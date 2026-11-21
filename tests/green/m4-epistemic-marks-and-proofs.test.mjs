import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asOpaqueCell, DATA_MARKS, renderFigure, SIGNS } from '../../packages/reader-core/src/index.ts';
import { buildBitemporalModel } from '../../packages/atlas/src/bitemporal-model.ts';
import { buildFlowSplitModel, exportFlowSplitSvg } from '../../packages/atlas/src/flow-split-svg.ts';
import { buildMongeFoldingModel } from '../../packages/atlas/src/monge-model.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const M = DATA_MARKS;
const MONGE_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'MongeFoldingSheet.svelte');
const BITEMPORAL_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'BitemporalStairSheet.svelte');
const FLOW_SPLIT_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'FlowSplitSheet.svelte');

const FX_01 = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '01-platform-drift.json'), 'utf8'));
const FX_05 = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '05-subsidy-bitemporal.json'), 'utf8'));
const FX_08 = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '08-monge-4d-audit.json'), 'utf8'));

test('M4 §1 (Monge): absent round dots never paint valid-green, round dots never borrow service proof_ref, and no SVG mark duplicates another proof_ref', async () => {
  const { html } = await renderSvelte(MONGE_SHEET, { fixture: FX_08, foldAngleDeg: 40 });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const svg = doc.querySelector(`svg[${M.sheet}="monge-fold"]`);
    assert.ok(svg);

    // Absent round dots must render hollow absent styling, NEVER var(--c-valid)
    const absentDots = [...svg.querySelectorAll(`circle[${M.state}="absent"]`)];
    assert.equal(absentDots.length, 4, 'dr has 2 absent rounds (m-3, m-4) projected onto Plane II and Plane III');
    for (const dot of absentDots) {
      assert.notEqual(dot.getAttribute('fill'), 'var(--c-valid)', 'absent round dot must NEVER fill with valid green');
      assert.equal(dot.getAttribute('fill'), 'none', 'absent round dot must be hollow');
      assert.equal(dot.getAttribute('stroke'), 'var(--c-ink-soft)');
      assert.ok(dot.getAttribute('stroke-dasharray'), 'absent round dot must be dashed');
      assert.equal(dot.getAttribute(M.proof_ref), null, 'round dot without own witness must not borrow service proof_ref');
      assert.equal(dot.querySelector('title')?.textContent, 'no proof');
    }

    // No SVG mark in Monge reuses another mark's data-proof-ref
    const proofRefs = [...svg.querySelectorAll(`[${M.proof_ref}]`)].map((el) => el.getAttribute(M.proof_ref));
    assert.equal(proofRefs.length, FX_08.services.length, 'only the 6 services carry published proof_ref on fixture 08');
    assert.equal(new Set(proofRefs).size, proofRefs.length, 'zero SVG marks may borrow or duplicate another mark proof_ref');
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);

  // When per-round witness refs ARE published, each round dot emits its own witness ref
  const fxWithRoundProofs = structuredClone(FX_08);
  fxWithRoundProofs.services[4].round_proof_refs = ['p:dr-m1', 'p:dr-m2', 'p:dr-m3', 'p:dr-m4'];
  const model = buildMongeFoldingModel(fxWithRoundProofs, 40);
  const drProj = model.services.find((s) => s.id === 'dr');
  assert.deepEqual(
    drProj.rounds.map((r) => r.proofRef),
    ['p:dr-m1', 'p:dr-m2', 'p:dr-m3', 'p:dr-m4']
  );
});

