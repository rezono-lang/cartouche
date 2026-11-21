import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Pinned share links: sharing a conclusion shares its pinned address; the recipient sees only the part of their own role, and a 410 page with the withdrawal reason if it was withdrawn',
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

// Decision 0012 §3 (11). After Stardog Explorer share links, with Rezono pins and withdrawal
// (decisions/publication-supersession-and-withdrawal.md).

test('M2 [pinned-share-links]: a shared link carries the pinned address and respects role and withdrawal', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Share on a slip copies a link that carries the pinned conclusion IRI and the time controls, nothing else (no role, no session, no personal data in the URL).',
      '2. Opened by another role, the link shows that role part of the conclusion; a role that may not read it gets the same answer as for an unknown address (no leak that it exists).',
      '3. For a withdrawn epoch or row the link shows the 410 page with the withdrawal reason, decider and date as the reader serves them, and zero tr[data-line].',
      '4. For a superseded epoch the page shows the pinned (old) result and says which newer manifest superseded it, from the reader headers.'
    ].join('\n')
  );
});
