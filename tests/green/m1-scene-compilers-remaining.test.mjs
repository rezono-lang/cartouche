import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, renderOpaqueText } from '../../packages/reader-core/src/index.ts';
import { checkGeometricInvariants } from '../../packages/scene-ir/src/geometry-invariants.ts';
import { assertXDDiscipline, validateXDDiscipline } from '../../packages/scene-ir/src/xd-guard.ts';
import { compileKringstandScene } from '../../packages/scene-ir/src/compile-kringstand.ts';
import { compileCausalRippleScene } from '../../packages/scene-ir/src/compile-causal-ripple.ts';
import { compileBitemporalScene } from '../../packages/scene-ir/src/compile-bitemporal.ts';
import { loadJson, validateSceneShape } from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();
const SCENE_CONTRACT = loadJson(ROOT, 'contracts/cartouche-scene.v2.schema.json');
const OPAQUE_FIELDS = new Set(['display', 'previous_display']);

function mutateOpaqueTokens(obj, prefix = '§OPAQUE_M1', reverseOrder = false) {
  let seq = 0;
  function clone(node) {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(clone);
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (OPAQUE_FIELDS.has(k) && typeof v === 'string') {
        seq++;
        const rank = reverseOrder ? String.fromCharCode(90 - (seq % 20)) : String.fromCharCode(65 + (seq % 20));
        out[k] = `${rank}_${prefix}_${String.fromCharCode(65 + (seq % 26))}§`;
      } else {
        out[k] = clone(v);
      }
    }
    return out;
  }
  return clone(obj);
}

test('M1 Sheet 03 (kringstand): compiles fixture 03 into valid CartoucheScene v2 with provisional_engine seal lock and epistemic invariants', () => {
  const fx = loadJson(ROOT, 'fixtures/03-kring-m1-to-m5-live.json');

  // Default includes live_provisional_delta -> provisional_engine locks Propose
  const liveScene = compileKringstandScene(fx);
  assert.equal(liveScene.archetype, 'kringstand');
  assert.equal(liveScene.projection, '2d');
  assert.deepEqual(validateSceneShape(liveScene, SCENE_CONTRACT), []);
  assert.deepEqual(validateXDDiscipline(liveScene), []);
  assert.deepEqual(checkGeometricInvariants(liveScene), []);
  assert.equal(liveScene.nodes.length, 9);
  assert.equal(liveScene.seal.trustTier, 'provisional_engine');
  assert.equal(liveScene.seal.provisionalCount, 1);
  assert.equal(liveScene.seal.canPropose, false);

  // Absent node carries completeness witness; unknown node carries zero digits + explicit reason
  const absentNode = liveScene.nodes.find((n) => n.id === 'target:legacy-proxy');
  assert.ok(absentNode);
  assert.equal(absentNode.state, 'absent');
  assert.equal(absentNode.completenessWitnessRef, 'sweep:complete-m4');

  const unknownNode = liveScene.nodes.find((n) => n.id === 'target:edge-node-04');
  assert.ok(unknownNode);
  assert.equal(unknownNode.state, 'unknown');
  assert.ok(unknownNode.cell);
  assert.equal(unknownNode.cell.display, null);
  assert.equal(/\d/.test(renderOpaqueText(unknownNode.cell)), false);
  assert.ok(renderOpaqueText(unknownNode.cell).includes('telemetry_timeout'));

  // Sealed-only snapshot (whether it unlocks Propose is the reader's to serve: tests/red/m1-propose-locked-until-served)
  const sealedScene = compileKringstandScene(fx, { includeProvisional: false });
  assert.deepEqual(validateSceneShape(sealedScene, SCENE_CONTRACT), []);
  assert.deepEqual(checkGeometricInvariants(sealedScene), []);
  assert.equal(sealedScene.nodes.length, 8);
  assert.equal(sealedScene.seal.trustTier, 'sealed');
  assert.equal(sealedScene.seal.provisionalCount, 0);

  // Determinism
  assert.equal(canonicalJson(liveScene), canonicalJson(compileKringstandScene(fx)));

  // Dual-sided drift edges pass; single-sided drift is caught by geometric invariants
  const withDrift = compileKringstandScene({
    ...fx,
    drift_edges: [
      {
        id: 'd-1',
        from: 'step:vault-rule-patch',
        to: 'step:policy-push',
        stated_proof_ref: 'round:m-4#needed-1',
        observed_proof_ref: 'round:m-4#ready-1'
      }
    ]
  });
  assert.deepEqual(validateSceneShape(withDrift, SCENE_CONTRACT), []);
  assert.deepEqual(checkGeometricInvariants(withDrift), []);
  assert.ok(withDrift.usedSigns.includes('drift'));

  const badDrift = compileKringstandScene({
    ...fx,
    drift_edges: [
      {
        id: 'd-bad',
        from: 'step:vault-rule-patch',
        to: 'step:policy-push',
        stated_proof_ref: 'round:m-4#needed-1',
        observed_proof_ref: ''
      }
    ]
  });
  assert.ok(checkGeometricInvariants(badDrift).some((v) => v.code === 'EPI_DRIFT_SINGLE_SIDED'));

  // Rejects unknown row without explicit epistemic reason (never fabricates a default)
  const missingReason = structuredClone(fx);
  delete missingReason.sealed_rows[7].reason;
  assert.throws(() => compileKringstandScene(missingReason), /explicit reason/);
});

