import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0015 §2 and §6, issue #46 point 4. canPropose is worked out in Cartouche: DeltaStore.seal() (from
// witness_check and the trust tier), render.ts sealFromManifest (fixture paths) and KringstandSheet.svelte (sealedOk).
// Rezono's recorded /slip/head has no can_propose, rights or trust_tier field; rezono-lang/rezono#1451 asks for them.
// Until the reader serves the right, Propose stays locked and the page says so with the reason code
// propose_locked_no_reader_grant, the code #55 introduced (Decision 0015 §7). The positive direction waits in
// m2-seal-and-rights-from-rezono.

const ROOT = process.cwd();
const M = DATA_MARKS;
const NOT_SERVED = 'propose_locked_no_reader_grant';
const loadFx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

async function page(request) {
  const res = await render(request);
  return parseHtml(res.html);
}

test('M1 [propose-locked-until-served]: DeltaStore does not grant Propose on a sealed, green manifest', () => {
  const fx = loadFx('03-kring-m1-to-m5-live.json');
  const store = new DeltaStore(fx.manifest, fx.sealed_rows);
  assert.notEqual(
    store.seal().canPropose,
    true,
    'DeltaStore.seal() grants Propose from witness_check and trust_tier; the right to propose is not served by Rezono (#46 point 4)'
  );
  store.ingestSealedSnapshot({ ...fx.manifest, id: 'sha256:round-m5', epoch: 43, trust_tier: 'sealed' }, fx.sealed_rows);
  assert.notEqual(store.seal().canPropose, true, 'a sealed snapshot does not grant Propose either');
});

test('M1 [propose-locked-until-served]: the fixture path locks every Propose and says not served', async () => {
  const { window: win, document: doc } = await page({
    fixture: 'fixtures/09-slip-conformance.json',
    pack: 'slip',
    lang: 'en',
    row: 'flagged::item-a::12',
    reader: { answeredVerbs: ['propose'] }
  });
  try {
    const buttons = [...doc.querySelectorAll(`button[${M.verb}="propose"]`)];
    assert.ok(buttons.length > 0, 'the reader capability answers propose on the lines, so Propose buttons are drawn');
    assert.deepEqual(
      buttons.map((b) => b.hasAttribute('disabled')),
      buttons.map(() => true),
      'render.ts sealFromManifest grants Propose from a hand-written manifest: Propose is unlocked (#46 point 4)'
    );
    assert.ok(doc.querySelector(`[${M.reason}="${NOT_SERVED}"]`), `the slip says Propose is not served (data-reason="${NOT_SERVED}")`);
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [propose-locked-until-served]: the enrichment path locks the Propose verb and says not served', async () => {
  const { window: win, document: doc } = await page({ fixture: 'fixtures/01-platform-drift.json', pack: 'slip', lang: 'en' });
  try {
    const propose = doc.querySelector(`button[${M.verb}="propose"]`);
    assert.ok(propose, 'the verb bar draws Propose');
    assert.equal(propose.hasAttribute('disabled'), true, 'the verb bar unlocks Propose from a seal Cartouche computed (#46 point 4)');
    assert.ok(propose.querySelector(`[${M.reason}="${NOT_SERVED}"]`), `the locked Propose says data-reason="${NOT_SERVED}"`);
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [propose-locked-until-served]: the reader path says Propose is not served', async () => {
  const { window: win, document: doc } = await page({
    fixture: 'fixtures/10-slip-reader-answers.json',
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  });
  try {
    for (const b of doc.querySelectorAll(`button[${M.verb}="propose"]`)) assert.equal(b.hasAttribute('disabled'), true);
    assert.ok(
      doc.querySelector(`[${M.reason}="${NOT_SERVED}"]`),
      `the slip read from Rezono's reader does not say that the right to propose is not served (data-reason="${NOT_SERVED}")`
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [propose-locked-until-served]: Kringstand locks Propose and Approve on a sealed round and says not served', async () => {
  const fx = { ...loadFx('03-kring-m1-to-m5-live.json'), live_provisional_delta: null };
  const { html } = await renderSvelte(path.join(ROOT, 'packages', 'atlas', 'src', 'KringstandSheet.svelte'), { fixture: fx });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const propose = doc.querySelector(`button[${M.verb}="propose"]`);
    const approve = doc.querySelector('form button[type="submit"]');
    assert.ok(propose && approve, 'Kringstand draws Propose and Approve');
    assert.equal(propose.hasAttribute('disabled'), true, 'KringstandSheet.svelte unlocks Propose from tier and witness_check (#46 point 4)');
    assert.equal(approve.hasAttribute('disabled'), true, 'KringstandSheet.svelte unlocks Approve from tier and witness_check');
    assert.equal(propose.getAttribute('data-lock-reason'), NOT_SERVED);
    assert.equal(approve.getAttribute('data-lock-reason'), NOT_SERVED);
  } finally {
    await win.happyDOM.close();
  }
});
