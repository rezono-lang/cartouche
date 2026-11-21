import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as readerCore from '../../packages/reader-core/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'Pinned share links: sharing a conclusion shares its pinned address; the recipient sees only the part of their own role, and a 410 page with the withdrawal reason if it was withdrawn',
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
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §3 (11). After Stardog Explorer share links, with Rezono pins and withdrawal
// (decisions/publication-supersession-and-withdrawal.md).

const ROOT = process.cwd();
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

test('M2 [pinned-share-links]: share URL carries pinned IRI, time controls, selection, and optional role lens with zero session or personal data', () => {
  assert.equal(
    typeof readerCore.buildPinnedShareUrl,
    'function',
    'reader-core must export buildPinnedShareUrl(params)'
  );
  assert.equal(
    typeof readerCore.parsePinnedShareUrl,
    'function',
    'reader-core must export parsePinnedShareUrl(url)'
  );

  const pinnedIri = 'rezono:sha256:aaaa1111bbbb2222cccc3333dddd4444/flagged/item-a/12';
  const url = readerCore.buildPinnedShareUrl({
    baseUrl: 'https://atlas.example/slip',
    at: pinnedIri,
    validAt: '2026-01-01',
    knownAt: 'm-4',
    epoch: 4,
    selection: 'flagged::item-a::12',
    roleLens: 'reader',
    // Forbidden fields must be stripped and never appear in the shared URL
    sessionId: 'secret-session-token',
    userEmail: 'person@example.test'
  });

  const parsedUrl = new URL(url);
  assert.equal(parsedUrl.searchParams.get('at'), pinnedIri, 'share URL must carry pinned conclusion IRI');
  assert.equal(parsedUrl.searchParams.get('valid_at'), '2026-01-01');
  assert.equal(parsedUrl.searchParams.get('known_at'), 'm-4');
  assert.equal(parsedUrl.searchParams.get('epoch'), '4');
  assert.equal(parsedUrl.searchParams.get('selection'), 'flagged::item-a::12');
  assert.equal(parsedUrl.searchParams.get('role_lens'), 'reader');
  assert.equal(/session|token|email|person@example/i.test(url), false, 'share URL must never leak session or personal data');

  const roundTripped = readerCore.parsePinnedShareUrl(url);
  assert.equal(roundTripped.at, pinnedIri);
  assert.equal(roundTripped.validAt, '2026-01-01');
  assert.equal(roundTripped.knownAt, 'm-4');
  assert.equal(roundTripped.epoch, 4);
  assert.equal(roundTripped.selection, 'flagged::item-a::12');
  assert.equal(roundTripped.roleLens, 'reader');
});

test('M2 [pinned-share-links]: role lens never escalates privileges and unreadable addresses return the same answer as unknown addresses', async () => {
  assert.equal(
    typeof readerCore.resolvePinnedShareAccess,
    'function',
    'reader-core must export resolvePinnedShareAccess(share, recipientContext)'
  );

  const share = readerCore.parsePinnedShareUrl(
    readerCore.buildPinnedShareUrl({
      baseUrl: 'https://atlas.example/map',
      at: 'rezono:sha256:aaaa1111/flagged/item-a/12',
      validAt: '2026-01-01',
      knownAt: 'm-4',
      epoch: 4,
      roleLens: 'reader'
    })
  );

  // Recipient with only 'summary' role opening a link with role_lens=reader stays on 'summary' + gets a notice
  const downgraded = readerCore.resolvePinnedShareAccess(share, {
    recipientRole: 'summary',
    allowedRoleLenses: ['summary'],
    readerStatus: 200
  });
  assert.equal(downgraded.effectiveRole, 'summary', 'role lens in URL must never grant a higher role');
  assert.equal(downgraded.roleLensNotice, true, 'denied role lens must produce a notice');

  // Role that may not read the conclusion (403/404) must receive the exact same public outcome as an unknown address
  const deniedOutcome = readerCore.resolvePinnedShareAccess(share, {
    recipientRole: 'external',
    allowedRoleLenses: ['external'],
    readerStatus: 403
  });
  const missingOutcome = readerCore.resolvePinnedShareAccess(share, {
    recipientRole: 'external',
    allowedRoleLenses: ['external'],
    readerStatus: 404
  });
  assert.deepEqual(
    deniedOutcome,
    missingOutcome,
    'unreadable conclusion must produce the exact same answer as an unknown address (zero existence leak)'
  );
});

test('M2 [pinned-share-links]: withdrawn epoch renders 410 with withdrawal reason, decider, and date (zero tr[data-line]); superseded epoch shows pinned result plus successor manifest', async () => {
  const fx410 = readFixture('07-unserved-410.json');
  const withdrawnFixture = {
    ...fx410,
    unserved: {
      ...fx410.unserved,
      withdrawn_at: '2026-03-15T12:00:00Z'
    }
  };
  const res410 = await renderSlip({ fixture: withdrawnFixture, lang: 'en' });
  const { window: win410, document: doc410 } = parseHtml(res410.html);
  try {
    const unserved = doc410.querySelector(`[${DATA_MARKS.part}="unserved"]`);
    assert.ok(unserved, '410 withdrawn link must render [data-part="unserved"]');
    assert.equal(doc410.querySelectorAll(`tr[${DATA_MARKS.line}]`).length, 0, '410 withdrawn page must emit zero tr[data-line]');
    assert.ok(unserved.textContent.includes(withdrawnFixture.unserved.withdrawn_by_decision_ref), '410 must show decider ref');
    assert.ok(unserved.textContent.includes('2026-03-15T12:00:00Z'), '410 must show withdrawal date as served by reader');
  } finally {
    await win410.happyDOM.close();
  }

  // Superseded epoch (HTTP 200 with reader successor manifest header) shows pinned old result AND successor manifest
  const fx10 = readFixture('10-slip-reader-answers.json');
  const successorManifest = 'sha256:9999888877776666555544443333222211110000';
  const resSuperseded = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'flagged', key: ['item-a', '12'] },
    supersededBy: successorManifest
  });
  const { window: winSup, document: docSup } = parseHtml(resSuperseded.html);
  try {
    assert.ok(docSup.querySelectorAll(`tr[${DATA_MARKS.line}]`).length > 0, 'superseded epoch must still show the pinned old result');
    assert.ok(
      resSuperseded.html.includes(successorManifest),
      'superseded epoch must show which newer manifest superseded it from reader headers'
    );
  } finally {
    await winSup.happyDOM.close();
  }
});
