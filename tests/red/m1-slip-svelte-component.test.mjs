import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0004-swisstopo-oklch-palette-and-data-marks.md',
  summary: 'Build embeddable @rezono/slip Svelte 5 component + Web Component with canonical data-* marks & W/D/M/S/C/P shortcuts',
  waits_on: []
};

test('M1: @rezono/slip emits canonical data-* marks, 5-bar micro-prism, [M] levers, [S] Δ=1 hops, and unserved 410 state', () => {
  assert.fail('RED TASK: implement packages/slip/src/Slip.svelte + custom element wrapper verified against contracts/data-marks.json and fixtures/07-unserved-410.json');
});
