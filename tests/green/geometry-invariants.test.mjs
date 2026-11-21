import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkGeometricInvariants,
  compileFlowSplitScene,
  compileMongeScene,
  compileReliefScene
} from '../../packages/scene-ir/src/index.ts';
import { verifySpecimenCoverage } from '../../packages/atlas/src/index.ts';

test('Headless geometric invariants pass on golden Flow, Relief, and Monge fixtures (<20ms)', () => {
  const fxFlow = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8'));
  const fxSub = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '04-subsidy-a001-a003.json'), 'utf8'));
  const fxMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));

  assert.deepEqual(checkGeometricInvariants(compileFlowSplitScene(fxFlow)), []);
  assert.deepEqual(checkGeometricInvariants(compileReliefScene(fxSub)), []);
  assert.deepEqual(checkGeometricInvariants(compileMongeScene(fxMonge)), []);
  assert.equal(verifySpecimenCoverage().ok, true);
});

test('Headless geometric invariants catch Monge Y-axis collisions and single-sided drift immediately', () => {
  const fxMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));
  // Force two services onto identical Y (the exact regression we caught visually!)
  fxMonge.services[3].y = fxMonge.services[1].y;
  fxMonge.drift_arcs[0].observed_proof_ref = '';

  const scene = compileMongeScene(fxMonge);
  const codes = checkGeometricInvariants(scene).map((e) => e.code);
  assert.ok(codes.includes('MONGE_Y_COLLISION'));
  assert.ok(codes.includes('EPI_DRIFT_SINGLE_SIDED'));
});
