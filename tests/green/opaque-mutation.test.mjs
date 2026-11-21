import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asOpaqueCell, canonicalJson, DeltaStore, renderFigure, renderOpaqueText } from '../../packages/reader-core/src/index.ts';
import { compileFlowSplitScene, compileMongeScene, compileReliefScene } from '../../packages/scene-ir/src/index.ts';
import { createSlipModel } from '../../packages/slip/src/index.ts';

const OPAQUE_FIELDS = new Set(['display', 'previous_display', 'ratio_display', 'outcome_display', 'cliff_distance_display']);

/**
 * Recursively replaces every non-null server-formatted display field in any fixture
 * with adversarial non-numeric opaque tokens (zero digits, zero currency symbols!).
 */
function mutateOpaqueTokens(obj, prefix = '§OPAQUE_TRAP', reverseOrder = false) {
  let seq = 0;
  const tokens = [];
  function clone(node) {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(clone);
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (OPAQUE_FIELDS.has(k) && typeof v === 'string') {
        seq++;
        const rankPrefix = reverseOrder ? String.fromCharCode(90 - (seq % 20)) : String.fromCharCode(65 + (seq % 20));
        const tok = `${rankPrefix}_${prefix}_${String.fromCharCode(65 + (seq % 26))}§`;
        tokens.push(tok);
        out[k] = tok;
      } else {
        out[k] = clone(v);
      }
    }
    return out;
  }
  return { mutated: clone(obj), tokens };
}

test('Exhaustive Opaque-Token Mutation Test: Subsidy 3D Relief passes all mutated tokens verbatim with zero NaN/coercion', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '04-subsidy-a001-a003.json'), 'utf8'));
  const { mutated } = mutateOpaqueTokens(raw, '§SUB_TOK');
  const expectedA001 = mutated.subjects[0].amount_cell.display;

  const scene = compileReliefScene(mutated);
  const serialized = canonicalJson(scene);

  // Zero NaN, zero Infinity, exact passthrough into node and Table Twin!
  assert.equal(serialized.includes('NaN'), false);
  assert.equal(serialized.includes('Infinity'), false);
  assert.equal(scene.tableTwin.rows[0][1], expectedA001);
  assert.equal(renderOpaqueText(scene.nodes[0].cell), expectedA001);

  // Unknown subject A003 still carries zero digits and explicit reason!
  const a003Text = renderOpaqueText(scene.nodes[1].cell);
  assert.equal(/\d/.test(a003Text), false);
  assert.ok(a003Text.includes('income_statement_not_received'));
});

test('Order-Invariance Mutation Test: inverting lexicographic order of opaque tokens never reorders Slip or Scene rows', () => {
  const rawFlow = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8'));
  const fwd = mutateOpaqueTokens(rawFlow, 'FWD', false).mutated;
  const rev = mutateOpaqueTokens(rawFlow, 'REV', true).mutated;

  const storeFwd = new DeltaStore(fwd.manifest);
  const storeRev = new DeltaStore(rev.manifest);

  const slipFwd = createSlipModel({
    subjectId: 'e-drift-vault',
    proofRef: 'policy:netpol-04#L42',
    seal: storeFwd.seal(),
    prism5: fwd.slip_enrichment.prism_5,
    missingLevers: fwd.slip_enrichment.missing_levers,
    adjacentWorlds: fwd.slip_enrichment.adjacent_worlds_delta1
  });
  const slipRev = createSlipModel({
    subjectId: 'e-drift-vault',
    proofRef: 'policy:netpol-04#L42',
    seal: storeRev.seal(),
    prism5: rev.slip_enrichment.prism_5,
    missingLevers: rev.slip_enrichment.missing_levers,
    adjacentWorlds: rev.slip_enrichment.adjacent_worlds_delta1
  });

  // Exact structural order MUST stay identical regardless of mutated token strings!
  assert.deepEqual(slipFwd.prism5.map((p) => p.key), slipRev.prism5.map((p) => p.key));
  assert.deepEqual(slipFwd.adjacentWorlds.map((w) => w.id), slipRev.adjacentWorlds.map((w) => w.id));
  assert.deepEqual(
    compileFlowSplitScene(fwd).nodes.map((n) => n.id),
    compileFlowSplitScene(rev).nodes.map((n) => n.id)
  );
  // Every mutated token reached Slip verbatim
  assert.equal(slipRev.adjacentWorlds[0].outcome_display, rev.slip_enrichment.adjacent_worlds_delta1[0].outcome_display);
});

test('Monge & Unknown Boundary Mutation Test: unknown forbids digits and absent requires completeness witness', () => {
  const rawMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));
  const scene = compileMongeScene(rawMonge);
  assert.equal(canonicalJson(scene).includes('NaN'), false);

  assert.throws(
    () => asOpaqueCell({ state: 'unknown', display: '€ 0', reason: 'missing_doc', proof_ref: 'p:1' }),
    /Epistemic violation/
  );
  assert.throws(
    () => asOpaqueCell({ state: 'absent', display: null, proof_ref: 'p:abs' }),
    /completeness_witness_ref/
  );

  const folded = renderFigure(asOpaqueCell({
    state: 'known',
    display: '§NEW_TOK§',
    previous_display: '§OLD_TOK§',
    proof_ref: 'p:fold'
  }));
  assert.equal(folded.folded, true);
  assert.equal(folded.text, '§NEW_TOK§');
  assert.equal(folded.previousText, '§OLD_TOK§');
  assert.equal(folded.attrs['data-sign'], 'replaced');
});
