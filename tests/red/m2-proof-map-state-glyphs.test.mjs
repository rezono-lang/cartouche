import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 3: every row and edge carries its state glyph from the key, never colour alone: stated fact with its origin glyph, derived, supposed, unknown hatched with a dashed edge, absent only after a complete sweep, invalid',
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

// Decision 0012 §3a (proof map, requirement 3). The owner listed: stated fact with its origin glyph, ○ derived,
// ◇ supposed, ▨ unknown (hatched, dashed edge), ⦸ absent (only after a complete sweep), ! invalid. In the key, ● is
// the origin glyph of an observation; a stated fact shows its own origin glyph (◆ ▲ ■ ●). ! needs the invalid sign
// in the key first (m1-invalid-drawn-everywhere).

test('M2 [proof-map-state-glyphs]: every row and edge shows its state with a glyph from the key, never by colour alone', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Every row in the map carries data-sign and shows the glyph of the key: a stated fact its origin sign (origin_decision, origin_vendor, origin_design, origin_observation), a derived row derived (○), a supposed row supposed (◇), an unknown row unknown (▨) on the hatch of m2-hatch-signature, an absent row absent (⦸), an invalid row invalid (!).',
      '2. An absent row is drawn only when the reader publishes its complete sweep: it carries data-completeness-ref; without one the row is not drawn as absent.',
      '3. An edge from an unknown premise is dashed with the dash of the key and carries data-state="unknown"; other edges are solid. Every edge carries the state of its premise.',
      '4. Rendered in the forced palette and in greyscale, every state remains distinguishable by glyph, hatch or dash (no two states share all three).',
      '5. Every sign drawn is listed in the legend.'
    ].join('\n')
  );
});