test('M1 Sheet 04 (causal-ripple): compiles fixture 06 into valid CartoucheScene v2 preserving incomplete horizon and opaque tokens', () => {
  const fx = loadJson(ROOT, 'fixtures/06-keycloak-dense-28.json');
  const scene = compileCausalRippleScene(fx);

  assert.equal(scene.archetype, 'causal-ripple');
  assert.equal(scene.projection, '2d');
  assert.deepEqual(validateSceneShape(scene, SCENE_CONTRACT), []);
  assert.deepEqual(validateXDDiscipline(scene), []);
  assert.deepEqual(checkGeometricInvariants(scene), []);
  assert.deepEqual(scene.horizon, { complete: false, reason: 'depth_limit_hop_2' });
  assert.equal(scene.seal.trustTier, 'provisional_checked');
  assert.deepEqual(
    scene.nodes.map((n) => n.id),
    fx.nodes.map((n) => n.id)
  );

  // Violated node preserves opaque display + previousDisplay verbatim
  const rpo = scene.nodes.find((n) => n.id === 'g-rpo');
  assert.ok(rpo?.cell);
  assert.equal(rpo.cell.display, 'violated');
  assert.equal(rpo.cell.previousDisplay, 'valid');

  // Determinism
  assert.equal(canonicalJson(scene), canonicalJson(compileCausalRippleScene(fx)));

  // Rejects unknown node without explicit epistemic reason (never fabricates a default)
  const missingReason = structuredClone(fx);
  missingReason.nodes.push({
    id: 'obs-unexplained',
    label: 'Unexplained Probe',
    hop: 2,
    sign: 'origin_observation',
    state: 'unknown',
    display: null,
    proof_ref: 'p:unexplained'
  });
  assert.throws(() => compileCausalRippleScene(missingReason), /explicit reason/);
});

test('M1 Sheet 05 (bitemporal-stair): compiles fixture 05 into valid orthographic CartoucheScene v2 with hollow not_applicable and unknown curtains', () => {
  const fx = loadJson(ROOT, 'fixtures/05-subsidy-bitemporal.json');
  const scene = compileBitemporalScene(fx);

  assert.equal(scene.archetype, 'bitemporal-stair');
  assert.equal(scene.projection, 'orthographic');
  assert.deepEqual(validateSceneShape(scene, SCENE_CONTRACT), []);
  assert.deepEqual(validateXDDiscipline(scene), []);
  assert.deepEqual(checkGeometricInvariants(scene), []);
  assert.equal(scene.nodes.length, 16);

  // At least two bitemporal axes + non-nominal metric Z axis
  assert.equal(scene.axes.filter((a) => a.kind === 'bitemporal').length, 2);
  const zAxis = scene.axes.find((a) => a.axis === 'z');
  assert.ok(zAxis);
  assert.equal(zAxis.kind, 'metric');

  // Every unknown cell binds to a hatched uncertainty_curtain manifold (never at z=0) and carries zero digits
  const unknownNodes = scene.nodes.filter((n) => n.state === 'unknown');
  assert.equal(unknownNodes.length, 2);
  assert.equal(scene.unknownManifolds.length, 2);
  for (const un of unknownNodes) {
    assert.ok(un.cell);
    assert.equal(un.cell.display, null);
    assert.equal(/\d/.test(renderOpaqueText(un.cell)), false);
    assert.equal(/\d/.test(un.label), false);
    const manifold = scene.unknownManifolds.find((m) => m.subjectId === un.id);
    assert.ok(manifold);
    assert.equal(manifold.kind, 'uncertainty_curtain');
    assert.equal(manifold.zFloorZeroForbidden, true);
    assert.equal(manifold.proofRef, un.proofRef);
  }

  // Every not_applicable cell stays visibly hollow ('–')
  const naNodes = scene.nodes.filter((n) => n.state === 'not_applicable');
  assert.equal(naNodes.length, 6);
  for (const na of naNodes) {
    assert.ok(na.cell);
    assert.equal(na.cell.display, null);
    assert.equal(na.label, '–');
    assert.equal(renderOpaqueText(na.cell), '–');
  }

  // Synchronized accessible Table Twin
  assert.deepEqual(scene.tableTwin.headers, ['Knowledge Epoch', ...fx.bitemporal_grid.valid_times]);
  assert.equal(scene.tableTwin.rows.length, 4);
  assert.equal(scene.tableTwin.rows[0][2], '–');
  assert.equal(scene.tableTwin.rows[1][1], '€ 2.694');

  // Rejects perspective 3D at compile time
  const badPerspective = structuredClone(fx);
  badPerspective.bitemporal_grid.projection = 'perspective';
  assert.throws(() => compileBitemporalScene(badPerspective), /XD_NO_PERSPECTIVE/);

  // Rejects missing matrix cell instead of shifting Table Twin columns
  const truncatedMatrix = structuredClone(fx);
  truncatedMatrix.bitemporal_grid.matrix[1].pop();
  assert.throws(() => compileBitemporalScene(truncatedMatrix), /missing bitemporal matrix cell/);

  // Determinism
  assert.equal(canonicalJson(scene), canonicalJson(compileBitemporalScene(fx)));
});

