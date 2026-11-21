import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { REQUIRED_PALETTES, renderSpecimenHtml } from '../../packages/atlas/src/specimen.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §7. Rezono's packs/std-view/key.yaml: hatch: {color_role: status.unknown, spacing: 6, angle: 45,
// width: 1}. Today sheets define their own patterns (cartouche-hatch-45, relief-unknown-hatch, bt-hatch, monge-hatch)
// with different geometry. Pattern ids may stay (green tests name some); the geometry is one.

const ROOT = process.cwd();
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

const SHEETS_WITH_UNKNOWN = [
  { name: 'relief', component: 'packages/atlas/src/Relief3DSheet.svelte', props: () => ({ fixture: readFixture('04-subsidy-a001-a003.json'), projection: 'orthographic' }) },
  { name: 'flow', component: 'packages/atlas/src/FlowSplitSheet.svelte', props: () => ({ fixture: readFixture('01-platform-drift.json') }) },
  { name: 'ripple', component: 'packages/atlas/src/CausalRippleSheet.svelte', props: () => ({ fixture: readFixture('06-keycloak-dense-28.json') }) },
  { name: 'bitemporal', component: 'packages/atlas/src/BitemporalStairSheet.svelte', props: () => ({ fixture: readFixture('05-subsidy-bitemporal.json'), view: 'orthographic' }) },
  { name: 'monge', component: 'packages/atlas/src/MongeFoldingSheet.svelte', props: () => ({ fixture: readFixture('08-monge-4d-audit.json'), foldAngleDeg: 40 }) }
];

const CSS_HATCH_RE = /repeating-linear-gradient\(\s*45deg\b[^)]*var\(--c-hatch\)/i;

test('M2 [hatch-signature]: every SVG unknown pattern uses canonical 6x6 / rotate(45) / stroke-width 1 / var(--c-hatch)', async () => {
  for (const sheet of SHEETS_WITH_UNKNOWN) {
    const { html } = await renderSvelte(path.join(ROOT, sheet.component), sheet.props());
    const { window: win, document: doc } = parseHtml(html);
    try {
      const patterns = [...doc.querySelectorAll('svg pattern')];
      assert.ok(patterns.length > 0, `${sheet.name}: expected at least one SVG <pattern> for unknown marks`);

      for (const pat of patterns) {
        const id = pat.getAttribute('id') ?? '(no-id)';
        assert.equal(pat.getAttribute('width'), '6', `${sheet.name} pattern#${id}: width must be 6`);
        assert.equal(pat.getAttribute('height'), '6', `${sheet.name} pattern#${id}: height must be 6`);
        assert.equal(
          (pat.getAttribute('patternTransform') ?? '').replace(/\s+/g, ''),
          'rotate(45)',
          `${sheet.name} pattern#${id}: patternTransform must be rotate(45)`
        );
        const lines = [...pat.querySelectorAll('line')];
        assert.equal(lines.length, 1, `${sheet.name} pattern#${id}: must contain exactly one <line>`);
        assert.equal(
          lines[0].getAttribute('stroke-width'),
          '1',
          `${sheet.name} pattern#${id}: line stroke-width must be 1`
        );
        assert.equal(
          lines[0].getAttribute('stroke'),
          'var(--c-hatch)',
          `${sheet.name} pattern#${id}: line stroke must be var(--c-hatch)`
        );
      }
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('M2 [hatch-signature]: HTML unknown marks in sheets and slip use CSS hatch with var(--c-hatch) next to the ▨ glyph', async () => {
  // Check HTML twin cells in BitemporalStairSheet (2D) & Relief3DSheet
  const htmlSheets = [
    { name: 'bitemporal-2d', component: 'packages/atlas/src/BitemporalStairSheet.svelte', props: () => ({ fixture: readFixture('05-subsidy-bitemporal.json'), view: '2d' }) },
    { name: 'relief', component: 'packages/atlas/src/Relief3DSheet.svelte', props: () => ({ fixture: readFixture('04-subsidy-a001-a003.json'), projection: 'orthographic' }) }
  ];

  for (const sheet of htmlSheets) {
    const { html, head, css } = await renderSvelte(path.join(ROOT, sheet.component), sheet.props());
    const cssText = typeof css === 'string' ? css : css?.code ?? '';
    const combinedStyles = `${cssText}\n${head ?? ''}\n${html}`;
    assert.match(
      combinedStyles,
      CSS_HATCH_RE,
      `${sheet.name}: expected CSS hatch repeating-linear-gradient(45deg, ... var(--c-hatch)) for unknown HTML marks`
    );
    const { window: win, document: doc } = parseHtml(html);
    try {
      const unknownCells = [...doc.querySelectorAll(`td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="unknown"]`)];
      assert.ok(unknownCells.length > 0, `${sheet.name}: expected unknown HTML value cells`);
      for (const td of unknownCells) {
        assert.ok(
          (td.textContent ?? '').includes(SIGNS.unknown.glyph),
          `${sheet.name}: unknown HTML cell must display ${SIGNS.unknown.glyph} glyph`
        );
      }
    } finally {
      await win.happyDOM.close();
    }
  }

  // Check @rezono/slip unknown cell
  const fx10 = readFixture('10-slip-reader-answers.json');
  const slipRes = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'calc__capped_amount', key: ['item-c', '', 'unknown', 'fact recorded_amount.amount is missing'] }
  });
  assert.match(
    slipRes.html,
    CSS_HATCH_RE,
    'slip: unknown HTML cells must include CSS hatch repeating-linear-gradient(45deg, ... var(--c-hatch))'
  );
});

test('M2 [hatch-signature]: specimen renders the unknown hatch once per palette, and non-unknown marks never use hatch', async () => {
  for (const palette of REQUIRED_PALETTES) {
    const html = renderSpecimenHtml(palette);
    const { window: win, document: doc } = parseHtml(html);
    try {
      const unknownRow = doc.querySelector(`tr[${DATA_MARKS.sign}="unknown"]`);
      assert.ok(unknownRow, `specimen (${palette}): expected tr[data-sign="unknown"]`);
      const unknownMarkup = unknownRow.outerHTML;
      assert.ok(
        CSS_HATCH_RE.test(unknownMarkup) || /patternTransform="rotate\(45\)"/.test(unknownMarkup),
        `specimen (${palette}): tr[data-sign="unknown"] must render the canonical hatch signature`
      );

      const nonUnknownRows = [...doc.querySelectorAll(`tr[${DATA_MARKS.sign}]:not([${DATA_MARKS.sign}="unknown"])`)];
      assert.ok(nonUnknownRows.length > 0);
      for (const row of nonUnknownRows) {
        assert.equal(
          CSS_HATCH_RE.test(row.outerHTML) || row.outerHTML.includes('url(#'),
          false,
          `specimen (${palette}): non-unknown row ${row.getAttribute(DATA_MARKS.sign)} must never use the hatch`
        );
      }
    } finally {
      await win.happyDOM.close();
    }
  }

  // Across sheets, no non-unknown SVG mark may fill with a hatch pattern
  for (const sheet of SHEETS_WITH_UNKNOWN) {
    const { html } = await renderSvelte(path.join(ROOT, sheet.component), sheet.props());
    const { window: win, document: doc } = parseHtml(html);
    try {
      const hatchFills = [...doc.querySelectorAll('svg [fill*="hatch"]')];
      for (const el of hatchFills) {
        const owner = el.closest(`[${DATA_MARKS.state}], [${DATA_MARKS.sign}]`);
        const isUnknown =
          owner?.getAttribute(DATA_MARKS.state) === 'unknown' ||
          owner?.getAttribute(DATA_MARKS.sign) === 'unknown';
        assert.ok(
          isUnknown,
          `${sheet.name}: non-unknown SVG element filled with hatch (${owner?.outerHTML?.slice(0, 120) ?? el.outerHTML.slice(0, 120)})`
        );
      }
    } finally {
      await win.happyDOM.close();
    }
  }
});
