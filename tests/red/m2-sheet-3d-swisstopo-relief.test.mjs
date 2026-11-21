import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0002-cartouche-scene-ir-and-xd-discipline.md',
  summary: 'Build Sheet 01 (3D Swisstopo Statutory Relief via Threlte v8 orthographic) + hatched A003 curtain + 2D profile toggle',
  waits_on: ['m1-slip-svelte-component']
};

test('M2: Sheet 01 renders orthographic Swisstopo 3D terrain, cliff distance markers, collapsing A003 curtain, and 2D fallback', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/StatutoryRelief3D.svelte (Threlte v8 MIT, ortho-only) against fixtures/04-subsidy-a001-a003.json');
});
