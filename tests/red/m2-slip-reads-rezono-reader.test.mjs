import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0009-slip-reads-rezono-reader.md',
  summary: 'Slip reads Rezono reader answers (fixtures/10) through a build-time port of Rezono model.ts; fill.ts sentences; data-line from 0; calc steps as lines; stops inside the swept line; folds from the published difference; Rezono DOM cases carried over',
  waits_on: []
};

test('M2 [slip-reads-rezono-reader]: render from recorded reader answers satisfies every DOM case of Rezono tests/slip', () => {
  assert.fail(
    'RED TASK: port rezono viewer/slip/src/model.ts to packages/slip/src/model.ts (build time only, never in the page bundle), consume fill.ts and std packs through packages/slip/rezono-source.json, record fixtures/10-slip-reader-answers.json, and carry over Rezono tests/slip cases: slip-rule-row (lines and links from 0, aggregate total before contributors), slip-calculated-row (steps as tr[data-line][data-path], no constant), unknown-shows-no-digit, tables-and-legend, unserved-publication (served seal reader-hashes + publisher-record; refused -> [data-part=unserved], no line), verbs-that-answer (why/depends on group_size; missing only with a reader that answers gap; identical files), stops-only (stops inside the item__amount line with statuses, turns, red checks, fold 12 -> 20 from the difference at stop 4, none at 3 and 6, all unavailable for summary)'
  );
});
