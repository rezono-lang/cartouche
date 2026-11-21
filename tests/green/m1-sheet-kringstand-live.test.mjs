import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const SHEET = path.join(process.cwd(), 'packages', 'atlas', 'src', 'KringstandSheet.svelte');
const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '03-kring-m1-to-m5-live.json'), 'utf8'));
const M = DATA_MARKS;
const ROOT = `[${M.sheet}="kringstand"]`;
const PROPOSE = 'button[data-verb="propose"], button[data-verb="p"]';
const LANES = ['needed', 'waiting', 'ready', 'done', 'stuck', 'absent'];
const BOARD = 'table[aria-label="Board lanes"]';

async function mount(fx) {
  const { html } = await renderSvelte(SHEET, { fixture: fx });
  return { html, ...parseHtml(html) };
}
const cards = (doc) => doc.querySelectorAll(`${BOARD} [${M.proof_ref}], [${M.part}="unknown-band"] [${M.state}="unknown"]`);

test('M1: Sheet 03 renders board lanes, separate unknown band, round chronometer, and locks [P] on live delta', async () => {
  const { html, window: win, document: doc } = await mount(fixture);
  try {
    const lanes = [...doc.querySelectorAll(`${BOARD} tbody tr[${M.key}]`)].map((n) => n.getAttribute(M.key));
    assert.deepEqual(lanes, LANES);

    const band = doc.querySelector(`[${M.part}="unknown-band"]`);
    assert.ok(band);
    const unk = band.querySelectorAll(`[${M.state}="unknown"]`);
    assert.equal(unk.length, 1);
    assert.equal(doc.querySelectorAll(`${BOARD} [${M.state}="unknown"]`).length, 0);
    assert.equal(/[0-9]/.test(band.textContent), false);
    assert.ok(unk[0].querySelector(`[${M.sign}="unknown"]`).textContent.includes('▨'));
    assert.equal(unk[0].getAttribute(M.reason), 'telemetry_timeout');
    assert.equal(unk[0].getAttribute(M.proof_ref), 'round:m-4#unk-1');

    const absent = doc.querySelector(`${BOARD} [${M.state}="absent"]`);
    assert.equal(absent.getAttribute(M.completeness_ref), 'sweep:complete-m4');

    const total = fixture.sealed_rows.length + fixture.live_provisional_delta.changes.length;
    assert.equal(cards(doc).length, total);
    for (const c of cards(doc)) assert.ok(c.getAttribute(M.proof_ref));

    const rounds = [...doc.querySelectorAll(`table[aria-label="Round chronometer"] tr[${M.key}]`)];
    assert.deepEqual(rounds.map((r) => r.getAttribute(M.layer)), ['sealed', 'sealed', 'sealed', 'sealed', 'provisional']);

    assert.equal(doc.querySelector(ROOT).getAttribute(M.trust_tier), 'provisional_engine');
    const seal = doc.querySelector(`[${M.part}="seal"]`);
    assert.equal(seal.getAttribute(M.trust_tier), 'provisional_engine');
    assert.equal(seal.querySelector(`[${M.part}="manifest-hash"]`).textContent, fixture.manifest.id);
    assert.ok(seal.querySelector(`[${M.check}]`));
    assert.ok(doc.querySelector(PROPOSE).hasAttribute('disabled'));
    assert.ok(doc.querySelector('form button[type="submit"]').hasAttribute('disabled'));
    assert.equal(doc.querySelectorAll('button[data-verb][data-key]').length, 6);

    // Legend covers every drawn sign; twin has a header and a row per fixture row.
    const drawn = new Set([...doc.querySelectorAll(`[${M.sign}]`)].filter((n) => !n.closest(`table[${M.part}="legend"]`)).map((n) => n.getAttribute(M.sign)));
    const legend = new Set([...doc.querySelectorAll(`table[${M.part}="legend"] tr[${M.sign}]`)].map((n) => n.getAttribute(M.sign)));
    assert.deepEqual([...drawn].sort(), [...legend].sort());
    assert.ok(doc.querySelector(`table[${M.part}="twin"] th`));
    assert.equal(doc.querySelectorAll(`table[${M.part}="twin"] tbody tr`).length, total);
  } finally {
    await win.happyDOM.close();
  }
  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

test('M1: Sheet 03 unlocks [P] and approve only when sealed and green', async () => {
  const sealed = { ...fixture, live_provisional_delta: null };
  const { html, window: win, document: doc } = await mount(sealed);
  try {
    assert.equal(doc.querySelector(PROPOSE).hasAttribute('disabled'), false);
    assert.equal(doc.querySelector('form button[type="submit"]').hasAttribute('disabled'), false);
    assert.equal(doc.querySelector(ROOT).getAttribute(M.trust_tier), 'sealed');
    assert.equal(doc.querySelectorAll(`table[aria-label="Round chronometer"] tr[${M.key}]`).length, 4);
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);

  const red = { ...sealed, manifest: { ...fixture.manifest, witness_check: 'red' } };
  const m = await mount(red);
  try {
    assert.ok(m.document.querySelector(PROPOSE).hasAttribute('disabled'));
  } finally {
    await m.window.happyDOM.close();
  }
});

test('M1: Sheet 03 drops no row: stuck lane renders, live unknown rows go to the hatched band', async () => {
  const fx = structuredClone(fixture);
  fx.sealed_rows.push({ key: 'step:s1', lane: 'stuck', label: 'stuck-one', sign: 'observation', state: 'violated', proof_ref: 'round:m-4#stuck-1' });
  fx.sealed_rows.push({ key: 'step:u2', lane: 'unknown', label: 'unk-sealed', sign: 'derived', state: 'unknown', reason: 'r_a', proof_ref: 'round:m-4#unk-2' });
  fx.live_provisional_delta.changes.push({ weight: 1, row: { key: 'step:u3', lane: 'ready', label: 'unk-live', sign: 'derived', state: 'unknown', reason: 'r_b', proof_ref: 'stream:u3' } });
  const { html, window: win, document: doc } = await mount(fx);
  try {
    const total = fx.sealed_rows.length + fx.live_provisional_delta.changes.length;
    assert.equal(cards(doc).length, total);
    assert.equal(doc.querySelectorAll(`${BOARD} tr[${M.key}="stuck"] [${M.proof_ref}]`).length, 1);
    const band = doc.querySelector(`[${M.part}="unknown-band"]`);
    assert.equal(band.querySelectorAll(`[${M.state}="unknown"]`).length, 3);
    assert.equal(/[0-9]/.test(band.textContent), false);
    const liveUnk = band.querySelector(`[${M.layer}="provisional"] [${M.proof_ref}="stream:u3"]`);
    assert.ok(liveUnk);
    assert.equal(liveUnk.closest(`[${M.layer}="provisional"]`).getAttribute(M.trust_tier), 'provisional_engine');
    assert.equal(doc.querySelectorAll(`${BOARD} [${M.state}="unknown"]`).length, 0);
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);
});