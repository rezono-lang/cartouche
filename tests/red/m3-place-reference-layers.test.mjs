import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 3,
  summary: "Anchored proof map §10: base maps, point clouds and models are reference layers behind the data, licensed, thinned at build time, never a premise unless a witness names them",
  waits_on: [
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §10. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-reference-layers]: Anchored proof map §10', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. Every reference layer in the scene IR carries its licence identifier and attribution, and the attribution is visible in the view.",
      "2. Reference layers are thinned at build time; the client receives the thinned set and never thins by itself.",
      "3. A reference layer appears as a premise in a slip only if the reader's witness lists it.",
      "4. The licence check rejects a reference layer whose licence is not permitted for display."
    ].join('\n')
  );
});
