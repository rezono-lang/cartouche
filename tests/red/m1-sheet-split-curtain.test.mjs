import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0003-atlas-six-sheets-and-slip-backbone.md',
  summary: 'Build Sheet 02 (Flow & Reality-Split Curtain) Svelte 5 component + deterministic SVG export',
  waits_on: []
};

test('M1: Sheet 02 renders stated || observed split curtain with dual-proof drift and complete_sweep absent', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/FlowSplitSheet.svelte and SVG snapshot check against fixtures/01-platform-drift.json and 02-platform-tenant-a.json');
});
