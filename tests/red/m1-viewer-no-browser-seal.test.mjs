import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DeltaStore } from '../../packages/reader-core/src/delta-store.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { rezonoMessageFiller, rezonoStdPacks } from '../../packages/slip/bin/rezono-source.ts';
import { loadSlip } from '../../packages/slip/src/model.ts';
import { slipPropsFromView } from '../../packages/slip/src/slip-props.ts';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0014-round-3-client-boundary-and-guards.md',
  summary: 'Issue #46 items 1-8: viewer never seals/compiles in browser; apps/ scanned by zero-compute & domain lint; render.ts refuses model & fixture seal_checks; no client canPropose, source.kind guessing, hard-coded reader-hashes, or fabricated proof refs',
  waits_on: []
};

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('M1 [viewer-no-browser-seal]: apps/atlas-viewer never imports DeltaStore/compilers or passes a browser-built seal to Slip', () => {
  const appSrc = read('apps/atlas-viewer/src/App.svelte');
  assert.equal(/\bDeltaStore\b/.test(appSrc), false, 'App.svelte must not construct DeltaStore in the browser');
  assert.equal(/\bcompile(FlowSplit|Relief|Monge|Kringstand|CausalRipple|Bitemporal)Scene\b/.test(appSrc), false, 'App.svelte must not compile scenes in the browser');
  assert.equal(/<Slip\b[^>]*\bseal=/.test(appSrc), false, 'App.svelte must not pass a browser-computed seal prop to <Slip>');
});

test('M1 [viewer-no-browser-seal]: zero-compute-lint and leak-and-domain-check scan apps/ in addition to packages/', () => {
  const zcLint = read('scripts/zero-compute-lint.mjs');
  const domainCheck = read('scripts/leak-and-domain-check.mjs');
  assert.ok(/['"`]apps['"`]/.test(zcLint), 'scripts/zero-compute-lint.mjs must scan apps/');
  assert.ok(/['"`]apps['"`]/.test(domainCheck), 'scripts/leak-and-domain-check.mjs must scan apps/');
});

test('M1 [viewer-no-browser-seal]: render() refuses caller-injected model and fixture seal_checks', async () => {
  const fx09 = JSON.parse(read('fixtures/09-slip-conformance.json'));
  const fakeModel = {
    subjectId: 'x',
    proofRef: 'p:1',
    seal: { manifestId: 'sha256:aaa', epoch: 1, knowledgeTime: '2026-01-01T00:00:00Z', role: 'reader', witnessCheck: 'green', trustTier: 'sealed', provisionalCount: 0, canPropose: true },
    activeVerb: 'w',
    proposeAllowed: true,
    proposeBlockedReason: null,
    prism5: [],
    missingLevers: [],
    adjacentWorlds: []
  };
  await assert.rejects(
    () => renderSlip({ fixture: fx09, model: fakeModel }),
    /model|seal/i,
    'render() must refuse caller-injected request.model'
  );

  const fxWithSealChecks = structuredClone(fx09);
  fxWithSealChecks.seal_checks = [{ id: 'injected-check', status: 'green' }];
  const res = await renderSlip({ fixture: fxWithSealChecks, role: 'reader', pack: 'slip', lang: 'en' });
  assert.equal(res.html.includes('injected-check'), false, 'render() must not trust fixture-injected seal_checks');
});

test('M1 [viewer-no-browser-seal]: slip-props does not hard-code reader-hashes: green or fabricate rowProofRef/sweep proof refs', async () => {
  const fx10 = JSON.parse(read('fixtures/10-slip-reader-answers.json'));
  const answers = fx10.reader_answers.main.reader;
  const fetchFn = async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const rec = answers[url.pathname + url.search];
    assert.ok(rec, `recorded: ${url.pathname + url.search}`);
    return Response.json(rec.body, { status: rec.status });
  };
  const view = await loadSlip(fetchFn, { pack: 'slip', lang: 'en' }, await rezonoStdPacks(), await rezonoMessageFiller());
  const props = slipPropsFromView(view);

  assert.equal(
    props.sealChecks.some((c) => c.id === 'reader-hashes' && c.status === 'green'),
    false,
    'slip-props must not hard-code reader-hashes: green when the reader did not serve a check for it'
  );

  const renderSrc = read('packages/slip/bin/render.ts');
  assert.equal(/`sweep:\$\{/.test(renderSrc), false, 'render.ts must not fabricate sweep:<name>#<i> proof refs');
  assert.equal(/provisionalCount\s*:/.test(renderSrc), false, 'render.ts must not fabricate provisionalCount');

  const slipPropsSrc = read('packages/slip/src/slip-props.ts');
  assert.equal(/export function rowProofRef\b/.test(slipPropsSrc), false, 'slip-props.ts must not fabricate rowProofRef (${manifestId}:${relation}:${key})');

  const modelSrc = read('packages/slip/src/model.ts');
  assert.equal(/\boriginSignForSourceKind\b/.test(modelSrc), false, 'model.ts must not guess origin signs from source.kind strings');
  assert.equal(/parts\.includes\(\s*binding\.value\s*\)/.test(modelSrc), false, 'model.ts must not link bindings to premises by matching binding.value against premise keys');
});

test('M1 [viewer-no-browser-seal]: canPropose is never derived client-side when the reader omits it', () => {
  const fx09 = JSON.parse(read('fixtures/09-slip-conformance.json'));
  const store = new DeltaStore(fx09.manifest);
  assert.equal(
    store.seal().canPropose,
    false,
    'DeltaStore.seal() must not derive canPropose=true when the reader manifest does not publish can_propose/rights'
  );
});

test('M1 [viewer-no-browser-seal]: AGENTS.md does not promise an unverified "verifiable witness" per mark', () => {
  const agents = read('AGENTS.md');
  assert.equal(/\bverifiable witness\b/i.test(agents), false, 'AGENTS.md must state honestly that marks carry witness references (not client-verified proofs)');
});
