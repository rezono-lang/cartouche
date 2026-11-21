import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Motion only where it means something: moving known at between two epochs shows what disappears in del and what appears in ins, each with its own proof link, animated only under prefers-reduced-motion: no-preference',
  waits_on: [
    'm1-time-valid-at-known-at'
  ]
};

// Decision 0012 §2 (5a). The change between two epochs is the one motion with meaning. It uses the same del and ins
// as a fold in the slip. The breathing, 60fps and under 250 ms claims go in m1-claims-match-build.

test('M1 [motion-between-epochs]: the change between two epochs is shown as del and ins, animated only when motion is welcome', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Moving known_at from epoch A to epoch B (recorded gate output for both) marks every row that is in A and not in B inside <del>, and every row in B and not in A inside <ins>, on every sheet and in its table twin; a changed value shows the old value in del and the new in ins, from the published difference.',
      '2. Each del and ins element links to the proof of its own epoch (the address pinned to A for del, to B for ins).',
      '3. CSS transitions or animations of that change exist only inside @media (prefers-reduced-motion: no-preference); under reduce the same del and ins appear at once.',
      '4. Nothing else moves: no idle animation, no breathing, no motion on hover that carries no data.',
      '5. The difference is the reader published one (scenario or the epoch difference); Cartouche does not diff two snapshots itself.'
    ].join('\n')
  );
});
