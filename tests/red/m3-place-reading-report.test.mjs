import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §12a: each layout shows the reading report Rezono publishes (order, containment, coverage, distinctness), as a warning, never a block; Cartouche computes none of it",
  waits_on: [
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-scale',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §12a, §9 item 6. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-reading-report]: each layout shows the reading report Rezono publishes, as a warning', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. For each layout (by derivation, by place) and each role in the recorded fixture, the scene shows the reading report Rezono publishes for that layout and role, in a fidelity panel beside the scene.",
      "2. The panel's counts (order, containment, coverage, distinctness) and the listed offending elements equal the published report exactly. They are opaque display cells.",
      "3. A broken measure is shown as a warning. It never blocks rendering, publishing or CI (owner, 21-11).",
      "4. No preservation measure is computed under packages/ or apps/ (lint). Changing a mark's position in the client changes no number in the panel (opaque-token mutation).",
      "5. Until Rezono publishes reading reports (Rezono decision one-structure-space-and-readings §5), this test stays red and its PR links the Rezono red test."
    ].join('\n')
  );
});
