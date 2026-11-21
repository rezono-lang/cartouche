import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'The hatch for unknown is one visual signature: every unknown mark on every sheet, the slip and the specimen uses one hatch with the spacing, angle and width of the Rezono key (6, 45, 1) and the hatch token',
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
    'm1-time-valid-at-known-at'
  ]
};

// Decision 0012 §7. Rezono's packs/std-view/key.yaml: hatch: {color_role: status.unknown, spacing: 6, angle: 45,
// width: 1}. Today sheets define their own patterns (cartouche-hatch-45, relief-unknown-hatch, bt-hatch, monge-hatch)
// with different geometry. Pattern ids may stay (green tests name some); the geometry is one.

test('M2 [hatch-signature]: one hatch geometry for unknown everywhere', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Every svg pattern used to fill an unknown mark has width and height 6 (the spacing), patternTransform rotate(45), one line of stroke-width 1, and stroke var(--c-hatch).',
      '2. Every unknown mark in HTML (twin cells, slip cells) shows the same hatch as a CSS background built from the same token and geometry, next to the ▨ glyph.',
      '3. The specimen shows the hatch once, as the sign of unknown, in each palette.',
      '4. A mark that is not unknown never uses the hatch.'
    ].join('\n')
  );
});
