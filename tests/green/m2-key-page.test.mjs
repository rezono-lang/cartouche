import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §3 (10).

const ROOT = process.cwd();
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

test('M2 [key-page]: lists all role-readable conclusions for one key table-first, grouped by kind, linked to slips under time controls', async () => {
  assert.ok(
    atlas.ATLAS_SHEETS && typeof atlas.ATLAS_SHEETS.KeyPageSheet === 'string',
    'ATLAS_SHEETS must register KeyPageSheet'
  );
  assert.equal(
    typeof atlas.buildKeyPageModel,
    'function',
    '@rezono/cartouche-atlas must export buildKeyPageModel'
  );

  const fx10 = readFixture('10-slip-reader-answers.json');
  const keyPagePath = path.join(ROOT, 'packages/atlas/src', atlas.ATLAS_SHEETS.KeyPageSheet);

  const { html } = await renderSvelte(keyPagePath, {
    fixture: fx10,
    store: 'main',
    role: 'reader',
    entityKey: 'item-a',
    validAt: '2026-01-01',
    knownAt: 'm-4',
    lang: 'en'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    // 1. Table first in reading order with <th> headers
    const firstTable = doc.querySelector('table');
    assert.ok(firstTable, 'key page must render a conclusions table');
    assert.ok(firstTable.querySelectorAll('th').length > 0, 'key page table must have <th> headers');
    const firstSvg = doc.querySelector('svg');
    if (firstSvg) {
      assert.equal(
        Boolean(firstTable.compareDocumentPosition(firstSvg) & 4),
        true,
        'key page table must precede any SVG in DOM reading order'
      );
    }

    // Grouped by kind ([data-relation]) and each conclusion links to its pinned slip
    const conclusionRows = [...doc.querySelectorAll(`tbody tr[${DATA_MARKS.relation}][${DATA_MARKS.key}]`)];
    assert.ok(conclusionRows.length > 0, 'key page must list conclusions about the key');
    for (const row of conclusionRows) {
      const slipLink = row.querySelector('a[href*="at="]');
      assert.ok(slipLink, 'every conclusion row on key page must link to its pinned slip');
    }
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [key-page]: restricted role shows its own conclusions only with one omission notice; path renders reader-served steps table; neighbour graph is distance-1 only', async () => {
  assert.ok(
    atlas.ATLAS_SHEETS && typeof atlas.ATLAS_SHEETS.KeyPageSheet === 'string',
    'ATLAS_SHEETS must register KeyPageSheet'
  );

  const fx10 = readFixture('10-slip-reader-answers.json');
  const keyPagePath = path.join(ROOT, 'packages/atlas/src', atlas.ATLAS_SHEETS.KeyPageSheet);

  // Restricted role ('summary')
  const { html: summaryHtml } = await renderSvelte(keyPagePath, {
    fixture: fx10,
    store: 'main',
    role: 'summary',
    entityKey: 'item-a',
    validAt: '2026-01-01',
    knownAt: 'm-4',
    lang: 'en'
  });
  const summaryDoc = parseHtml(summaryHtml);
  try {
    const notices = [...summaryDoc.document.querySelectorAll(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)];
    assert.equal(notices.length, 1, 'restricted key page must emit exactly one not_read_in_full notice');
    assert.equal(/\d/.test(notices[0].textContent ?? ''), false, 'omission notice must not include hidden counts');
  } finally {
    await summaryDoc.window.happyDOM.close();
  }

  // Path between two conclusions rendered directly from reader-served steps (zero client graph search)
  const readerPathSteps = [
    { depth: 0, relation: 'flagged', key: 'item-a::12', display: 'flagged', proof_ref: 'w:step-0' },
    { depth: 1, relation: 'threshold_breach', key: 'item-a::12', display: 'breach', proof_ref: 'w:step-1' }
  ];
  const { html: pathHtml } = await renderSvelte(keyPagePath, {
    fixture: fx10,
    store: 'main',
    role: 'reader',
    entityKey: 'item-a',
    validAt: '2026-01-01',
    knownAt: 'm-4',
    pathSteps: readerPathSteps,
    lang: 'en'
  });
  const pathDoc = parseHtml(pathHtml);
  try {
    const pathTable = pathDoc.document.querySelector(`table[${DATA_MARKS.answer}="grounds"], table[${DATA_MARKS.answer}="reach"]`);
    assert.ok(pathTable, 'path view must render a derivation-chain table with [data-answer]');
    assert.ok(pathTable.querySelectorAll('th').length > 0, 'path table must include <th> headers');
    const renderedRefs = [...pathTable.querySelectorAll(`tr[${DATA_MARKS.proof_ref}]`)].map((r) =>
      r.getAttribute(DATA_MARKS.proof_ref)
    );
    assert.deepEqual(renderedRefs, ['w:step-0', 'w:step-1'], 'path table must render exact reader-served derivation steps');

    // If a neighbour graph SVG is shown, every neighbour node must be distance-1 (never depth >= 2)
    const svgNodes = [...pathDoc.document.querySelectorAll(`svg [${DATA_MARKS.depth}]`)];
    for (const node of svgNodes) {
      const d = Number(node.getAttribute(DATA_MARKS.depth));
      assert.ok(d <= 1, `neighbour graph must hold distance-1 neighbours only, got depth=${d}`);
    }
  } finally {
    await pathDoc.window.happyDOM.close();
  }
});
