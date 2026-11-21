import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 5: why unknown and why not in the map: a missing premise is a ghost row with its published reason, and the conclusion stays unknown, never no; first case the unknown income of p-bob in the healthcare allowance',
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
    'm1-time-valid-at-known-at',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 5). The drawer part is m1-slip-why-not-why-unknown; this is the map part.
// The owner saw it in the mockup: the income of Bob unknown on 1 February, so the allowance is unknown until 1 March.

test('M2 [proof-map-ghost-rows]: missing premises are ghost rows with their reason; unknown conclusions stay unknown', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. A premise the reader names in gap or contrast but that is not in the publication is drawn as a ghost row in its lane: hatched outline, no value, the reason from MF2 (for example: waiting for the tax authority), data-state and data-reason as published.',
      '2. The edge from a ghost row is dashed (m2-proof-map-state-glyphs), and the conclusion it supports stays data-state="unknown" with its reason; it is never drawn as no, false, zero or absent unless the reader publishes that.',
      '3. First case from the recording: at the epoch where the income of p-bob is not yet known, the income is a ghost row in the tax lane and the allowance of p-bob is unknown; at the epoch where it is known, the ghost row is gone and the allowance shows its published value. The recording decides the dates; where they differ from the mockup (1 February, 1 March), the PR says so.'
    ].join('\n')
  );
});
