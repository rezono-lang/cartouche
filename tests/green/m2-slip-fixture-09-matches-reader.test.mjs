import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { rezonoMessageFiller, rezonoStdPacks } from '../../packages/slip/bin/rezono-source.ts';
import { loadSlip } from '../../packages/slip/src/model.ts';
import { slipPropsFromView } from '../../packages/slip/src/slip-props.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0009, point 5: fixtures/09-slip-conformance.json stays a small unit fixture only while it equals what the
// view model ported from Rezono produces from Rezono's reader answers (fixtures/10-slip-reader-answers.json) for the
// same rows. Compared: everything the reader decides (rows, polarity, depth, totals, paths, states, values, reasons,
// sentences and their links, the verbs the reader answers, the stops with statuses, turns, checks and folds) and the
// Rezono marks the page draws from each. Not compared, because they are Cartouche's own names for references the
// reader does not publish: proof_ref, completeness_witness_ref, premise_position, sweep_name.

const M = DATA_MARKS;
const ROOT = process.cwd();
const FX09 = 'fixtures/09-slip-conformance.json';
const FX10 = 'fixtures/10-slip-reader-answers.json';
const load = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const REASON = 'fact recorded_amount.amount is missing';
const ROWS = {
  'flagged::item-a::12': { relation: 'flagged', key: ['item-a', '12'] },
  'group_size::group-a::2': { relation: 'group_size', key: ['group-a', '2'] },
  'busy::group-a': { relation: 'busy', key: ['group-a'] },
  'calc__capped_amount::item-a': { relation: 'calc__capped_amount', key: ['item-a', '12', 'known', ''] },
  'calc__capped_amount::item-c': { relation: 'calc__capped_amount', key: ['item-c', '', 'unknown', REASON] }
};

async function readerProps(store, role, row, lang = 'en') {
  const answers = load(FX10).reader_answers[store][role];
  const fetchFn = async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const recorded = answers[url.pathname + url.search];
    assert.ok(recorded, `recorded: ${url.pathname + url.search}`);
    return Response.json(recorded.body, { status: recorded.status });
  };
  const view = await loadSlip(fetchFn, { pack: 'slip', lang, row }, await rezonoStdPacks(), await rezonoMessageFiller());
  return slipPropsFromView(view);
}

const decided = (line) => ({
  part: line.part,
  relation: line.relation,
  key: line.key,
  polarity: line.polarity,
  depth: line.depth,
  path: line.path,
  sign: line.sign,
  state: line.cell.state,
  display: line.cell.display ?? null,
  reason: line.cell.state === 'known' ? null : (line.cell.reason ?? null),
  verbs: line.answered_verbs ?? []
});

test('M2 [slip-fixture-09-matches-reader]: every row of fixture 09 is what the model makes of the reader answers for that row', async () => {
  const fx09 = load(FX09).slip_conformance;
  assert.deepEqual(Object.keys(fx09.rows).sort(), Object.keys(ROWS).sort(), 'every fixture row is checked');
  for (const [id, row] of Object.entries(ROWS)) {
    const fixture = fx09.rows[id];
    const reader = await readerProps('main', 'reader', row);
    assert.equal(reader.row.kind, fixture.kind, id);
    const fixtureLines = (fixture.kind === 'calc' ? fixture.steps : fixture.grounds_distance_1).map((line) => decided({
      ...line,
      path: line.path,
      cell: line.cell
    }));
    const readerLines = (reader.row.grounds_distance_1 ?? reader.row.steps).map(decided);
    assert.deepEqual(fixtureLines, readerLines, `${id}: lines`);

    if (fixture.kind === 'calc') {
      // The result the reader published for the calculated row (its CalcWitness), drawn as fixture 09's result row.
      const route = load(FX10).reader_answers.main.reader[
        `/slip/m-1/ask/grounds?relation=${encodeURIComponent(row.relation)}&key=${encodeURIComponent(JSON.stringify(row.key))}`
      ].body;
      const witness = route.calc_witnesses.find((cw) => cw.conclusion.key === JSON.stringify(row.key));
      assert.equal(fixture.result_cell.state, witness.state, `${id}: result state`);
      assert.equal(fixture.result_cell.display ?? '', witness.state === 'known' ? witness.value : '', `${id}: result value`);
      assert.equal(fixture.result_cell.reason ?? '', witness.reason ?? '', `${id}: result reason`);
    }
  }
});

