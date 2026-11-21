import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Why not and why unknown in the slip: a missing premise is a ghost row with its published reason, the conclusion stays unknown (never no), and a premise the role may not read says not readable for your role, with n premises hidden only as the reader publishes it (proof map requirements 5 and 6)',
  waits_on: [
    'planner:assertions',
    'm1-sheet-reads-gate-output',
    'm1-slip-proof-tree'
  ]
};

// Decision 0012 §2 (3c) and §3a (proof map, requirements 5 and 6, folded into the drawer). Unique to the four Rezono
// states: absent, unknown, not applicable and invalid each have a reason. Rezono std-explain publishes gap (the first
// premise that fails, with candidate deltas) and contrast (what lacks support). A premise can be missing in the
// publication or not readable for this role; RDFox drops the second silently.

test('M1 [slip-why-not-why-unknown]: why not and why unknown show ghost rows with their reason, keep unknown unknown, and say what the role may not read', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. On an absent conclusion, opening why not renders table[data-answer="contrast"]; on an unknown or absent one, opening missing renders table[data-answer="gap"]. Each has th headers and one tr per premise the reader names, with data-relation, data-key, data-polarity and data-state.',
      '2. Ghost row: a premise missing from the publication is drawn in the proof (also in the grounds table of m1-slip-proof-tree) as a row with data-state="unknown" and the data-reason the reader gives, its text from MF2 (for example: waiting for the tax authority), or with data-state="absent" and its data-completeness-ref. A ghost row has no value and no digit.',
      '3. The conclusion that rests on a ghost row stays data-state="unknown" with its reason. It is never shown as no, false, zero or absent unless the reader publishes that state.',
      '4. Role lens: a premise the current role may not read is said as such (not readable for your role, from MF2) without its key, value or source. The conclusion says how many of its premises are hidden (for example 1 premise hidden) only when the reader publishes that number for the role; Cartouche counts no hidden rows itself (AGENTS.md rule 6). Rendering the same conclusion for a role that can read it shows the premise itself. The test renders both roles from recorded answers.',
      '5. Candidate deltas the reader returns for gap are listed as the reader orders them; Cartouche ranks nothing.',
      '6. First gate case: in the recorded healthcare allowance answers, at the epoch where the income of p-bob is not yet known, the income row is a ghost row with the reason the gate gives and the allowance of p-bob is unknown; at the epoch where it is known, the allowance has its published value. Dates and wording come from the recording; where they differ from the mockup (unknown on 1 February, known from 1 March), the recording wins and the PR says so.'
    ].join('\n')
  );
});
