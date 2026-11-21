import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_MARKS, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { buildAnswerTable } from '../../packages/slip/src/slip-verbs.ts';
import { auditA11y, parseHtml } from '../../scripts/svelte-test-harness.mjs';
import { loadJson } from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();
const FX_09 = 'fixtures/09-slip-conformance.json';

function queryVerbs(doc, rootSelector = '') {
  const scope = rootSelector ? doc.querySelector(rootSelector) : doc;
  if (!scope) return [];
  return [...scope.querySelectorAll(`button[${DATA_MARKS.verb}][${DATA_MARKS.key}]`)].map((btn) => ({
    verb: btn.getAttribute(DATA_MARKS.verb),
    key: btn.getAttribute(DATA_MARKS.key),
    proofRef: btn.getAttribute(DATA_MARKS.proof_ref),
    disabled: btn.hasAttribute('disabled'),
    ariaDisabled: btn.getAttribute('aria-disabled')
  }));
}

test('M1 conformance [verbs-that-answer]: shows button[data-verb][data-key] strictly for answered verbs in STD_VERBS order and opens table[data-answer] with th headers', async () => {
  // 1. busy::group-a has answered_verbs: ["why", "depends"]
  const plainBusy = await render({
    fixture: FX_09,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  });
  const { window: win1, document: doc1 } = parseHtml(plainBusy.html);
  try {
    const verbs = queryVerbs(doc1, `table[${DATA_MARKS.sheet}="slip"]`);
    assert.deepEqual(
      verbs.map((v) => [v.verb, v.key]),
      [
        ['why', 'w'],
        ['depends', 'd']
      ]
    );
    assert.ok(verbs.every((v) => typeof v.proofRef === 'string' && v.proofRef.length > 0));
    assert.equal(doc1.querySelectorAll(`table[${DATA_MARKS.answer}]`).length, 0);
  } finally {
    await win1.happyDOM.close();
  }

  // 2. flagged::item-a::12 has line 0 answered_verbs: [] and line 1 answered_verbs: ["depends", "suppose"]
  //    (Rezono's reader answers reach on item__amount: fixture 09 follows it, decisions/0009 point 5)
  //    (lines are numbered by their index from 0, Rezono's marks: decisions/0009-slip-reads-rezono-reader.md)
  const plainFlagged = await render({
    fixture: FX_09,
    row: 'flagged::item-a::12',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  });
  const { window: win2, document: doc2 } = parseHtml(plainFlagged.html);
  try {
    assert.deepEqual(queryVerbs(doc2, `tr[${DATA_MARKS.line}="0"]`), []);
    assert.deepEqual(
      queryVerbs(doc2, `tr[${DATA_MARKS.line}="1"]`).map((v) => [v.verb, v.key]),
      [
        ['depends', 'd'],
        ['suppose', 's']
      ]
    );
  } finally {
    await win2.happyDOM.close();
  }

  // 3. Pressing an unanswered shortcut key ('m') opens ZERO table[data-answer]
  const unansweredAttempt = await render({
    fixture: FX_09,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    keys: ['m']
  });
  const { window: win3, document: doc3 } = parseHtml(unansweredAttempt.html);
  try {
    assert.equal(doc3.querySelectorAll(`table[${DATA_MARKS.answer}]`).length, 0);
  } finally {
    await win3.happyDOM.close();
  }

  // 4. Pressing an answered shortcut key ('w') opens table[data-answer="grounds"] with <th> headers
  const openedGrounds = await render({
    fixture: FX_09,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    keys: ['w']
  });
  const { window: win4, document: doc4 } = parseHtml(openedGrounds.html);
  try {
    const ansTable = doc4.querySelector(`table[${DATA_MARKS.answer}="grounds"]`);
    assert.ok(ansTable, 'expected table[data-answer="grounds"]');
    const headers = [...ansTable.querySelectorAll('th')];
    assert.ok(headers.length > 0, 'table[data-answer] must have th headers');
    const rows = [...ansTable.querySelectorAll(`tbody tr[${DATA_MARKS.proof_ref}]`)];
    assert.ok(rows.length > 0, 'answer rows must carry data-proof-ref');
  } finally {
    await win4.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(openedGrounds.html), []);
});

