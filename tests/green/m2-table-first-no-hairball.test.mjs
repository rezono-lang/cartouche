import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §8 and §3a (proof map requirement 9), avoiding what users dislike in RDFox and Stardog explorers.
// Amended for the proof map: the map is a graph, but it starts small and grows only on request.

const ROOT = process.cwd();
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

test('M2 [table-first-no-hairball]: slip answers open on a table with <th> headers, and layered distance columns remain valid', async () => {
  const fx10 = readFixture('10-slip-reader-answers.json');
  const slipRes = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'flagged', key: ['item-a', '12'] },
    keys: ['w']
  });
  const slipDoc = parseHtml(slipRes.html);
  try {
    const slipTable = slipDoc.document.querySelector(`table[${DATA_MARKS.sheet}="slip"]`);
    assert.ok(slipTable, 'slip must open on table[data-sheet="slip"]');
    assert.ok(slipTable.querySelectorAll('th').length > 0, 'slip table must include <th> headers');
  } finally {
    await slipDoc.window.happyDOM.close();
  }

  // Layered views that are tables in disguise (distance columns of sheet 04) are allowed
  const fx06 = readFixture('06-keycloak-dense-28.json');
  const { html: rippleHtml } = await renderSvelte(path.join(ROOT, 'packages/atlas/src/CausalRippleSheet.svelte'), {
    fixture: fx06,
    lang: 'en'
  });
  const rippleDoc = parseHtml(rippleHtml);
  try {
    const twin = rippleDoc.document.querySelector(`table[${DATA_MARKS.part}="twin"]`);
    assert.ok(twin && twin.querySelectorAll('th').length > 0, 'distance-column sheet must keep synchronized table twin with <th>');
  } finally {
    await rippleDoc.window.happyDOM.close();
  }
});

test('M2 [table-first-no-hairball]: proof map opens as distance-1 ego graph, grows only on explicit expansion, links every node to slip & focus, and uses reader-published group counts', async () => {
  assert.ok(
    atlas.ATLAS_SHEETS && typeof atlas.ATLAS_SHEETS.ProofMapSheet === 'string',
    'ATLAS_SHEETS must register ProofMapSheet'
  );
  assert.equal(
    typeof atlas.buildProofMapModel,
    'function',
    '@rezono/cartouche-atlas must export buildProofMapModel'
  );

  const fx11 = readFixture('11-zorgtoeslag-bitemporal-gate-answers.json');
  const proofMapPath = path.join(ROOT, 'packages/atlas/src', atlas.ATLAS_SHEETS.ProofMapSheet);

  // Initial ego-graph render: only focused node (depth 0) + distance-1 neighbours (depth 1)
  const initialModel = atlas.buildProofMapModel(fx11, {
    focusKey: 'focus-0',
    groupThreshold: 2,
    publishedGroupCounts: { rule_kind: '42 (published)' }
  });
  assert.ok(Array.isArray(initialModel.nodes) && initialModel.nodes.length > 0, 'proof map must contain focused node');
  for (const node of initialModel.nodes) {
    assert.ok(
      (node.distance ?? 0) <= 1,
      `initial proof map must be a distance-1 ego graph; found node "${node.id}" at distance ${node.distance}`
    );
  }

  // Explicit expansion ('why' / 'depends' / 'affects') reveals distance-2 nodes
  const expandedModel = atlas.buildProofMapModel(fx11, {
    focusKey: 'focus-0',
    expansions: ['why']
  });
  assert.ok(
    expandedModel.nodes.length >= initialModel.nodes.length,
    'explicit expansion must grow or preserve the ego graph'
  );

  // Rendered proof map: every node links to its slip and to its own focus, and group chip uses reader-published count
  const { html } = await renderSvelte(proofMapPath, {
    fixture: fx11,
    focusKey: 'focus-0',
    groupThreshold: 2,
    publishedGroupCounts: { rule_kind: '42 (published)' },
    lang: 'en'
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const nodes = [...doc.querySelectorAll(`[${DATA_MARKS.key}][${DATA_MARKS.proof_ref}]`)];
    assert.ok(nodes.length > 0, 'proof map must render proof-anchored nodes');
    for (const node of nodes) {
      assert.ok(node.querySelector('a[href*="at="]'), 'every proof map node must link to its slip');
      assert.ok(node.querySelector('a[href*="focus="]'), 'every proof map node must link to its own focus');
    }
    assert.ok(
      html.includes('42 (published)'),
      'group chip must display the reader-published count verbatim (zero client counting)'
    );
  } finally {
    await win.happyDOM.close();
  }
});
