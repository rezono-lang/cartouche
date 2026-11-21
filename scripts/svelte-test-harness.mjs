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

const TOKENS_CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'contracts', 'std-view.v2.tokens.json'), 'utf8')
);

const NAMED_COLORS = {
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  red: [255, 0, 0, 1],
  green: [0, 128, 0, 1],
  blue: [0, 0, 255, 1],
  gray: [128, 128, 128, 1],
  grey: [128, 128, 128, 1],
  silver: [192, 192, 192, 1],
  maroon: [128, 0, 0, 1],
  purple: [128, 0, 128, 1],
  fuchsia: [255, 0, 255, 1],
  lime: [0, 255, 0, 1],
  olive: [128, 128, 0, 1],
  yellow: [255, 255, 0, 1],
  navy: [0, 0, 128, 1],
  teal: [0, 128, 128, 1],
  aqua: [0, 255, 255, 1],
  orange: [255, 165, 0, 1],
  rebeccapurple: [102, 51, 153, 1],
  transparent: [0, 0, 0, 0]
};

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function srgbToLinear(c255) {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb255(lin) {
  const c = clamp01(lin);
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(s) * 255);
}

function resolveCssVars(raw, vars, depth = 0) {
  if (!raw || depth > 8) return raw;
  return raw.replace(/var\(\s*(--[a-z0-9-_]+)\s*(?:,\s*([^)]+))?\)/gi, (_m, name, fallback) => {
    const val = vars.get(name);
    if (val !== undefined && val !== '') return resolveCssVars(val, vars, depth + 1);
    return fallback !== undefined ? resolveCssVars(fallback.trim(), vars, depth + 1) : '';
  });
}

function parseColor(raw, vars) {
  if (!raw) return null;
  const text = resolveCssVars(raw.trim(), vars).replace(/\s*!important$/i, '').trim().toLowerCase();
  if (!text || text === 'inherit' || text === 'initial' || text === 'unset' || text === 'currentcolor') {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, text)) {
    return NAMED_COLORS[text];
  }
  const hex3 = text.match(/^#([0-9a-f]{3,4})$/i);
  if (hex3) {
    const h = hex3[1];
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
    return [r, g, b, a];
  }
  const hex6 = text.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex6) {
    const r = parseInt(hex6[1].slice(0, 2), 16);
    const g = parseInt(hex6[1].slice(2, 4), 16);
    const b = parseInt(hex6[1].slice(4, 6), 16);
    const a = hex6[2] ? parseInt(hex6[2], 16) / 255 : 1;
    return [r, g, b, a];
  }
  const rgb = text.match(/^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (rgb) {
    const ch = (s) => (s.endsWith('%') ? (parseFloat(s) / 100) * 255 : parseFloat(s));
    const al = (s) => (s === undefined ? 1 : s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));
    return [ch(rgb[1]), ch(rgb[2]), ch(rgb[3]), clamp01(al(rgb[4]))];
  }
  const oklch = text.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (oklch) {
    const L = oklch[1].endsWith('%') ? parseFloat(oklch[1]) / 100 : parseFloat(oklch[1]);
    const C = parseFloat(oklch[2]);
    const h = (parseFloat(oklch[3]) * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rLin = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;
    const alpha = oklch[4] === undefined ? 1 : oklch[4].endsWith('%') ? parseFloat(oklch[4]) / 100 : parseFloat(oklch[4]);
    return [linearToSrgb255(rLin), linearToSrgb255(gLin), linearToSrgb255(bLin), clamp01(alpha)];
  }
  return null;
}

function compositeRgba(fg, bg) {
  const a = fg[3];
  if (a >= 1) return [fg[0], fg[1], fg[2], 1];
  if (a <= 0) return bg;
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1
  ];
}

function wcagLuminance(rgba) {
  return 0.2126 * srgbToLinear(rgba[0]) + 0.7152 * srgbToLinear(rgba[1]) + 0.0722 * srgbToLinear(rgba[2]);
}

function wcagContrastRatio(fg, bg) {
  const y1 = wcagLuminance(fg);
  const y2 = wcagLuminance(bg);
  const hi = Math.max(y1, y2);
  const lo = Math.min(y1, y2);
  return (hi + 0.05) / (lo + 0.05);
}

function parseDeclarations(cssText) {
  const decls = [];
  for (const part of cssText.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim();
    if (prop && val) decls.push([prop, val]);
  }
  return decls;
}

function extractCssRules(doc) {
  const rules = [];
  for (const styleEl of doc.querySelectorAll('style')) {
    const stripped = (styleEl.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Skip @media (forced-colors) or @keyframes blocks when auditing default screen contrast
    const withoutAtBlocks = stripped.replace(/@[a-z-]+[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(withoutAtBlocks)) !== null) {
      const selectors = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.includes(':hover') && !s.includes(':focus') && !s.includes('::'));
      const decls = parseDeclarations(m[2]);
      if (selectors.length > 0 && decls.length > 0) {
        rules.push({ selectors, decls });
      }
    }
  }
  return rules;
}

function safeMatches(el, selector) {
  try {
    return typeof el.matches === 'function' && el.matches(selector);
  } catch {
    return false;
  }
}

