import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { auditA11y, parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0009: the slip reads Rezono's reader. Every case below is carried over from Rezono's DOM tests in
// tests/slip/ at rezono-lang/rezono@f15c89d665e2815b02e12665203a9d48dd6abc40, with the expectations Rezono wrote by
// hand from its tests/fixtures/slip (test_slip_rule_row, test_slip_calculated_row, test_unknown_shows_no_digit,
// test_tables_and_legend, test_unserved_publication, test_verbs_that_answer, test_stops_only, and the turns of
// test_turn_unknown_neighbour). The page is drawn by packages/slip/bin/render.ts from the reader's answers in
// fixtures/10-slip-reader-answers.json, through the view model ported from Rezono (packages/slip/src/model.ts).

const M = DATA_MARKS;
const ROOT = process.cwd();
const FX = 'fixtures/10-slip-reader-answers.json';
const GAP = path.join(ROOT, 'tests', 'support', 'answers-gap.mjs');
const KEYS = Object.fromEntries(STD_VERBS.map((v) => [v.verb, v.key]));
const REASON = 'fact recorded_amount.amount is missing';
const load = () => JSON.parse(fs.readFileSync(path.join(ROOT, FX), 'utf8'));

async function page(request = {}) {
  const res = await render({ fixture: FX, role: 'reader', pack: 'slip', lang: 'en', ...request });
  const { window, document } = parseHtml(res.html);
  return { ...res, window, doc: document };
}
async function done(p) {
  await p.window.happyDOM.close();
}
const normal = (text) => text.replace(/\s+/g, ' ').trim();
const slip = (doc) => {
  const tables = doc.querySelectorAll(`table[${M.sheet}="slip"]`);
  assert.equal(tables.length, 1, 'one table[data-sheet=slip]');
  return tables[0];
};
const lines = (doc) => [...slip(doc).querySelectorAll(`tr[${M.line}]`)];
const ref = (tr) => [tr.getAttribute(M.relation), JSON.parse(tr.getAttribute(M.key))];
const lineOf = (doc, relation, key) => {
  const found = lines(doc).filter((tr) => JSON.stringify(ref(tr)) === JSON.stringify([relation, key]));
  assert.equal(found.length, 1, `one line for ${relation} ${JSON.stringify(key)}`);
  return found[0];
};
const verbs = (tr) =>
  Object.fromEntries([...tr.querySelectorAll(`button[${M.verb}]`)].map((b) => [b.getAttribute(M.verb), b.getAttribute(M.key)]));
const valueText = (tr) => normal(tr.querySelector(`td[${M.part}="value"]`).textContent);

function assertTablesAndLegend(doc) {
  const legend = doc.querySelector(`table[${M.part}="legend"]`);
  assert.ok(legend, 'a legend');
  const listed = new Set([...legend.querySelectorAll(`tr[${M.sign}]`)].map((tr) => tr.getAttribute(M.sign)));
  const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((el) => !el.closest(`table[${M.part}="legend"]`));
  assert.ok(drawn.length > 0, 'signs are drawn');
  for (const el of drawn) assert.ok(listed.has(el.getAttribute(M.sign)), `${el.getAttribute(M.sign)} in the legend`);
  for (const table of doc.querySelectorAll('table')) assert.ok(table.querySelector('th'), 'every table has headers');
}

test('slip-rule-row (Rezono test_slip_rule_row): the home claim, its lines from 0 in the reader order, links, and an aggregate total above its contributors', async () => {
  const home = await page();
  try {
    assert.equal(normal(home.doc.querySelector(`[${M.part}="sentence"]`).textContent), 'Item item-a is flagged with amount 12, and nothing holds it.');
    const rows = lines(home.doc);
    assert.deepEqual(rows.map(ref), [['held', ['item-a']], ['item__amount', ['item-a', '12']]]);
    // The same lines as the reader's own `grounds` answer for the row, distance 1, in its order.
    const grounds = load().reader_answers.main.reader['/slip/m-1/ask/grounds?relation=flagged&key=%5B%22item-a%22%2C%2212%22%5D'].body;
    assert.deepEqual(rows.map(ref), grounds.nodes.filter((n) => n.distance === 1).map((n) => [n.relation, JSON.parse(n.key)]));
    assert.deepEqual(rows.map((tr) => tr.getAttribute(M.polarity)), ['negative', 'positive']);
    assert.deepEqual(rows.map((tr) => tr.getAttribute(M.depth)), ['0', '0']);
    assert.deepEqual(rows.map((tr) => tr.getAttribute(M.line)), ['0', '1']);
    // Both variables are bound by the first atom of the body, item__amount(i, a): premise position 0, line 1.
    const links = [...home.doc.querySelectorAll(`[${M.part}="sentence"] a[${M.line}]`)];
    assert.deepEqual(links.map((a) => a.getAttribute(M.line)), ['1', '1']);
    assertTablesAndLegend(home.doc);
  } finally {
    await done(home);
  }
  assert.deepEqual(await auditA11y(home.html), []);

  const agg = await page({ row: { relation: 'group_size', key: ['group-a', '2'] } });
  try {
    assert.equal(normal(agg.doc.querySelector(`[${M.part}="sentence"]`).textContent), 'Group group-a has 2 items.');
    const every = lines(agg.doc);
    const totals = every.filter((tr) => tr.getAttribute(M.part) === 'total');
    assert.equal(totals.length, 1);
    assert.equal(valueText(totals[0]), '2');
    const rows = every.filter((tr) => tr.getAttribute(M.part) !== 'total');
    assert.deepEqual(rows.map((tr) => [ref(tr), tr.getAttribute(M.depth)]), [
      [['group', ['group-a']], '0'],
      [['item__group', ['item-a', 'group-a']], '1'],
      [['item__group', ['item-b', 'group-a']], '1']
    ]);
    assert.equal(every.indexOf(totals[0]), every.indexOf(rows[1]) - 1, 'the contributors follow their total');
    // The aggregate's variable links to its total.
    const links = [...agg.doc.querySelectorAll(`[${M.part}="sentence"] a[${M.line}]`)];
    assert.ok(links.some((a) => a.getAttribute(M.line) === totals[0].getAttribute(M.line)));
  } finally {
    await done(agg);
  }
});

test('slip-calculated-row (Rezono test_slip_calculated_row): the steps of the CalcWitness are lines, nested by path; a constant has no line', async () => {
  const calc = await page({ row: { relation: 'calc__capped_amount', key: ['item-a', '12', 'known', ''] } });
  try {
    const got = lines(calc.doc).map((tr) => [tr.getAttribute(M.path), tr.getAttribute(M.depth), valueText(tr)]);
    assert.deepEqual(got, [
      ['at_most_twenty/value', '0', '12'],
      ['at_most_twenty/value/0', '1', '12']
    ]);
    assert.equal(slip(calc.doc).querySelectorAll('tr[data-path="at_most_twenty/value/1"]').length, 0, 'a constant has no line');
    assertTablesAndLegend(calc.doc);
  } finally {
    await done(calc);
  }
});

test('unknown-shows-no-digit (Rezono test_unknown_shows_no_digit): a value that is not known shows its state, reason and sign, and no digit', async () => {
  const unknown = await page({ row: { relation: 'calc__capped_amount', key: ['item-c', '', 'unknown', REASON] } });
  try {
    const cells = lines(unknown.doc).map((tr) => tr.querySelector(`td[${M.part}="value"]`));
    assert.equal(cells.length, 2);
    for (const cell of cells) {
      assert.equal(cell.getAttribute(M.state), 'unknown');
      assert.equal(cell.getAttribute(M.reason), REASON);
      assert.ok(cell.querySelector(`[${M.sign}]`), 'the sign of its state');
      assert.equal(/[0-9]/.test(cell.textContent), false, cell.textContent);
    }
    assertTablesAndLegend(unknown.doc);
  } finally {
    await done(unknown);
  }
  assert.deepEqual(await auditA11y(unknown.html), []);
});

test('verbs-that-answer (Rezono test_verbs_that_answer): verbs only where the reader answers; a reader that answers one more question adds its verb with the same page', async () => {
  const busy = { relation: 'busy', key: ['group-a'] };
  const plainBusy = await page({ row: busy });
  let index;
  try {
    const line = lineOf(plainBusy.doc, 'group_size', ['group-a', '2']);
    assert.deepEqual(verbs(line), { why: KEYS.why, depends: KEYS.depends });
    index = Number(line.getAttribute(M.line));
    assert.equal(plainBusy.doc.querySelectorAll(`table[${M.answer}]`).length, 0);
  } finally {
    await done(plainBusy);
  }
  for (const [verb, question] of [['why', 'grounds'], ['depends', 'reach']]) {
    const opened = await page({ row: busy, keys: [{ line: index, key: KEYS[verb] }] });
    try {
      const table = opened.doc.querySelector(`table[${M.answer}="${question}"]`);
      assert.ok(table, `${verb} opens ${question}`);
      assert.ok(table.querySelector('th'));
      assert.ok(table.querySelectorAll('tbody tr').length > 0, 'the answer as the reader gave it');
      assertTablesAndLegend(opened.doc);
    } finally {
      await done(opened);
    }
    assert.deepEqual(await auditA11y(opened.html), []);
  }

  // The local reader does not answer gap: no `missing` on the absent row. With one more question, it is there.
  const plain = await page();
  const more = await page({ reader: GAP });
  try {
    assert.equal('missing' in verbs(lineOf(plain.doc, 'held', ['item-a'])), false);
    assert.equal(verbs(lineOf(more.doc, 'held', ['item-a'])).missing, KEYS.missing);
    assert.deepEqual(more.files, plain.files, 'the same page answered more, without a change to the page');
  } finally {
    await done(plain);
    await done(more);
  }
});

test('stops-only (Rezono test_stops_only, test_turn_unknown_neighbour): suppose opens only the published stops on the swept line; the fold comes from the published difference', async () => {
  const STATUSES = ['green', 'green', 'green', 'not_computed', 'green', 'green', 'red'];
  const TURNS = [null, 'same', 'turns', 'unknown', 'unknown', 'same', 'unknown'];
  const amount = (doc) => lineOf(doc, 'item__amount', ['item-a', '12']);
  const first = await page({ store: 'sweeps' });
  const index = Number(amount(first.doc).getAttribute(M.line));
  assert.equal(amount(first.doc).querySelectorAll(`[${M.stop}]`).length, 0, 'closed until suppose');
  await done(first);
  const suppose = { line: index, key: KEYS.suppose };

  const opened = await page({ store: 'sweeps', keys: [suppose] });
  try {
    const stops = [...amount(opened.doc).querySelectorAll(`[${M.stop}]`)];
    assert.deepEqual(stops.map((s) => [s.getAttribute(M.stop), s.getAttribute(M.status)]), STATUSES.map((st, i) => [String(i), st]));
    assert.deepEqual(stops.map((s) => s.getAttribute(M.turn)), TURNS);
    assert.equal(opened.doc.querySelectorAll(`[${M.stop}]`).length, STATUSES.length, 'the stops stand inside the swept line');
    const red = stops[6];
    assert.ok([...red.querySelectorAll(`[${M.check}]`)].some((c) => c.getAttribute(M.status) === 'red'));
    assert.equal(/[0-9]/.test(red.textContent), false, 'a red stop shows its checks and no value');
    assertTablesAndLegend(opened.doc);
  } finally {
    await done(opened);
  }
  assert.deepEqual(await auditA11y(opened.html), []);

  // The fold at 20 comes from the difference of that stop's variant: 12 struck, 20 beside it.
  const at = await page({ store: 'sweeps', keys: [suppose, { line: index, stop: 4 }] });
  try {
    const cell = amount(at.doc).querySelector(`td[${M.part}="value"]`);
    assert.equal(cell.querySelector('del').textContent.replace(/\s+/g, ''), '12');
    assert.equal(cell.querySelector('ins').textContent.replace(/\s+/g, ''), '20');
    assert.ok(cell.querySelector(`[${M.sign}="supposed"]`));
    assertTablesAndLegend(at.doc);
  } finally {
    await done(at);
  }
  assert.deepEqual(await auditA11y(at.html), []);
  // A red or a not computed stop has no variant, so no fold and no value.
  for (const stop of [3, 6]) {
    const moved = await page({ store: 'sweeps', keys: [suppose, { line: index, stop }] });
    try {
      assert.equal(amount(moved.doc).querySelectorAll('ins').length, 0, `stop ${stop}`);
    } finally {
      await done(moved);
    }
  }
  // When the reader does not serve the variant's difference, the stop stays green and there is no fold, never one made up.
  const noDiff = load();
  noDiff.reader_answers.sweeps.reader['/slip/m-2/ask/scenario?variant=v-item_amount-04-3'] = { status: 404, body: { error: 'not found' } };
  const bare = await page({ fixture: noDiff, store: 'sweeps', keys: [suppose, { line: index, stop: 4 }] });
  try {
    assert.equal(amount(bare.doc).querySelectorAll(`[${M.stop}]`)[4].getAttribute(M.status), 'green');
    assert.equal(amount(bare.doc).querySelectorAll('ins').length, 0);
  } finally {
    await done(bare);
  }

  // summary does not read every relation in full: every stop is unavailable.
  const other = await page({ store: 'sweeps', role: 'summary', keys: [suppose] });
  try {
    const stops = [...amount(other.doc).querySelectorAll(`[${M.stop}]`)];
    assert.deepEqual(stops.map((s) => s.getAttribute(M.status)), STATUSES.map(() => 'unavailable'));
    assert.ok(stops.every((s) => [null, 'unknown'].includes(s.getAttribute(M.turn))));
  } finally {
    await done(other);
  }
  await assert.rejects(() => page({ store: 'sweeps', keys: [{ line: index, stop: 4 }] }), /No stop 4/);
});

test('unserved-publication (Rezono test_unserved_publication): a served page has the seal of the reader and the publisher; a refused one shows no line', async () => {
  const served = await page();
  try {
    const seal = served.doc.querySelector(`[${M.part}="seal"]`);
    assert.deepEqual(
      new Set([...seal.querySelectorAll(`[${M.check}]`)].map((c) => c.getAttribute(M.check))),
      new Set(['publisher-record', 'reader-hashes', 'reader-hashes:flagged:["item-a","12"]'])
    );
    const head = load().reader_answers.main.reader['/slip/head'].body;
    assert.equal(seal.querySelector(`[${M.part}="manifest-hash"]`).textContent, head.manifest_sha256);
    assert.equal(seal.querySelector(`[${M.check}="publisher-record"]`).getAttribute(M.status), head.witness_check);
  } finally {
    await done(served);
  }
  // Rezono changes one byte of the stored witness set; the local reader then refuses the proof. Here: the refusal.
  const tampered = load();
  tampered.reader_answers.main.reader['/slip/m-1/ask/grounds?relation=flagged&key=%5B%22item-a%22%2C%2212%22%5D'] = {
    status: 409,
    body: { error: 'object hash mismatch' }
  };
  const refused = await page({ fixture: tampered });
  try {
    assert.ok(refused.doc.querySelector(`[${M.part}="unserved"]`));
    assert.equal(refused.doc.querySelectorAll(`tr[${M.line}]`).length, 0);
    assert.equal(refused.doc.querySelector(`[${M.part}="unserved"]`).getAttribute(M.reason), 'http_status_409');
  } finally {
    await done(refused);
  }
  assert.deepEqual(await auditA11y(refused.html), []);
});

test('Decision 0009: the view model runs at build time only, from pinned Rezono sources; the same request gives the same bytes', async () => {
  const a = await render({ fixture: FX, role: 'reader', pack: 'slip', lang: 'en' });
  const b = await render({ fixture: FX, role: 'reader', pack: 'slip', lang: 'en' });
  assert.equal(a.html, b.html);
  assert.deepEqual(a.files, b.files);
  for (const name of Object.keys(a.files)) {
    assert.equal(/model\.ts|slip-props\.ts|rezono-source/.test(name), false, `${name}: build code is not a page asset`);
  }
  const page = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte'), 'utf8');
  assert.equal(/from '\.\/model\.ts'|from '\.\/slip-props\.ts'/.test(page), false, 'the page imports no view-model code');
  assert.equal(/\{\\\$|split\(/.test(page), false, 'the page fills no message itself');
  // One pin, in one place: contracts/rezono-pin.json. Bumping it without re-recording the reader answers is red.
  const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
  assert.match(pin.pinned_commit, /^[0-9a-f]{40}$/);
  assert.equal(load().source.commit, pin.pinned_commit, 'the reader answers are of the pinned Rezono commit');
  const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'rezono-source.json'), 'utf8'));
  assert.equal('commit' in sources, false, 'the slip sources carry no second pin');
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'rezono-reader-parity.yml'), 'utf8');
  assert.match(workflow, /jq -r \.pinned_commit cartouche\/contracts\/rezono-pin\.json/, 'the recording job reads the same pin');
  // Dutch through Rezono's own std-view messages and fill.ts, from the same answers.
  const nl = await render({ fixture: FX, role: 'reader', pack: 'slip', lang: 'nl' });
  assert.notEqual(nl.html, a.html);
});
