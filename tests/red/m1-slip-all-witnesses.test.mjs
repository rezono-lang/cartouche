import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'The slip shows every distinct witness the reader publishes for a conclusion, not only the shortest: one proof tree per witness IRI, each with its own premises and seal check',
  waits_on: [
    'planner:assertions',
    'm1-slip-proof-tree'
  ]
};

// Decision 0012 §2 (3b). Rezono keeps distinct witnesses and validates on-demand alternatives
// (decisions/language-expression-semantics.md, decisions/platform-query-results.md). Showing one hides that a conclusion
// holds in two ways, which is exactly what tells a reader whether a single premise is load-bearing.

test('M1 [slip-all-witnesses]: the slip lists all distinct witnesses of a conclusion', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. For a conclusion the reader answers with n distinct witnesses, the slip renders n proof trees (or n groups in one grounds table), each headed by a row whose data-proof-ref is that witness IRI (<base>witness/<64 hex>). n and the IRIs equal the recorded answer; their order is the reader order.',
      '2. The shortest witness is not singled out by Cartouche; any ranking comes from the reader.',
      '3. A premise that occurs in every witness is marked load-bearing only if the reader publishes that; Cartouche does not intersect witnesses itself.',
      '4. Tested against recorded reader answers for a conclusion with at least two witnesses. Where the reader serves one witness only, open the issue in rezono-lang/rezono and keep this test red.'
    ].join('\n')
  );
});
