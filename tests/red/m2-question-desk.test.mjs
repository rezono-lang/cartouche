import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Question desk as the entry page: start from the declared Rezono questions, or for a citizen from their own case; an optional LLM front answers only through declared questions, always shows the question, its parameters and its witness, else says unknown because',
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

// Decision 0012 §3 (8). There is no app or entry page today. After Stardog Voicebox answer provenance, done stricter:
// every answer is a Rezono row with its proof.

test('M2 [question-desk]: the entry page starts from declared questions and never shows text without a Rezono row', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The entry page lists the declared questions the role may ask (the questions.yaml of the packs in the publication, through the reader catalogue), with their labels from MF2, Dutch and English.',
      '2. A citizen role opens on their own case: the conclusions about their own key, nothing about other keys.',
      '3. Asking a question renders the answer rows with the question term, its parameters and, per row, the link to its slip (m1-mark-opens-slip).',
      '4. An optional LLM front may only choose a declared question and its parameters. The page shows which question and parameters it chose and the witness of each answer row. If no declared question fits, or the reader answers unknown, it shows unknown with the reason (unknown, because ...). It never shows free text that is not a Rezono row or an MF2 message.',
      '5. Tested with a stub front: a front that returns free text is refused by the page; a front that returns question plus parameters gets the reader answer shown with its question, parameters and witness.'
    ].join('\n')
  );
});
