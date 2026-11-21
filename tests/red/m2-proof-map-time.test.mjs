import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 7: the valid at and known at controls apply to the map, and a change between epochs is animated (what goes, what comes) only when reduced motion is not asked',
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

// Decision 0012 §3a (proof map, requirement 7), building on m1-time-valid-at-known-at and m1-motion-between-epochs.

test('M2 [proof-map-time]: valid at and known at drive the map, and an epoch change shows what goes and what comes', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The map reads the global valid_at and known_at controls; its cartouche states the valid time and epoch it shows.',
      '2. Moving known_at between two recorded epochs marks rows that leave as removed (del) and rows that come as added (ins), from the published difference, each linking to the proof of its own epoch.',
      '3. The transition is animated only inside @media (prefers-reduced-motion: no-preference); under reduce the end state appears at once with the same del and ins marks.',
      '4. First case: moving known_at across the epoch where the income of p-bob arrives turns the ghost row into a fact row and the allowance from unknown into its value.'
    ].join('\n')
  );
});
