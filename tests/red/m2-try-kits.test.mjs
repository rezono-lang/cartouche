import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Try kits after Stardog Knowledge Kits: one-click demos (healthcare allowance, tax return, platform) from published Rezono examples, with a suppose toggle that shows how the conclusion and its proof tip over',
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

// Decision 0012 §3 (12). Kits are Rezono publications (its examples), recorded like fixture 10, not hand-written.

test('M2 [try-kits]: one-click demos with a suppose toggle that tips the conclusion and its proof', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The entry page offers three kits: healthcare allowance, tax return and platform, each a recorded Rezono publication with its source commit.',
      '2. Each kit opens on one conclusion with its slip. A suppose toggle switches to the published variant (sweep or scenario) and shows the conclusion and its proof tip over: old in del, new in ins, from the published difference, and the turning point if the reader publishes one.',
      '3. Toggling back restores the original page exactly (same files hashes).',
      '4. Domain words live in the kits data and MF2 messages only; packages stay domain-free (scripts/leak-and-domain-check.mjs).'
    ].join('\n')
  );
});
