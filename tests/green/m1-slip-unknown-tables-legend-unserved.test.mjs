import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const SLIP = path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte');
const M = DATA_MARKS;
const load = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const fx09 = load('09-slip-conformance.json');
const fx07 = load('07-unserved-410.json');
const ROWS = fx09.slip_conformance.rows;
const LEGEND = `table[${M.part}="legend"]`;
const VALUE = `td[${M.part}="value"]`;

async function mount(props) {
  const { html } = await renderSvelte(SLIP, props);
  return { html, ...parseHtml(html) };
}
const sealOf = () => new DeltaStore(fx09.manifest, []).seal();
const withDoc = async (props, fn) => {
  const m = await mount(props);
  try {
    await fn(m.document, m.html);
  } finally {
    await m.window.happyDOM.close();
  }
  return m.html;
};

test('M1 conformance [unknown-shows-no-digit]: non-known td[data-part=value] carries data-state, data-reason, a [data-sign] mark, and zero ASCII digits', async () => {
  const row = ROWS['calc__capped_amount::item-c'];
  const html = await withDoc({ conformanceRow: row, seal: sealOf() }, (doc) => {
    const cells = [...doc.querySelectorAll(`${VALUE}[${M.state}="unknown"]`)];
    assert.equal(cells.length, 1 + row.steps.length);
    for (const td of cells) {
      assert.equal(td.getAttribute(M.reason), row.result_cell.reason);
      assert.ok(td.querySelector(`[${M.sign}="unknown"]`));
      assert.ok(td.getAttribute(M.proof_ref));
      assert.equal(/[0-9]/.test(td.textContent), false, 'unknown cell text must hold no digit');
    }
  });
  assert.deepEqual(await auditA11y(html), []);

  // Absent cell (fixture 09 rule row) is distinct from unknown and carries its completeness witness.
  await withDoc({ conformanceRow: ROWS['flagged::item-a::12'], seal: sealOf() }, (doc) => {
    const absent = doc.querySelector(`${VALUE}[${M.state}="absent"]`);
    assert.equal(absent.getAttribute(M.completeness_ref), 'sweep:complete-held');
    assert.ok(absent.querySelector(`[${M.sign}="absent"]`));
    assert.equal(doc.querySelectorAll(`${VALUE}[${M.state}="unknown"]`).length, 0);
  });

  // Mutations: nothing is invented for a malformed non-known cell.
  const noReason = structuredClone(ROWS['calc__capped_amount::item-c']);
  delete noReason.result_cell.reason;
  await assert.rejects(() => mount({ conformanceRow: noReason }), /explicit reason/);
  const digitReason = structuredClone(ROWS['calc__capped_amount::item-c']);
  digitReason.result_cell.reason = 'missing since 2024';
  await assert.rejects(() => mount({ conformanceRow: digitReason }), /must not contain digits/);
  const noWitness = structuredClone(ROWS['flagged::item-a::12']);
  delete noWitness.grounds_distance_1[0].cell.completeness_witness_ref;
  await assert.rejects(() => mount({ conformanceRow: noWitness }), /completeness_witness_ref/);
});

test('M1 conformance [tables-and-legend]: every table has th headers and table[data-part=legend] lists a tr[data-sign] for every drawn [data-sign]', async () => {
  const answer = {
    question: 'grounds',
    verb: 'why',
    headers: ['Line', 'Relation'],
    rows: [{ cells: ['x', 'held'], sign: 'observation', proof_ref: 'witness:held-absent-item-a' }]
  };
  for (const key of Object.keys(ROWS)) {
    const html = await withDoc({ conformanceRow: ROWS[key], seal: sealOf(), openAnswers: [answer] }, (doc) => {
      const tables = [...doc.querySelectorAll('table')];
      assert.ok(tables.length >= 3, key);
      for (const t of tables) assert.ok(t.querySelector('th'), `table without th in ${key}`);
      assert.ok(doc.querySelector(`table[${M.sheet}="slip"] th`));
      assert.ok(doc.querySelector(`table[${M.answer}="grounds"] th`));
      const legend = doc.querySelector(LEGEND);
      assert.ok(legend, key);
      const listed = new Set([...legend.querySelectorAll(`tr[${M.sign}]`)].map((n) => n.getAttribute(M.sign)));
      const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((n) => !n.closest(LEGEND));
      assert.ok(drawn.length > 0, key);
      for (const el of drawn) assert.ok(listed.has(el.getAttribute(M.sign)), `${key}: ${el.getAttribute(M.sign)} not in legend`);
    });
    assert.deepEqual(await auditA11y(html), [], key);
  }
});

test('M1 conformance [unserved-publication]: served page renders [data-part=seal] checks (reader-hashes, publisher-record); refused store renders [data-part=unserved] and zero tr[data-line]', async () => {
  const seal = sealOf();
  const checks = [
    { id: 'reader-hashes', status: 'green' },
    { id: 'publisher-record', status: 'green' }
  ];
  const served = await withDoc({ conformanceRow: ROWS['busy::group-a'], seal, sealChecks: checks }, (doc) => {
    const el = doc.querySelector(`[${M.part}="seal"]`);
    assert.equal(el.querySelector(`[${M.part}="manifest-hash"]`).textContent, fx09.manifest.id);
    assert.deepEqual(
      [...el.querySelectorAll(`[${M.check}]`)].map((n) => [n.getAttribute(M.check), n.getAttribute(M.status)]),
      [['reader-hashes', 'green'], ['publisher-record', 'green']]
    );
    assert.ok(doc.querySelectorAll('tr[data-line]').length > 0);
    assert.equal(doc.querySelector(`[${M.part}="unserved"]`), null);
  });
  assert.deepEqual(await auditA11y(served), []);

  const refused = await withDoc({ unserved: fx07.unserved, httpStatus: fx07.http_status, seal }, (doc) => {
    const un = doc.querySelector(`[${M.part}="unserved"]`);
    assert.ok(un);
    assert.equal(un.getAttribute(M.reason), fx07.unserved.code);
    assert.ok(un.textContent.includes(fx07.unserved.superseded_by));
    assert.equal(doc.querySelectorAll('tr[data-line]').length, 0);
    assert.equal(doc.querySelector(`[${M.part}="seal"]`), null);
  });
  assert.deepEqual(await auditA11y(refused), []);

  // 410 with no body: reason is the HTTP status itself; no made-up publication code.
  await withDoc({ httpStatus: 410 }, (doc) => {
    const un = doc.querySelector(`[${M.part}="unserved"]`);
    assert.equal(un.getAttribute(M.reason), 'http_status_410');
    assert.equal(doc.querySelectorAll('tr[data-line]').length, 0);
  });
});
