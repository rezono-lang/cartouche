import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0010-slip-reads-rezono-reader.md',
  summary: 'fixtures/09-slip-conformance.json equals what the ported model produces from the recorded reader answers for the same rows (lines, links, states, values, reasons, verbs, stops, folds), and renders with the same Rezono marks',
  waits_on: ['m2-slip-reads-rezono-reader']
};

test('M2 [slip-fixture-09-matches-reader]: every row of fixture 09 equals the model output from fixtures/10 for that row', () => {
  assert.fail(
    'RED TASK: compare each fixture 09 row and sweep with the model output from fixtures/10-slip-reader-answers.json (relation, key, polarity, depth, part, path, state, display, reason, sentence text and links, answered verbs, stop index/display/status/turn/checks, fold); fix fixture 09 where it differs from the reader (stop 5 turn, red check id); render both through bin/render.ts and require the same Rezono marks (data-line from 0 included)'
  );
});
