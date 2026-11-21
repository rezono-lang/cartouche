import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSourceCode } from '../../scripts/zero-compute-ast.mjs';

function codesOf(source, file = 'packages/atlas/src/worker-attempt.ts') {
  return lintSourceCode(source, file).map((v) => v.code);
}

test('AST Linter blocks sneaky client arithmetic, reductions, coercions, and formatting (ZC01–ZC05, ZC09)', () => {
  assert.ok(codesOf(`export const f = (n: number) => new Intl.NumberFormat('nl-NL').format(n);`).includes('ZC01'));
  assert.ok(codesOf(`export const s = (a: string, b: string) => a.localeCompare(b);`).includes('ZC01'));
  assert.ok(codesOf(`export const x = (cell: { display: string }) => parseFloat(cell.display);`).includes('ZC02'));
  assert.ok(codesOf(`export const x = (cell: { display: string }) => +cell.display;`).includes('ZC02'));
  assert.ok(codesOf(`export const x = (cell: { display: string }) => Number(cell.display);`).includes('ZC02'));
  assert.ok(codesOf(`export const x = (v: number) => v.toFixed(2);`).includes('ZC03'));
  assert.ok(codesOf(`export const x = (amount: number) => amount * 0.75;`).includes('ZC04'));
  assert.ok(codesOf(`export const x = (a: { amount: number }, b: { amount: number }) => a.amount + b.amount;`).includes('ZC04'));
  assert.ok(codesOf(`export const total = (rows: { amount: number }[]) => rows.reduce((acc, r) => acc + r.amount, 0);`).includes('ZC05'));
  assert.ok(codesOf(`export const x = (value: number) => Math.round(value);`).includes('ZC09'));
});

test('AST Linter blocks sorting on domain values (.sort / .toSorted) and threshold logic (ZC06–ZC08)', () => {
  assert.ok(codesOf(`export const o = (rows: { amount: number }[]) => rows.sort((a, b) => a.amount - b.amount);`).includes('ZC06'));
  assert.ok(codesOf(`export const o = (rows: { score: number }[]) => rows.toSorted((a, b) => b.score - a.score);`).includes('ZC06'));
  assert.ok(codesOf(`export const o = (rows: { display: string }[]) => rows.sort((a, b) => a.display.localeCompare(b.display));`).includes('ZC06'));
  assert.ok(codesOf(`export const ok = (income: number) => income > 42000;`).includes('ZC07'));
  assert.ok(codesOf(`export const shown = (cell: { display: string | null }) => cell.display ?? '€ 0';`).includes('ZC08'));
  assert.ok(codesOf(`export const shown = (cell: { display: string | null }) => cell.display || 0;`).includes('ZC08'));
});

test('AST Linter blocks nondeterministic globals, type escape hatches, and @ts-ignore (ZC10–ZC12)', () => {
  assert.ok(codesOf(`export const t = () => Date.now();`).includes('ZC10'));
  assert.ok(codesOf(`export const t = () => new Date();`).includes('ZC10'));
  assert.ok(codesOf(`export const r = () => Math.random();`).includes('ZC10'));
  assert.ok(codesOf(`export const h = (x: unknown) => x as any;`).includes('ZC11'));
  assert.ok(codesOf(`export const h = (display: string) => (display as unknown as number);`).includes('ZC11'));
  assert.ok(codesOf(`// @ts-ignore\nexport const x = 1;`).includes('ZC12'));
});

test('AST Linter audits BOTH <script> blocks AND inline {...} expressions inside .svelte files!', () => {
  const sneakySvelte = `
<script lang="ts">
  let { rows, a, b } = $props();
  const sorted = rows.toSorted((x: any, y: any) => x.value - y.value);
</script>
<section>
  <p>{(a.amount + b.amount).toFixed(2)}</p>
  {#each rows.sort((x, y) => x.priority - y.priority) as r}
    <span>{r.display ?? '€ 0'}</span>
  {/each}
</section>
`;
  const codes = codesOf(sneakySvelte, 'packages/atlas/src/SneakyWidget.svelte');
  assert.ok(codes.includes('ZC03'), 'Expected ZC03 on .toFixed(2) inside Svelte mustache');
  assert.ok(codes.includes('ZC04'), 'Expected ZC04 on a.amount + b.amount inside Svelte mustache');
  assert.ok(codes.includes('ZC06'), 'Expected ZC06 on .toSorted/.sort inside Svelte');
  assert.ok(codes.includes('ZC08'), 'Expected ZC08 on r.display ?? "€ 0" inside Svelte mustache');
  assert.ok(codes.includes('ZC11'), 'Expected ZC11 on "as any" / ": any"');
});

test('AST Linter allows legitimate structural/canonical key sorting and pure geometry bounding boxes (0 false positives)', () => {
  const cleanCode = `
export function canonicalKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}
export function stablePairs<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function painterSort(quads: { depth: number }[]): { depth: number }[] {
  /* @cartouche-geometry-sort */
  return [...quads].sort((a, b) => a.depth - b.depth);
}
export function mongeKey(mongeCoords: { x: number; y: number }): string {
  return mongeCoords.x.toFixed(2);
}
`;
  assert.deepEqual(lintSourceCode(cleanCode, 'packages/scene-ir/src/clean.ts'), []);
});
