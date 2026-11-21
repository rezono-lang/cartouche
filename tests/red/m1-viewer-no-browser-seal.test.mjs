import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';
import { viewerBundleModules } from '../support/viewer-bundle.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 1,
  summary: 'N1 (#46 point 1): the viewer seals nothing in the browser; its slip is the page render() builds from the recorded reader answers (fixture 10), and Slip gets no seal prop',
  waits_on: []
};

// Decision 0015 §2 N1, issue #46 point 1. apps/atlas-viewer/src/App.svelte builds a seal with DeltaStore from the
// hand-written fixture 09, which gives canPropose = true, and passes it straight to Slip.svelte. The guard in render()
// (caller-injected seals are refused) never runs, and Slip unlocks Propose. Fix: mount the slip HTML that render()
// produces from fixture 10 at build time, and give the page no seal prop.

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps', 'atlas-viewer', 'src', 'App.svelte');
const FX10 = 'fixtures/10-slip-reader-answers.json';
const M = DATA_MARKS;

function sealChecks(doc) {
  const seal = doc.querySelector(`[${M.part}="seal"]`);
  return seal ? [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)]) : null;
}

test('M1 [viewer-no-browser-seal]: the browser bundle holds no DeltaStore, so nothing in the page builds a seal', async () => {
  const modules = await viewerBundleModules();
  assert.ok(modules.includes('apps/atlas-viewer/src/main.ts'), 'the build graph was read');
  assert.equal(
    modules.includes('packages/reader-core/src/delta-store.ts'),
    false,
    'the viewer bundle ships packages/reader-core/src/delta-store.ts: the browser builds a seal (and canPropose) itself (#46 point 1)'
  );
});

test('M1 [viewer-no-browser-seal]: the viewer slip is the page render() builds from the recorded reader answers', async () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));
  const head = fx.reader_answers.main.reader['/slip/head'].body;
  const built = await render({ fixture: FX10, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const builtDoc = parseHtml(built.html);
  const expectedChecks = sealChecks(builtDoc.document);
  await builtDoc.window.happyDOM.close();

  const { html } = await renderSvelte(APP, { initialTab: 'slip' });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const hash = doc.querySelector(`[${M.part}="manifest-hash"]`);
    assert.ok(hash, 'the viewer slip shows a seal with the manifest hash');
    assert.equal(
      hash.textContent.trim(),
      head.manifest_sha256,
      "the viewer slip shows the hand-written fixture 09 manifest, not the manifest_sha256 of Rezono's recorded /slip/head"
    );
    const tiers = [...doc.querySelectorAll(`[${M.trust_tier}]`)].map((el) => el.getAttribute(M.trust_tier));
    assert.deepEqual(tiers, [], 'the viewer slip states a trust tier that Rezono does not serve (sealed, computed by DeltaStore)');
    assert.deepEqual(sealChecks(doc), expectedChecks, 'the viewer seal lists other checks than the page render() builds');
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [viewer-no-browser-seal]: App.svelte passes Slip no seal prop', () => {
  const ast = parse(fs.readFileSync(APP, 'utf8'), { modern: true });
  const offenders = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === 'Component' && node.name === 'Slip') {
      for (const attr of node.attributes ?? []) {
        if (attr.name === 'seal' || attr.name === 'sealChecks' || attr.name === 'model') offenders.push(attr.name);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'start' && key !== 'end' && key !== 'loc' && value && typeof value === 'object') walk(value);
    }
  })(ast.fragment);
  assert.deepEqual(offenders, [], 'App.svelte hands Slip a seal it built in the browser (#46 point 1)');
});
