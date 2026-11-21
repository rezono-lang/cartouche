import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import {
  buildReliefModel,
  renderRelief2DProfileSvg,
  renderReliefOrthographicSvg
} from '../../packages/atlas/src/relief-model.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const RELIEF_SVELTE = path.join(ROOT, 'packages', 'atlas', 'src', 'StatutoryRelief3D.svelte');
const M = DATA_MARKS;

function loadFixture04() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '04-subsidy-a001-a003.json'), 'utf8'));
}

function assertLegendCoversAllDrawnSigns(doc) {
  const legend = doc.querySelector(`table[${M.part}="legend"]`);
  assert.ok(legend, 'expected table[data-part="legend"]');
  assert.ok(legend.querySelector('th'), 'legend table must include <th> headers');
  const listed = new Set([...legend.querySelectorAll(`tr[${M.sign}]`)].map((tr) => tr.getAttribute(M.sign)));
  const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((el) => !el.closest(`table[${M.part}="legend"]`));
  assert.ok(drawn.length > 0, 'expected drawn [data-sign] marks');
  for (const el of drawn) {
    const sign = el.getAttribute(M.sign);
    assert.ok(listed.has(sign), `drawn sign "${sign}" missing from table[data-part="legend"]`);
  }
}

function assertAllTablesHaveHeaders(doc) {
  for (const table of doc.querySelectorAll('table')) {
    assert.ok(table.querySelector('th'), 'every rendered table must include at least one <th> header cell');
  }
}

test('M2: Sheet 01 renders orthographic Swisstopo 3D terrain, cliff markers, hatched A003 curtain (never z=0), twin, legend & 0 WCAG 2.1 AA violations', async () => {
  const fx = loadFixture04();
  const model = buildReliefModel(fx, { theme: 'swisstopo', projection: 'orthographic' });

  // Headless Threlte v8 / Three.js orthographic scene spec (zero WebGL needed)
  assert.equal(model.threlteScene.camera.cameraType, 'OrthographicCamera');
  assert.equal(model.threlteScene.camera.projection, 'orthographic');
  assert.equal(model.threlteScene.terraces.length, fx.sweep_2d.cells.length);
  assert.equal(model.threlteScene.curtains.length, 1);
  assert.equal(model.curtains[0].subjectId, 'A003');
  assert.equal(model.curtains[0].zFloorZeroForbidden, true);
  assert.equal(model.curtains[0].zMin, 0);
  assert.equal(model.curtains[0].zMax, 1);

  const { html } = await renderSvelte(RELIEF_SVELTE, {
    fixture: fx,
    theme: 'swisstopo',
    projection: 'orthographic'
  });
  const { html: htmlRepeat } = await renderSvelte(RELIEF_SVELTE, {
    fixture: fx,
    theme: 'swisstopo',
    projection: 'orthographic'
  });
  assert.equal(html, htmlRepeat, 'relief-3d rendering must be byte-for-byte deterministic');

  const { window: win, document: doc } = parseHtml(html);
  try {
    const root = doc.querySelector(`section[${M.sheet}="relief-3d"]`);
    assert.ok(root, 'expected section[data-sheet="relief-3d"]');
    assert.equal(root.getAttribute(M.projection), 'orthographic');
    assert.equal(root.getAttribute(M.theme), 'swisstopo');
    assert.equal(root.getAttribute(M.trust_tier), 'sealed');

    // Honest seal check (no fabricated reader-hashes/publisher-record)
    const seal = doc.querySelector(`[${M.part}="seal"]`);
    assert.ok(seal, 'expected [data-part="seal"]');
    assert.equal(seal.querySelector(`[${M.part}="manifest-hash"]`)?.textContent, fx.manifest.id);
    const checks = [...seal.querySelectorAll(`[${M.check}]`)];
    assert.deepEqual(
      checks.map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)]),
      [['witness', 'green']]
    );

    // Orthographic SVG marks
    const svg = doc.querySelector(`svg[${M.sheet}="relief-3d"][${M.projection}="orthographic"]`);
    assert.ok(svg, 'expected orthographic SVG');
    assert.ok(svg.querySelector('pattern#relief-unknown-hatch'), 'expected 45-deg hatch pattern for unknown curtain');

    const svgMarks = [...svg.querySelectorAll(`[${M.proof_ref}]`)];
    assert.equal(svgMarks.length, fx.sweep_2d.cells.length + 1, '5 grid terraces + 1 curtain carry published proofs');

    // Cliff distance marker for A001 displays published cliff text without borrowing amountCell.proofRef
    const cliffMark = svg.querySelector(`g[${M.key}="cliff:A001"][${M.sign}="legislator"]`);
    assert.ok(cliffMark, 'expected cliff distance marker for A001');
    assert.equal(
      cliffMark.getAttribute(M.proof_ref),
      null,
      'must not borrow amountCell.proofRef when fixture publishes no dedicated cliff proof_ref'
    );
    assert.ok(cliffMark.textContent.includes(fx.subjects[0].cliff_distance_display));

    // Hatched A003 unknown curtain carries proof, reason, sign, and zero ASCII digits
    const curtainSvg = svg.querySelector(`g[${M.part}="curtain"][${M.sign}="unknown"][${M.state}="unknown"]`);
    assert.ok(curtainSvg, 'expected SVG uncertainty curtain for A003');
    assert.equal(curtainSvg.getAttribute(M.reason), 'income_statement_not_received');
    assert.equal(curtainSvg.getAttribute(M.proof_ref), 'witness:sub-A003-missing');
    assert.equal(/[0-9]/.test(curtainSvg.textContent), false, 'SVG unknown curtain text must contain 0 ASCII digits');

    // Synchronized HTML Table Twin
    const twins = [...doc.querySelectorAll(`table[${M.part}="twin"]`)];
    assert.equal(twins.length, 2, 'expected subject twin + sweep grid twin');
    const a001Row = twins[0].querySelector(`tr[${M.key}="A001"]`);
    assert.ok(a001Row?.textContent.includes('€ 2.694'));
    assert.ok(a001Row?.textContent.includes('€ 2.000 to Art. 5 cliff'));
    assert.ok(a001Row?.textContent.includes(fx.subjects[0].citation));

    const a003Val = twins[0].querySelector(`tr[${M.key}="A003"] td[${M.part}="value"][${M.state}="unknown"]`);
    assert.ok(a003Val, 'expected A003 unknown value cell in Table Twin');
    assert.equal(a003Val.getAttribute(M.reason), 'income_statement_not_received');
    assert.equal(a003Val.getAttribute(M.proof_ref), 'witness:sub-A003-missing');
    assert.ok(a003Val.querySelector(`[${M.sign}="unknown"]`));
    assert.equal(/[0-9]/.test(a003Val.textContent), false, 'A003 unknown twin cell must contain 0 ASCII digits');

    assertAllTablesHaveHeaders(doc);
    assertLegendCoversAllDrawnSigns(doc);
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(html), [], 'Sheet 01 orthographic 3D view must have 0 WCAG 2.1 AA violations');
});

