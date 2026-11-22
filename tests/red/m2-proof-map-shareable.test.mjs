import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import * as readerCore from '../../packages/reader-core/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary:
    'Proof map requirement 11: every map state (selection, role lens, valid at, known at, epoch, expansions) is a pinned shareable link that reproduces the same map',
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
    'm2-pinned-share-links',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 11), with the rules of m2-pinned-share-links.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FIXTURE_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const SHEET_PATH = path.join(ROOT, 'packages', 'atlas', 'src', 'ProofMapSheet.svelte');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function loadFixture() {
  assert.ok(fs.existsSync(FIXTURE_PATH), `Expected recorded fixture at ${path.relative(ROOT, FIXTURE_PATH)}.`);
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('M2 [proof-map-shareable] 1: map share URL encodes focus, selection, role_lens, valid_at, known_at, epoch, and expansions with zero session or personal data', () => {
  assert.equal(
    typeof atlas.buildProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export buildProofMapShareUrl(params).'
  );
  assert.equal(
    typeof atlas.parseProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export parseProofMapShareUrl(url).'
  );

  const focusIri = 'rezono:sha256:c76dc998ae2174c269588823b5f26435/calc__allowance/p-ann';
  const shareUrl = atlas.buildProofMapShareUrl({
    baseUrl: 'https://atlas.example/map?session=leak-me&email=user@example.test',
    at: focusIri,
    selection: 'toeslagpartner::p-ann',
    roleLens: 'checker',
    validAt: '2026-01-01',
    knownAt: '2026-05-01',
    epoch: 4,
    expansions: ['why:calc__allowance::p-ann', 'depends:persoon::p-ann'],
    sessionToken: 'secret-token',
    userEmail: 'person@example.test'
  });

  const parsed = new URL(shareUrl);
  assert.equal(parsed.searchParams.get('at'), focusIri, 'Share URL must carry pinned focus IRI in "at".');
  assert.equal(parsed.searchParams.get('selection'), 'toeslagpartner::p-ann');
  assert.equal(parsed.searchParams.get('role_lens'), 'checker');
  assert.equal(parsed.searchParams.get('valid_at'), '2026-01-01');
  assert.equal(parsed.searchParams.get('known_at'), '2026-05-01');
  assert.equal(parsed.searchParams.get('epoch'), '4');
  assert.ok(
    (parsed.searchParams.get('expansions') ?? '').includes('why:calc__allowance::p-ann'),
    'Share URL must encode active map expansions.'
  );
  assert.equal(
    /session|token|email|person@example|user@example/i.test(shareUrl),
    false,
    'Share URL must strip all session and personal data.'
  );

  const roundTrip = atlas.parseProofMapShareUrl(shareUrl);
  assert.equal(roundTrip.at, focusIri);
  assert.equal(roundTrip.selection, 'toeslagpartner::p-ann');
  assert.equal(roundTrip.roleLens, 'checker');
  assert.equal(roundTrip.validAt, '2026-01-01');
  assert.equal(roundTrip.knownAt, '2026-05-01');
  assert.equal(roundTrip.epoch, 4);
  assert.deepEqual(roundTrip.expansions, ['why:calc__allowance::p-ann', 'depends:persoon::p-ann']);
});

test('M2 [proof-map-shareable] 2: opening the same share URL renders byte-identical map HTML and SVG for the same role', async () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.buildProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export buildProofMapShareUrl(params).'
  );
  assert.equal(
    typeof atlas.parseProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export parseProofMapShareUrl(url).'
  );
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const shareUrl = atlas.buildProofMapShareUrl({
    baseUrl: 'https://atlas.example/map',
    at: 'calc__allowance::p-ann',
    selection: 'toeslagpartner::p-ann',
    roleLens: 'checker',
    validAt: '2026-01-01',
    knownAt: '2026-05-01',
    epoch: 4,
    expansions: ['why:calc__allowance::p-ann']
  });
  const state = atlas.parseProofMapShareUrl(shareUrl);

  const layoutA = atlas.compileProofMapLayout(fx, {
    role: 'checker',
    focusKey: state.at,
    selection: state.selection,
    validAt: state.validAt,
    knownAt: state.knownAt,
    epoch: state.epoch,
    expansions: state.expansions
  });
  const layoutB = atlas.compileProofMapLayout(fx, {
    role: 'checker',
    focusKey: state.at,
    selection: state.selection,
    validAt: state.validAt,
    knownAt: state.knownAt,
    epoch: state.epoch,
    expansions: state.expansions
  });
  assert.equal(sha256(layoutA.svg), sha256(layoutB.svg), 'Opening the same share URL must produce byte-identical SVG.');

  const renderA = await renderSvelte(SHEET_PATH, { fixture: fx, shareUrl, role: 'checker' });
  const renderB = await renderSvelte(SHEET_PATH, { fixture: fx, shareUrl, role: 'checker' });
  assert.equal(sha256(renderA.html), sha256(renderB.html), 'Opening the same share URL must produce byte-identical HTML.');
});

test('M2 [proof-map-shareable] 3: role lens never escalates privileges and a withdrawn epoch renders the 410 unserved view', async () => {
  const fx = loadFixture();
  assert.equal(
    typeof atlas.buildProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export buildProofMapShareUrl(params).'
  );
  assert.equal(
    typeof atlas.parseProofMapShareUrl,
    'function',
    'packages/atlas/src/index.ts must export parseProofMapShareUrl(url).'
  );

  const checkerUrl = atlas.buildProofMapShareUrl({
    baseUrl: 'https://atlas.example/map',
    at: 'calc__allowance::p-ann',
    roleLens: 'checker',
    validAt: '2026-01-01',
    knownAt: '2026-05-01',
    epoch: 4
  });
  const parsed = atlas.parseProofMapShareUrl(checkerUrl);

  // Recipient with only "limited" role opening a link with role_lens=checker never escalates.
  const access = readerCore.resolvePinnedShareAccess(parsed, {
    recipientRole: 'limited',
    allowedRoleLenses: ['limited'],
    readerStatus: 200
  });
  assert.equal(access.effectiveRole, 'limited', 'role_lens in URL must never escalate recipient privileges.');
  assert.equal(access.roleLensNotice, true, 'Denied role_lens must raise a notice.');

  // Rendering ProofMapSheet for a withdrawn epoch (410) renders [data-part="unserved"] with zero map/twin rows.
  const { html } = await renderSvelte(SHEET_PATH, {
    fixture: fx,
    shareUrl: checkerUrl,
    role: 'checker',
    readerStatus: 410
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const unserved = doc.querySelector(`[${M.part}="unserved"]`);
    assert.ok(unserved, 'A withdrawn epoch (410) must render [data-part="unserved"].');
    assert.equal(
      doc.querySelectorAll(`table[${M.part}="twin"] tbody tr`).length,
      0,
      'A withdrawn epoch (410) must render zero rows in the table twin.'
    );
  } finally {
    await win.happyDOM.close();
  }
});
