import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildMongeFoldingModel } from '../../packages/atlas/src/monge-model.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0014-round-3-client-boundary-and-guards.md',
  summary: 'Issue #46 items 10, 12, 18: Monge unknown curtain has no fixed height and changed/not_applicable never paint valid-green; nightly-live.yml fixed; leftover threlteScene, removed deps doc, StatutoryRelief3D, and law/statute/policy removed',
  waits_on: []
};

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const MONGE_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'MongeFoldingSheet.svelte');

test('M1 [monge-and-leftovers-honesty]: Monge unknown curtain has no fixed height (CURTAIN_HEIGHT) and changed/not_applicable never paint valid-green', async () => {
  const mongeModelSrc = read('packages/atlas/src/monge-model.ts');
  assert.equal(/\bCURTAIN_HEIGHT\b/.test(mongeModelSrc), false, 'monge-model.ts must not extrude unknown curtains to a fixed CURTAIN_HEIGHT');

  const fx08 = JSON.parse(read('fixtures/08-monge-4d-audit.json'));
  fx08.services[0].round_states = ['valid', 'changed', 'not_applicable', 'absent'];
  const { html } = await renderSvelte(MONGE_SHEET, { fixture: fx08, foldAngleDeg: 40 });
  const { window, document } = parseHtml(html);
  try {
    for (const st of ['changed', 'not_applicable']) {
      const dots = [...document.querySelectorAll(`svg circle[data-state="${st}"]`)];
      assert.ok(dots.length > 0, `expected round dots for state "${st}"`);
      for (const dot of dots) {
        assert.notEqual(dot.getAttribute('fill'), 'var(--c-valid)', `${st} round dot must never paint with var(--c-valid)`);
      }
    }
  } finally {
    await window.happyDOM.close();
  }
});

test('M1 [monge-and-leftovers-honesty]: nightly-live.yml has no dead REZONO_LIVE_DIR or misleading regenerate-fixture-10 step', () => {
  const yml = read('.github/workflows/nightly-live.yml');
  assert.equal(/\bREZONO_LIVE_DIR\b/.test(yml), false, 'nightly-live.yml must not set an unused REZONO_LIVE_DIR env var');
  assert.equal(/regenerate.*10-slip-reader-answers/i.test(yml), false, 'nightly-live.yml must not claim to regenerate fixture 10 unless it actually runs regeneration');
});

test('M1 [monge-and-leftovers-honesty]: removed 3D/domain leftovers are cleaned from relief-model, docs, and model.ts', () => {
  const reliefSrc = read('packages/atlas/src/relief-model.ts');
  assert.equal(/\bthrelteScene\b/.test(reliefSrc), false, 'relief-model.ts must not retain unused threlteScene descriptor');

  const launchKit = read('docs/AGENT-LAUNCH-KIT.md');
  assert.equal(/@threlte\/core|\bthree\b/i.test(launchKit), false, 'docs/AGENT-LAUNCH-KIT.md must not reference removed three/@threlte/core dependencies');

  const modelSrc = read('packages/slip/src/model.ts');
  assert.equal(/['"`](law|statute|policy)['"`]/.test(modelSrc), false, 'packages/slip/src/model.ts must not contain hardcoded domain words law/statute/policy');
});
