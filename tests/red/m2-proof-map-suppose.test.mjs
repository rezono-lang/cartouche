import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 8: a suppose toggle on a fact ripples through to the conclusions as the reader publishes the variant, with the turning points marked',
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

// Decision 0012 §3a (proof map, requirement 8). Rezono publishes sweeps, variants and turning points; Cartouche shows them.

test('M2 [proof-map-suppose]: suppose on a fact ripples to the conclusions, and turning points are marked', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. A fact row that has a published variant or sweep shows a suppose toggle; switching it renders the variant answers: every row that changes shows the old value in del and the new in ins (◇ supposed sign), every row that does not change stays as it was.',
      '2. Rows the variant reaches (impact or consequence as the reader answers) are marked along their edges; nothing is recomputed in the page.',
      '3. Turning points the reader publishes for the sweep (stops with data-turn="turns") are marked on the swept fact with their values; red and not computed stops show no new value.',
      '4. Toggling back restores the map exactly (same files hashes).'
    ].join('\n')
  );
});
