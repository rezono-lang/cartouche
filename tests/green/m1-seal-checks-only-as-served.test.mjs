import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 1,
  summary: 'N5 (#46 point 6): the seal never shows reader-hashes green on its own say-so; until the reader serves a hash check per witness (rezono-lang/rezono#1451) it reads unavailable, and publisher-record quotes the head witness_check',
  waits_on: []
};

// Green on arrival (Decision 0015 §4): #55 fixed this while the plan was in review; this behavioural check holds the fix
// independently of Decision 0014's green tests, which match source text.
// Decision 0015 §2 N5, issue #46 point 6. slip-props.ts hard-codes { id: 'reader-hashes', status: 'green' }, so the
// checker seal of m1-slip-proof-tree passes on a value Cartouche wrote. Rezono's reader serves no hash check result;
// rezono-lang/rezono#1451 item 3 asks for one per witness. Until then the seal shows no such check, or shows it as
// data-status="unavailable" (the contract's value for what is not served, Decision 0015 §7).

const ROOT = process.cwd();
const FX10 = 'fixtures/10-slip-reader-answers.json';
const M = DATA_MARKS;

const CASES = [
  { name: 'main / reader, home row', store: 'main', role: 'reader', extra: {} },
  { name: 'main / reader, why on group_size', store: 'main', role: 'reader', extra: { row: { relation: 'busy', key: ['group-a'] }, keys: ['w'] } },
  { name: 'sweeps / summary, home row', store: 'sweeps', role: 'summary', extra: {} }
];

for (const c of CASES) {
  test(`M1 [seal-checks-only-as-served]: ${c.name}: every seal check is one the reader served`, async () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FX10), 'utf8'));
    const head = fx.reader_answers[c.store][c.role]['/slip/head'].body;
    const res = await render({ fixture: FX10, store: c.store, role: c.role, pack: 'slip', lang: 'en', ...c.extra });
    const { window: win, document: doc } = parseHtml(res.html);
    try {
      const seal = doc.querySelector(`[${M.part}="seal"]`);
      assert.ok(seal, 'the slip shows its seal');
      const checks = Object.fromEntries(
        [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)])
      );
      const grounds = Object.entries(fx.reader_answers[c.store][c.role])
        .find(([k]) => k.includes('/ask/grounds?'))?.[1]?.body;
      const servedReaderHashes = grounds?.reader_hashes?.status;
      if (servedReaderHashes) {
        assert.equal(
          checks['reader-hashes'],
          servedReaderHashes,
          `the seal reader-hashes must quote the reader's served status (${servedReaderHashes})`
        );
      } else {
        assert.ok(
          checks['reader-hashes'] === undefined || checks['reader-hashes'] === 'unavailable',
          `the seal says reader-hashes: ${checks['reader-hashes']}, a value slip-props.ts hard-codes; the reader serves no hash check (#46 point 6)`
        );
      }
      assert.equal(checks['publisher-record'], head.witness_check, "publisher-record quotes the head's witness_check");
    } finally {
      await win.happyDOM.close();
    }
  });
}
