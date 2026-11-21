import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'The slip shows every distinct witness the reader publishes for a conclusion, not only the shortest: one proof tree per witness IRI, each with its own premises and seal check',
  waits_on: [
    'm1-slip-proof-tree'
  ]
};

// Decision 0012 §2 (3b). When the reader publishes n distinct founded witnesses for a conclusion, the slip renders
// n proof groups in exact reader order, each headed by its canonical witness IRI (<base>witness/<64 hex>).
// Load-bearing marks appear ONLY when the reader publishes load_bearing on steps; Cartouche never intersects witnesses.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const WITNESS_IRI_A = `https://rezono.example/slip/witness/${'a'.repeat(64)}`;
const WITNESS_IRI_B = `https://rezono.example/slip/witness/${'b'.repeat(64)}`;

function fixtureWithTwoWitnesses({ includeLoadBearing }) {
  const fx = JSON.parse(fs.readFileSync(FX10_PATH, 'utf8'));
  const reader = fx.reader_answers.main.reader;
  const groundsKey = '/slip/m-1/ask/grounds?relation=group_size&key=%5B%22group-a%22%2C%222%22%5D';
  const answer = reader[groundsKey].body;
  const first = structuredClone(answer.witnesses[0]);
  first.iri = WITNESS_IRI_A;
  const second = structuredClone(answer.witnesses[0]);
  second.iri = WITNESS_IRI_B;
  second.bindings = second.bindings.slice(0, 1); // intentionally shorter, placed at index 1 to test reader order
  answer.witnesses = [first, second];

  if (includeLoadBearing) {
    answer.steps = answer.steps.map((s, idx) => ({ ...s, load_bearing: idx === 0 }));
  }
  return fx;
}

test('M1 [slip-all-witnesses]: renders all distinct witnesses in exact reader order, each headed by its witness IRI', async () => {
  const fx = fixtureWithTwoWitnesses({ includeLoadBearing: true });
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
    const heads = [...doc.querySelectorAll(`table[${M.answer}="grounds"] [${M.proof_ref}]`)]
      .map((el) => el.getAttribute(M.proof_ref))
      .filter((ref) => ref === WITNESS_IRI_A || ref === WITNESS_IRI_B);
    const uniqueInOrder = [...new Set(heads)];
    assert.deepEqual(
      uniqueInOrder,
      [WITNESS_IRI_A, WITNESS_IRI_B],
      'slip must render both distinct witness IRIs in exact reader order (never singling out the shortest witness)'
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [slip-all-witnesses]: load-bearing is marked ONLY when the reader publishes load_bearing (never computed client-side)', async () => {
  const fxWith = fixtureWithTwoWitnesses({ includeLoadBearing: true });
  const resWith = await render({
    fixture: fxWith,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });
  const dWith = parseHtml(resWith.html);
  try {
    const lbTrue = dWith.document.querySelectorAll(`table[${M.answer}="grounds"] [${M.load_bearing}="true"]`);
    assert.ok(lbTrue.length >= 1, 'published load_bearing=true premise must carry data-load-bearing="true"');
  } finally {
    await dWith.window.happyDOM.close();
  }

  const fxWithout = fixtureWithTwoWitnesses({ includeLoadBearing: false });
  const resWithout = await render({
    fixture: fxWithout,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'busy', key: ['group-a'] },
    keys: ['w']
  });
  const dWithout = parseHtml(resWithout.html);
  try {
    const lbAny = dWithout.document.querySelectorAll(`table[${M.answer}="grounds"] [${M.load_bearing}]`);
    assert.equal(lbAny.length, 0, 'when reader omits load_bearing, Cartouche must emit zero data-load-bearing marks');
  } finally {
    await dWithout.window.happyDOM.close();
  }
});
