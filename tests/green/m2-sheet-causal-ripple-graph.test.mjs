import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import {
  buildCausalRippleModel,
  DISTANCE_COLUMN_THRESHOLD,
  exportCausalRippleSvg
} from '../../packages/atlas/src/ripple-layout.ts';
import { buildPixiDrawPlan } from '../../packages/atlas/src/ripple-pixi.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const CAUSAL_RIPPLE_SHEET = path.join(process.cwd(), 'packages', 'atlas', 'src', 'CausalRippleSheet.svelte');
const FX_DENSE = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', '06-keycloak-dense-28.json'), 'utf8')
);

test('M2 Sheet 04: switches to Distance Columns for 28 dependents, draws zero unpublished edges, renders OR-shields, AND cliffs, fold diff, legend, twin, seal, and 0 axe violations', async () => {
  const model = buildCausalRippleModel(FX_DENSE);
  assert.equal(
    model.mode,
    'distance-columns',
    `dependent_count=${FX_DENSE.dependent_count} > ${DISTANCE_COLUMN_THRESHOLD} must use distance-columns`
  );
  assert.equal(model.columns.length, 3, 'fixture 06 spans hops 0, 1, 2');
  assert.equal(model.nodes.length, FX_DENSE.nodes.length);
  assert.equal(model.edges.length, 0, 'fixture 06 publishes no edges, so zero causal edges may be fabricated');

  // Compact graph (<= 12 dependents) switches to radial-rings mode
  const fxCompact = structuredClone(FX_DENSE);
  fxCompact.dependent_count = 8;
  const compactModel = buildCausalRippleModel(fxCompact);
  assert.equal(compactModel.mode, 'radial-rings', 'dependent_count <= 12 must use radial-rings');

  const { html } = await renderSvelte(CAUSAL_RIPPLE_SHEET, { fixture: FX_DENSE });
  const { html: htmlRepeat } = await renderSvelte(CAUSAL_RIPPLE_SHEET, { fixture: FX_DENSE });
  assert.equal(html, htmlRepeat, 'SSR HTML must be byte-for-byte deterministic');

  const expectedSvg = exportCausalRippleSvg(FX_DENSE, {
    ariaLabel: 'Causal Ripple & Distance Columns — distance-columns diagram'
  });
  assert.ok(html.includes(expectedSvg), 'CausalRippleSheet.svelte must embed the exact exporter SVG output');

  const { window: win, document: doc } = parseHtml(html);
  try {
    const sheet = doc.querySelector(`[${DATA_MARKS.sheet}="causal-ripple"][${DATA_MARKS.projection}="2d"]`);
    assert.ok(sheet, 'expected sheet root with data-sheet="causal-ripple" and data-projection="2d"');
    assert.equal(sheet.getAttribute(DATA_MARKS.trust_tier), 'provisional_checked');

    // Honest incomplete horizon
    const horizon = doc.querySelector(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="depth_limit_hop_2"]`);
    assert.ok(horizon, 'expected incomplete horizon indicator with data-reason="depth_limit_hop_2"');

    // Three hop columns present in SVG and zero fabricated [data-relation] elements
    assert.ok(doc.querySelector(`svg [${DATA_MARKS.key}="hop-0"]`), 'expected hop-0 column');
    assert.ok(doc.querySelector(`svg [${DATA_MARKS.key}="hop-1"]`), 'expected hop-1 column');
    assert.ok(doc.querySelector(`svg [${DATA_MARKS.key}="hop-2"]`), 'expected hop-2 column');
    assert.equal(
      doc.querySelectorAll(`svg [${DATA_MARKS.relation}]`).length,
      0,
      'fixture 06 has no published edges, so svg [data-relation] count must be 0'
    );

    // OR-shield node (g-quorum: gate=OR, load_bearing=false)
    const orShield = doc.querySelector(
      `svg [${DATA_MARKS.key}="g-quorum"][${DATA_MARKS.gate}="OR"][${DATA_MARKS.load_bearing}="false"]`
    );
    assert.ok(orShield, 'expected OR-shield node g-quorum with data-gate="OR" and data-load-bearing="false"');
    assert.equal(orShield.getAttribute(DATA_MARKS.proof_ref), 'p:quorum');

    // AND load-bearing cliff node (g-rpo: gate=AND, load_bearing=true, violated)
    const andCliff = doc.querySelector(
      `svg [${DATA_MARKS.key}="g-rpo"][${DATA_MARKS.gate}="AND"][${DATA_MARKS.load_bearing}="true"][${DATA_MARKS.state}="violated"]`
    );
    assert.ok(andCliff, 'expected AND cliff node g-rpo with data-gate="AND", data-load-bearing="true", data-state="violated"');
    assert.equal(andCliff.getAttribute(DATA_MARKS.proof_ref), 'p:rpo');

    // Fold diff (<del>valid</del> <ins>violated</ins>) in Table Twin for g-rpo
    const rpoRow = doc.querySelector(`table[${DATA_MARKS.part}="twin"] tr[${DATA_MARKS.key}="g-rpo"]`);
    assert.ok(rpoRow, 'expected g-rpo row in Table Twin');
    assert.equal(rpoRow.querySelector(`td[${DATA_MARKS.part}="value"] del`)?.textContent, 'valid');
    assert.equal(rpoRow.querySelector(`td[${DATA_MARKS.part}="value"] ins`)?.textContent, 'violated');

    // Every SVG proof mark has non-empty data-proof-ref
    const proofMarks = doc.querySelectorAll(`svg [${DATA_MARKS.proof_ref}]`);
    assert.ok(proofMarks.length >= FX_DENSE.nodes.length);
    for (const m of proofMarks) {
      assert.ok((m.getAttribute(DATA_MARKS.proof_ref) ?? '').trim().length > 0, 'empty data-proof-ref on SVG mark');
    }

    // Legend contract
    const legendTable = doc.querySelector(`table[${DATA_MARKS.part}="legend"]`);
    assert.ok(legendTable, 'expected table[data-part="legend"]');
    assert.ok(legendTable.querySelectorAll('th').length >= 1, 'legend table must have <th> headers');
    const legendSigns = new Set(
      [...legendTable.querySelectorAll(`tr[${DATA_MARKS.sign}]`)].map((r) => r.getAttribute(DATA_MARKS.sign))
    );
    const drawnSigns = new Set(
      [...doc.querySelectorAll(`[${DATA_MARKS.sign}]`)]
        .filter((el) => !legendTable.contains(el))
        .map((el) => el.getAttribute(DATA_MARKS.sign))
    );
    for (const s of drawnSigns) {
      assert.ok(legendSigns.has(s), `drawn sign "${s}" is missing from table[data-part="legend"]`);
    }

    // Table Twin contract
    const twinTable = doc.querySelector(`table[${DATA_MARKS.part}="twin"]`);
    assert.ok(twinTable, 'expected table[data-part="twin"]');
    assert.ok(twinTable.querySelectorAll('th').length >= 1, 'twin table must have <th> headers');
    assert.equal(
      twinTable.querySelectorAll(`tbody tr[${DATA_MARKS.key}]`).length,
      FX_DENSE.nodes.length,
      'twin row count must match fixture nodes'
    );

    // Cartouche Seal contract
    const seal = doc.querySelector(`[${DATA_MARKS.part}="seal"]`);
    assert.ok(seal, 'expected [data-part="seal"]');
    assert.equal(seal.querySelector(`[${DATA_MARKS.part}="manifest-hash"]`)?.textContent?.trim(), FX_DENSE.manifest.id);
    assert.equal(seal.querySelector(`[${DATA_MARKS.check}]`)?.getAttribute(DATA_MARKS.status), 'green');
  } finally {
    await win.happyDOM.close();
  }

  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], `WCAG 2.1 AA violations on fixture 06: ${JSON.stringify(violations, null, 2)}`);
});

test('M2 Sheet 04: 4-valued unknown/absent, published edges with own proofs, omitted cut_set, PixiJS draw plan, and strict rejections', async () => {
  const fx4Val = structuredClone(FX_DENSE);
  fx4Val.nodes.push(
    {
      id: 'node-fog',
      label: 'Telemetry-09',
      hop: 2,
      sign: 'origin_observation',
      state: 'unknown',
      reason: 'probe_unreachable',
      display: null,
      proof_ref: 'p:fog'
    },
    {
      id: 'node-abs',
      label: 'Standby-C',
      hop: 2,
      sign: 'origin_decision',
      state: 'absent',
      cut_set: { load_bearing: false, redundancy_margin: 0, gate: 'FACT' },
      proof_ref: 'p:abs',
      completeness_witness_ref: 'sweep:full-12'
    }
  );
  fx4Val.edges = [
    { id: 'edge-shield', from: 'svc-keycloak', to: 'g-quorum', kind: 'standard', proof_ref: 'p:edge-shield' },
    { id: 'edge-cliff', from: 'obs-tls', to: 'g-rpo', kind: 'standard', proof_ref: 'p:edge-cliff' }
  ];

  const { html } = await renderSvelte(CAUSAL_RIPPLE_SHEET, { fixture: fx4Val });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const unkSvg = doc.querySelector(`svg [${DATA_MARKS.sign}="unknown"][${DATA_MARKS.state}="unknown"]`);
    assert.ok(unkSvg, 'expected unknown SVG mark');
    assert.equal(unkSvg.getAttribute(DATA_MARKS.reason), 'probe_unreachable');
    assert.ok(unkSvg.textContent.includes(SIGNS.unknown.glyph));
    assert.equal(/[0-9]/.test(unkSvg.textContent), false, 'unknown SVG mark must contain zero ASCII digits');

    // Node without cut_set omits data-gate and data-load-bearing (no fabricated FACT/false)
    const fogNode = doc.querySelector(`svg [${DATA_MARKS.key}="node-fog"]`);
    assert.ok(fogNode, 'expected node-fog in SVG');
    assert.equal(fogNode.getAttribute(DATA_MARKS.gate), null, 'omitted cut_set must not fabricate data-gate');
    assert.equal(fogNode.getAttribute(DATA_MARKS.load_bearing), null, 'omitted cut_set must not fabricate data-load-bearing');

    const unkTd = doc.querySelector(
      `table[${DATA_MARKS.part}="twin"] td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="unknown"]`
    );
    assert.ok(unkTd, 'expected unknown Table Twin value cell');
    assert.equal(unkTd.getAttribute(DATA_MARKS.reason), 'probe_unreachable');
    assert.equal(/[0-9]/.test(unkTd.textContent), false, 'unknown Table Twin cell must contain zero ASCII digits');

    const absNode = doc.querySelector(`svg [${DATA_MARKS.key}="node-abs"][${DATA_MARKS.state}="absent"]`);
    assert.ok(absNode, 'expected absent node in SVG');
    assert.equal(absNode.getAttribute(DATA_MARKS.completeness_ref), 'sweep:full-12');
    assert.ok(absNode.textContent.includes(SIGNS.absent.glyph));

    // Published edges carry their own published proof_ref
    const shieldEdge = doc.querySelector(`svg [${DATA_MARKS.key}="edge-shield"][${DATA_MARKS.relation}="or-shield"]`);
    assert.ok(shieldEdge, 'expected published OR-shield edge');
    assert.equal(shieldEdge.getAttribute(DATA_MARKS.proof_ref), 'p:edge-shield');

    const cliffEdge = doc.querySelector(`svg [${DATA_MARKS.key}="edge-cliff"][${DATA_MARKS.relation}="and-cliff"]`);
    assert.ok(cliffEdge, 'expected published AND-cliff edge');
    assert.equal(cliffEdge.getAttribute(DATA_MARKS.proof_ref), 'p:edge-cliff');
  } finally {
    await win.happyDOM.close();
  }

  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], `WCAG 2.1 AA violations on 4-valued ripple: ${JSON.stringify(violations, null, 2)}`);

  // Reject published non-drift edge with missing proof_ref (never borrow dst.proofRef)
  const fxEdgeNoProof = structuredClone(fx4Val);
  delete fxEdgeNoProof.edges[0].proof_ref;
  assert.throws(() => exportCausalRippleSvg(fxEdgeNoProof), /proof_ref/);

  // Reject unreasoned unknown
  const fxBadUnk = structuredClone(fx4Val);
  delete fxBadUnk.nodes[5].reason;
  assert.throws(() => exportCausalRippleSvg(fxBadUnk), /reason/);

  // Reject unwitnessed absent
  const fxBadAbs = structuredClone(fx4Val);
  delete fxBadAbs.nodes[6].completeness_witness_ref;
  assert.throws(() => exportCausalRippleSvg(fxBadAbs), /EPI_ABSENT_NO_SWEEP|completeness_witness_ref/);

  // Reject missing node proof_ref
  const fxNoProof = structuredClone(FX_DENSE);
  fxNoProof.nodes[0].proof_ref = '';
  assert.throws(() => exportCausalRippleSvg(fxNoProof), /EPI_MISSING_PROOF|proof_ref/);

  // Reject unrecognized state & prototype keys (constructor / toString)
  const fxBadState = structuredClone(FX_DENSE);
  fxBadState.nodes[0].state = 'constructor';
  assert.throws(() => exportCausalRippleSvg(fxBadState), /unrecognized state/);

  const fxBadSign = structuredClone(FX_DENSE);
  fxBadSign.nodes[0].sign = 'toString';
  assert.throws(() => exportCausalRippleSvg(fxBadSign), /unrecognized sign/);

  // Headless PixiJS v8 draw plan is deterministic and needs zero WebGL
  const planA = buildPixiDrawPlan(buildCausalRippleModel(fx4Val));
  const planB = buildPixiDrawPlan(buildCausalRippleModel(fx4Val));
  assert.deepEqual(planA, planB, 'PixiJS draw plan must be deterministic');
  assert.equal(
    planA.commands.filter((c) => c.kind === 'curve').length,
    2,
    'PixiJS draw plan must emit curves only for published edges'
  );
  assert.ok(planA.commands.some((c) => c.kind === 'rect' && c.fill === null), 'PixiJS draw plan must emit OR-shield / AND-cliff rings');
});
