import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (4). Time is the main control. Rezono facts are bitemporal: valid time (when it holds) and
// knowledge time (which epoch, which manifest). An earlier epoch stays citable (publication-supersession-and-withdrawal).

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps', 'atlas-viewer', 'src', 'App.svelte');
const M = DATA_MARKS;

function hasAccessibleLabel(doc, ctrl) {
  if (!ctrl) return false;
  if (ctrl.closest('label')) return true;
  const id = ctrl.getAttribute('id');
  return Boolean(id && doc.querySelector(`label[for="${id}"]`));
}

test('M1 [time-valid-at-known-at]: atlas page renders labelled valid_at and known_at global controls', async () => {
  const { html } = await renderSvelte(APP, { initialTab: 'bitemporal', initialLocale: 'en' });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const validAt = doc.querySelector('input[name="valid_at"], select[name="valid_at"]');
    const knownAt = doc.querySelector('input[name="known_at"], select[name="known_at"]');
    assert.ok(validAt, 'atlas page must render a global [name="valid_at"] control');
    assert.ok(knownAt, 'atlas page must render a global [name="known_at"] control');
    assert.equal(hasAccessibleLabel(doc, validAt), true, 'valid_at control must have an accessible label');
    assert.equal(hasAccessibleLabel(doc, knownAt), true, 'known_at control must have an accessible label');
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [time-valid-at-known-at]: changing known_at switches manifest hash in seal and refuses unreadable epochs', async () => {
  const e1 = await renderSvelte(APP, { initialTab: 'bitemporal', initialKnownAt: 'm-1', initialValidAt: '2026-01-01' });
  const e2 = await renderSvelte(APP, { initialTab: 'bitemporal', initialKnownAt: 'm-2', initialValidAt: '2026-01-01' });
  const d1 = parseHtml(e1.html);
  const d2 = parseHtml(e2.html);
  try {
    const h1 = d1.document.querySelector(`[${M.part}="seal"] [${M.part}="manifest-hash"]`)?.textContent?.trim();
    const h2 = d2.document.querySelector(`[${M.part}="seal"] [${M.part}="manifest-hash"]`)?.textContent?.trim();
    assert.ok(h1 && h2, 'both epochs must render a manifest hash in the seal');
    assert.notEqual(h1, h2, 'changing known_at must render the manifest hash of that epoch');

    const cartouche1 = d1.document.querySelector(`[${M.part}="seal"]`)?.textContent ?? '';
    assert.ok(cartouche1.includes('2026-01-01'), 'cartouche must state the active valid_at date');
  } finally {
    await d1.window.happyDOM.close();
    await d2.window.happyDOM.close();
  }

  // Unreadable / withdrawn epoch must show [data-part="unserved"], never silently fall back to the newest epoch.
  const gone = await renderSvelte(APP, { initialTab: 'bitemporal', initialKnownAt: 'm-withdrawn' });
  const dGone = parseHtml(gone.html);
  try {
    assert.ok(
      dGone.document.querySelector(`[${M.part}="unserved"]`),
      'an epoch the role can no longer read must show the unserved/410 page'
    );
  } finally {
    await dGone.window.happyDOM.close();
  }
});

test('M1 [time-valid-at-known-at]: bitemporal staircase highlights (valid_at, known_at) and reflects both in page URL state', async () => {
  const { html } = await renderSvelte(APP, {
    initialTab: 'bitemporal',
    initialValidAt: '2026-02-01',
    initialKnownAt: 'm-2'
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const activeCells = [...doc.querySelectorAll(`[${M.sheet}="bitemporal-stair"] [aria-current="true"]`)];
    const activeCell = activeCells.find((el) => {
      const k = el.getAttribute(M.key) ?? '';
      const p = el.getAttribute(M.proof_ref) ?? '';
      return (k.includes('2026-02-01') || p.includes('2026-02-01')) && (k.includes('m-2') || p.includes('m-2'));
    });
    assert.ok(activeCell, 'bitemporal staircase must mark the (2026-02-01, m-2) cell with aria-current="true"');

    const permalink = doc.querySelector('a[href*="valid_at=2026-02-01"][href*="known_at=m-2"]');
    assert.ok(permalink, 'page must expose both valid_at and known_at in the page address so a link reproduces the view');
  } finally {
    await win.happyDOM.close();
  }
});
