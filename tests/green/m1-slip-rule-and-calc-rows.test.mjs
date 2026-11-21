import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

const FX_PATH = 'fixtures/09-slip-conformance.json';
const fx = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), FX_PATH), 'utf8'));
const ROWS = () => fx().slip_conformance.rows;

async function page(row, fixture = FX_PATH) {
  const res = await render({ fixture, role: 'reader', pack: 'slip', lang: 'en', row });
  return parseHtml(res.html).document;
}

const bodyRows = (doc) => [...doc.querySelectorAll('table[data-sheet="slip"] tbody > tr')];

test('M1 conformance [slip-rule-row]: sentence links, exact grounds order, polarity/depth', async () => {
  const key = 'flagged::item-a::12';
  const row = ROWS()[key];
  const doc = await page(key);

  const sentence = doc.querySelector('[data-part="sentence"]');
  assert.ok(sentence, 'sentence present');
  const links = [...sentence.querySelectorAll('a[data-line]')];
  assert.ok(links.length >= 1);

  const trs = bodyRows(doc).filter((tr) => tr.hasAttribute('data-line'));
  assert.equal(trs.length, row.grounds_distance_1.length);
  row.grounds_distance_1.forEach((g, i) => {
    const tr = trs[i];
    assert.equal(tr.getAttribute('data-relation'), g.relation);
    assert.equal(tr.getAttribute('data-key'), JSON.stringify(g.key));
    assert.equal(tr.getAttribute('data-polarity'), g.polarity);
    assert.equal(tr.getAttribute('data-depth'), String(g.depth));
    assert.ok(tr.getAttribute('data-proof-ref'));
  });

  // every sentence link binds to an existing row, and the premise position selects the right one
  const lineOf = new Map(trs.map((tr) => [tr.getAttribute('data-line'), tr]));
  for (const a of links) assert.ok(lineOf.has(a.getAttribute('data-line')), 'link targets a drawn line');
  const binding = row.bindings.find((b) => b.name === 'i');
  const target = row.grounds_distance_1.findIndex((g) => g.premise_position === binding.premise_position);
  assert.equal(links[0].getAttribute('data-line'), trs[target].getAttribute('data-line'));
});

test('M1 conformance [slip-rule-row]: aggregate total row precedes its depth-1 contributors', async () => {
  const key = 'group_size::group-a::2';
  const row = ROWS()[key];
  const doc = await page(key);
  const trs = bodyRows(doc).filter((tr) => tr.hasAttribute('data-line'));
  assert.equal(trs.length, row.grounds_distance_1.length);

  const totalIdx = trs.findIndex((tr) => tr.getAttribute('data-part') === 'total');
  assert.ok(totalIdx >= 0, 'tr[data-part=total] present');
  const expectedTotal = row.grounds_distance_1.findIndex((g) => g.part === 'total');
  assert.equal(totalIdx, expectedTotal);
  const contributors = trs.slice(totalIdx + 1);
  assert.ok(contributors.length >= 1);
  for (const tr of contributors) assert.equal(tr.getAttribute('data-depth'), '1');
  // published order is preserved exactly
  assert.deepEqual(
    trs.map((tr) => tr.getAttribute('data-key')),
    row.grounds_distance_1.map((g) => JSON.stringify(g.key))
  );
});

test('M1 conformance [slip-calculated-row]: CalcWitness steps in published order with path and depth', async () => {
  const key = 'calc__capped_amount::item-a';
  const row = ROWS()[key];
  const doc = await page(key);
  const steps = [...doc.querySelectorAll('table[data-sheet="slip"] tr[data-path]')];
  assert.equal(steps.length, row.steps.length);
  row.steps.forEach((s, i) => {
    assert.equal(steps[i].getAttribute('data-path'), s.path);
    assert.equal(steps[i].getAttribute('data-depth'), String(s.depth));
    assert.equal(steps[i].getAttribute('data-proof-ref'), s.cell.proof_ref);
  });
});

test('M1 conformance [slip-calculated-row]: constant arguments emit no tr[data-path]', async () => {
  const key = 'calc__capped_amount::item-a';
  const mutated = fx();
  const steps = mutated.slip_conformance.rows[key].steps;
  const published = steps.length;
  steps.splice(1, 0, {
    kind: 'constant',
    path: 'at_most_twenty/value/const',
    depth: 1,
    cell: { state: 'known', display: '20', proof_ref: 'calc:const-20' }
  });
  const doc = await page(key, mutated);
  const paths = [...doc.querySelectorAll('tr[data-path]')].map((tr) => tr.getAttribute('data-path'));
  assert.equal(paths.length, published);
  assert.ok(!paths.includes('at_most_twenty/value/const'));
  assert.ok(!doc.querySelector('[data-proof-ref="calc:const-20"]'));
});