test('M4 §1 (Drift & Line Convention): Sheet 02 and Sheet 06 unify stated (dashed) vs observed (solid) and never borrow stated_proof_ref as generic data-proof-ref', async () => {
  const flowModel = buildFlowSplitModel(FX_01);
  assert.equal(flowModel.driftEdges.length, 1);
  assert.equal(flowModel.driftEdges[0].proofRef, null, 'drift edge without own proof_ref must not borrow stated_proof_ref');

  const mongeModel = buildMongeFoldingModel(FX_08, 40);
  assert.equal(mongeModel.driftArcs.length, 1);
  assert.equal(mongeModel.driftArcs[0].proofRef, null, 'Monge drift arc without own proof_ref must not borrow stated_proof_ref');

  const { html: flowHtml } = await renderSvelte(FLOW_SPLIT_SHEET, { fixture: FX_01 });
  const { html: mongeHtml } = await renderSvelte(MONGE_SHEET, { fixture: FX_08, foldAngleDeg: 40 });

  for (const [name, html] of [['FlowSplitSheet', flowHtml], ['MongeFoldingSheet', mongeHtml]]) {
    const { window: win, document: doc } = parseHtml(html);
    try {
      const driftG = doc.querySelector(`svg g[${M.sign}="drift"]`);
      assert.ok(driftG, `${name}: expected drift group`);
      assert.equal(
        driftG.getAttribute(M.proof_ref),
        null,
        `${name}: drift group must not borrow stated_proof_ref as data-proof-ref`
      );
      assert.ok(driftG.getAttribute(M.stated_proof_ref), `${name}: drift must carry data-stated-proof-ref`);
      assert.ok(driftG.getAttribute(M.observed_proof_ref), `${name}: drift must carry data-observed-proof-ref`);

      const statedPath = driftG.querySelector(`path[${M.stated_proof_ref}]`);
      const observedPath = driftG.querySelector(`path[${M.observed_proof_ref}]`);
      assert.ok(statedPath, `${name}: expected stated path`);
      assert.ok(observedPath, `${name}: expected observed path`);
      assert.equal(statedPath.getAttribute('stroke-dasharray'), '6 3', `${name}: stated track must be dashed (6 3)`);
      assert.equal(observedPath.getAttribute('stroke-dasharray'), null, `${name}: observed track must be solid`);
    } finally {
      await win.happyDOM.close();
    }
  }

  // Exported SVG also never borrows stated_proof_ref on drift
  const flowSvg = exportFlowSplitSvg(FX_01);
  assert.equal(flowSvg.includes(`${M.proof_ref}="policy:netpol-04#L42"`), false);
});

test('M4 §1 (Sheet 05 Unknown & Invalid): unknown draws flat hatched band with no height/size, and invalid (!) renders cleanly in 2D and 3D', async () => {
  const model = buildBitemporalModel(FX_05);
  const unkCells = model.cells.filter((c) => c.state === 'unknown');
  assert.ok(unkCells.length > 0);
  for (const c of unkCells) {
    assert.equal(c.zToken, null, 'unknown cell must not carry a height/zToken');
  }

  // Inject an invalid cell and verify both 2D and 3D render cleanly without throwing
  const fxInvalid = structuredClone(FX_05);
  fxInvalid.bitemporal_grid.matrix[1][0] = {
    state: 'invalid',
    display: null,
    reason: 'check_failed',
    proof_ref: 'p:bt-inv-1'
  };

  for (const view of ['2d', 'orthographic']) {
    const { html } = await renderSvelte(BITEMPORAL_SHEET, { fixture: fxInvalid, view });
    const { window: win, document: doc } = parseHtml(html);
    try {
      if (view === 'orthographic') {
        const svg = doc.querySelector(`svg[${M.sheet}="bitemporal-stair"]`);
        const unkGroups = [...svg.querySelectorAll(`g[${M.state}="unknown"]`)];
        assert.ok(unkGroups.length > 0);
        for (const g of unkGroups) {
          assert.equal(g.innerHTML.includes('--z:'), false, 'unknown mark must carry no --z height');
          assert.equal(g.querySelector('rect'), null, 'unknown mark must not draw an extruded prism');
          assert.ok(g.innerHTML.includes('url(#bt-hatch)'), 'unknown mark must render hatched band');
        }
        const invG = svg.querySelector(`g[${M.state}="invalid"]`);
        assert.ok(invG, '3D view must render invalid (!) cell');
        assert.equal(invG.getAttribute(M.sign), 'invalid');
        assert.equal(invG.getAttribute(M.reason), 'check_failed');
        assert.equal(invG.innerHTML.includes('--z:'), false, 'invalid mark must carry no fabricated height');
        assert.ok(invG.textContent.includes('!'));
      } else {
        const invTd = doc.querySelector(`td[${M.part}="value"][${M.state}="invalid"]`);
        assert.ok(invTd, '2D matrix must render invalid (!) cell');
        assert.equal(invTd.getAttribute(M.reason), 'check_failed');
        assert.ok(invTd.querySelector(`[${M.sign}="invalid"]`));
        assert.ok(invTd.textContent.includes('!'));
      }
      // Legend lists 'invalid' for the invalid cell
      assert.ok(doc.querySelector(`table[${M.part}="legend"] tr[${M.sign}="invalid"]`));
    } finally {
      await win.happyDOM.close();
    }
    assert.deepEqual(await auditA11y(html), [], `BitemporalStairSheet (${view}) with invalid must have 0 axe violations`);
  }
});

