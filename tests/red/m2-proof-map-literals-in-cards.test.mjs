import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 2: literal values live inside node cards as opaque published displays, never as separate nodes (RDFox draws male as a node; the proof map does not)',
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

// Decision 0012 §3a (proof map, requirement 2).

test('M2 [proof-map-literals-in-cards]: literal values are rows inside node cards, not nodes', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Every node card lists the slots of its row with their published display values (opaque cells, Decision 0001); a literal (text, number, date, enum value) is never a node and never the end of an edge.',
      '2. Edges join rows only (a premise row to the conclusion it supports), each edge carrying both ends as data-relation and data-key.',
      '3. A slot with an unknown value shows the unknown sign and its reason inside the card, with no digit.',
      '4. The table twin has the same rows and slot values as the cards.'
    ].join('\n')
  );
});
