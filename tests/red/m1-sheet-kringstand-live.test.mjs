import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0003-atlas-six-sheets-and-slip-backbone.md',
  summary: 'Build Sheet 03 (Kringstand & Round Timeline) with separate hatched unknown band and <250ms Propose lock',
  waits_on: []
};

test('M1: Sheet 03 renders 5 board lanes, separate unknown strip, round chronometer, and locks [P] on live delta', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/KringstandSheet.svelte against fixtures/03-kring-m1-to-m5-live.json');
});