test('M4 §1 (Invalid across Sheet 02 & Sheet 06): FlowSplitSheet and MongeFoldingSheet render invalid (!) without throwing and with 0 axe violations', async () => {
  const fxFlowInv = structuredClone(FX_01);
  fxFlowInv.nodes[2].state = 'invalid';
  fxFlowInv.nodes[2].reason = 'schema_check_failed';

  const { html: flowHtml } = await renderSvelte(FLOW_SPLIT_SHEET, { fixture: fxFlowInv });
  {
    const { window: win, document: doc } = parseHtml(flowHtml);
    try {
      const invSvg = doc.querySelector(`svg g[${M.state}="invalid"]`);
      assert.ok(invSvg, 'FlowSplit SVG must render invalid node');
      assert.ok(invSvg.textContent.includes('!'));
      const invTd = doc.querySelector(`table[${M.part}="twin"] td[${M.part}="value"][${M.state}="invalid"]`);
      assert.ok(invTd, 'FlowSplit Table Twin must render invalid cell');
      assert.ok(invTd.textContent.includes('!'));
    } finally {
      await win.happyDOM.close();
    }
  }
  assert.deepEqual(await auditA11y(flowHtml), []);

  const fxMongeInv = structuredClone(FX_08);
  fxMongeInv.services[2].state = 'invalid';
  fxMongeInv.services[2].reason = 'invariant_failed';
  fxMongeInv.services[2].round_states = ['valid', 'valid', 'valid', 'invalid'];

  const { html: mongeHtml } = await renderSvelte(MONGE_SHEET, { fixture: fxMongeInv, foldAngleDeg: 40 });
  {
    const { window: win, document: doc } = parseHtml(mongeHtml);
    try {
      const invG = doc.querySelector(`svg g[${M.state}="invalid"]`);
      assert.ok(invG, 'Monge SVG must render invalid service');
      assert.ok(invG.textContent.includes('!'));
      const invTd = doc.querySelector(`table[${M.part}="twin"] td[${M.part}="value"][${M.state}="invalid"]`);
      assert.ok(invTd, 'Monge Table Twin must render invalid cell');
      assert.ok(invTd.textContent.includes('!'));
    } finally {
      await win.happyDOM.close();
    }
  }
  assert.deepEqual(await auditA11y(mongeHtml), []);
});

test('M4 §1 (renderFigure): emits only canonical std-view contract SIGNS (never "hatch" or "replaced")', () => {
  const cases = [
    { cell: asOpaqueCell({ state: 'unknown', display: null, reason: 'missing_doc', proof_ref: 'p:1' }), expectedSign: 'unknown' },
    { cell: asOpaqueCell({ state: 'absent', display: null, proof_ref: 'p:2', completeness_witness_ref: 'sweep:1' }), expectedSign: 'absent' },
    { cell: asOpaqueCell({ state: 'not_applicable', display: null, reason: 'future_period', proof_ref: 'p:3' }), expectedSign: 'not_applicable' },
    { cell: asOpaqueCell({ state: 'invalid', display: null, reason: 'check_failed', proof_ref: 'p:4' }), expectedSign: 'invalid' },
    { cell: asOpaqueCell({ state: 'known', display: 'NEW', previous_display: 'OLD', proof_ref: 'p:5' }), expectedSign: 'changed' }
  ];

  for (const { cell, expectedSign } of cases) {
    const fig = renderFigure(cell);
    const emitted = fig.attrs['data-sign'];
    assert.equal(emitted, expectedSign);
    assert.notEqual(emitted, 'hatch', 'non-contract sign "hatch" is forbidden');
    assert.notEqual(emitted, 'replaced', 'non-contract sign "replaced" is forbidden');
    assert.equal(
      Object.prototype.hasOwnProperty.call(SIGNS, emitted),
      true,
      `emitted data-sign "${emitted}" must be a canonical SIGNS key`
    );
  }
});
