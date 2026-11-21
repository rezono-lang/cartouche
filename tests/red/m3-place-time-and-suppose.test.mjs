import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §8: valid-at, known-at and suppose swap between worlds the reader serves; moved things move; the client computes no state",
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
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm2-proof-map-suppose',
    'm2-proof-map-time',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §8, §9 item 5. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-time-and-suppose]: Anchored proof map §8', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. Changing \"known at\" or \"valid at\" swaps the place scene to the one the reader serves for that time; every state shown is a served state.",
      "2. A thing whose anchor differs between two served epochs moves between its two served positions (motion between epochs, reduced motion respected).",
      "3. Turning `suppose` on shows the world the reader serves for it; the marks whose state differs from the base world are exactly the served differences.",
      "4. No state, value or position is computed in the client to produce either world (lint and opaque-token mutation)."
    ].join('\n')
  );
});
