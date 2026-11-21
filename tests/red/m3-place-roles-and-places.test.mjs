import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0013-anchored-proof-map.md',
  priority: 1,
  summary: "Anchored proof map §7: a place can be personal; the reader decides full, coarser or no anchor per role, and no finer coordinate leaks anywhere",
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
    'm2-no-silent-omission',
    'm2-proof-map-proof-in-place',
    'm2-proof-map-role-lens',
    'm2-proof-map-semantic-layout',
    'm2-proof-map-state-glyphs',
    'm3-place-anchors-from-reader',
    'm3-place-two-layouts-one-graph'
  ]
};

// Decision 0013 §7, §9 item 4. Before a worker claims this task, a planner PR records the fixture from Rezono's reader and
// replaces this list with executable assertions against it, with hand-checked expectations (Decision 0013 §13).

test('M3 [place-roles-and-places]: Anchored proof map §7', () => {
  assert.fail(
    [
      'RED TASK (Decision 0013). Acceptance, each point an assertion of the promoted test:',
      "1. For a role whose reader output coarsens an anchor to a higher partonomy level, the mark stands at that level and no finer coordinate appears in the scene IR, the table twin, the DOM, URLs or hashed state.",
      "2. For a role whose reader output withholds an anchor, the mark is in the unplaced tray, or absent if the row itself is hidden, and no coordinate of it appears anywhere.",
      "3. No placeholder, lock icon or count appears unless the reader published it (AGENTS.md rule 6).",
      "4. Switching role swaps to that role's served scene; nothing finer survives in memory that the DOM can reach.",
      "5. Until Rezono serves the role decision for places (Decision 0013 §9 item 4), this test stays red and its PR links the Rezono issue."
    ].join('\n')
  );
});
