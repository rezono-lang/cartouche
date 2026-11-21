import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0009-slip-reads-rezono-reader.md',
  summary: 'Frozen std-view tokens and data-marks match Rezono packs/std-view at the slip source pin (sign names, verbs and their questions), and contracts/rezono-pin.json pins that commit; contract bump under Decision 0007 with owner review',
  waits_on: ['m2-slip-reads-rezono-reader']
};

test('M3 [std-view-matches-rezono]: SIGNS, STD_VERBS, data-sign values and rezono-pin agree with Rezono std-view at packages/slip/rezono-source.json', () => {
  assert.fail(
    'RED TASK (planner + owner review, Decision 0007): bump contracts/std-view.v2.tokens.json, contracts/data-marks.json and contracts/rezono-pin.json so that the sign names equal Rezono key.yaml signs + statuses, STD_VERBS equal Rezono Sheets.verbs (suppose, compare, propose without a question), and pinned_commit equals packages/slip/rezono-source.json commit; then drop the slip rule that leaves out signs the two keys do not share'
  );
});
