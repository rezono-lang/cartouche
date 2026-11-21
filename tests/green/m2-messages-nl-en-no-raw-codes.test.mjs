import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { formatReasonLabel } from '../../packages/atlas/src/i18n-mf2.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §7, issue #23 §5, issue #46 item 13.
// Every visible label, reason, heading, table header, and aria-label on every sheet and the slip must come from
// Rezono MF2 messages in the chosen locale (nl / en); raw snake_case codes stay in data-reason and never reach users.

const ROOT = process.cwd();
const M = DATA_MARKS;
const SNAKE_CASE_CODE_RE = /^[a-z]+(_[a-z0-9]+)+$/;
const loadFx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

const SHEETS = [
  { name: 'relief', file: 'packages/atlas/src/Relief3DSheet.svelte', fixture: '04-subsidy-a001-a003.json' },
  { name: 'flow', file: 'packages/atlas/src/FlowSplitSheet.svelte', fixture: '01-platform-drift.json' },
  { name: 'kringstand', file: 'packages/atlas/src/KringstandSheet.svelte', fixture: '03-kring-m1-to-m5-live.json' },
  { name: 'ripple', file: 'packages/atlas/src/CausalRippleSheet.svelte', fixture: '06-keycloak-dense-28.json' },
  { name: 'bitemporal', file: 'packages/atlas/src/BitemporalStairSheet.svelte', fixture: '05-subsidy-bitemporal.json' },
  { name: 'monge', file: 'packages/atlas/src/MongeFoldingSheet.svelte', fixture: '08-monge-4d-audit.json' }
];

function collectVisibleTextSegments(doc) {
  const out = [];
  const skipTags = new Set(['STYLE', 'SCRIPT']);
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 1) {
      if (skipTags.has(node.tagName)) return;
      if (node.getAttribute('aria-hidden') === 'true') return;
      if (node.getAttribute(M.part) === 'manifest-hash') return;
      for (const child of node.childNodes) walk(child);
    } else if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (parent && parent.closest('code')) return;
      const trimmed = (node.textContent ?? '').trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
  };
  walk(doc.body);
  return out;
}

