import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M, asOpaqueCell, renderFigure } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Green on arrival (Decision 0012 §2): written red against 8b3c96d, where it failed for the reason below;
// the M4 work of #30 to #33 made it pass. It stays as an independent check of that fix.

// Decision 0012 §2 (6f), issue #23 §1: renderFigure emits the sign values "hatch" and "replaced", which std-view does
// not define. A sign the key does not define cannot be explained by the legend, so it is not drawn.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);
const SIGN_VALUES = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'data-marks.json'), 'utf8')).attributes.sign.values);

test('M1 [signs-only-from-contract]: renderFigure emits only contract signs for unknown, absent and a fold', () => {
  const cells = [
    { state: 'unknown', display: null, reason: 'not_received', proof_ref: 'p:u' },
    { state: 'absent', display: null, proof_ref: 'p:a', completeness_witness_ref: 'sweep:p' },
    { state: 'known', display: 'twenty', previous_display: 'twelve', proof_ref: 'p:k' }
  ];
  for (const raw of cells) {
    const sign = renderFigure(asOpaqueCell(raw)).attrs['data-sign'];
    if (sign !== undefined) assert.ok(SIGN_VALUES.has(sign), `renderFigure(${raw.state}) emits data-sign="${sign}", not in contracts/data-marks.json`);
  }
});

const SHEETS = [
  { name: 'flow-split 01', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('01-platform-drift.json') }) },
  { name: 'kringstand 03', file: 'KringstandSheet.svelte', props: () => ({ fixture: fx('03-kring-m1-to-m5-live.json') }) },
  { name: 'relief-3d 04', file: 'Relief3DSheet.svelte', props: () => ({ fixture: fx('04-subsidy-a001-a003.json') }) },
  { name: 'bitemporal-stair 05', file: 'BitemporalStairSheet.svelte', props: () => ({ fixture: fx('05-subsidy-bitemporal.json') }) },
  { name: 'causal-ripple 06', file: 'CausalRippleSheet.svelte', props: () => ({ fixture: fx('06-keycloak-dense-28.json') }) },
  { name: 'monge-fold 08', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 0 }) }
];

async function drawnSigns(html) {
  const { window, document } = parseHtml(html);
  try {
    return [...document.querySelectorAll(`[${M.sign}]`)].map((el) => el.getAttribute(M.sign));
  } finally {
    await window.happyDOM.close();
  }
}

for (const sheet of SHEETS) {
  test(`M1 [signs-only-from-contract]: ${sheet.name} draws only contract signs`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const outside = (await drawnSigns(html)).filter((s) => !SIGN_VALUES.has(s));
    assert.deepEqual([...new Set(outside)], [], `${sheet.name}: data-sign values outside the contract`);
  });
}

test('M1 [signs-only-from-contract]: the slip draws only contract signs from the recorded reader answers', async () => {
  const res = await render({ fixture: 'fixtures/10-slip-reader-answers.json', role: 'reader', pack: 'slip', lang: 'en' });
  const outside = (await drawnSigns(res.html)).filter((s) => !SIGN_VALUES.has(s));
  assert.deepEqual([...new Set(outside)], [], 'slip: data-sign values outside the contract');
});
