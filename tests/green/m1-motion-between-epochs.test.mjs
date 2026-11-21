import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (5a). The change between two epochs is the one motion with meaning. It uses the same <del> and <ins>
// as a fold in the slip, driven by the reader-published difference (Cartouche never diffs two snapshots itself).

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'BitemporalStairSheet.svelte');
const M = DATA_MARKS;
const HASH_A = '1'.repeat(64);
const HASH_B = '2'.repeat(64);
const PIN_A = `https://rezono.example/sample/Item/item-a?pin=m-1@d-${HASH_A}`;
const PIN_B = `https://rezono.example/sample/Item/item-a?pin=m-2@d-${HASH_B}`;

function fixtureWithPublishedEpochDiff() {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '05-subsidy-bitemporal.json'), 'utf8'));
  fx.epoch_diff = {
    from_manifest: 'm-1',
    to_manifest: 'm-2',
    entries: [
      { key: '2026-Q1::t1', change: 'removed', old_display: 'EUR 120', old_proof_iri: PIN_A },
      { key: '2026-Q2::t2', change: 'added', new_display: 'EUR 145', new_proof_iri: PIN_B },
      {
        key: '2026-Q3::t2',
        change: 'changed',
        old_display: 'EUR 130',
        old_proof_iri: PIN_A,
        new_display: 'EUR 110',
        new_proof_iri: PIN_B
      }
    ]
  };
  return fx;
}

test('M1 [motion-between-epochs]: published epoch difference renders <del> and <ins> with per-epoch proof links on sheet and twin', async () => {
  const { html } = await renderSvelte(SHEET, { fixture: fixtureWithPublishedEpochDiff(), theme: 'swisstopo' });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const twin = doc.querySelector(`table[${M.part}="twin"]`);
    assert.ok(twin, 'sheet must render its accessible table twin');

    const dels = [...twin.querySelectorAll('del')];
    const ins = [...twin.querySelectorAll('ins')];
    assert.ok(dels.length >= 2, 'removed and changed rows must render old values inside <del> in the table twin');
    assert.ok(ins.length >= 2, 'added and changed rows must render new values inside <ins> in the table twin');

    for (const el of dels) {
      const link = el.closest('a[href]') ?? el.querySelector('a[href]');
      assert.ok(link, 'every <del> must link to the proof of epoch A');
      const at = new URL(link.getAttribute('href') ?? '', 'https://cartouche.local/').searchParams.get('at');
      assert.equal(at, PIN_A, '<del> proof link must pin to epoch A');
    }
    for (const el of ins) {
      const link = el.closest('a[href]') ?? el.querySelector('a[href]');
      assert.ok(link, 'every <ins> must link to the proof of epoch B');
      const at = new URL(link.getAttribute('href') ?? '', 'https://cartouche.local/').searchParams.get('at');
      assert.equal(at, PIN_B, '<ins> proof link must pin to epoch B');
    }
  } finally {
    await win.happyDOM.close();
  }
});

function stripReducedMotionNoPreferenceMedia(css) {
  const re = /@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*\{/gi;
  let out = '';
  let cursor = 0;
  let match;
  while ((match = re.exec(css)) !== null) {
    out += css.slice(cursor, match.index);
    let idx = re.lastIndex;
    let depth = 1;
    while (idx < css.length && depth > 0) {
      if (css[idx] === '{') depth++;
      else if (css[idx] === '}') depth--;
      idx++;
    }
    cursor = idx;
    re.lastIndex = idx;
  }
  out += css.slice(cursor);
  return out;
}

test('M1 [motion-between-epochs]: CSS motion lives strictly inside @media (prefers-reduced-motion: no-preference) with zero idle animations', async () => {
  const { html } = await renderSvelte(SHEET, { fixture: fixtureWithPublishedEpochDiff(), theme: 'swisstopo' });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const css = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    assert.equal(/\binfinite\b/i.test(css), false, 'no idle or infinite breathing animations are permitted');

    const outsideMotionMedia = stripReducedMotionNoPreferenceMedia(css);
    assert.equal(
      /\b(transition|animation)\s*:/i.test(outsideMotionMedia),
      false,
      'CSS transitions/animations must exist only inside @media (prefers-reduced-motion: no-preference)'
    );
  } finally {
    await win.happyDOM.close();
  }
});
