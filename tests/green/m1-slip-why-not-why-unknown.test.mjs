import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (3c) and §3a (proof map requirements 5 and 6). Unique to Rezono's 4-valued truth:
// missing premises appear as ghost rows with their published reason (zero digits), unknown conclusions stay unknown,
// and role-screened premises say "not readable for your role" without leaking key, value, or source.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');

function fixtureWithWhyNotAndRoleLens({ publishHiddenCount }) {
  const fx = JSON.parse(fs.readFileSync(FX10_PATH, 'utf8'));
  const reader = fx.reader_answers.main.reader;
  const groundsKey = '/slip/m-1/ask/grounds?relation=group_size&key=%5B%22group-a%22%2C%222%22%5D';
  const answer = reader[groundsKey].body;
  // Mark the distance-0 conclusion as unknown resting on the ghost unknown premise (point 3).
  answer.nodes[0].state = 'unknown';
  answer.nodes[0].reason = 'waiting_for_tax_authority';
  // Add a ghost unknown premise (missing from publication) and a role-screened outside premise.
  answer.nodes.push({
    relation: 'recorded_amount',
    key: '["item-x"]',
    distance: 1,
    state: 'unknown',
    reason: 'waiting_for_tax_authority'
  });
  answer.nodes.push({
    relation: 'secret_relation',
    key: '["secret-key-999"]',
    distance: 1,
    outside: true
  });
  if (publishHiddenCount) {
    answer.hidden_count = 1;
  }
  return fx;
}

test('M1 [slip-why-not-why-unknown]: ghost rows carry data-state="unknown" and data-reason with zero digits; conclusion stays unknown', async () => {
  const fx = fixtureWithWhyNotAndRoleLens({ publishHiddenCount: false });
  const res = await render({
    fixture: fx,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });
  const { window: win, document: doc } = parseHtml(res.html);
  try {
    const tree = doc.querySelector(`table[${M.answer}="grounds"]`);
    assert.ok(tree, 'expected grounds proof tree');

    // Point 2: Ghost row carries data-state="unknown", data-reason, and zero digits.
    const ghostRow = tree.querySelector(`tr[${M.relation}="recorded_amount"]`);
    assert.ok(ghostRow, 'missing premise must render as a ghost row in the proof tree');
    const valCell = ghostRow.querySelector(`td[${M.part}="value"]`);
    assert.equal(valCell?.getAttribute(M.state), 'unknown', 'ghost row must carry data-state="unknown"');
    assert.equal(valCell?.getAttribute(M.reason), 'waiting_for_tax_authority', 'ghost row must carry its published data-reason');
    assert.equal(/[0-9]/.test(valCell?.textContent ?? ''), false, 'ghost unknown row must contain zero digits');

    // Point 3: Conclusion resting on a ghost unknown premise stays data-state="unknown" with its reason and zero digits.
    const conclusionRow = tree.querySelector(`tr[${M.depth}="0"]`);
    assert.ok(conclusionRow, 'expected distance-0 conclusion row');
    const concCell = conclusionRow.querySelector(`td[${M.part}="value"]`);
    assert.equal(concCell?.getAttribute(M.state), 'unknown', 'conclusion resting on a ghost row must stay data-state="unknown"');
    assert.equal(concCell?.getAttribute(M.reason), 'waiting_for_tax_authority', 'unknown conclusion must carry its published data-reason');
    assert.equal(/[0-9]/.test(concCell?.textContent ?? ''), false, 'unknown conclusion must contain zero digits (never 0/no/false)');
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [slip-why-not-why-unknown]: role-screened premise carries [data-sign="screened"] with zero leaks and shows hidden count ONLY when reader publishes it', async () => {
  // Without reader-published hidden_count: must NOT invent a hidden count, and must NOT leak secret key/relation.
  const fxNoCount = fixtureWithWhyNotAndRoleLens({ publishHiddenCount: false });
  const resNoCount = await render({
    fixture: fxNoCount,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });
  const d1 = parseHtml(resNoCount.html);
  let textWithoutCount = '';
  try {
    const tree = d1.document.querySelector(`table[${M.answer}="grounds"]`);
    assert.ok(tree, 'expected grounds proof tree');
    textWithoutCount = tree.textContent ?? '';
    assert.equal(textWithoutCount.includes('secret_relation'), false, 'screened premise must leak zero relation name');
    assert.equal(textWithoutCount.includes('secret-key-999'), false, 'screened premise must leak zero key');
    const screened = tree.querySelector(`[${M.sign}="screened"]`);
    assert.ok(screened, 'screened premise must carry frozen [data-sign="screened"] mark');
    assert.ok((screened.closest('td')?.textContent ?? '').trim().length > 0, 'screened premise must render non-empty MF2 label');
    assert.equal(
      d1.document.querySelector(`[${M.reason}="hidden_premises"]`) !== null || /\b1\s+premise\s+hidden\b/i.test(textWithoutCount),
      false,
      'Cartouche must never count hidden premises when reader omits hidden_count'
    );
  } finally {
    await d1.window.happyDOM.close();
  }

  // With reader-published hidden_count: 1 -> renders the published hidden count.
  const fxWithCount = fixtureWithWhyNotAndRoleLens({ publishHiddenCount: true });
  const resWithCount = await render({
    fixture: fxWithCount,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });
  const d2 = parseHtml(resWithCount.html);
  try {
    const treeText = d2.document.querySelector(`table[${M.answer}="grounds"]`)?.textContent ?? '';
    const note = d2.document.querySelector(`[${M.reason}="hidden_premises"]`)?.textContent ?? treeText;
    assert.notEqual(treeText, textWithoutCount, 'when reader publishes hidden_count=1, slip must render the published hidden count');
    assert.ok(/\b1\b/.test(note), 'rendered hidden count must include the published count 1');
  } finally {
    await d2.window.happyDOM.close();
  }
});
