import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Issue #23 §2 / Decision 0009 point 1: the slip shows only what Rezono's reader served. Rezono's own page normalised
// the sweep answers (an unknown stop status became `unavailable`, an unknown turn was dropped, a turn on a stop the role
// cannot see became `unknown`); the ported model refuses such an answer instead. Recorded answers: fixtures/10.

const FX = 'fixtures/10-slip-reader-answers.json';
const load = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), FX), 'utf8'));
const SWEEPS = '/slip/sweeps?m=m-2';
const SERIES = '/slip/m-2/ask/sweep?sweep=item_amount&relation=flagged&key=%5B%22item-a%22%2C%2212%22%5D';
const keys = [{ line: 1, key: 's' }];

test('the recorded sweep answers draw as served: canonical statuses and turns, for both roles', async () => {
  for (const role of ['reader', 'summary']) {
    const res = await render({ fixture: FX, store: 'sweeps', role, pack: 'slip', lang: 'en', keys });
    const { window, document } = parseHtml(res.html);
    try {
      const stops = [...document.querySelectorAll('tr[data-line="1"] [data-stop]')];
      const served = load().reader_answers.sweeps[role][SWEEPS].body.sweeps[0].cells;
      assert.deepEqual(stops.map((s) => s.getAttribute('data-status')), served.map((c) => c.status), role);
    } finally {
      await window.happyDOM.close();
    }
  }
});

test('a stop status the contract does not know is refused, not shown as unavailable', async () => {
  const fx = load();
  fx.reader_answers.sweeps.reader[SWEEPS].body.sweeps[0].cells[1].status = 'greenish';
  await assert.rejects(
    () => render({ fixture: fx, store: 'sweeps', role: 'reader', pack: 'slip', lang: 'en', keys }),
    /unknown stop status "greenish" at stop 1/
  );
});

test('an unknown turn is refused, not dropped', async () => {
  const fx = load();
  fx.reader_answers.sweeps.reader[SERIES].body.series[2].turn = 'sideways';
  await assert.rejects(
    () => render({ fixture: fx, store: 'sweeps', role: 'reader', pack: 'slip', lang: 'en', keys }),
    /unknown turn "sideways" at stop 2/
  );
});

test('a turn on a stop the role cannot see is refused, not rewritten to unknown', async () => {
  const fx = load();
  fx.reader_answers.sweeps.summary[SERIES].body.series[2].turn = 'turns';
  await assert.rejects(
    () => render({ fixture: fx, store: 'sweeps', role: 'summary', pack: 'slip', lang: 'en', keys }),
    /turn "turns" at stop 2, which the role cannot see/
  );
});
