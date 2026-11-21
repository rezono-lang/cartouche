import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Green on arrival (Decision 0012 §2): written red against 8b3c96d, where it failed for the reason below;
// the M4 work of #30 to #33 made it pass. It stays as an independent check of that fix.

// Decision 0012 §2 (6d), issue #23 §1: Kringstand ignores the weight of a live change and skips DeltaStore, so a
// retraction appears as a row. A Z-set change of weight -1 removes a row; it is never a row of its own.

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'KringstandSheet.svelte');
const base = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '03-kring-m1-to-m5-live.json'), 'utf8'));

function withChanges() {
  const f = base();
  const row = (key) => f.sealed_rows.find((r) => r.key === key);
  const retracted = row('step:policy-push');
  const moved = row('step:canary-smoke');
  assert.ok(retracted && moved, 'fixture 03 holds step:policy-push and step:canary-smoke');
  f.live_provisional_delta.changes.push(
    { weight: -1, row: retracted },
    { weight: -1, row: moved },
    { weight: 1, row: { ...moved, lane: 'ready', proof_ref: 'stream:m5-canary-ready' } }
  );
  return f;
}

// Elements for a key that are not shown as a removal.
const current = (doc, key) => [...doc.querySelectorAll(`[${M.key}="${key}"]`)].filter((el) => !el.closest('del') && !el.querySelector('del'));

test('M1 [retractions-applied]: a weight -1 change removes the row instead of drawing it as a row', async () => {
  const { html } = await renderSvelte(SHEET, { fixture: withChanges() });
  const { window, document } = parseHtml(html);
  try {
    assert.deepEqual(
      current(document, 'step:policy-push').map((el) => `<${el.tagName.toLowerCase()} ${M.relation}="${el.getAttribute(M.relation) ?? ''}">`),
      [],
      'the retracted row is not drawn as a current row anywhere on the sheet (board or twin)'
    );
    const lanes = current(document, 'step:canary-smoke')
      .map((el) => el.getAttribute(M.relation))
      .filter(Boolean);
    assert.deepEqual([...new Set(lanes)], ['ready'], 'the -1/+1 pair moves step:canary-smoke from waiting to ready');
    const added = current(document, 'step:worker-07').map((el) => el.getAttribute(M.relation)).filter(Boolean);
    assert.deepEqual([...new Set(added)], ['ready'], 'the +1 change still adds step:worker-07 to ready');
  } finally {
    await window.happyDOM.close();
  }
});

test('M1 [retractions-applied]: retracting a live addition leaves nothing behind', async () => {
  const f = base();
  const added = f.live_provisional_delta.changes[0].row;
  f.live_provisional_delta.changes.push({ weight: -1, row: added });
  const { html } = await renderSvelte(SHEET, { fixture: f });
  const { window, document } = parseHtml(html);
  try {
    assert.deepEqual(current(document, added.key).length, 0, `+1 then -1 of ${added.key} draws no current row`);
  } finally {
    await window.happyDOM.close();
  }
});
