import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'No hairballs: every exploration view opens as a table or as an ego graph of one question or key; the proof map grows only by explicit why, depends on and affects expansions or a selected witness, and groups by kind with published counts',
  waits_on: [
    'planner:assertions',
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §8 and §3a (proof map requirement 9), avoiding what users dislike in RDFox and Stardog explorers.
// Amended for the proof map: the map is a graph, but it starts small and grows only on request.

test('M2 [table-first-no-hairball]: table first or an ego graph; the map grows only on request', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The key page, the slip answers and the question desk open on a table (table first in reading order, with th headers).',
      '2. The proof map opens as an ego graph: the focused question or key and its distance-1 neighbours as the reader answers them. A farther node appears only after an explicit expansion (why, depends on, affects) or as part of a selected witness (m2-proof-map-proof-in-place).',
      '3. Each node is a link to its slip (m1-mark-opens-slip) and to its own focus.',
      '4. Above the group threshold of the decision, rows of one kind collapse into one chip with the count the reader publishes; Cartouche counts nothing itself.',
      '5. Layered views that are tables in disguise (distance columns of sheet 04) are allowed.'
    ].join('\n')
  );
});
