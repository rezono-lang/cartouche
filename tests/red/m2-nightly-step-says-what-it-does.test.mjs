import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0014-quality-round-3.md',
  priority: 3,
  summary: '#46 point 12: the nightly job says what it does: no step claims to regenerate fixture 10 unless it runs the recorder, and no step passes REZONO_LIVE_DIR, which nothing reads',
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

// Decision 0014 §4, issue #46 point 12. In .github/workflows/nightly-live.yml one step is named as if it regenerates
// fixture 10, but it only hashes the pinned Rezono files and runs fast-check, and it passes REZONO_LIVE_DIR, which no
// script reads (checked on main at 8a72c0f). Recording and comparing the reader's answers happens in
// rezono-reader-parity.yml (scripts/record-rezono-reader.mjs). Fix the step or remove it. If a later PR makes a script
// read REZONO_LIVE_DIR, a planner updates the second assertion.

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'nightly-live.yml');

function steps() {
  const wf = parse(fs.readFileSync(WORKFLOW, 'utf8'));
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

test('M2 [nightly-step-says-what-it-does]: a step that claims to regenerate fixture 10 runs the recorder', () => {
  const claims = steps().filter((s) => (s.name ?? '').toLowerCase().includes('fixture 10'));
  const hollow = claims.filter((s) => !(s.run ?? '').split(/\s+/).some((token) => token.endsWith('scripts/record-rezono-reader.mjs')));
  assert.deepEqual(
    hollow.map((s) => s.name),
    [],
    'a nightly step is named as regenerating fixture 10 but never runs scripts/record-rezono-reader.mjs (#46 point 12)'
  );
});

test('M2 [nightly-step-says-what-it-does]: no step passes REZONO_LIVE_DIR', () => {
  const passing = steps().filter((s) => {
    const inEnv = Object.prototype.hasOwnProperty.call(s.env ?? {}, 'REZONO_LIVE_DIR');
    const inRun = (s.run ?? '').split(/\s+/).some((token) => token.startsWith('REZONO_LIVE_DIR='));
    return inEnv || inRun;
  });
  assert.deepEqual(passing.map((s) => s.name), [], 'a nightly step passes REZONO_LIVE_DIR, which no script reads (#46 point 12)');
});
