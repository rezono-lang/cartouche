import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Key page after Stardog Explorer: all conclusions about one key (a person, a service) per role under the time controls; path means the derivation chain between two conclusions',
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

// Decision 0012 §3 (10).

test('M2 [key-page]: one page per key with all its conclusions, per role, under valid at and known at', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The page for a key lists every conclusion about it that the role may read (table first), grouped by kind, each linking to its slip, under the valid_at and known_at controls.',
      '2. The same key opened as another role shows that role part only; what the role may not read is said once, without counts or names (m2-no-silent-omission).',
      '3. Path: choosing two conclusions shows the derivation chain between them as the reader answers it (grounds and reach), as a table of steps; no client graph search.',
      '4. A neighbour graph, if shown, holds distance-1 neighbours only (m2-table-first-no-hairball).'
    ].join('\n')
  );
});
