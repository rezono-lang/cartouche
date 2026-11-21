import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'No silent omissions: wherever the role may not read part of an answer, the page says not readable for your role (MF2), once, without names, keys or placeholders; a number of hidden premises appears only as the reader publishes it',
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

// Decision 0012 §8 and AGENTS.md rule 6: zero leaks, and honest incompleteness (not_read_in_full). A view that drops
// rows the role may not read without saying so looks complete and is not.

const ROOT = process.cwd();
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));

test('M2 [no-silent-omission]: partial role on recorded reader publication shows one MF2 notice without leaking keys, names, placeholders, or hidden counts', async () => {
  const fx10 = readFixture('10-slip-reader-answers.json');

  // Recorded answers for full ('reader') vs partial ('summary') role of the same publication
  const summaryResEn = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'summary',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'flagged', key: ['item-a', '12'] }
  });
  const summaryResNl = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'summary',
    pack: 'slip',
    lang: 'nl',
    row: { relation: 'flagged', key: ['item-a', '12'] }
  });

  for (const [locale, res] of [
    ['en', summaryResEn],
    ['nl', summaryResNl]
  ]) {
    const { window: win, document: doc } = parseHtml(res.html, { lang: locale });
    try {
      const notices = [...doc.querySelectorAll(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)];
      assert.equal(
        notices.length,
        1,
        `slip summary role (${locale}): expected exactly 1 [data-part="horizon"][data-reason="not_read_in_full"] notice, got ${notices.length}`
      );
      const noticeText = (notices[0].textContent ?? '').trim();
      assert.ok(noticeText.length > 0, `slip summary role (${locale}): notice must carry localized MF2 text`);
      assert.equal(
        noticeText.includes('not_read_in_full'),
        false,
        `slip summary role (${locale}): notice must not expose raw snake_case code`
      );
      assert.equal(/\d/.test(noticeText), false, `slip summary role (${locale}): notice must not leak a count of hidden rows`);
      assert.equal(res.html.includes('🔒'), false, `slip summary role (${locale}): zero lock icons allowed`);
      assert.equal(/\b(redacted|hidden|restricted)\b/i.test(noticeText), false, `slip summary role (${locale}): no placeholder prose`);
    } finally {
      await win.happyDOM.close();
    }
  }

  // EN and NL notices must differ (localized MF2)
  const enDoc = parseHtml(summaryResEn.html, { lang: 'en' });
  const nlDoc = parseHtml(summaryResNl.html, { lang: 'nl' });
  try {
    const enNotice = enDoc.document.querySelector(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)?.textContent?.trim();
    const nlNotice = nlDoc.document.querySelector(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)?.textContent?.trim();
    assert.notEqual(enNotice, nlNotice, 'en and nl not_read_in_full notices must be localized');
  } finally {
    await enDoc.window.happyDOM.close();
    await nlDoc.window.happyDOM.close();
  }
});

test('M2 [no-silent-omission]: full role on recorded reader publication and complete snapshot shows zero omission notices', async () => {
  const fx10 = readFixture('10-slip-reader-answers.json');
  const readerRes = await renderSlip({
    fixture: fx10,
    store: 'main',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: { relation: 'flagged', key: ['item-a', '12'] }
  });
  const { window: winR, document: docR } = parseHtml(readerRes.html);
  try {
    const notices = [...docR.querySelectorAll(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)];
    assert.equal(notices.length, 0, 'full reader role must show zero not_read_in_full notices');
  } finally {
    await winR.happyDOM.close();
  }

  // Complete vs restricted sheet snapshots
  const fxFull = readFixture('01-platform-drift.json');
  const fxRestricted = readFixture('02-platform-tenant-a.json');

  const { html: fullHtml } = await renderSvelte(path.join(ROOT, 'packages/atlas/src/FlowSplitSheet.svelte'), {
    fixture: fxFull,
    lang: 'en'
  });
  const { html: restrictedHtml } = await renderSvelte(path.join(ROOT, 'packages/atlas/src/FlowSplitSheet.svelte'), {
    fixture: fxRestricted,
    lang: 'en'
  });

  const fullParsed = parseHtml(fullHtml);
  const restParsed = parseHtml(restrictedHtml);
  try {
    assert.equal(
      fullParsed.document.querySelectorAll(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`).length,
      0,
      'complete snapshot must show zero not_read_in_full notices'
    );
    const restNotices = [...restParsed.document.querySelectorAll(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`)];
    assert.equal(restNotices.length, 1, 'restricted snapshot must show exactly one not_read_in_full notice');
    assert.equal(/\d/.test(restNotices[0].textContent ?? ''), false, 'restricted snapshot notice must not leak a hidden-row count');
    for (const forbidden of fxRestricted.forbidden_leaks_check) {
      assert.equal(restrictedHtml.includes(forbidden), false, `hidden id "${forbidden}" leaked into restricted HTML`);
    }
  } finally {
    await fullParsed.window.happyDOM.close();
    await restParsed.window.happyDOM.close();
  }
});
