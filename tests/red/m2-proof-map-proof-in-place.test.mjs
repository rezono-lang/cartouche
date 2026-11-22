import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary:
    'Proof map requirement 4: selecting a conclusion highlights its whole witness in the same map as a shared DAG of all ancestors, equal to the witness premises the Rezono gate serves, with the slip as side panel (means sentence, bindings, @ sources)',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 4). The drawer part (sentence, bindings, sources, shared DAG) is
// m1-slip-proof-tree; this test is the map part. RDFox Explain repeats the tree endlessly; here every ancestor is
// highlighted once, in place, driven strictly by the Rezono gate's served witness premises.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const FX12_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const WITNESS_IRI_A = `https://rezono.example/slip/witness/${'a'.repeat(64)}`;
const WITNESS_IRI_B = `https://rezono.example/slip/witness/${'b'.repeat(64)}`;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalRowId(relation, key) {
  const keyText = typeof key === 'string' ? key : JSON.stringify(key);
  return `${relation}::${keyText}`;
}

test('M2 [proof-map-proof-in-place] 1 & 2: selecting a conclusion highlights its exact gate-served transitive witness DAG once, dimming outside nodes', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx10 = loadJson(FX10_PATH);
  const groundsPath = '/slip/m-1/ask/grounds?relation=busy&key=%5B%22group-a%22%5D';
  const groundsAnswer = fx10.reader_answers.main.reader[groundsPath].body;
  assert.ok(groundsAnswer && Array.isArray(groundsAnswer.nodes) && groundsAnswer.nodes.length >= 2);

  const expectedRowIds = new Set(groundsAnswer.nodes.map((n) => canonicalRowId(n.relation, n.key)));
  const layout = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    selected: { relation: 'busy', key: ['group-a'] },
    groundsAnswer
  });

  assert.equal(typeof layout.svg, 'string', 'compileProofMapLayout must emit SVG.');
  const { window: win, document: doc } = parseHtml(layout.svg);
  try {
    const selectedEls = [...doc.querySelectorAll(`[${M.relation}][${M.key}][aria-selected="true"]`)];
    const selectedIds = selectedEls.map((el) =>
      canonicalRowId(el.getAttribute(M.relation), el.getAttribute(M.key))
    );
    // Every ancestor highlighted once (shared DAG, no duplicated nodes)
    assert.equal(
      selectedIds.length,
      new Set(selectedIds).size,
      'Every ancestor in the highlighted witness DAG must appear once (no repeated tree copies).'
    );
    assert.deepEqual(
      new Set(selectedIds),
      expectedRowIds,
      'Highlighted (relation, key) set must equal the exact transitive witness premises served by the gate.'
    );

    // Every highlighted node must carry a proof-ref
    for (const el of selectedEls) {
      assert.ok(
        el.getAttribute(M.proof_ref),
        `Highlighted node ${el.getAttribute(M.relation)} must carry ${M.proof_ref}.`
      );
    }

    // Outside nodes remain present and readable with aria-selected="false"
    const unselectedEls = [...doc.querySelectorAll(`[${M.relation}][${M.key}][aria-selected="false"]`)];
    assert.ok(
      unselectedEls.length >= 1,
      'Nodes outside the selected witness must stay in the map (dimmed, aria-selected="false") rather than deleted.'
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-proof-in-place] 3: side panel renders synchronized @rezono/slip (sentence, bindings, @ sources) with two-way selection sync', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx12 = loadJson(FX12_PATH);
  const layout = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-4',
    selected: { relation: 'calc__allowance', key: ['p-ann', '13600', 'known', ''] }
  });

  assert.equal(
    typeof layout.slipHtml,
    'string',
    'Selected conclusion must produce a synchronized @rezono/slip side panel (layout.slipHtml).'
  );
  const { window: win, document: doc } = parseHtml(layout.slipHtml);
  try {
    const slipTable = doc.querySelector(`table[${M.sheet}="slip"]`);
    assert.ok(slipTable, 'Side panel must contain table[data-sheet="slip"].');

    const sentence = doc.querySelector(`[${M.part}="sentence"]`);
    assert.ok(
      sentence && sentence.textContent.trim().length > 0,
      'Slip side panel must render the filled [data-part="sentence"] with bindings.'
    );

    const proofRefs = [...doc.querySelectorAll(`table[${M.sheet}="slip"] [${M.proof_ref}]`)];
    assert.ok(proofRefs.length >= 1, 'Slip side panel must render @ source / witness [data-proof-ref] links.');

    // Two-way sync: selecting a slip line selects the matching (relation, key) in the map
    const firstPremiseRow = doc.querySelector(`table[${M.sheet}="slip"] tr[${M.relation}][${M.key}]`);
    assert.ok(firstPremiseRow, 'Slip side panel must expose selectable premise rows with data-relation and data-key.');
    const targetRel = firstPremiseRow.getAttribute(M.relation);
    const targetKey = JSON.parse(firstPremiseRow.getAttribute(M.key));

    const synced = atlas.compileProofMapLayout(fx12, {
      role: 'checker',
      manifest: 'm-4',
      selected: { relation: targetRel, key: targetKey }
    });
    const mapDom = parseHtml(synced.svg);
    try {
      const matched = mapDom.document.querySelector(
        `[${M.relation}="${targetRel}"][${M.key}='${JSON.stringify(targetKey)}'][aria-selected="true"]`
      );
      assert.ok(matched, 'Selecting a row in the slip panel must select the same (relation, key) node in the map.');
    } finally {
      await mapDom.window.happyDOM.close();
    }
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-proof-in-place] 4: multi-witness switcher switches active witness IRI and updates the highlighted DAG in place', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx10 = loadJson(FX10_PATH);
  const groundsPath = '/slip/m-1/ask/grounds?relation=group_size&key=%5B%22group-a%22%2C%222%22%5D';
  const baseAnswer = structuredClone(fx10.reader_answers.main.reader[groundsPath].body);
  const wA = structuredClone(baseAnswer.witnesses[0]);
  wA.iri = WITNESS_IRI_A;
  const wB = structuredClone(baseAnswer.witnesses[0]);
  wB.iri = WITNESS_IRI_B;
  wB.premises = [{ relation: 'item__group', key: '["item-b","group-a"]' }];
  assert.notDeepEqual(
    wA.premises,
    wB.premises,
    'Fixture setup must give witness A and witness B genuinely distinct premise sets.'
  );
  baseAnswer.witnesses = [wA, wB];

  const first = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    selected: { relation: 'group_size', key: ['group-a', '2'] },
    groundsAnswer: baseAnswer,
    witnessIndex: 0
  });
  const second = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    selected: { relation: 'group_size', key: ['group-a', '2'] },
    groundsAnswer: baseAnswer,
    witnessIndex: 1
  });

  assert.equal(first.activeWitnessIri, WITNESS_IRI_A, 'witnessIndex=0 must activate the first reader-ordered witness.');
  assert.equal(second.activeWitnessIri, WITNESS_IRI_B, 'witnessIndex=1 must switch to the second reader-ordered witness.');
  assert.ok(
    first.slipHtml.includes(WITNESS_IRI_A) && second.slipHtml.includes(WITNESS_IRI_B),
    'Slip side panel must expose the switched witness IRI.'
  );
  assert.notEqual(
    first.svg,
    second.svg,
    'Switching witnessIndex must update the highlighted witness DAG in the map.'
  );
});
