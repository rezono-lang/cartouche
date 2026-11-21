import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lintSourceCode } from '../../scripts/zero-compute-ast.mjs';
import { evaluatePrPolicy } from '../../scripts/pr-red-policy.mjs';
import { auditA11y } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0014-round-3-client-boundary-and-guards.md',
  summary: 'Issue #46 items 14-17: stricter zero-compute-ast (dependentTotal, calc(var(--z)), hop sort); pr-red-policy protects svelte-test-harness, leak-and-domain-check & package.json; auditA11y decides SVG fill contrast + opacity',
  waits_on: []
};

test('M1 [guards-and-svg-contrast]: zero-compute-ast catches dependentTotal thresholds, CSS calc(var(--z)...), and hop sort under @cartouche-geometry-sort', () => {
  const depThreshold = 'const dependentTotal = fx.dependent_count; export const dense = dependentTotal > 12;';
  assert.ok(
    lintSourceCode(depThreshold, 'ripple.ts').some((v) => v.code === 'ZC07'),
    'zero-compute-ast must catch threshold comparison on aliased dependentTotal'
  );

  const zCalc = '<style>.zlift { transform: translateY(calc(var(--z) * -90px)); }</style>';
  assert.ok(
    lintSourceCode(zCalc, 'Stair.svelte').some((v) => v.code === 'ZC13'),
    'zero-compute-ast must catch CSS calc(var(--z) * ...) arithmetic on published z token'
  );

  const hopSort = '// @cartouche-geometry-sort\nexport const s = (nodes) => nodes.sort((a, b) => a.hop - b.hop);';
  assert.ok(
    lintSourceCode(hopSort, 'ripple.ts').some((v) => v.code === 'ZC06'),
    '@cartouche-geometry-sort must not allow sorting on published hop distance'
  );
});

test('M1 [guards-and-svg-contrast]: pr-red-policy protects svelte-test-harness.mjs, leak-and-domain-check.mjs, and package.json', () => {
  for (const protectedPath of [
    'scripts/svelte-test-harness.mjs',
    'scripts/leak-and-domain-check.mjs',
    'package.json'
  ]) {
    const violations = evaluatePrPolicy([{ status: 'M', path: protectedPath }], []);
    assert.ok(
      violations.length > 0,
      `pr-red-policy must require planner label to modify "${protectedPath}"`
    );
  }
});

test('M1 [guards-and-svg-contrast]: auditA11y decides SVG <text fill="..."> contrast and CSS opacity', async () => {
  const lowSvg = '<svg viewBox="0 0 200 40" role="img" aria-label="Low contrast SVG"><rect width="200" height="40" fill="#ffffff" /><text x="10" y="25" fill="#949494">Low contrast SVG text</text></svg>';
  const lowSvgViolations = await auditA11y(lowSvg);
  assert.ok(
    lowSvgViolations.some((v) => v.id === 'color-contrast'),
    'auditA11y must report low-contrast SVG <text fill="#949494"> on #ffffff as a color-contrast violation'
  );

  const lowOpacity = '<p style="color:#000000;background-color:#ffffff;opacity:0.3">Faded low contrast text</p>';
  const lowOpacityViolations = await auditA11y(lowOpacity);
  assert.ok(
    lowOpacityViolations.some((v) => v.id === 'color-contrast'),
    'auditA11y must account for CSS opacity when deciding color contrast'
  );

  const lowMediaBlock = '<style>@media screen { .faint { color: #949494; background-color: #ffffff; } }</style><p class="faint">Media low contrast</p>';
  const lowMediaViolations = await auditA11y(lowMediaBlock);
  assert.ok(
    lowMediaViolations.some((v) => v.id === 'color-contrast'),
    'auditA11y must evaluate CSS rules inside @media screen blocks rather than stripping all @ blocks'
  );
});

test('M1 [guards-and-svg-contrast]: specimen.ts verifies real rendered signs/palettes (not static palette count) and role-zero-leak / sweep tests do not self-feed inputs', () => {
  const ROOT = process.cwd();
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  const specimenSrc = read('packages/atlas/src/specimen.ts');
  assert.equal(/palettes\.length\s*===\s*3/.test(specimenSrc), false, 'specimen.ts must verify actual palette tokens/rendered signs rather than a static palettes.length === 3 count');

  const roleLeakSrc = read('tests/green/role-zero-leak.test.mjs');
  assert.equal(/complete\.nodes\.filter\(/.test(roleLeakSrc), false, 'role-zero-leak.test.mjs must not pre-strip restricted nodes inside the test itself');

  const sweepTestSrc = read('tests/green/m2-slip-sweep-stops-and-fold.test.mjs');
  assert.equal(/stops:\s*SWEEP\(\)\.stops_summary/.test(sweepTestSrc), false, 'm2-slip-sweep-stops-and-fold.test.mjs must not self-feed pre-built summary stops that it then asserts');
});
