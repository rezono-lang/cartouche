/**
 * Lightweight, Deterministic Svelte 5 + Happy-DOM + axe-core Test Harness.
 * Lets any Wave-1+ worker render a .svelte component in ~20ms in pure Node 22:
 *  - Strips <script lang="ts"> with Node 22 built-in module.stripTypeScriptTypes
 *  - Compiles .svelte with svelte/compiler (generate: 'server')
 *  - Rewrites relative imports to absolute file:// URLs for instant ESM loading
 *  - Parses HTML into Happy-DOM and runs WCAG 2.1 AA audits via axe-core
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { Window } from 'happy-dom';
import axe from 'axe-core';

const CACHE_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'cartouche-svelte-ssr');
fs.mkdirSync(CACHE_DIR, { recursive: true });

function preprocessTsScript(source) {
  return source.replace(/<script\b([^>]*)lang=["']ts["']([^>]*)>([\s\S]*?)<\/script>/gi, (_m, a, b, code) => {
    const stripped = stripTypeScriptTypes(code, { mode: 'strip' });
    return `<script${a}${b}>${stripped}</script>`;
  });
}

function compileSvelteToFile(svelteFilePath) {
  const absPath = path.resolve(svelteFilePath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const preprocessed = preprocessTsScript(raw);
  const compiled = compile(preprocessed, {
    filename: absPath,
    generate: 'server',
    css: 'injected'
  });
  const sourceDir = path.dirname(absPath);
  const rewritten = compiled.js.code.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_m, pre, spec, post) => {
    const resolved = path.resolve(sourceDir, spec);
    const target = resolved.endsWith('.svelte') ? compileSvelteToFile(resolved) : resolved;
    return `${pre}${pathToFileURL(target).href}${post}`;
  });
  const digest = crypto.createHash('sha256').update(rewritten).digest('hex').slice(0, 16);
  const outFile = path.join(CACHE_DIR, `${path.basename(absPath, '.svelte')}-${digest}.mjs`);
  if (!fs.existsSync(outFile)) {
    fs.writeFileSync(outFile, rewritten, 'utf8');
  }
  return outFile;
}

export async function loadSvelteComponent(svelteFilePath) {
  const outFile = compileSvelteToFile(svelteFilePath);
  const mod = await import(pathToFileURL(outFile).href);
  return mod.default;
}

export async function renderSvelte(svelteFilePath, props = {}) {
  const Component = await loadSvelteComponent(svelteFilePath);
  const out = render(Component, { props });
  const body = out.body ?? out.html ?? '';
  const head = out.head ?? '';
  return { html: body, head };
}

export function parseHtml(htmlFragment, { title = 'Cartouche Sheet', lang = 'en', theme = 'swisstopo' } = {}) {
  const win = new Window({ url: 'http://localhost/' });
  win.document.write(
    `<!DOCTYPE html><html lang="${lang}" data-cartouche-theme="${theme}"><head><meta charset="utf-8"><title>${title}</title></head><body><main>${htmlFragment}</main></body></html>`
  );
  win.document.close();
  return { window: win, document: win.document };
}

export async function auditA11y(htmlFragment, opts = {}) {
  const { window: win, document: doc } = parseHtml(htmlFragment, opts);
  try {
    // Run axe-core WCAG 2.1 AA structural/ARIA rules inside the Happy-DOM document.
    // color-contrast is disabled here because Happy-DOM does not compute CSS layout painting;
    // perceptual OKLCH contrast is mathematically verified in contract-freeze-guard.mjs.
    const results = await axe.run(doc.documentElement, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false } }
    });
    return results.violations;
  } finally {
    await win.happyDOM.close();
  }
}
