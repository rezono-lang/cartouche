import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSourceCode } from '../../scripts/zero-compute-ast.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 2,
  summary: '#46 point 16: the zero-compute lint fails closed instead of matching name lists; it catches the dependentTotal threshold, calc(var(--z)) and the hop sort under the opt-out tag, and a renamed data field',
  waits_on: []
};

// Decision 0015 §4 and §7, issue #46 point 16. scripts/zero-compute-ast.mjs decides what is data by name lists
// (OPAQUE_NAME_RE, DOMAIN_SORT_PROP_RE, CSS_CALC_DOMAIN_VAR_RE, GEOMETRY_SORT_PROPS), so a value with a new name
// escapes. The three escapes below are copied from main at 8a72c0f (ripple-layout.ts:186-187 and :201-202,
// BitemporalStairSheet.svelte:168 and :223). Fix: fail closed, so a value the lint cannot show to be geometry counts as
// data. The zero-false-positive cases of tests/green/zero-compute-ast.test.mjs (canonical key sorts, bounding boxes,
// a painter sort on depth) stay allowed.

const CASES = [
  {
    name: 'the dependentTotal threshold (ripple-layout.ts:186-187)',
    file: 'packages/atlas/src/ripple-layout.ts',
    code: `
const DISTANCE_COLUMN_THRESHOLD = 12;
export function layoutMode(fixture: { dependent_count?: number; nodes: readonly unknown[] }) {
  const dependentTotal = typeof fixture.dependent_count === 'number' ? fixture.dependent_count : fixture.nodes.length;
  return dependentTotal > DISTANCE_COLUMN_THRESHOLD ? 'distance-columns' : 'radial-rings';
}
`
  },
  {
    name: 'a sort on served hop values under the opt-out tag (ripple-layout.ts:201-202)',
    file: 'packages/atlas/src/ripple-layout.ts',
    code: `
export function hopOrderOf(fixture: { nodes: readonly { hop: number }[] }) {
  const hopOrder: number[] = [];
  for (const n of fixture.nodes) {
    if (!hopOrder.includes(n.hop)) hopOrder.push(n.hop);
  }
  // @cartouche-geometry-sort
  hopOrder.sort((a, b) => a - b);
  return hopOrder;
}
`
  },
  {
    name: 'calc() over a custom property set from a served value (BitemporalStairSheet.svelte:168, :223)',
    file: 'packages/atlas/src/BitemporalStairSheet.svelte',
    code: `<script lang="ts">
  let { cells }: { cells: readonly { zToken: string }[] } = $props();
</script>

{#each cells as c}
  <g style={\`--z: \${c.zToken}\`}><rect class="zlift" width="10" height="10" /></g>
{/each}

<style>
  .zlift { transform: translateY(calc(var(--z) * -90px)); }
</style>
`
  },
  {
    name: 'arithmetic on a served field whose name is on no list',
    file: 'packages/atlas/src/any-model.ts',
    code: `
export function heights(fixture: { nodes: readonly { zq: number }[] }) {
  return fixture.nodes.map((n) => n.zq * 2);
}
`
  }
];

for (const c of CASES) {
  test(`M1 [zero-compute-lint-fails-closed]: flags ${c.name}`, () => {
    const violations = lintSourceCode(c.code, c.file);
    assert.ok(violations.length > 0, `the zero-compute lint passes ${c.name}: it only knows the names on its lists (#46 point 16)`);
  });
}
