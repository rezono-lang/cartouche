import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 11: every map state (selection, role lens, valid at, known at, epoch, expansions) is a pinned shareable link that reproduces the same map',
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
    'm2-proof-map-semantic-layout',
    'm2-pinned-share-links'
  ]
};

// Decision 0012 §3a (proof map, requirement 11), with the rules of m2-pinned-share-links.

test('M2 [proof-map-shareable]: every map state is a pinned link that reproduces it', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The page address holds the focus (pinned conclusion IRI or key), the selection, the role lens, valid_at, known_at, the epoch and the expansions; no session and no personal data.',
      '2. Opening that address renders byte-identical map HTML and SVG for the same role.',
      '3. A role lens in the link never grants more than the reader allows the recipient (m2-pinned-share-links); a withdrawn epoch gives the 410 page.'
    ].join('\n')
  );
});
