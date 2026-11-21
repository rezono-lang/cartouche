import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, canonicalJson } from '../../packages/reader-core/src/index.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const PACK = 'zorgtoeslag-slice';

test('Role-safe zero-leak projection (recorded gate -> restricted role): limited recording contains zero complete-only subjects or withheld allowance rows and marks household full=false', () => {
  const recording = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'fixtures', '11-zorgtoeslag-bitemporal-gate-answers.json'), 'utf8')
  );
  const checkerSubjects = recording.reader_answers.checker[`/${PACK}/m-4/rows/household`].body.rows.map((r) => String(r.key[0]));
  const limitedSubjects = new Set(
    recording.reader_answers.limited[`/${PACK}/m-4/rows/household`].body.rows.map((r) => String(r.key[0]))
  );
  const restrictedIds = checkerSubjects.filter((id) => !limitedSubjects.has(id));
  assert.ok(restrictedIds.length > 0, 'complete role must contain subjects hidden from limited role');

  const limitedHead = recording.reader_answers.limited[`/${PACK}/head`].body;
  const limitedHhSnap = limitedHead.snapshots.find((s) => s.relation === 'household');
  assert.equal(limitedHhSnap?.full, false, 'restricted role must mark household snapshot full=false');

  const limitedRels = new Set(recording.reader_answers.limited[`/${PACK}/bundle`].body.relations.map((r) => r.id));
  assert.equal(limitedRels.has('calc__allowance'), false, 'withheld calc__allowance must not appear in restricted bundle');
  assert.deepEqual(recording.reader_answers.limited[`/${PACK}/m-4/rows/calc__allowance`].body.rows, []);

  const limitedJson = canonicalJson(recording.reader_answers.limited);
  for (const hiddenId of restrictedIds) {
    assert.equal(limitedJson.includes(`"${hiddenId}"`), false, `restricted subject "${hiddenId}" leaked into limited gate output`);
  }
});

test('Role-safe zero-leak projection (reader store -> summary role): partial-read role in fixture 10 leaks zero full-reader sweep answers', async () => {
  const res = await renderSlip({
    fixture: 'fixtures/10-slip-reader-answers.json',
    store: 'sweeps',
    role: 'summary',
    pack: 'slip',
    lang: 'en',
    keys: [{ line: 1, key: 's' }]
  });
  const { window, document } = parseHtml(res.html);
  try {
    const stops = [...document.querySelectorAll(`[${DATA_MARKS.stop}]`)];
    assert.ok(stops.length > 0, 'summary role renders sweep stops');
    for (const stop of stops) {
      assert.equal(stop.getAttribute(DATA_MARKS.status), 'unavailable', 'partial-read role must see only unavailable stops');
    }
    assert.equal(res.html.includes('too_large'), false, 'restricted invariant check id must not leak into summary role');
  } finally {
    await window.happyDOM.close();
  }
});
