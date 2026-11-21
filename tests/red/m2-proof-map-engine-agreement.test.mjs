import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 10: every derived edge carries a mark that DuckDB and Feldera agree on it, or a visible disagreement mark, as the Rezono parity record publishes it',
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
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 10). Rezono records engine parity (decisions/feldera-calculation-parity.md).
// The owner sketched ! for disagreement; ! is the invalid sign of the key, so the disagreement sign is agreed in the
// Rezono key first (planner), and never by colour alone.

test('M2 [proof-map-engine-agreement]: each derived edge shows whether the engines agree', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Every edge into a derived row carries the engine agreement for its relation as the Rezono parity record publishes it: agree, disagree or unknown (no record), with a link to that record.',
      '2. Agreement shows a quiet mark; disagreement shows the disagreement sign of the key next to the edge and in the table twin; no record shows unknown with its reason.',
      '3. Cartouche compares no engine output itself (Decision 0001).',
      '4. The engine sheet (m3-engine-sheet) and the map read the same record.'
    ].join('\n')
  );
});
