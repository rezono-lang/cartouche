import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0015 §4, issue #46 point 8. Cartouche makes up proof references: render.ts fixtureSweeps
// (`sweep:<name>#<i>`), render.ts createSlipModel (the subject's ref is the manifest id) and slip-props.ts rowProofRef
// (`<manifest>:<relation>:<key>`). Rezono's recorded answers hold no witness reference today, so the honest slip shows
// "no proof" (no data-proof-ref) until the reader serves one. AGENTS.md rule 2 promises a "verifiable witness" that
// nothing verifies; the claim stays only on a line that names the green test that verifies it (Decision 0012 5b).

const ROOT = process.cwd();
const M = DATA_MARKS;

function strings(value, out = new Set()) {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

async function refsOf(request) {
  const { window: win, document: doc } = parseHtml((await render(request)).html);
  try {
    return [...new Set([...doc.querySelectorAll(`[${M.proof_ref}]`)].map((el) => el.getAttribute(M.proof_ref)))];
  } finally {
    await win.happyDOM.close();
  }
}

const FX10 = 'fixtures/10-slip-reader-answers.json';
const READER_PAGES = [
  { store: 'main', role: 'reader' },
  { store: 'main', role: 'reader', row: { relation: 'busy', key: ['group-a'] }, keys: ['w'] },
  { store: 'sweeps', role: 'summary' }
];

for (const p of READER_PAGES) {
  test(`M1 [proof-refs-only-as-served]: reader path ${p.store}/${p.role}${p.keys ? ' why' : ''}: every proof ref is one the reader served`, async () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));
    const served = strings(fx.reader_answers[p.store][p.role]);
    const refs = await refsOf({ fixture: FX10, pack: 'slip', lang: 'en', ...p });
    assert.deepEqual(
      refs.filter((r) => !served.has(r)),
      [],
      'the slip carries proof references the reader never served (slip-props.ts rowProofRef makes them up, #46 point 8)'
    );
  });
}

test('M1 [proof-refs-only-as-served]: fixture path: a sweep fold carries no made-up sweep:<name>#<i> ref', async () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '09-slip-conformance.json'), 'utf8'));
  const served = strings(fx);
  const refs = await refsOf({
    fixture: 'fixtures/09-slip-conformance.json',
    pack: 'slip',
    lang: 'en',
    row: 'flagged::item-a::12',
    keys: [{ line: 1, key: 's' }, { line: 1, stop: 0 }]
  });
  assert.deepEqual(refs.filter((r) => !served.has(r)), [], 'render.ts fixtureSweeps makes up sweep:<name>#<i> for a fold (#46 point 8)');
});

test("M1 [proof-refs-only-as-served]: enrichment path: the subject does not borrow the manifest id as its proof", async () => {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '01-platform-drift.json'), 'utf8'));
  const refs = await refsOf({ fixture: 'fixtures/01-platform-drift.json', pack: 'slip', lang: 'en' });
  assert.equal(
    refs.includes(fx.manifest.id),
    false,
    "render.ts gives the slip subject the manifest id as its proof reference: a borrowed proof (#46 point 8)"
  );
});

test('M1 [proof-refs-only-as-served]: AGENTS.md promises no verifiable witness that no green test verifies', () => {
  const claims = fs
    .readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /\bverifiable\b/i.test(line) && /\b(witness|proof)/i.test(line))
    .filter(({ line }) => {
      const named = line.match(/tests\/green\/[\w.-]+\.test\.mjs/g) ?? [];
      return !named.some((rel) => fs.existsSync(path.join(ROOT, rel)));
    });
  assert.deepEqual(
    claims.map(({ n }) => `AGENTS.md:${n}`),
    [],
    'AGENTS.md promises a verifiable witness per mark, and no green test named on that line verifies one (#46 point 8)'
  );
});
