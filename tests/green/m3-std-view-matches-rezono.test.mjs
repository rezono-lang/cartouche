import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, SIGNS, STD_VERBS, signForState } from '../../packages/reader-core/src/index.ts';
import { REZONO_SOURCE, rezonoStdPacks } from '../../packages/slip/bin/rezono-source.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0009, point 6: Cartouche's frozen key of signs and verb bar are Rezono's std-view at the one pinned
// commit (contracts/rezono-pin.json), read from Rezono's own packs/std-view (sheets.yaml, key.yaml) through the
// verified source loader. A contract bump under Decision 0007.

const ROOT = process.cwd();
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('M3 [std-view-matches-rezono]: one Rezono pin, as a full commit, shared by the contracts, the slip sources and the reader answers', () => {
  const pin = json('contracts/rezono-pin.json');
  assert.match(pin.pinned_commit, /^[0-9a-f]{40}$/);
  assert.equal(REZONO_SOURCE.commit, pin.pinned_commit);
  assert.equal('commit' in json('packages/slip/rezono-source.json'), false, 'no second pin');
  assert.equal(json('fixtures/10-slip-reader-answers.json').source.commit, pin.pinned_commit);
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'rezono-reader-parity.yml'), 'utf8');
  assert.match(workflow, /jq -r \.pinned_commit cartouche\/contracts\/rezono-pin\.json/);
});

test('M3 [std-view-matches-rezono]: the signs are Rezono key.yaml signs and statuses, in the tokens, in reader-core and in data-marks', async () => {
  const packs = await rezonoStdPacks();
  const rezono = [...packs.signs.map((s) => s.sign), ...packs.statuses.map((s) => s.status)].sort();
  const tokens = json('contracts/std-view.v2.tokens.json');
  const marks = json('contracts/data-marks.json');
  assert.deepEqual(Object.keys(tokens.signs).sort(), rezono);
  assert.deepEqual(Object.keys(SIGNS).sort(), rezono);
  assert.deepEqual([...marks.attributes.sign.values].sort(), rezono);
  // Where Rezono's key gives a glyph, Cartouche draws that glyph.
  for (const entry of [...packs.signs, ...packs.statuses]) {
    const name = 'sign' in entry ? entry.sign : entry.status;
    if (entry.glyph) assert.equal(SIGNS[name].glyph, entry.glyph, name);
  }
  // A value that is invalid is drawn with `violated`, as Rezono's slip does; no other state is renamed.
  assert.equal(signForState('invalid'), 'violated');
  for (const state of ['unknown', 'absent', 'not_applicable']) assert.equal(signForState(state), state);
  assert.equal(DATA_MARKS.sign, 'data-sign');
});

test('M3 [std-view-matches-rezono]: the verb bar is Rezono Sheets.verbs: order, keys, and a question only where std-view gives one', async () => {
  const packs = await rezonoStdPacks();
  const rezono = packs.verbs.map((v) => ({ verb: v.verb, key: v.key, ...(v.question ? { question: v.question } : {}) }));
  assert.deepEqual(STD_VERBS.map((v) => ({ ...v })), rezono);
  assert.deepEqual(json('contracts/std-view.v2.tokens.json').verbs, rezono);
});

test('M3 [std-view-matches-rezono]: the slip draws every sign Rezono\'s reader gives it, so none is left out any more', async () => {
  const res = await render({ fixture: 'fixtures/10-slip-reader-answers.json', role: 'reader', pack: 'slip', lang: 'en' });
  const { window, document } = parseHtml(res.html);
  try {
    assert.equal(document.querySelector('.slip-signs-left-out'), null);
  } finally {
    await window.happyDOM.close();
  }
  // An invalid value: the sign of `violated`, its reason, and no `invalid` sign anywhere.
  const fx = json('fixtures/09-slip-conformance.json');
  fx.slip_conformance.rows['flagged::item-a::12'].grounds_distance_1[1].cell = {
    state: 'invalid',
    display: null,
    reason: 'two values recorded',
    proof_ref: 'fact:item-a-amount'
  };
  const bad = await render({ store: fx, role: 'reader', pack: 'slip', lang: 'en' });
  const parsed = parseHtml(bad.html);
  try {
    const cell = parsed.document.querySelector('td[data-part="value"][data-state="invalid"]');
    assert.ok(cell.querySelector('[data-sign="violated"]'));
    assert.equal(cell.getAttribute('data-reason'), 'two values recorded');
    assert.equal(parsed.document.querySelectorAll('[data-sign="invalid"]').length, 0);
    assert.ok(parsed.document.querySelector('table[data-part="legend"] tr[data-sign="violated"]'));
  } finally {
    await parsed.window.happyDOM.close();
  }
});