test('M2: Sheet 01 collapses cleanly to 2D profile fallback and collapses A003 curtain when server resolves unknown', async () => {
  const fx = loadFixture04();
  const { html: html2d } = await renderSvelte(RELIEF_SVELTE, {
    fixture: fx,
    theme: 'obsidian',
    projection: '2d',
    sliceYIndex: 1
  });

  const { window: win2d, document: doc2d } = parseHtml(html2d, { theme: 'obsidian' });
  try {
    const root = doc2d.querySelector(`section[${M.sheet}="relief-3d"]`);
    assert.equal(root?.getAttribute(M.projection), '2d');
    assert.equal(root?.getAttribute(M.theme), 'obsidian');

    const toggleBtn = doc2d.querySelector(`button[${M.key}="toggle-projection"]`);
    assert.equal(toggleBtn?.getAttribute('aria-pressed'), 'true');

    const svg2d = doc2d.querySelector(`svg[${M.sheet}="relief-3d"][${M.projection}="2d"]`);
    assert.ok(svg2d, 'expected 2D profile SVG');
    const sliceMarks = [...svg2d.querySelectorAll(`g[${M.key}^="cell:"]`)];
    assert.deepEqual(
      sliceMarks.map((g) => g.getAttribute(M.proof_ref)),
      ['sw:1-1', 'sw:2-1', 'sw:3-1'],
      '2D profile at sliceYIndex=1 must plot published iy=1 slice cells in x order'
    );
    const curtain2d = svg2d.querySelector(`g[${M.part}="curtain"][${M.sign}="unknown"]`);
    assert.ok(curtain2d, '2D profile must preserve hatched unknown curtain');
    assert.equal(/[0-9]/.test(curtain2d.textContent), false);

    assertAllTablesHaveHeaders(doc2d);
    assertLegendCoversAllDrawnSigns(doc2d);
  } finally {
    await win2d.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html2d, { theme: 'obsidian' }), [], '2D profile fallback must have 0 WCAG 2.1 AA violations');

  // Collapsing A003 curtain once server-projected resolution replaces unknown with known
  const resolvedFx = structuredClone(fx);
  resolvedFx.subjects[1] = {
    id: 'A003',
    state: 'valid',
    amount_cell: { state: 'known', display: '€ 1.850', unit: 'EUR', proof_ref: 'witness:sub-A003-resolved' },
    income_cell: { state: 'known', display: '€ 31.000', unit: 'EUR', proof_ref: 'fact:tax-A003-received' },
    assets_cell: { state: 'known', display: '€ 24.000', unit: 'EUR', proof_ref: 'fact:assets-A003' },
    citation: 'Article 3 · Council Decision 2026-047'
  };
  resolvedFx.sweep_2d.unknown_manifolds = [];

  const { html: htmlResolved } = await renderSvelte(RELIEF_SVELTE, {
    fixture: resolvedFx,
    theme: 'swisstopo',
    projection: 'orthographic'
  });
  const { window: winRes, document: docRes } = parseHtml(htmlResolved);
  try {
    assert.equal(docRes.querySelectorAll(`[${M.part}="curtain"]`).length, 0, 'resolved A003 collapses curtain completely');
    const a003Known = docRes.querySelector(`table[${M.part}="twin"] tr[${M.key}="A003"] td[${M.part}="value"][${M.state}="known"]`);
    assert.equal(a003Known?.textContent.trim(), '€ 1.850');
    assert.equal(
      docRes.querySelector(`table[${M.part}="legend"] tr[${M.sign}="unknown"]`),
      null,
      'legend omits unknown once curtain has collapsed'
    );
    assertLegendCoversAllDrawnSigns(docRes);
  } finally {
    await winRes.happyDOM.close();
  }
});

