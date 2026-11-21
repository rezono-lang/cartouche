import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0005-rezono-core-five-projections.md',
  summary: 'Build Sheet 04 (Adaptive Distance Columns >12 nodes + Live 60fps Causal Ripple Graph with OR-shields via PixiJS v8)',
  waits_on: ['m1-slip-svelte-component']
};

test('M2: Sheet 04 switches to Distance Columns for 28 dependents and propagates 4-valued shockwaves through OR-shields and AND cliffs', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/CausalRippleSheet.svelte (PixiJS v8 MIT) against fixtures/06-keycloak-dense-28.json');
});
