import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §11: perspective only in the place layout and only when no channel encodes a magnitude by size or height; orthographic stays the default (amends 0002 §2)",
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

// Decision 0013 §11. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-camera-honesty]: Anchored proof map §11', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. The xD guard accepts a perspective camera for a place-layout scene that declares no magnitude channel by size or height.",
      "2. The xD guard rejects the same scene once a size or a height is bound to a value.",
      "3. Every other 3D sheet is still rejected with a perspective camera (0002 §2 unchanged).",
      "4. The place view opens orthographic; perspective is a viewer's choice and is recorded in the shareable state."
    ].join('\n')
  );
});