test('M1 conformance [verbs-that-answer]: adding a question to reader auto-surfaces its verb and table[data-answer] with identical built files SHA-256 map', async () => {
  const plain = await render({
    fixture: FX_09,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  });

  const extended = await render({
    fixture: FX_09,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    reader: {
      answeredQuestions: ['gap'],
      answersByQuestion: {
        gap: {
          question: 'gap',
          verb: 'missing',
          headers: ['Lever', 'Status', 'Proof'],
          rows: [
            {
              cells: ['§OPAQUE_GAP_LEVER§', 'missing', 'witness:gap-1'],
              proof_ref: 'witness:gap-1',
              sign: 'unknown'
            }
          ]
        }
      }
    },
    keys: ['m']
  });

  // Zero page code change: built asset SHA-256 map MUST be 100% identical
  assert.ok(Object.keys(plain.files).length > 0);
  assert.deepEqual(extended.files, plain.files);

  const { window: win, document: doc } = parseHtml(extended.html);
  try {
    const verbs = queryVerbs(doc, `table[${DATA_MARKS.sheet}="slip"]`);
    const canonicalOrder = STD_VERBS.map((s) => s.verb);
    const renderedVerbs = verbs.map((v) => v.verb);
    assert.deepEqual(renderedVerbs, ['why', 'depends', 'missing']);
    for (let i = 1; i < renderedVerbs.length; i++) {
      assert.ok(
        canonicalOrder.indexOf(renderedVerbs[i - 1]) < canonicalOrder.indexOf(renderedVerbs[i]),
        'verbs must appear in canonical std-view STD_VERBS order'
      );
    }

    const missingBtn = doc.querySelector(`button[${DATA_MARKS.verb}="missing"][${DATA_MARKS.key}="m"]`);
    assert.ok(missingBtn, 'expected button[data-verb="missing"][data-key="m"]');

    const gapTable = doc.querySelector(`table[${DATA_MARKS.answer}="gap"]`);
    assert.ok(gapTable, 'expected table[data-answer="gap"]');
    assert.equal(gapTable.querySelectorAll('th').length, 3);
    assert.ok(gapTable.textContent.includes('§OPAQUE_GAP_LEVER§'));

    // Legend includes any sign drawn inside the opened answer table
    assert.ok(doc.querySelector(`table[${DATA_MARKS.part}="legend"] tr[${DATA_MARKS.sign}="unknown"]`));
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(extended.html), []);
});

test('M1 conformance [verbs-that-answer]: line-level button[data-verb="propose"] is physically locked under provisional_engine', async () => {
  const liveFixture = loadJson(ROOT, FX_09);
  liveFixture.manifest.trust_tier = 'provisional_engine';

  const res = await render({
    store: liveFixture,
    row: 'busy::group-a',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    reader: { answeredQuestions: ['propose'] },
    keys: ['p']
  });

  const { window: win, document: doc } = parseHtml(res.html);
  try {
    const proposeBtn = doc.querySelector(`button[${DATA_MARKS.verb}="propose"][${DATA_MARKS.key}="p"]`);
    assert.ok(proposeBtn, 'propose button should be visible when reader answers propose');
    assert.equal(proposeBtn.hasAttribute('disabled'), true, 'propose button must be physically disabled on provisional_engine');
    assert.equal(proposeBtn.getAttribute('aria-disabled'), 'true');
    assert.equal(doc.querySelectorAll(`table[${DATA_MARKS.answer}="propose"]`).length, 0);
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 conformance [verbs-that-answer]: buildAnswerTable never fabricates rows for reach/gap when reader supplies no answer', () => {
  const fx09 = loadJson(ROOT, FX_09);
  const busyRow = fx09.slip_conformance.rows['busy::group-a'];
  const reachSpec = STD_VERBS.find((s) => s.question === 'reach');
  const gapSpec = STD_VERBS.find((s) => s.question === 'gap');
  const groundsSpec = STD_VERBS.find((s) => s.question === 'grounds');

  assert.equal(buildAnswerTable(reachSpec, busyRow, null).rows.length, 0);
  assert.equal(buildAnswerTable(gapSpec, busyRow, null).rows.length, 0);
  assert.equal(buildAnswerTable(groundsSpec, busyRow, null).rows.length, busyRow.grounds_distance_1.length);
});
