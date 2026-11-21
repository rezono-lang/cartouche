import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 12: a table twin, keyboard walking along edges, and a screen reader that reads each row as a sentence through the MF2 messages',
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
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 12).

test('M2 [proof-map-accessible]: the map has a table twin, keyboard walking along edges, and rows read as sentences', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. A table[data-part="twin"] with th headers holds every drawn row (lane, kind, key, slots, state, sign) and every edge (premise, conclusion, state).',
      '2. Keyboard: every node is focusable; arrow keys walk along edges (left to premises, right to conclusions, up and down within a lane); Enter opens the slip; focus is always visible and the walk order is deterministic.',
      '3. Each node has an accessible name that is its row read as a sentence, filled from MF2 (the means sentence for a derived row, the fact sentence for a stated one), in nl and en; no snake_case code is read out.',
      '4. axe reports no violation on the map (with colour contrast decided, m1-contrast-wcag-aa), and the forced-colors and reduced-motion rules of m1-forced-colors-reduced-motion hold.'
    ].join('\n')
  );
});
