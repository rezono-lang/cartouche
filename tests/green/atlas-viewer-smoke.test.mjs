import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/data-marks.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps', 'atlas-viewer', 'src', 'App.svelte');
const M = DATA_MARKS;

test('Atlas Viewer: mounts all 6 sheets, @rezono/slip (served + 410 unserved), and Typst export with 0 WCAG 2.1 AA axe violations (incl. color-contrast)', async () => {
  const cases = [
    { name: '01 relief', props: { initialTab: 'relief' }, selector: `[${M.sheet}="relief-3d"]` },
    { name: '02 flow full', props: { initialTab: 'flow', initialFlowRole: 'full' }, selector: `[${M.sheet}="flow-split"]` },
    { name: '02 flow restricted', props: { initialTab: 'flow', initialFlowRole: 'restricted' }, selector: `[${M.sheet}="flow-split"]` },
    { name: '03 kringstand', props: { initialTab: 'kringstand' }, selector: `[${M.sheet}="kringstand"]` },
    { name: '04 causal ripple', props: { initialTab: 'ripple' }, selector: `[${M.sheet}="causal-ripple"]` },
    { name: '05 bitemporal', props: { initialTab: 'bitemporal' }, selector: `[${M.sheet}="bitemporal-stair"]` },
    { name: '06 monge fold', props: { initialTab: 'monge' }, selector: `[${M.sheet}="monge-fold"]` },
    { name: 'slip served', props: { initialTab: 'slip', initialSlipUnserved: false }, selector: `table[${M.sheet}="slip"]` },
    { name: 'slip 410 unserved', props: { initialTab: 'slip', initialSlipUnserved: true }, selector: `[${M.part}="unserved"]` },
    { name: 'typst export', props: { initialTab: 'typst', initialTypstSheet: 'monge' }, selector: 'pre code' }
  ];

  for (const tc of cases) {
    const { html } = await renderSvelte(APP, tc.props);
    const { window: win, document: doc } = parseHtml(html);
    try {
      assert.ok(doc.querySelector(tc.selector), `${tc.name}: expected ${tc.selector}`);
      if (tc.name === 'typst export') {
        const typ = doc.querySelector('pre code')?.textContent ?? '';
        assert.ok(typ.includes('#set document(') && typ.includes('date: none'));
      }
      if (tc.name === '02 flow restricted') {
        assert.equal(html.includes('svc-vault'), false, 'restricted role view must leak zero hidden entities');
      }
    } finally {
      await win.happyDOM.close();
    }
    const violations = await auditA11y(html);
    assert.deepEqual(violations, [], `${tc.name}: axe WCAG 2.1 AA violations: ${JSON.stringify(violations)}`);
  }
});

test('Atlas Viewer: palette switcher (swisstopo, obsidian, forced) and locale switcher (en, nl) pass axe & keep browser bundle pure', async () => {
  for (const theme of ['swisstopo', 'obsidian', 'forced']) {
    const { html } = await renderSvelte(APP, { initialTab: 'relief', initialTheme: theme });
    const { window: win, document: doc } = parseHtml(html, { theme });
    try {
      assert.ok(doc.querySelector(`[${M.theme}="${theme}"]`), `expected theme ${theme}`);
    } finally {
      await win.happyDOM.close();
    }
    assert.deepEqual(await auditA11y(html, { theme }), [], `axe clean in theme ${theme}`);
  }

  const { html: nlHtml } = await renderSvelte(APP, { initialTab: 'relief', initialLocale: 'nl' });
  assert.ok(nlHtml.includes('Orthografisch Reliëf'), 'Dutch locale must localize relief sheet heading');

  // Verify zero Node builtins, zero bin/render.ts, and zero model.ts imports in browser viewer sources
  const srcDir = path.join(ROOT, 'apps', 'atlas-viewer', 'src');
  for (const file of fs.readdirSync(srcDir)) {
    const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    assert.equal(/from\s+['"]node:/.test(content), false, `${file} must not import node:* builtins`);
    assert.equal(/slip\/bin\//.test(content), false, `${file} must not import packages/slip/bin/*`);
    assert.equal(/slip\/src\/model\.ts/.test(content), false, `${file} must not import build-time model.ts`);
  }
});