test('M2 [slip-fixture-09-matches-reader]: the sentences and their links, in English and Dutch, are Rezono messages filled as the reader binds them', async () => {
  for (const id of ['flagged::item-a::12', 'group_size::group-a::2', 'busy::group-a']) {
    for (const lang of ['en', 'nl']) {
      const reader = await readerProps('main', 'reader', ROWS[id], lang);
      const fixture = await render({ fixture: FX09, role: 'reader', pack: 'slip', lang, row: id });
      const { window, document } = parseHtml(fixture.html);
      try {
        const segments = [...document.querySelector(`[${M.part}="sentence"]`).children].map((el) =>
          el.hasAttribute(M.line) ? { text: el.textContent, line: Number(el.getAttribute(M.line)) } : { text: el.textContent }
        );
        assert.deepEqual(segments, reader.row.sentence.map((s) => (s.line === undefined ? { text: s.text } : s)), `${id} ${lang}`);
      } finally {
        await window.happyDOM.close();
      }
    }
  }
});

test('M2 [slip-fixture-09-matches-reader]: the stops of fixture 09 are the reader\'s, for a role reading in full and for one that does not', async () => {
  const sweep = load(FX09).slip_conformance.sweeps.item_amount;
  for (const [role, stops] of [['reader', sweep.stops_reader], ['summary', sweep.stops_summary]]) {
    const reader = await readerProps('sweeps', role, undefined);
    assert.equal(reader.sweeps.length, 1);
    const [line] = reader.sweeps;
    assert.deepEqual(
      stops.map((s) => ({ index: s.index, display: s.display, status: s.status, turn: s.turn, fold_display: s.fold_display, checks: s.checks })),
      line.stops.map((s) => ({ index: s.index, display: s.display, status: s.status, turn: s.turn, fold_display: s.fold_display, checks: s.checks })),
      role
    );
    // The model folds only the swept line, at the stops with a variant.
    for (const stop of line.stops) assert.ok(stop.folds.every((fold) => fold.line === line.line));
  }
});

test('M2 [slip-fixture-09-matches-reader]: fixture 09 and the reader draw the same Rezono marks for the same row', async () => {
  const marks = async (request) => {
    const res = await render({ role: 'reader', pack: 'slip', lang: 'en', ...request });
    const { window, document } = parseHtml(res.html);
    try {
      return [...document.querySelectorAll(`table[${M.sheet}="slip"] tr[${M.line}]`)].map((tr) => {
        const cell = tr.querySelector(`td[${M.part}="value"]`);
        return {
          line: tr.getAttribute(M.line),
          part: tr.getAttribute(M.part),
          relation: tr.getAttribute(M.relation),
          key: tr.getAttribute(M.key),
          depth: tr.getAttribute(M.depth),
          polarity: tr.getAttribute(M.polarity),
          path: tr.getAttribute(M.path),
          state: cell.getAttribute(M.state),
          reason: cell.getAttribute(M.reason),
          value: cell.getAttribute(M.state) === 'known' ? cell.textContent.trim() : null,
          verbs: [...tr.querySelectorAll(`button[${M.verb}]`)].map((b) => [b.getAttribute(M.verb), b.getAttribute(M.key)])
        };
      });
    } finally {
      await window.happyDOM.close();
    }
  };
  for (const [id, row] of Object.entries(ROWS)) {
    assert.deepEqual(await marks({ fixture: FX09, row: id }), await marks({ fixture: FX10, row }), id);
  }
  // Stops and the fold at stop 4, through both ways in.
  const amount = 1;
  const suppose = [{ line: amount, key: 's' }, { line: amount, stop: 4 }];
  const fromFixture = await render({ fixture: FX09, role: 'reader', pack: 'slip', lang: 'en', row: 'flagged::item-a::12', keys: suppose });
  const fromReader = await render({ fixture: FX10, store: 'sweeps', role: 'reader', pack: 'slip', lang: 'en', keys: suppose });
  const stopMarks = (html) => {
    const { window, document } = parseHtml(html);
    try {
      const tr = document.querySelector(`tr[${M.line}="${amount}"]`);
      return {
        stops: [...tr.querySelectorAll(`[${M.stop}]`)].map((s) => [s.getAttribute(M.stop), s.getAttribute(M.status), s.getAttribute(M.turn)]),
        del: tr.querySelector('del')?.textContent.replace(/\s+/g, ''),
        ins: tr.querySelector('ins')?.textContent.replace(/\s+/g, '')
      };
    } finally {
      void window.happyDOM.close();
    }
  };
  assert.deepEqual(stopMarks(fromFixture.html), stopMarks(fromReader.html));
});
