import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0002-cartouche-scene-ir-and-xd-discipline.md',
  summary: 'Add pure zero-compute CartoucheScene v2 compilers for Sheet 03 (kringstand), Sheet 04 (causal-ripple), and Sheet 05 (bitemporal-stair) passing xD-Guard + geometry invariants',
  waits_on: []
};

test('M1: pure zero-compute compilers for kringstand (fixture 03), causal-ripple (fixture 06), and bitemporal-stair (fixture 05) satisfy CartoucheScene v2 schema, xD-Discipline, and geometric invariants', () => {
  assert.fail(
    'RED TASK: implement compileKringstandScene, compileCausalRippleScene, and compileBitemporalScene in packages/scene-ir/src/ (one file per sheet) and verify against fixtures 03, 05, 06 and contracts/cartouche-scene.v2.schema.json'
  );
});