function extractBackgroundToken(val) {
  // Handle shorthand `background: #fff` or `background: var(--c-paper)` while skipping gradients/images
  if (/gradient\(|url\(/i.test(val)) return null;
  const tokens = val.match(/oklch\([^)]+\)|rgba?\([^)]+\)|var\([^)]+\)|#[0-9a-f]{3,8}\b|\b[a-z]+\b/gi) ?? [];
  for (const tok of tokens) {
    if (/^(none|no-repeat|repeat|center|top|bottom|left|right|cover|contain|scroll|fixed|border-box|padding-box)$/i.test(tok)) {
      continue;
    }
    return tok;
  }
  return null;
}

function auditDomColorContrast(doc, theme = 'swisstopo') {
  const violations = [];
  const rules = extractCssRules(doc);
  const baseVars = new Map();
  const paletteSpec = TOKENS_CONTRACT.palettes?.[theme] ?? TOKENS_CONTRACT.palettes?.swisstopo;
  if (paletteSpec?.tokens && TOKENS_CONTRACT.css_vars) {
    for (const [tokenKey, varName] of Object.entries(TOKENS_CONTRACT.css_vars)) {
      if (paletteSpec.tokens[tokenKey]) baseVars.set(varName, paletteSpec.tokens[tokenKey]);
    }
  }

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'SVG', 'PATH', 'DEFS']);

  function walk(el, inheritedFg, inheritedBg, inheritedVars, inheritedFontSize, inheritedBold) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return;

    const vars = new Map(inheritedVars);
    const props = new Map();
    for (const rule of rules) {
      if (rule.selectors.some((sel) => safeMatches(el, sel))) {
        for (const [p, v] of rule.decls) {
          if (p.startsWith('--')) vars.set(p, v);
          else props.set(p, v);
        }
      }
    }
    const inline = el.getAttribute('style');
    if (inline) {
      for (const [p, v] of parseDeclarations(inline)) {
        if (p.startsWith('--')) vars.set(p, v);
        else props.set(p, v);
      }
    }

    const display = (props.get('display') ?? '').toLowerCase();
    const visibility = (props.get('visibility') ?? '').toLowerCase();
    if (display === 'none' || visibility === 'hidden') return;
    if (/\b(sr-only|visually-hidden)\b/.test(el.getAttribute('class') ?? '')) return;

    let fg = inheritedFg;
    let bg = inheritedBg;
    let unparseableFg = null;

    if (props.has('color')) {
      const rawFg = props.get('color');
      const parsed = parseColor(rawFg, vars);
      if (parsed) fg = compositeRgba(parsed, bg);
      else if (rawFg && !/^(inherit|initial|unset|currentcolor)$/i.test(rawFg.trim())) {
        unparseableFg = rawFg;
      }
    }
    if (props.has('background-color')) {
      const parsed = parseColor(props.get('background-color'), vars);
      if (parsed) bg = compositeRgba(parsed, bg);
    } else if (props.has('background')) {
      const tok = extractBackgroundToken(props.get('background'));
      const parsed = tok ? parseColor(tok, vars) : null;
      if (parsed) bg = compositeRgba(parsed, bg);
    }

    let fontSize = inheritedFontSize;
    if (props.has('font-size')) {
      const fsRaw = resolveCssVars(props.get('font-size'), vars);
      const pxMatch = fsRaw.match(/^([\d.]+)px$/i);
      const remMatch = fsRaw.match(/^([\d.]+)rem$/i);
      if (pxMatch) fontSize = parseFloat(pxMatch[1]);
      else if (remMatch) fontSize = parseFloat(remMatch[1]) * 16;
    }
    let isBold = inheritedBold;
    if (props.has('font-weight')) {
      const fw = props.get('font-weight').toLowerCase();
      isBold = fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 700;
    }

    const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
    if (hasDirectText) {
      if (unparseableFg !== null) {
        violations.push({
          id: 'color-contrast',
          impact: 'serious',
          description: `Unable to decide WCAG 2.1 AA color contrast for unparseable foreground "${unparseableFg}" on <${el.tagName.toLowerCase()}>`,
          nodes: [{ html: el.outerHTML.slice(0, 160) }]
        });
      } else {
        const isLarge = fontSize >= 24 || (isBold && fontSize >= 18.66);
        const minRatio = isLarge ? 3.0 : 4.5;
        const r = wcagContrastRatio(fg, bg);
        if (r < minRatio) {
          violations.push({
            id: 'color-contrast',
            impact: 'serious',
            description: `Element <${el.tagName.toLowerCase()}> has contrast ratio ${r.toFixed(2)}:1 (requires >= ${minRatio}:1)`,
            nodes: [{ html: el.outerHTML.slice(0, 160) }]
          });
        }
      }
    }

    for (const child of el.children) {
      walk(child, fg, bg, vars, fontSize, isBold);
    }
  }

  const defaultFg = [0, 0, 0, 1];
  const defaultBg = [255, 255, 255, 1];
  if (doc.body) {
    walk(doc.body, defaultFg, defaultBg, baseVars, 16, false);
  }
  return violations;
}

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
    // Run axe-core WCAG 2.1 AA rules + deterministic DOM WCAG 2.1 AA color-contrast evaluator
    // (Happy-DOM cannot paint pixels, so axe-core reports color-contrast as "incomplete";
    // auditDomColorContrast resolves CSS rules, custom properties, OKLCH/RGB/hex colors and
    // decides every visible text node so low-contrast text is never silently passed as incomplete.)
    const results = await axe.run(doc.documentElement, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
    const contrastViolations = auditDomColorContrast(doc, opts.theme ?? 'swisstopo');
    return [...results.violations, ...contrastViolations];
  } finally {
    await win.happyDOM.close();
  }
}
