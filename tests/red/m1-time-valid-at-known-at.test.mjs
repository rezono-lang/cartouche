import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Two global controls, valid at and known at, apply to every sheet and the slip; each sheet states the valid time and the epoch it shows, and the bitemporal staircase is their detail view',
  waits_on: [
    'm1-sheet-reads-gate-output'
  ]
};

// Decision 0012 §2 (4). Time is the main control. Rezono facts are bitemporal: valid time (when it holds) and
// knowledge time (which epoch, which manifest). An earlier epoch stays citable (publication-supersession-and-withdrawal).

test('M1 [time-valid-at-known-at]: valid at and known at drive every sheet', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The atlas page renders one input[name="valid_at"] and one input[name="known_at"] with labels from the MF2 messages; known_at offers the epochs the reader lists for the role, valid_at the dates the publication can answer.',
      '2. Changing known_at re-renders every sheet and the slip from the manifest of that epoch: each seal shows that manifest hash, and an epoch the role can no longer read shows the 410 or unserved page, never the newest data in its place.',
      '3. Changing valid_at selects the rows valid at that date as the reader answers them; Cartouche filters nothing by date (Decision 0001).',
      '4. Each sheet carries the valid time and epoch it shows in its cartouche (Rezono sheets.yaml: pack, manifest, knowledge_time); two sheets on one page never show different times without saying so.',
      '5. The bitemporal staircase opens on the cell (valid_at, known_at) of the controls, and choosing a cell there sets both controls.',
      '6. The state of both controls is part of the page address, so a link reproduces the same view.'
    ].join('\n')
  );
});
