import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../packages/slip/bin/render.ts';
import { validateSweepStops, canFoldStop } from '../../packages/slip/src/slip-sweep.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

const FX = 'fixtures/09-slip-conformance.json';
const fx = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), FX), 'utf8'));
const SWEEP = () => fx().slip_conformance.sweeps.item_amount;

async function page(opts = {}) {
  const res = await render({
    fixture: FX,
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: 'flagged::item-a::12',
    keys: ['s'],
    ...opts
  });
  return parseHtml(res.html).document;
}

const stopsOf = (doc) => [...doc.querySelectorAll('.slip-sweep [data-stop]')];

test('M2 conformance [stops-only]: suppose opens the published stop strip with status/turn and red checks', async () => {
  const published = SWEEP().stops_reader;
  const stops = stopsOf(await page());
  assert.equal(stops.length, published.length);
  published.forEach((s, i) => {
    assert.equal(stops[i].getAttribute('data-stop'), String(s.index));
    assert.equal(stops[i].getAttribute('data-status'), s.status);
    if (s.turn === null) assert.equal(stops[i].hasAttribute('data-turn'), false, 'null turn is not invented');
    else assert.equal(stops[i].getAttribute('data-turn'), s.turn);
    if (s.status === 'red') {
      const checks = [...stops[i].querySelectorAll('[data-check]')];
      assert.deepEqual(
        checks.map((c) => [c.getAttribute('data-check'), c.getAttribute('data-status')]),
        s.checks.map((c) => [c.id, c.status])
      );
      assert.equal(/[0-9]/.test(stops[i].textContent), false, 'red stop shows no value');
    } else {
      assert.equal(stops[i].querySelector('[data-check]'), null);
      assert.equal(stops[i].textContent.trim(), s.display);
    }
  });
});

test('M2 conformance [stops-only]: <del>/<ins> fold only from the published fold, never on red/not_computed', async () => {
  const published = SWEEP().stops_reader;
  const withFold = published.find((s) => s.status === 'green' && s.fold_display !== null && s.index === 2);
  const doc = await page({ selectedStop: withFold.index });
  const del = doc.querySelector('td[data-part="value"] del');
  const ins = doc.querySelector('td[data-part="value"] ins');
  assert.ok(del && ins, 'fold drawn');
  assert.equal(ins.textContent.trim(), withFold.fold_display);

  for (const s of published.filter((p) => p.status === 'red' || p.status === 'not_computed')) {
    const d = await page({ selectedStop: s.index });
    assert.equal(d.querySelector('del'), null, `no fold on ${s.status}`);
    assert.equal(d.querySelector('ins'), null, `no fold on ${s.status}`);
  }
  const none = await page();
  assert.equal(none.querySelector('del'), null, 'no stop selected, no fold');
});

// Issue #46 point 14 (Decision 0015 §5): this case used to feed fixture 09's summary stops into the page and then check
// them. It now reads the stops Rezono's reader served the partial-read role (fixture 10, store sweeps, role summary).
test('M2 conformance [stops-only]: partial-read role gets only the unavailable stops its reader served, and no fold', async () => {
  const FX10 = 'fixtures/10-slip-reader-answers.json';
  const recorded = JSON.parse(fs.readFileSync(path.join(process.cwd(), FX10), 'utf8')).reader_answers.sweeps.summary;
  const sweepKey = Object.keys(recorded).find((k) => k.startsWith('/slip/m-2/ask/sweep?'));
  const served = recorded[sweepKey].body.series;
  assert.ok(served.length > 0 && served.every((s) => s.status === 'unavailable'), 'the reader serves the summary role only unavailable stops');

  const summaryPage = async (keys) =>
    parseHtml((await render({ fixture: FX10, store: 'sweeps', role: 'summary', pack: 'slip', lang: 'en', keys })).html).document;
  const stops = stopsOf(await summaryPage([{ line: 1, key: 's' }]));
  assert.deepEqual(
    stops.map((el) => [el.getAttribute('data-stop'), el.getAttribute('data-status')]),
    served.map((s) => [String(s.index), s.status])
  );
  assert.equal(stops.some((el) => el.querySelector('[data-check]')), false);
  const folded = await summaryPage([{ line: 1, key: 's' }, { line: 1, stop: served[1].index }]);
  assert.equal(folded.querySelector('del'), null);
  assert.equal(folded.querySelector('ins'), null);
});

test('slip-sweep: malformed stop strips are rejected instead of repaired', () => {
  const good = SWEEP().stops_reader;
  assert.equal(validateSweepStops(good), good);
  assert.throws(() => validateSweepStops([{ ...good[0], status: 'amber' }]), /status/);
  assert.throws(() => validateSweepStops([{ ...good[0], turn: 'sideways' }]), /turn/);
  assert.throws(() => validateSweepStops([good[0], good[0]]), /duplicate/);
  const red = good.find((s) => s.status === 'red');
  assert.throws(() => validateSweepStops([{ ...red, checks: [] }]), /checks/);
  assert.throws(() => validateSweepStops([{ ...red, fold_display: 'x' }]), /fold/);
  assert.throws(() => validateSweepStops([{ ...SWEEP().stops_summary[0], fold_display: 'x' }]), /fold/);
  assert.equal(canFoldStop(red), false);
  assert.equal(canFoldStop(null), false);
});