test('M2: Sheet 01 enforces xD-Discipline Guard and epistemic honesty (rejects perspective, nominal Z, unknown without curtain, and digits in unknown reason)', () => {
  const perspectiveFx = loadFixture04();
  perspectiveFx.sweep_2d.projection = 'perspective';
  assert.throws(() => buildReliefModel(perspectiveFx), /XD_NO_PERSPECTIVE/);

  const nominalZFx = loadFixture04();
  nominalZFx.sweep_2d.z_axis.dim = 'D1';
  nominalZFx.sweep_2d.z_axis.kind = 'nominal';
  assert.throws(() => buildReliefModel(nominalZFx), /XD_NOMINAL_Z_FORBIDDEN/);

  const unknownAtZeroFx = loadFixture04();
  unknownAtZeroFx.sweep_2d.unknown_manifolds = [];
  assert.throws(() => buildReliefModel(unknownAtZeroFx), /XD_UNKNOWN_AT_ZERO_FORBIDDEN/);

  const missingReasonFx = loadFixture04();
  delete missingReasonFx.subjects[1].amount_cell.reason;
  assert.throws(() => buildReliefModel(missingReasonFx), /explicit reason/);

  const digitCurtainFx = loadFixture04();
  digitCurtainFx.sweep_2d.unknown_manifolds[0].reason = 'missing since 2025';
  assert.throws(() => buildReliefModel(digitCurtainFx), /zero ASCII digits/);

  // Counterexample (P1 #91): non-known/non-unknown amount_cell (e.g. absent) or subject state must NOT collapse to known/valid
  const absentAmountFx = loadFixture04();
  absentAmountFx.subjects[0].amount_cell = {
    state: 'absent',
    display: null,
    proof_ref: 'w',
    completeness_witness_ref: 'sweep:x'
  };
  assert.throws(() => buildReliefModel(absentAmountFx), /Unsupported relief amount_cell state/);

  const violatedSubjectFx = loadFixture04();
  violatedSubjectFx.subjects[0].state = 'violated';
  assert.throws(() => buildReliefModel(violatedSubjectFx), /Unsupported relief subject state/);

  // Dedicated published cliff_distances proof_ref is used verbatim when provided
  const cliffProofFx = loadFixture04();
  cliffProofFx.sweep_2d.cliff_distances = [
    { subject_id: 'A001', display: '€ 2.000 to Art. 5 cliff', proof_ref: 'cliff:art5-A001' }
  ];
  const cliffModel = buildReliefModel(cliffProofFx);
  assert.equal(cliffModel.cliffMarkers[0].proofRef, 'cliff:art5-A001');
  assert.ok(renderReliefOrthographicSvg(cliffModel).includes('data-proof-ref="cliff:art5-A001"'));
});

test('M2: Sheet 01 passes exhaustive Opaque-Token Mutation Test with zero NaN or client re-ordering', async () => {
  const fx = loadFixture04();
  fx.subjects[0].amount_cell.display = 'OPAQUE_SUBJ_AMT';
  fx.subjects[0].cliff_distance_display = 'OPAQUE_CLIFF_TOKEN';
  fx.sweep_2d.x_axis.stops = ['X_TOK_0', 'X_TOK_1', 'X_TOK_2', 'X_TOK_3'];
  fx.sweep_2d.y_axis.stops = ['Y_TOK_0', 'Y_TOK_1', 'Y_TOK_2', 'Y_TOK_3'];
  fx.sweep_2d.cells.forEach((c, idx) => {
    c.cell.display = `OPAQUE_GRID_${idx}`;
  });

  const model = buildReliefModel(fx);
  const svg3d = renderReliefOrthographicSvg(model);
  const svg2d = renderRelief2DProfileSvg(model);
  const { html } = await renderSvelte(RELIEF_SVELTE, { fixture: fx, projection: 'orthographic' });

  for (const out of [svg3d, html]) {
    assert.equal(out.includes('NaN'), false, 'mutated opaque tokens must never produce NaN');
    assert.ok(out.includes('OPAQUE_CLIFF_TOKEN'), 'cliff distance display must pass verbatim');
    for (let idx = 0; idx < fx.sweep_2d.cells.length; idx++) {
      assert.ok(out.includes(`OPAQUE_GRID_${idx}`), `expected OPAQUE_GRID_${idx} verbatim`);
    }
  }
  assert.equal(svg2d.includes('NaN'), false);
  assert.ok(svg2d.includes('OPAQUE_CLIFF_TOKEN'));
  assert.ok(html.includes('OPAQUE_SUBJ_AMT'));
});
