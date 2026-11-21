import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Why not and why unknown in the slip: for an absent or unknown conclusion the slip shows which premise is missing and for which role, from the Rezono contrast and gap answers, never computed by Cartouche',
  waits_on: [
    'm1-slip-proof-tree'
  ]
};

// Decision 0012 §2 (3c). Unique to Rezono four states: absent, unknown, not applicable and invalid each have a reason.
// Rezono std-explain publishes gap (the first premise that fails, with candidate deltas) and contrast (what lacks
// support, and the rows that close it). A premise can be missing in the publication or not readable for this role.

test('M1 [slip-why-not-why-unknown]: why not and why unknown name the missing premise and the role it is missing for', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. On an absent conclusion, opening why not renders table[data-answer="contrast"]; on an unknown or absent one, opening missing renders table[data-answer="gap"]. Each has th headers and one tr per premise the reader names, with data-relation, data-key, data-polarity and data-state.',
      '2. A premise missing from the publication carries data-state="absent" with its data-completeness-ref, or data-state="unknown" with the data-reason the reader gives.',
      '3. A premise the current role may not read is said as such ("not readable for your role", from the MF2 messages) without its key, value or count; rendering the same conclusion for a role that can read it shows the premise itself. The test renders both roles from recorded answers.',
      '4. Candidate deltas the reader returns for gap are listed as the reader orders them; Cartouche ranks nothing.',
      '5. An unknown value cell still shows no digit, and every sign drawn is in the legend.'
    ].join('\n')
  );
});
