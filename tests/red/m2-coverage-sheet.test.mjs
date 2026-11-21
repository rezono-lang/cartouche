import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Coverage sheet after Stardog Designer question scoring: per declared question whether it is answered with proof, unknown or untested, and which kinds or slots no question uses',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at'
  ]
};

// Decision 0012 §3 (9).

test('M2 [coverage-sheet]: per declared question: answered with proof, unknown or untested; unused kinds and slots listed', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. One table row per declared question (table first), with data-state answered, unknown or untested as the reader or a recorded test run publishes it: answered means at least one row with a checked witness; unknown means the reader answered unknown with a reason; untested means no recorded answer exists.',
      '2. A second table lists the kinds and slots of the publication that no declared question reads, from the reader catalogue.',
      '3. Every count shown is a published value (Decision 0001); Cartouche does not count rows itself.',
      '4. Each answered question links to an example answer and its slip.'
    ].join('\n')
  );
});