test('M1 Opaque-Token Mutation & Order-Invariance Test across kringstand, causal-ripple, and bitemporal-stair', () => {
  // 1. Bitemporal stair opaque token passthrough & order invariance
  const rawBt = loadJson(ROOT, 'fixtures/05-subsidy-bitemporal.json');
  const btFwd = mutateOpaqueTokens(rawBt, 'BT_FWD', false);
  const btRev = mutateOpaqueTokens(rawBt, 'BT_REV', true);
  const scBtFwd = compileBitemporalScene(btFwd);
  const scBtRev = compileBitemporalScene(btRev);

  assert.equal(canonicalJson(scBtFwd).includes('NaN'), false);
  assert.equal(canonicalJson(scBtFwd).includes('Infinity'), false);
  assert.equal(scBtFwd.tableTwin.rows[1][1], btFwd.bitemporal_grid.matrix[1][0].display);
  assert.equal(scBtRev.tableTwin.rows[2][1], btRev.bitemporal_grid.matrix[2][0].display);
  assert.deepEqual(
    scBtFwd.nodes.map((n) => n.id),
    scBtRev.nodes.map((n) => n.id)
  );
  assertXDDiscipline(scBtFwd);
  assert.deepEqual(checkGeometricInvariants(scBtFwd), []);

  // 2. Causal ripple opaque token passthrough & order invariance
  const rawCr = loadJson(ROOT, 'fixtures/06-keycloak-dense-28.json');
  const crFwd = mutateOpaqueTokens(rawCr, 'CR_FWD', false);
  const crRev = mutateOpaqueTokens(rawCr, 'CR_REV', true);
  const scCrFwd = compileCausalRippleScene(crFwd);
  const scCrRev = compileCausalRippleScene(crRev);

  assert.equal(canonicalJson(scCrFwd).includes('NaN'), false);
  assert.equal(scCrFwd.nodes[4].cell.display, crFwd.nodes[4].display);
  assert.equal(scCrFwd.nodes[4].cell.previousDisplay, crFwd.nodes[4].previous_display);
  assert.deepEqual(
    scCrFwd.nodes.map((n) => n.id),
    scCrRev.nodes.map((n) => n.id)
  );
  assert.deepEqual(checkGeometricInvariants(scCrFwd), []);

  // 3. Kringstand opaque token passthrough & order invariance (including rows with display tokens)
  const rawKr = loadJson(ROOT, 'fixtures/03-kring-m1-to-m5-live.json');
  rawKr.sealed_rows[0].display = '100%';
  const krFwd = mutateOpaqueTokens(rawKr, 'KR_FWD', false);
  const krRev = mutateOpaqueTokens(rawKr, 'KR_REV', true);
  const scKrFwd = compileKringstandScene(krFwd);
  const scKrRev = compileKringstandScene(krRev);

  assert.equal(canonicalJson(scKrFwd).includes('NaN'), false);
  const patchedFwd = scKrFwd.nodes.find((n) => n.id === 'step:vault-rule-patch');
  assert.equal(patchedFwd.cell.display, krFwd.sealed_rows[0].display);
  assert.deepEqual(
    scKrFwd.nodes.map((n) => n.id),
    scKrRev.nodes.map((n) => n.id)
  );
  assert.deepEqual(checkGeometricInvariants(scKrFwd), []);
});
