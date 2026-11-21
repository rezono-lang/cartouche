import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 1,
  summary: "Anchored proof map §3: every placed mark stands on the anchor Rezono served, through one fixed transform per grid; no anchor is ever made in Cartouche",
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

// Decision 0013 §3, §9 item 1. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-anchors-from-reader]: Anchored proof map §3', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. The scene compiler places each row by one fixed, recorded transform per grid (national grid in mm, geographic grid in 1e-7 degree, local grid in mm or rack units). For every placed mark in the recorded fixture, its scene position equals that transform of the anchor the reader served, exactly.",
      "2. A row the reader serves without an anchor is in the unplaced tray of the place layout and has no place coordinates anywhere in the scene IR.",
      "3. Changing a label, a name or an address-like text in the fixture leaves every position unchanged: no code path makes a place from text (mutation check).",
      "4. No geocoding, address parsing or snapping code exists under packages/ or apps/ (the zero-compute lint and the domain check cover both).",
      "5. Until Rezono serves `anchor` (Decision 0013 §9 item 1), this test stays red and its PR links the Rezono issue."
    ].join('\n')
  );
});
