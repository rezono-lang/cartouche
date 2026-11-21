import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 2,
  summary: "Anchored proof map §12: a table twin with anchor path, state, value and stratum; keyboard walking along edges and the partonomy; reduced motion; MF2",
  waits_on: [
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm2-messages-nl-en-no-raw-codes',
    'm2-proof-map-accessible',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §12. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-accessible-twin]: Anchored proof map §12', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. The table twin lists every placed row with its anchor path, state glyph, value (opaque cell) and stratum, in the order the scene records.",
      "2. The keyboard walks along edges (why, depends on, affects) and along the partonomy (up, down, siblings), and the focused mark is announced as a sentence through MF2.",
      "3. Under `prefers-reduced-motion: reduce` the layout control and camera moves jump instead of animating.",
      "4. No raw snake_case code is shown as text in the view or the twin."
    ].join('\n')
  );
});
