import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 6: switching the role lens shows exactly what that role may read; a hidden premise reads not readable for your role and the conclusion says n premises hidden as the reader publishes it, never a silent omission',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 6). RDFox omits what a role may not read without a word. The count of
// hidden premises comes from the reader (AGENTS.md rule 6: Cartouche counts no hidden rows itself).

test('M2 [proof-map-role-lens]: the role lens shows exactly what a role may read and says what it may not', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The lens offers only the roles the reader lets the viewer view; switching renders the map from that role answers, never by filtering a fuller answer in the page.',
      '2. For each role, the set of drawn rows equals the rows the reader serves to that role (tested with two roles of the recorded healthcare allowance publication).',
      '3. A premise hidden from the role appears once as not readable for your role (MF2), without key, value, lane position that would identify it, or placeholder per hidden row; the conclusion says how many premises are hidden (for example 1 premise hidden) only as the reader publishes that number.',
      '4. Rendering the full role data as the restricted role leaks no hidden id into html, svg or scene IR.'
    ].join('\n')
  );
});
