import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M4',
  decision: 'decisions/0011-quality-review-truth-and-guards.md',
  summary: 'Issue #23 §4: real complete-to-restricted role-zero-leak test, per-sign/per-state verifySpecimenCoverage, drawn-layout geometry/xD assertions, stricter zero-compute-lint (z_norm/bar_units/dependent_count/CSS calc/@cartouche-geometry-sort), pr-red-policy green-test guard, axe color-contrast + OKLCH token fixes',
  waits_on: ['m3-std-view-matches-rezono']
};

test('M4 [strict-guards-and-contrast]: real role-leak test, per-sign/state specimen check, drawn-layout geometry/xD tests, tightened zero-compute AST lint, green-test edit guard, and WCAG AA color-contrast enabled with fixed OKLCH tokens', () => {
  assert.fail(
    [
      'RED TASK (Decision 0011 / Issue #23 §4, waits on m3-std-view-matches-rezono):',
      '1. role-zero-leak.test.mjs must render complete-role data as a restricted role and prove zero hidden IDs, placeholders, or count leaks (not merely test a pre-stripped fixture).',
      '2. verifySpecimenCoverage() must assert coverage per std-view sign and per epistemic state (not merely total counts).',
      '3. Geometry and xD tests must verify actual drawn SVG/DOM layout coordinates and projections rather than compiler-set constants and synthetic grid boxes.',
      '4. scripts/zero-compute-ast.mjs must catch z_norm, bar_units, dependent_count, and CSS calc(...) expressions, and tighten or remove the @cartouche-geometry-sort opt-out.',
      '5. scripts/pr-red-policy.mjs must guard modifications to already-merged tests/green/*.test.mjs with the same policy as tests/red/ (requiring planner review rather than silent weakening).',
      '6. Enable axe-core color-contrast rule in scripts/svelte-test-harness.mjs and fix OKLCH tokens (inkFaint 4.16:1, hatch 3.75:1, obsidian hatch 2.57:1) in contracts/std-view.v2.tokens.json + freeze-lock + palette.ts so all palettes pass WCAG 2.1 AA.'
    ].join('\n')
  );
});
