import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0005-rezono-core-five-projections.md',
  summary: 'Build Sheet 05 (2D Matrix <-> 3D Orthographic Bitemporal Staircase with hollow not_applicable upper triangle)',
  waits_on: ['m1-slip-svelte-component']
};

test('M2: Sheet 05 renders Valid x Knowledge 2D matrix & 3D staircase highlighting retroactive Nov 18 delta and hollow N/A cells', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/BitemporalStairSheet.svelte against fixtures/05-subsidy-bitemporal.json');
});
