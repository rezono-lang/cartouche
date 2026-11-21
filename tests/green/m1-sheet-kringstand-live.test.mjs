import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const SHEET = path.join(process.cwd(), 'packages', 'atlas', 'src', 'sheets', 'KringstandSheet.svelte');
const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '03-kring-m1-to-m5-live.json'), 'utf8'));
const M = DATA_MARKS;

async function mount(fx) {
  const { html } = await renderSvelte(SHEET, { fixture: fx });
  return { html, ...parseHtml(html) };
}

test('M1: Sheet 03 renders 5 board lanes, separate unknown strip, round chronometer, and locks [P] on live delta', async () => {
  const { html, window: win, document: doc } = await mount(fixture);
  try {
    const lanes = [...doc.querySelectorAll(`[${M.part}="lane"]`)].map((n) => n.getAttribute(M.key));
    assert.deepEqual(lanes, ['needed', 'waiting', 'ready', 'done', 'absent']);

    // Unknown lives only in its own strip, never in a lane, never with digits.
    const strip = doc.querySelector(`[${M.part}="unknown-strip"]`);
    assert.ok(strip);
    const unk = strip.querySelectorAll(`[${M.state}="unknown"]`);
    assert.equal(unk.length, 1);
    assert.equal(doc.querySelectorAll(`[${M.part}="lane"] [${M.state}="unknown"]`).length, 0);
    assert.equal(/[0-9]/.test(strip.textContent), false);
    assert.ok(unk[0].textContent.includes('▨'));
    assert.equal(unk[0].getAttribute(M.reason), 'telemetry_timeout');
    assert.equal(unk[0].getAttribute(M.proof_ref), 'round:m-4#unk-1');

    // Absent carries completeness witness.
    const absent = doc.querySelector(`[${M.part}="lane"][${M.key}="absent"] [${M.state}="absent"]`);
    assert.equal(absent.getAttribute(M.completeness_ref), 'sweep:complete-m4');

    // Proof per mark.
    for (const card of doc.querySelectorAll(`[${M.part}="card"], [${M.part}="unknown"]`)) {
      assert.ok(card.getAttribute(M.proof_ref), 'card without proof ref');
    }

    // Chronometer: 4 sealed rounds + 1 unsealed live round.
    const rounds = [...doc.querySelectorAll(`[${M.part}="round"]`)];
    assert.deepEqual(rounds.map((r) => r.getAttribute(M.status)), ['sealed', 'sealed', 'sealed', 'sealed', 'unsealed']);

    // Three-tier visible, live lock.
    assert.equal(doc.querySelector('section.kring').getAttribute(M.trust_tier), 'provisional_engine');
    const propose = doc.querySelector(`button[${M.verb}="propose"]`);
    assert.ok(propose.hasAttribute('disabled'));
    assert.equal(propose.getAttribute(M.gate), 'locked');
    assert.ok(doc.querySelector('button[data-action="approve"]').hasAttribute('disabled'));
    assert.equal(doc.querySelectorAll(`[${M.part}="slip"] button[${M.verb}]`).length, 6);
  } finally {
    await win.happyDOM.close();
  }
  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
});

test('M1: Sheet 03 unlocks [P] only when sealed and green', async () => {
  const sealed = { ...fixture, live_provisional_delta: null };
  const { html, window: win, document: doc } = await mount(sealed);
  try {
    assert.equal(doc.querySelector(`button[${M.verb}="propose"]`).hasAttribute('disabled'), false);
    assert.equal(doc.querySelector('section.kring').getAttribute(M.trust_tier), 'sealed');
    assert.equal(doc.querySelectorAll(`[${M.part}="round"]`).length, 4);
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);
});
