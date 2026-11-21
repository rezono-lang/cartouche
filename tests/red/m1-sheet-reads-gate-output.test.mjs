import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'At least one sheet (flow split or bitemporal staircase) renders from output that the Rezono gate produced at the pinned Rezono commit, recorded in CI like fixture 10; a hand-written fixture stays only if a test holds every row equal to that output (stricter than the ReaderClient loaders of #31)',
  waits_on: []
};

// Decision 0012 §2 (2), issue #23 §3: every sheet reads a hand-written fixture. #31 added ReaderClient loaders to the relief
// and ripple models, but every sheet still renders a hand-written fixture. Real data means what Rezono publishes, read
// through its gate at the pinned commit and recorded, not a fixture written to look like it or a stub reader serving one.

test('M1 [sheet-reads-gate-output]: the flow split or the bitemporal staircase renders from recorded Rezono gate output', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Pick the flow split (stated and observed, Rezono packs std-loop and the platform example) or the bitemporal staircase (one key over valid time and knowledge time, several epochs).',
      '2. Record what the Rezono gate (edge/gate/src/local.ts) answers for that sheet at the Rezono commit pinned in packages/slip/rezono-source.json (the one pin; #23 §3 belongs to the slip-port work), in CI, the way .github/workflows/rezono-reader-parity.yml records fixtures/10-slip-reader-answers.json: a new fixtures/<nn>-<sheet>-gate-answers.json with source.repository, source.commit equal to the pin, source.how naming the workflow run, and each answer with its status and body. Nothing in it is written by hand.',
      '3. Build the sheet input from those answers at build time (Decision 0001: the page never derives); the sheet component renders from it with no hand-written value.',
      '4. The test asserts: source.commit equals the pin; every drawn mark (svg [data-proof-ref] and twin rows) names a relation and key that occur in the recorded answers; every display value equals the published one; the sheet passes its existing invariants (legend, twin, seal, zero digits on unknown, completeness ref on absent).',
      '5. The hand-written fixture of that sheet (01 or 05) either leaves the sheet tests (planner PR, every assertion kept, rebased on the recorded output) or stays with a test that holds every row it has equal to the recorded output. No row of a hand-written fixture is exempt.',
      '6. Where the gate does not publish what the sheet needs, open an issue in rezono-lang/rezono, link it from the PR, and keep this test red. Cartouche does not compute it.'
    ].join('\n')
  );
});