test('M2 [messages-nl-en-no-raw-codes]: every sheet and slip renders with lang="nl" and lang="en" and localizes visible UI text', async () => {
  for (const sheet of SHEETS) {
    const abs = path.join(ROOT, sheet.file);
    const fx = loadFx(sheet.fixture);
    const en = await renderSvelte(abs, { fixture: fx, theme: 'swisstopo', lang: 'en' });
    const nl = await renderSvelte(abs, { fixture: fx, theme: 'swisstopo', lang: 'nl' });
    const dEn = parseHtml(en.html);
    const dNl = parseHtml(nl.html);
    try {
      const rootEn = dEn.document.querySelector(`[${M.sheet}]`);
      const rootNl = dNl.document.querySelector(`[${M.sheet}]`);
      assert.ok(rootEn && rootNl, `${sheet.name}: expected root [${M.sheet}]`);
      assert.equal(rootEn.getAttribute('lang'), 'en', `${sheet.name}: root must carry lang="en"`);
      assert.equal(rootNl.getAttribute('lang'), 'nl', `${sheet.name}: root must carry lang="nl"`);
      assert.notEqual(
        collectVisibleTextSegments(dNl.document).join(' '),
        collectVisibleTextSegments(dEn.document).join(' '),
        `${sheet.name}: lang="nl" must localize visible text instead of repeating English`
      );
    } finally {
      await dEn.window.happyDOM.close();
      await dNl.window.happyDOM.close();
    }
  }

  const slipEn = await renderSlip({ fixture: 'fixtures/10-slip-reader-answers.json', store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const slipNl = await renderSlip({ fixture: 'fixtures/10-slip-reader-answers.json', store: 'main', role: 'reader', pack: 'slip', lang: 'nl' });
  const sdEn = parseHtml(slipEn.html);
  const sdNl = parseHtml(slipNl.html);
  try {
    assert.ok(sdEn.document.querySelector('[lang="en"]'), 'slip lang="en" must carry lang="en"');
    assert.ok(sdNl.document.querySelector('[lang="nl"]'), 'slip lang="nl" must carry lang="nl"');
  } finally {
    await sdEn.window.happyDOM.close();
    await sdNl.window.happyDOM.close();
  }
});

test('M2 [messages-nl-en-no-raw-codes]: no visible text node exposes a raw snake_case code while data-reason keeps the code', async () => {
  for (const sheet of SHEETS) {
    const abs = path.join(ROOT, sheet.file);
    const fx = loadFx(sheet.fixture);
    for (const lang of ['en', 'nl']) {
      const { html } = await renderSvelte(abs, { fixture: fx, theme: 'swisstopo', lang });
      const { window: win, document: doc } = parseHtml(html);
      try {
        const segments = collectVisibleTextSegments(doc);
        const rawCodes = segments.filter((s) => SNAKE_CASE_CODE_RE.test(s));
        assert.deepEqual(
          rawCodes,
          [],
          `${sheet.name} (${lang}): visible text must contain zero raw snake_case codes, found ${JSON.stringify(rawCodes)}`
        );
      } finally {
        await win.happyDOM.close();
      }
    }
  }

  // Slip rendered from fixture 10 must also expose zero raw snake_case codes (including propose lock reason).
  for (const lang of ['en', 'nl']) {
    const res = await renderSlip({ fixture: 'fixtures/10-slip-reader-answers.json', store: 'main', role: 'reader', pack: 'slip', lang });
    const { window: win, document: doc } = parseHtml(res.html);
    try {
      const segments = collectVisibleTextSegments(doc);
      const rawCodes = segments
        .flatMap((s) => s.split(/[\s:·,()]+/))
        .filter((tok) => SNAKE_CASE_CODE_RE.test(tok));
      assert.deepEqual(
        rawCodes,
        [],
        `slip (${lang}): visible text must contain zero raw snake_case codes, found ${JSON.stringify(rawCodes)}`
      );
      assert.ok(doc.querySelector(`[${M.reason}]`), `slip (${lang}): data-reason must still preserve the canonical code`);
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('M2 [messages-nl-en-no-raw-codes]: an unmapped reason code uses an MF2 fallback message and never shows the raw code', async () => {
  const unmapped = 'custom_untranslated_reason_code';
  const enFallback = formatReasonLabel('en', unmapped);
  const nlFallback = formatReasonLabel('nl', unmapped);
  for (const [lang, formatted] of [['en', enFallback], ['nl', nlFallback]]) {
    assert.ok(formatted.trim().length > 0, `fallback message (${lang}) must be non-empty`);
    assert.equal(formatted.includes(unmapped), false, `fallback (${lang}) must never show raw code "${unmapped}"`);
    assert.equal(SNAKE_CASE_CODE_RE.test(formatted.trim()), false, `fallback (${lang}) must not be snake_case`);
    assert.equal(formatted.toLowerCase().includes('untranslated'), false, `fallback (${lang}) must be an MF2 fallback message, not mechanical underscore-to-space expansion of the raw code`);
  }
  assert.notEqual(nlFallback, enFallback, 'nl and en MF2 fallback messages must be localized');

  const fx = loadFx('05-subsidy-bitemporal.json');
  const unk = fx.bitemporal_grid.matrix.flat().find((c) => c.state === 'unknown');
  assert.ok(unk);
  unk.reason = unmapped;
  const { html } = await renderSvelte(path.join(ROOT, 'packages/atlas/src/BitemporalStairSheet.svelte'), {
    fixture: fx,
    theme: 'swisstopo',
    lang: 'nl'
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    assert.ok(doc.querySelector(`[${M.reason}="${unmapped}"]`), 'data-reason must preserve the canonical code');
    const visible = collectVisibleTextSegments(doc).join(' ');
    assert.equal(visible.includes(unmapped), false, 'rendered sheet must never show the unmapped snake_case code in visible text');
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [messages-nl-en-no-raw-codes]: sheet markup has no untranslated English <th> or [aria-label] literals in lang="nl"', async () => {
  for (const sheet of SHEETS) {
    const abs = path.join(ROOT, sheet.file);
    const fx = loadFx(sheet.fixture);
    const en = await renderSvelte(abs, { fixture: fx, theme: 'swisstopo', lang: 'en' });
    const nl = await renderSvelte(abs, { fixture: fx, theme: 'swisstopo', lang: 'nl' });
    const dEn = parseHtml(en.html);
    const dNl = parseHtml(nl.html);
    try {
      const thEn = [...dEn.document.querySelectorAll('thead th')].map((el) => el.textContent.trim()).filter(Boolean);
      const thNl = [...dNl.document.querySelectorAll('thead th')].map((el) => el.textContent.trim()).filter(Boolean);
      assert.ok(thEn.length > 0 && thNl.length > 0, `${sheet.name}: expected table headers`);
      assert.notDeepEqual(thNl, thEn, `${sheet.name}: Dutch <th> headers must be localized via MF2, not hardcoded English`);

      const ariaEn = [...dEn.document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label')?.trim() ?? '').filter(Boolean);
      const ariaNl = [...dNl.document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label')?.trim() ?? '').filter(Boolean);
      assert.ok(ariaEn.length > 0 && ariaNl.length > 0, `${sheet.name}: expected aria-label attributes`);
      assert.notDeepEqual(ariaNl, ariaEn, `${sheet.name}: Dutch [aria-label] attributes must be localized via MF2, not hardcoded English`);
    } finally {
      await dEn.window.happyDOM.close();
      await dNl.window.happyDOM.close();
    }
  }
});
