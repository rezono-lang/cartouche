import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 3,
  summary: "Anchored proof map §12: measured, not claimed: a recorded scene of at least 200,000 points and 2,000 marks stays at or under 16.7 ms frame time (p95) on CI",
  waits_on: [
    'planner:assertions',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-scale',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §12. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-scale-measured]: Anchored proof map §12', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. A recorded or generated domain-free scene with at least 200,000 reference points and 2,000 marks is rendered by the single WebGL renderer of m2-proof-map-scale.",
      "2. While orbiting, panning and zooming on the CI GPU runner, the 95th percentile frame time is at or under 16.7 ms, measured by this test.",
      "3. The first-render time is measured and recorded by this test; any claim about speed in docs names this test (m1-claims-match-build)."
    ].join('\n')
  );
});
