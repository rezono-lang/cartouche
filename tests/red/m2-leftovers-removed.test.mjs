import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReliefModel } from '../../packages/atlas/src/relief-model.ts';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0014-quality-round-3.md',
  priority: 3,
  summary: '#46 point 18: the leftovers of the removed 3D stack go (relief threlteScene, the Threlte line in the launch kit), and no file under packages/ or apps/ is named with a domain word such as Statutory, which the domain check then catches',
  waits_on: [
    'm1-contrast-reads-svg-fill',
    'm1-green-guard-covers-harness',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-injected-seal-checks',
    'm1-origin-signs-and-bindings-from-reader',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-seal-checks-only-as-served',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-refuses-request-model',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-no-browser-seal',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0014 §4, issue #46 point 18. #31 removed three and @threlte, but relief-model.ts still builds a threlteScene
// and docs/AGENT-LAUNCH-KIT.md still plans a Threlte sheet. The relief sheet's file and component are named
// StatutoryRelief3D, a legal-domain word the domain check does not know. The law/statute/policy words that model.ts
// maps to an origin sign go with that mapping (m1-origin-signs-and-bindings-from-reader).

const ROOT = process.cwd();

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

const words = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

test('M2 [leftovers-removed]: the relief model builds no Threlte scene', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '04-subsidy-a001-a003.json'), 'utf8'));
  const model = buildReliefModel(fx);
  assert.equal('threlteScene' in model, false, 'relief-model.ts still builds a threlteScene for a removed renderer (#46 point 18)');
});

test('M2 [leftovers-removed]: the docs plan no sheet on the removed Threlte stack', () => {
  const lines = filesUnder(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ at: `${path.relative(ROOT, f)}:${i + 1}`, line }))
    )
    .filter(({ line }) => words(line).includes('threlte'));
  assert.deepEqual(lines.map(({ at }) => at), [], 'the docs still plan a Threlte sheet; three and @threlte were removed in #31 (#46 point 18)');
});

test('M2 [leftovers-removed]: no file under packages/ or apps/ carries the domain word statutory', () => {
  const named = [...filesUnder(path.join(ROOT, 'packages')), ...filesUnder(path.join(ROOT, 'apps'))]
    .map((f) => path.relative(ROOT, f))
    .filter((rel) => words(path.basename(rel)).includes('statutory'));
  assert.deepEqual(named, [], 'a file in a domain-free package is named with a legal-domain word (#46 point 18)');
});

test('M2 [leftovers-removed]: the domain check catches the word statutory in a package', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-domain-'));
  try {
    fs.mkdirSync(path.join(dir, 'packages', 'a', 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'a', 'src', 'Sheet.svelte'), '<script>export let statutoryRelief;</script>\n');
    const env = { ...process.env, GITHUB_ACTIONS: '', CARTOUCHE_PRIVATE_PATTERNS: '' };
    const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'leak-and-domain-check.mjs')], { cwd: dir, env, encoding: 'utf8' });
    assert.notEqual(res.status, 0, 'the domain check passes "statutory" inside packages/, so the word can come back (#46 point 18)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
