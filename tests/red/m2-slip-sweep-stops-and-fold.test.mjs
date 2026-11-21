import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0006-slip-conformance-boundary.md',
  summary: 'Slip conformance (7/7): stops-only — inline sweep stops [data-stop][data-status][data-turn], red checks, <del>/<ins> fold from published diff, and partial-role unavailable stops',
  waits_on: ['m1-slip-svelte-component']
};

test('M2 conformance [stops-only]: suppose opens published [data-stop] grid with data-status/data-turn, red [data-check], <del>/<ins> variant fold, no fold on red/not_computed, and all unavailable for partial-read roles', () => {
  assert.fail(
    'RED TASK: implement inline sweep stop strip in @rezono/slip driven by published series + variant diff and verify stops-only statuses, red checks, <del>/<ins> fold, and partial-role unavailable guard'
  );
});
