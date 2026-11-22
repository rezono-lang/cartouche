import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §3a (proof map, requirement 2).

const ROOT = process.cwd();
const M = DATA_MARKS;
const FIXTURE_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const SHEET_PATH = path.join(ROOT, 'packages', 'atlas', 'src', 'ProofMapSheet.svelte');

function loadFixture() {
  assert.ok(fs.existsSync(FIXTURE_PATH), `Expected recorded fixture at ${path.relative(ROOT, FIXTURE_PATH)}.`);
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('M2 [proof-map-literals-in-cards] 1 & 2: node cards list opaque slot displays, literals are never nodes, and edges join rows only with data-relation and data-key', async () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const layout = atlas.compileProofMapLayout(fx, { role: 'checker', manifest: 'm-4' });
  assert.ok(Array.isArray(layout.nodes) && layout.nodes.length > 0, 'Proof map layout must emit row nodes.');
  assert.ok(Array.isArray(layout.edges) && layout.edges.length > 0, 'Proof map layout must emit derivation edges.');

  const rowIds = new Set();
  for (const node of layout.nodes) {
    assert.equal(typeof node.relation, 'string', `Node "${node.id}" must represent a relation row, never a bare literal.`);
    assert.ok(node.relation.length > 0, `Node "${node.id}" must carry a non-empty relation name.`);
    assert.ok(
      node.key !== undefined && node.key !== null && String(node.key).length > 0,
      `Node "${node.id}" must carry its row key.`
    );
    assert.notEqual(node.kind, 'literal', `Literal value must never be promoted to a node ("${node.id}").`);
    assert.ok(
      Array.isArray(node.slots) && node.slots.length > 0,
      `Node card "${node.id}" must list its row slots with opaque published display values.`
    );
    for (const slot of node.slots) {
      assert.equal(typeof slot.name, 'string', `Slot in "${node.id}" must carry a slot name.`);
      assert.equal(typeof slot.display, 'string', `Slot "${slot.name}" in "${node.id}" must carry an opaque display string.`);
    }
    rowIds.add(node.id);
  }

  // Edges join rows only (premise row -> conclusion row), never a literal value.
  for (const edge of layout.edges) {
    assert.ok(rowIds.has(edge.fromId), `Edge source "${edge.fromId}" must be a row node, never a literal.`);
    assert.ok(rowIds.has(edge.toId), `Edge target "${edge.toId}" must be a row node, never a literal.`);
    assert.ok(edge.fromRelation && edge.fromKey, 'Edge must expose premise data-relation and data-key.');
    assert.ok(edge.toRelation && edge.toKey, 'Edge must expose conclusion data-relation and data-key.');
  }

  // Rendered SVG exposes both ends of each edge using frozen data-relation and data-key on <g>.
  const { window: win, document: doc } = parseHtml(layout.svg);
  try {
    const edgeGroups = [...doc.querySelectorAll(`svg g[role="listitem"][${M.proof_ref}], svg g[${M.relation}][${M.key}]`)];
    assert.ok(edgeGroups.length > 0, 'Rendered SVG must carry row and edge groups with frozen data-relation and data-key.');

    const endpointRefs = [...doc.querySelectorAll(`svg g[${M.relation}][${M.key}]`)];
    assert.ok(
      endpointRefs.length >= layout.nodes.length,
      'Rendered SVG must carry data-relation and data-key on row cards and edge endpoints.'
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-literals-in-cards] 3: unknown slot shows unknown sign and published reason inside the card with zero digits', async () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  // At m-1 in fixtures/12, p-bob and p-ann have unknown calc__allowance with reason no_version_applies.
  const layout = atlas.compileProofMapLayout(fx, { role: 'checker', manifest: 'm-1' });
  const unknownSlots = layout.nodes.flatMap((n) => (n.slots ?? []).filter((s) => s.state === 'unknown'));
  assert.ok(unknownSlots.length > 0, 'm-1 layout must include at least one unknown slot inside a node card.');

  for (const slot of unknownSlots) {
    assert.ok(
      typeof slot.reason === 'string' && slot.reason.length > 0,
      `Unknown slot "${slot.name}" must carry its published reason.`
    );
    assert.equal(
      /[0-9]/.test(slot.display),
      false,
      `Unknown slot "${slot.name}" display "${slot.display}" must never contain ASCII digits.`
    );
  }

  const { window: win, document: doc } = parseHtml(layout.svg);
  try {
    const unknownMarks = [...doc.querySelectorAll(`svg [${M.state}="unknown"]`)];
    assert.ok(unknownMarks.length > 0, 'Rendered SVG must mark unknown slots with data-state="unknown".');
    for (const mark of unknownMarks) {
      const text = mark.textContent ?? '';
      assert.ok(
        text.includes(SIGNS.unknown.glyph),
        `Unknown card slot must display the unknown glyph (${SIGNS.unknown.glyph}).`
      );
      assert.ok(
        (mark.getAttribute(M.reason) ?? '').length > 0 || mark.querySelector(`[${M.reason}]`),
        'Unknown card slot must carry its published data-reason.'
      );
      assert.equal(/[0-9]/.test(text), false, `Unknown card slot text "${text}" must contain zero ASCII digits.`);
    }
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-literals-in-cards] 4: accessible table twin has the same rows and slot display values as the cards', async () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const layout = atlas.compileProofMapLayout(fx, { role: 'checker', manifest: 'm-4' });
  const { html } = await renderSvelte(SHEET_PATH, {
    fixture: fx,
    focusKey: 'calc__allowance::p-ann',
    role: 'checker',
    manifest: 'm-4'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    const twin = doc.querySelector(`table[${M.part}="twin"]`);
    assert.ok(twin, 'ProofMapSheet must render an accessible table[data-part="twin"].');

    const twinRows = [...twin.querySelectorAll(`tbody tr[${M.relation}][${M.key}]`)];
    assert.ok(
      twinRows.length >= layout.nodes.length,
      `Table twin must contain every row card (${twinRows.length} < ${layout.nodes.length}).`
    );

    const twinByRow = new Map(
      twinRows.map((tr) => [`${tr.getAttribute(M.relation)}::${tr.getAttribute(M.key)}`, tr.textContent ?? ''])
    );

    for (const node of layout.nodes) {
      const rowText = twinByRow.get(`${node.relation}::${node.key}`);
      assert.ok(
        rowText !== undefined,
        `Table twin is missing row card ${node.relation}::${node.key}.`
      );
      for (const slot of node.slots ?? []) {
        if (slot.state === 'unknown') {
          assert.ok(
            rowText.includes(SIGNS.unknown.glyph),
            `Table twin row ${node.relation}::${node.key} must display ${SIGNS.unknown.glyph} for unknown slot "${slot.name}".`
          );
        } else if (slot.display.length > 0) {
          assert.ok(
            rowText.includes(slot.display),
            `Table twin row ${node.relation}::${node.key} must contain slot display "${slot.display}".`
          );
        }
      }
    }
  } finally {
    await win.happyDOM.close();
  }
});
