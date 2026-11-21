import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 1,
  summary: "Anchored proof map §1–2: one graph with two layouts (by derivation, by place); the client only interpolates between served positions; height is the stratum",
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
    'm2-proof-map-state-glyphs'
  ]
};

// Decision 0013 §1, §2, §9 item 2. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-two-layouts-one-graph]: Anchored proof map §1–2', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. The derivation layout and the place layout of one scene have the same node ids, the same edges, the same glyphs and the same selection.",
      "2. In the place layout, a row's height equals its served derivation stratum times the step the scene records; keyed things stand on their anchor below the facts.",
      "3. The layout control moves continuously between the two layouts; the only arithmetic the client performs on positions is linear interpolation between two served positions (lint over packages/ and apps/).",
      "4. Selecting a conclusion in one layout keeps it selected, with the same highlighted witness, in the other.",
      "5. Until Rezono serves the stratum (Decision 0013 §9 item 2), this test stays red and its PR links the Rezono issue."
    ].join('\n')
  );
});
