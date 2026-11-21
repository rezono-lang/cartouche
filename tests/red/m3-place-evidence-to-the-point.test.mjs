import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §5: a measured fact highlights exactly the witness points and clip volume the reader serves; Cartouche never measures",
  waits_on: [
    'planner:assertions',
    'm1-contrast-reads-svg-fill',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-injected-seal-checks',
    'm1-origin-signs-and-bindings-from-reader',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-seal-checks-only-as-served',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-refuses-request-model',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-no-browser-seal',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §5, §9 item 3. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-evidence-to-the-point]: Anchored proof map §5', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. For a measured fact in the recorded fixture, the set of highlighted point ids equals the witness point ids the reader serves (set equality).",
      "2. The clip volume and the profile drawn in the panel come from the reader; their numbers are opaque display cells.",
      "3. Changing a point coordinate in the client changes no displayed value (opaque-token mutation test).",
      "4. No percentile, width, height or other statistic over points is computed under packages/ or apps/ (lint).",
      "5. Until Rezono serves measurement witnesses (Decision 0013 §9 item 3), this test stays red and its PR links the Rezono issue."
    ].join('\n')
  );
});
