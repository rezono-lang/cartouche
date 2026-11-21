import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §3: a place Rezono serves as invalid is drawn at both candidate places, joined by the conflict line from the witness; Cartouche never picks one",
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

// Decision 0013 §3. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-contested-anchor]: Anchored proof map §3', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. For a thing whose place the reader serves as `invalid` (two sources, two places), the scene draws both candidate places, each taken from the witness.",
      "2. A conflict line joins the two candidates; no mark of that thing stands at only one of them.",
      "3. Conclusions that rest on the contested place carry the state the reader serves (for example `invalid`), never a state computed in Cartouche.",
      "4. The slip opened from either candidate names both sources and the witness."
    ].join('\n')
  );
});
