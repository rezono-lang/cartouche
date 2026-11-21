import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §6: levels of detail follow the partonomy; bands, label rules and chip counts come from the scene and the reader",
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

// Decision 0013 §6. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-semantic-zoom]: Anchored proof map §6', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. The scene IR records a camera-distance band per partonomy level; at a camera distance inside a band, the visible labels are exactly the ones the scene lists for that band.",
      "2. A container (roof, wall, cabinet door) fades when the camera enters it; the fade depends on camera position only.",
      "3. The label density bound per screen region, recorded in the scene, holds in a headless layout check; when labels compete, higher strata win.",
      "4. From far away a group of things is one chip with the count the reader publishes; a chip never shows a count the reader did not publish."
    ].join('\n')
  );
});
