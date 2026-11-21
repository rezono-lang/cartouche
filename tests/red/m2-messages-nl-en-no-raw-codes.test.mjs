import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Dutch and English through the Rezono MF2 messages: every visible label, reason and sentence on every sheet and the slip comes from MF2 in the chosen language, and no raw snake_case reason code is shown to users (stricter than the i18n-mf2 helper of #31)',
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

// Decision 0012 §7, issue #23 §5. After #31 sheets still show raw codes as text (sheet 05: income_statement_not_received,
// valid_after_knowledge; sheet 02: origin_design). The code stays in data-reason; the text comes from MF2.

test('M2 [messages-nl-en-no-raw-codes]: every visible text comes from MF2 in nl or en, and no reason code reaches the user', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Each sheet and the slip render with lang nl and lang en; the html lang attribute follows. Every text node outside values, keys and hashes is a message from the MF2 files of Rezono (packs/std-view, packs/std-explain, the pack own messages), filled by viewer/messages/src/fill.ts at build time.',
      '2. No visible text node matches ^[a-z]+(_[a-z0-9]+)+$ (a snake_case code); data-reason keeps the code for tests.',
      '3. A reason or label without a message in the chosen language says so with the MF2 fallback message, never the code.',
      '4. packages contain no English user-facing literals in sheet markup (aria-label and th text included); the check is a test, not a review.'
    ].join('\n')
  );
});
