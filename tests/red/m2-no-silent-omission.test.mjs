import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'No silent omissions: wherever the role may not read part of an answer, the page says not readable for your role (MF2), once, without names, keys or placeholders; a number of hidden premises appears only as the reader publishes it',
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

// Decision 0012 §8 and AGENTS.md rule 6: zero leaks, and honest incompleteness (not_read_in_full). A view that drops
// rows the role may not read without saying so looks complete and is not.

test('M2 [no-silent-omission]: what a role may not read is said, without leaking what or how much', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. When the reader marks an answer or snapshot as not read in full for the role (head full: false, unavailable stops, refused rows), the page shows one notice from MF2 (not readable for your role) at that answer.',
      '2. The notice carries no key, no name, no grey placeholder and no lock icon per hidden row; rendering complete-role data as the restricted role leaks no hidden id into html, svg or scene IR. A number of hidden premises of a visible witness (proof map requirement 6) appears only as the reader publishes it for that role; lists never show a count of hidden rows.',
      '3. A full read shows no notice.',
      '4. Tested with recorded answers for a full and a partial role of one publication.'
    ].join('\n')
  );
});
