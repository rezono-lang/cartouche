import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PALETTES } from '../../packages/reader-core/src/index.ts';
import { verifySpecimenCoverage } from '../../packages/atlas/src/specimen.ts';
import { lintSourceCode } from '../../scripts/zero-compute-ast.mjs';
import { evaluatePrPolicy } from '../../scripts/pr-red-policy.mjs';
import { auditA11y } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();

function oklchToLuminance(str) {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  assert.ok(m, `expected OKLCH string, got ${str}`);
  const L = Number(m[1]);
  const C = Number(m[2]);
  const H = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const r = clamp(+4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrastRatio(y1, y2) {
  return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);
}

test('M4 [strict-guards-and-contrast]: OKLCH tokens pass >= 4.5:1 WCAG AA contrast across swisstopo & obsidian, and axe color-contrast is enabled', async () => {
  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'std-view.v2.tokens.json'), 'utf8'));
  const checkedForegrounds = ['ink', 'inkSoft', 'inkFaint', 'proof', 'valid', 'caution', 'violated', 'hatchStroke'];

  for (const name of ['swisstopo', 'obsidian']) {
    const pal = tokens.palettes[name].tokens;
    assert.deepEqual(PALETTES[name], pal, `PALETTES.${name} must match frozen std-view.v2.tokens.json`);
    const yPaper = oklchToLuminance(pal.paper);
    const yTint = oklchToLuminance(pal.paperTint);
    for (const key of checkedForegrounds) {
      const y = oklchToLuminance(pal[key]);
      assert.ok(
        contrastRatio(y, yPaper) >= 4.5,
        `${name}.${key} contrast vs paper (${contrastRatio(y, yPaper).toFixed(2)}:1) below 4.5:1`
      );
      assert.ok(
        contrastRatio(y, yTint) >= 4.5,
        `${name}.${key} contrast vs paperTint (${contrastRatio(y, yTint).toFixed(2)}:1) below 4.5:1`
      );
    }
  }

  // Verify scripts/svelte-test-harness.mjs no longer disables color-contrast
  const harnessSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'svelte-test-harness.mjs'), 'utf8');
  assert.equal(/color-contrast.*enabled:\s*false/.test(harnessSrc), false, 'color-contrast must not be disabled in svelte-test-harness.mjs');

  // Verify auditA11y succeeds cleanly on accessible markup with color-contrast enabled
  const violations = await auditA11y('<section aria-label="Test"><h1>Heading</h1><p style="color:#111111;background:#ffffff">Readable text</p></section>');
  assert.deepEqual(violations, []);
});

test('M4 [strict-guards-and-contrast]: zero-compute AST linter catches z_norm, bar_units, dependent_count, CSS calc, and tightened @cartouche-geometry-sort', () => {
  // 1. z_norm / bar_units / dependent_count arithmetic and thresholds
  assert.ok(lintSourceCode('export const h = cell.z_norm * 100;', 'a.ts').some((v) => v.code === 'ZC04'));
  assert.ok(lintSourceCode('export const w = prism.bar_units + 5;', 'b.ts').some((v) => v.code === 'ZC04'));
  assert.ok(lintSourceCode('export const dense = fx.dependent_count > 12;', 'c.ts').some((v) => v.code === 'ZC07'));

  // 2. CSS calc(...) on published/domain tokens and inline style attributes
  const svelteInlineCalc = '<div style="width: calc(var(--bar) * 2px)"></div>';
  assert.ok(lintSourceCode(svelteInlineCalc, 'Inline.svelte').some((v) => v.code === 'ZC13'));

  const svelteDomainStyleCalc = '<style>.x { width: calc(var(--amount) * 2px); }</style>';
  assert.ok(lintSourceCode(svelteDomainStyleCalc, 'Domain.svelte').some((v) => v.code === 'ZC13'));

  const svelteMultiVarCalc = '<style>.x { height: calc(var(--z) + var(--other)); }</style>';
  assert.ok(lintSourceCode(svelteMultiVarCalc, 'Multi.svelte').some((v) => v.code === 'ZC13'));

  const tsCalcTemplate = 'export const s = (cell) => `calc(${cell.z_norm} * 100px)`;';
  assert.ok(lintSourceCode(tsCalcTemplate, 'tpl.ts').some((v) => v.code === 'ZC13'));

  // 3. @cartouche-geometry-sort can NEVER suppress domain/opaque or non-geometry property sorts
  const bypassDomain = '// @cartouche-geometry-sort\nexport const s = (rows) => rows.sort((a, b) => a.amount - b.amount);';
  assert.ok(lintSourceCode(bypassDomain, 'sort1.ts').some((v) => v.code === 'ZC06'));

  const bypassZNorm = '// @cartouche-geometry-sort\nexport const s = (rows) => rows.sort((a, b) => a.z_norm - b.z_norm);';
  assert.ok(lintSourceCode(bypassZNorm, 'sort2.ts').some((v) => v.code === 'ZC06'));

  const bypassNonGeom = '// @cartouche-geometry-sort\nexport const s = (rows) => rows.sort((a, b) => a.customMetric - b.customMetric);';
  assert.ok(lintSourceCode(bypassNonGeom, 'sort3.ts').some((v) => v.code === 'ZC06'));

  // Pure layout coordinate sort with @cartouche-geometry-sort stays allowed
  const validGeomSort = '// @cartouche-geometry-sort\nexport const s = (cells) => cells.sort((a, b) => a.ix + a.iy - (b.ix + b.iy));';
  assert.deepEqual(lintSourceCode(validGeomSort, 'sort4.ts'), []);
});

test('M4 [strict-guards-and-contrast]: pr-red-policy guards modifications and deletions of already-merged tests/green/*.test.mjs', () => {
  // Worker modifying an already-merged green test without planner label -> BLOCKED
  const modViolations = evaluatePrPolicy(
    [
      { status: 'M', path: 'packages/reader-core/src/opaque.ts' },
      { status: 'M', path: 'tests/green/opaque-mutation.test.mjs' }
    ],
    []
  );
  assert.ok(modViolations.some((v) => /Already-merged green test/.test(v)));

  // Worker deleting an already-merged green test without planner label -> BLOCKED
  const delViolations = evaluatePrPolicy(
    [{ status: 'D', path: 'tests/green/opaque-mutation.test.mjs' }],
    []
  );
  assert.ok(delViolations.some((v) => /Already-merged green test/.test(v)));

  // Worker adding a brand-new promoted green test alongside deleting red test + packages/ edit -> ALLOWED
  const promoteViolations = evaluatePrPolicy(
    [
      { status: 'D', path: 'tests/red/m9-new-feature.test.mjs' },
      { status: 'A', path: 'tests/green/m9-new-feature.test.mjs' },
      { status: 'M', path: 'packages/atlas/src/new-feature.ts' }
    ],
    []
  );
  assert.deepEqual(promoteViolations, []);

  // Planner modifying an already-merged green test -> ALLOWED
  const plannerViolations = evaluatePrPolicy(
    [{ status: 'M', path: 'tests/green/opaque-mutation.test.mjs' }],
    ['planner']
  );
  assert.deepEqual(plannerViolations, []);
});

test('M4 [strict-guards-and-contrast]: verifySpecimenCoverage checks per-sign and per-state completeness', () => {
  const cov = verifySpecimenCoverage();
  assert.equal(cov.ok, true);
  assert.deepEqual(cov.missingSigns, []);
  assert.deepEqual(cov.missingStates, []);
});
