import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Engine sheet for builders after Stardog visual query plans: per relation whether DuckDB and Feldera agree, the pipeline budget, and the cost of deltas, all as published by Rezono',
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

// Decision 0012 §4 (13). For builders, after M1 and the entry work of M2.

test('M3 [engine-sheet]: per relation: engine agreement, pipeline budget and delta cost', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. One table row per relation of the publication with: whether the DuckDB and Feldera results agree (as the Rezono parity check publishes it, with a link to its record), the pipeline budget and its use, and the cost of the last deltas.',
      '2. Values are published values (Decision 0001); a relation without a published parity or budget shows unknown with the reason.',
      '3. A relation links to its rule (rule with bindings) and to a sample conclusion slip.',
      '4. Recorded from Rezono CI output at the pinned commit, not hand-written.'
    ].join('\n')
  );
});
