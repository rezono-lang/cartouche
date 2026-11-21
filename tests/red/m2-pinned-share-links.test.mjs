import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Pinned share links: sharing a conclusion shares its pinned address; the recipient sees only the part of their own role, and a 410 page with the withdrawal reason if it was withdrawn',
  waits_on: [
    'planner:assertions',
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-reads-svg-fill',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-no-injected-seal-checks',
    'm1-origin-signs-and-bindings-from-reader',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-seal-checks-only-as-served',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-refuses-request-model',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-no-browser-seal',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §3 (11). After Stardog Explorer share links, with Rezono pins and withdrawal
// (decisions/publication-supersession-and-withdrawal.md).

test('M2 [pinned-share-links]: a shared link carries the pinned address and respects role and withdrawal', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Share on a slip or the proof map copies a link that carries the pinned conclusion IRI, the time controls (valid at, known at, epoch), the selection and, on the map, the role lens. No session and no personal data in the URL.',
      '2. Opened by another role, the link shows that role part of the conclusion. A role lens in the link never grants more than the reader allows the recipient: a recipient who may not view that lens sees their own role and a notice. A role that may not read the conclusion gets the same answer as for an unknown address (no leak that it exists).',
      '3. For a withdrawn epoch or row the link shows the 410 page with the withdrawal reason, decider and date as the reader serves them, and zero tr[data-line].',
      '4. For a superseded epoch the page shows the pinned (old) result and says which newer manifest superseded it, from the reader headers.'
    ].join('\n')
  );
});
