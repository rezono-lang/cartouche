import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { viewerBundleModules } from '../support/viewer-bundle.mjs';

// Decision 0015 §2 N2, issue #46 point 2. App.svelte imports the scene compilers, the layout models, DeltaStore and the
// hand-written fixtures, so the browser compiles and lays out every sheet. #55 prerendered the slip and the Typst view
// and extended the zero-compute lint and the domain check to apps/ (the last two tests below now pass and hold that);
// the six sheets are still compiled in the browser. Fix: prerender the sheets at build time too.

const ROOT = process.cwd();

// What compiles or lays out a sheet. packages/scene-ir/src/types.ts holds types only and may stay.
function compilesOrLaysOut(rel) {
  if (rel.startsWith('packages/scene-ir/src/')) return rel !== 'packages/scene-ir/src/types.ts';
  if (rel === 'packages/reader-core/src/delta-store.ts') return true;
  if (/^packages\/atlas\/src\/[a-z-]+-(model|layout)\.ts$/.test(rel)) return true;
  // The golden fixtures (fixtures/NN-*.json) are build input; prerendered build output (fixtures/viewer/) may ship.
  return /^fixtures\/[^/]+\.json$/.test(rel);
}

function tempProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-guard-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function runGuard(script, cwd) {
  // Only the generic machine-path patterns: the CI secret is not needed to see whether apps/ is scanned.
  const env = { ...process.env, GITHUB_ACTIONS: '', CARTOUCHE_PRIVATE_PATTERNS: '' };
  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)], { cwd, env, encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

test('M1 [viewer-prerendered-and-guarded]: the viewer bundle holds no scene compiler, layout model, Typst export or fixture', async () => {
  const modules = await viewerBundleModules();
  assert.ok(modules.includes('apps/atlas-viewer/src/main.ts'), 'the build graph was read');
  assert.deepEqual(
    modules.filter(compilesOrLaysOut),
    [],
    'the browser compiles and lays out the sheets from hand-written fixtures; prerender them at build time (#46 point 2)'
  );
});

test('M1 [viewer-prerendered-and-guarded]: the zero-compute lint checks apps/', () => {
  const clean = { 'packages/a/src/ok.ts': 'export const ok = 1;\n' };
  const violating = { ...clean, 'apps/viewer/src/sum.ts': 'export const twice = (cell: { amount: number }) => cell.amount * 2;\n' };
  const cleanDir = tempProject(clean);
  const badDir = tempProject(violating);
  try {
    assert.equal(runGuard('zero-compute-lint.mjs', cleanDir).status, 0, 'control: the lint passes a clean tree');
    const res = runGuard('zero-compute-lint.mjs', badDir);
    assert.notEqual(res.status, 0, 'arithmetic on a cell under apps/ passes the zero-compute lint: apps/ is not scanned (#46 point 2)');
    assert.ok(res.out.includes('apps/viewer/src/sum.ts'), `the lint names the apps/ file: ${res.out}`);
  } finally {
    fs.rmSync(cleanDir, { recursive: true, force: true });
    fs.rmSync(badDir, { recursive: true, force: true });
  }
});

test('M1 [viewer-prerendered-and-guarded]: the domain check covers apps/', () => {
  const clean = { 'packages/a/src/ok.ts': 'export const ok = 1;\n' };
  const violating = { ...clean, 'apps/viewer/src/Page.svelte': '<h1>Subsidy relief</h1>\n' };
  const cleanDir = tempProject(clean);
  const badDir = tempProject(violating);
  try {
    assert.equal(runGuard('leak-and-domain-check.mjs', cleanDir).status, 0, 'control: the domain check passes a clean tree');
    const res = runGuard('leak-and-domain-check.mjs', badDir);
    assert.notEqual(res.status, 0, 'a domain word under apps/ passes the domain check: only packages/ is checked (#46 point 2)');
    assert.ok(res.out.includes('apps/viewer/src/Page.svelte'), `the domain check names the apps/ file: ${res.out}`);
  } finally {
    fs.rmSync(cleanDir, { recursive: true, force: true });
    fs.rmSync(badDir, { recursive: true, force: true });
  }
});
