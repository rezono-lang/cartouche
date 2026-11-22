import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary:
    'Proof map requirement 7: the valid at and known at controls apply to the map, and a change between epochs is animated (what goes, what comes) only when reduced motion is not asked',
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

// Decision 0012 §3a (proof map, requirement 7), building on m1-time-valid-at-known-at and m1-motion-between-epochs.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FIXTURE_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const SHEET_PATH = path.join(ROOT, 'packages', 'atlas', 'src', 'ProofMapSheet.svelte');

const PIN_M1 = `https://rezono.example/zorgtoeslag-slice/calc__allowance/p-bob?pin=m-1@d-${'1'.repeat(64)}`;
const PIN_M2 = `https://rezono.example/zorgtoeslag-slice/calc__allowance/p-bob?pin=m-2@d-${'2'.repeat(64)}`;

function loadFixture() {
  assert.ok(fs.existsSync(FIXTURE_PATH), `Expected recorded fixture at ${path.relative(ROOT, FIXTURE_PATH)}.`);
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function fixtureWithEpochTransition() {
  const fx = loadFixture();
  fx.epoch_diff = {
    from_manifest: 'm-1',
    to_manifest: 'm-2',
    entries: [
      {
        relation: 'inkomen',
        key: 'p-bob',
        change: 'added',
        new_display: 'known',
        new_proof_iri: PIN_M2
      },
      {
        relation: 'calc__allowance',
        key: 'p-bob',
        change: 'changed',
        old_display: `${SIGNS.unknown.glyph} no_version_applies`,
        old_proof_iri: PIN_M1,
        new_display: '10500',
        new_proof_iri: PIN_M2
      }
    ]
  };
  return fx;
}

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

test('M2 [proof-map-time] 1: map reads valid_at and known_at controls and states valid time and epoch in its cartouche seal', async () => {
  const fx = loadFixture();
  const { html } = await renderSvelte(SHEET_PATH, {
    fixture: fx,
    focusKey: 'calc__allowance::p-bob',
    role: 'checker',
    validAt: '2026-02-01',
    knownAt: '2025-12-01',
    manifest: 'm-2'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    const seal = doc.querySelector(`[${M.part}="seal"]`);
    assert.ok(seal, 'ProofMapSheet must render its cartouche [data-part="seal"].');
    const sealText = seal.textContent ?? '';
    assert.ok(sealText.includes('2026-02-01'), `Cartouche seal must state valid_at ("2026-02-01"), got "${sealText}".`);
    assert.ok(
      sealText.includes('2025-12-01') || sealText.includes('m-2'),
      `Cartouche seal must state known_at / epoch ("2025-12-01" or "m-2"), got "${sealText}".`
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-time] 2 & 3: epoch diff marks leaving rows with <del> and arriving rows with <ins> linked to each epoch proof, and motion is gated inside prefers-reduced-motion: no-preference', async () => {
  const fx = fixtureWithEpochTransition();
  const { html, css } = await renderSvelte(SHEET_PATH, {
    fixture: fx,
    focusKey: 'calc__allowance::p-bob',
    role: 'checker',
    validAt: '2026-02-01',
    knownAt: '2025-12-01',
    previousKnownAt: '2025-11-15',
    manifest: 'm-2'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    const dels = [...doc.querySelectorAll('del')];
    const ins = [...doc.querySelectorAll('ins')];
    assert.ok(dels.length >= 1, 'Leaving/superseded row values must be marked with <del> from the published difference.');
    assert.ok(ins.length >= 1, 'Arriving/new row values must be marked with <ins> from the published difference.');

    for (const el of dels) {
      const link = el.closest('a[href]') ?? el.querySelector('a[href]');
      assert.ok(link, 'Every <del> mark must link to the proof of its own departing epoch.');
      const at = new URL(link.getAttribute('href') ?? '', 'https://cartouche.local/').searchParams.get('at');
      assert.equal(at, PIN_M1, '<del> proof link must pin to epoch m-1.');
    }
    for (const el of ins) {
      const link = el.closest('a[href]') ?? el.querySelector('a[href]');
      assert.ok(link, 'Every <ins> mark must link to the proof of its own arriving epoch.');
      const at = new URL(link.getAttribute('href') ?? '', 'https://cartouche.local/').searchParams.get('at');
      assert.equal(at, PIN_M2, '<ins> proof link must pin to epoch m-2.');
    }

    const cssText = [
      typeof css === 'string' ? css : css?.code ?? '',
      ...[...doc.querySelectorAll('style')].map((s) => s.textContent ?? '')
    ].join('\n');

    assert.equal(/\binfinite\b/i.test(cssText), false, 'Proof map must have zero idle or infinite animations.');
    const outsideMotionMedia = stripReducedMotionNoPreferenceMedia(cssText);
    assert.equal(
      /\b(transition|animation)\s*:/i.test(outsideMotionMedia),
      false,
      'Epoch transition animation must live strictly inside @media (prefers-reduced-motion: no-preference).'
    );
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-time] 4: first case — moving known_at from m-1 to m-2 turns p-bob missing income into a fact row and calc__allowance from unknown into 10500', () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  // Before p-bob income arrives: m-1 (as_of=2026-02-01, known=2025-11-15)
  const before = atlas.compileProofMapLayout(fx, {
    role: 'checker',
    validAt: '2026-02-01',
    knownAt: '2025-11-15',
    manifest: 'm-1'
  });
  const bobBefore = before.nodes.find((n) => n.relation === 'calc__allowance' && String(n.key).includes('p-bob'));
  assert.ok(bobBefore, 'm-1 layout must include calc__allowance row for p-bob.');
  assert.equal(bobBefore.state, 'unknown', 'At m-1 (known 2025-11-15), p-bob calc__allowance must be unknown.');

  // After p-bob income arrives: m-2 (as_of=2026-02-01, known=2025-12-01)
  const after = atlas.compileProofMapLayout(fx, {
    role: 'checker',
    validAt: '2026-02-01',
    knownAt: '2025-12-01',
    manifest: 'm-2'
  });
  const bobAfter = after.nodes.find((n) => n.relation === 'calc__allowance' && String(n.key).includes('p-bob'));
  assert.ok(bobAfter, 'm-2 layout must include calc__allowance row for p-bob.');
  assert.equal(bobAfter.state, 'known', 'At m-2 (known 2025-12-01), p-bob calc__allowance must become known.');
  const hasPublishedAmount = (bobAfter.slots ?? []).some((s) => String(s.display).includes('10500'));
  assert.ok(hasPublishedAmount, 'At m-2, p-bob calc__allowance card must display published value "10500".');
});
