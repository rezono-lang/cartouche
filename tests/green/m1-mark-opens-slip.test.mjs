import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (1). Every mark links to the slip at its pinned Rezono conclusion address:
// <kind iri>/<spelled id>?pin=m-<epoch>@d-<64 hex> (decisions/publication-conclusion-addresses.md).
// Cartouche reads the address from the reader; it never builds one from parts.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const PINNED_IRI_RE = /^[a-z][a-z0-9+.-]*:\/\/[^?#\s]+\?pin=m-[0-9]+@d-[0-9a-f]{64}$/;
const DATASET_HASH = 'a'.repeat(64);
const WRONG_HASH = 'b'.repeat(64);
const IRI_FLAGGED = `https://rezono.example/slip/Item/item-a?pin=m-1@d-${DATASET_HASH}`;
const IRI_HELD = `https://rezono.example/slip/Held/item-a?pin=m-1@d-${DATASET_HASH}`;
const IRI_AMOUNT = `https://rezono.example/slip/ItemAmount/item-a-12?pin=m-1@d-${DATASET_HASH}`;

function fixtureWithConclusionIris() {
  const fx = JSON.parse(fs.readFileSync(FX10_PATH, 'utf8'));
  const reader = fx.reader_answers.main.reader;
  reader['/slip/head'].body.dataset = `d-${DATASET_HASH}`;
  const groundsKey = '/slip/m-1/ask/grounds?relation=flagged&key=%5B%22item-a%22%2C%2212%22%5D';
  const nodes = reader[groundsKey].body.nodes;
  for (const node of nodes) {
    if (node.relation === 'flagged') node.iri = IRI_FLAGGED;
    else if (node.relation === 'held') node.iri = IRI_HELD;
    else if (node.relation === 'item__amount') node.iri = IRI_AMOUNT;
  }
  reader[`/slip/resolve?iri=${encodeURIComponent(IRI_FLAGGED)}`] = {
    status: 200,
    body: { manifest: 'm-1', dataset: `d-${DATASET_HASH}`, relation: 'flagged', key: '["item-a","12"]' }
  };
  reader[`/slip/resolve?iri=${encodeURIComponent(`https://rezono.example/slip/Item/item-a?pin=m-1@d-${WRONG_HASH}`)}`] = {
    status: 409,
    body: { error: 'dataset_pin_mismatch' }
  };
  reader[`/slip/resolve?iri=${encodeURIComponent(`https://rezono.example/slip/Item/item-a?pin=m-0@d-${DATASET_HASH}`)}`] = {
    status: 410,
    body: { error: 'epoch_withdrawn' }
  };
  return fx;
}

function linkForMark(el) {
  if (el.tagName === 'A' && el.hasAttribute('href')) return [el];
  const ancestor = el.closest('a[href]');
  if (ancestor) return [ancestor];
  return [...el.querySelectorAll('a[href]')];
}

test('M1 [mark-opens-slip]: every mark links to the slip with its pinned conclusion IRI in query param at', async () => {
  const fx = fixtureWithConclusionIris();
  const res = await render({ fixture: fx, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const { window: win, document: doc } = parseHtml(res.html);
  try {
    const lines = [...doc.querySelectorAll(`table[${M.sheet}="slip"] tr[${M.line}]`)];
    assert.ok(lines.length >= 2, 'slip must render its ground lines');

    const byKey = new Map();
    for (const tr of lines) {
      const links = linkForMark(tr);
      assert.equal(links.length, 1, `line ${tr.getAttribute(M.line)} must carry exactly one link to its conclusion address`);
      const href = links[0].getAttribute('href') ?? '';
      const url = new URL(href, 'https://cartouche.local/');
      const at = url.searchParams.get('at');
      assert.ok(at && PINNED_IRI_RE.test(at), `link query param "at" must be a pinned conclusion IRI, got "${at}"`);
      const rowKey = `${tr.getAttribute(M.relation)}::${tr.getAttribute(M.key)}`;
      if (byKey.has(rowKey)) assert.equal(byKey.get(rowKey), at, 'marks of one conclusion share one address');
      else byKey.set(rowKey, at);
    }
    assert.equal(new Set(byKey.values()).size, byKey.size, 'different conclusions must link to different addresses');
  } finally {
    await win.happyDOM.close();
  }
});

test('M1 [mark-opens-slip]: render({ at }) resolves the pinned conclusion IRI and refuses mismatched or withdrawn pins', async () => {
  const fx = fixtureWithConclusionIris();

  // Valid pinned IRI resolves to that exact conclusion and carries matching epoch + dataset hash in seal.
  const okRes = await render({ fixture: fx, store: 'main', role: 'reader', pack: 'slip', lang: 'en', at: IRI_FLAGGED });
  const okDom = parseHtml(okRes.html);
  try {
    assert.equal(okDom.document.querySelector(`[${M.part}="unserved"]`), null, 'valid pin must not render unserved');
    const lines = [...okDom.document.querySelectorAll(`table[${M.sheet}="slip"] tr[${M.line}]`)];
    assert.deepEqual(
      lines.map((tr) => [tr.getAttribute(M.relation), tr.getAttribute(M.key)]),
      [['held', '["item-a"]'], ['item__amount', '["item-a","12"]']],
      'resolved slip must answer with the exact grounds of flagged::["item-a","12"] (never another row)'
    );
    const sealText = okDom.document.querySelector(`[${M.part}="seal"]`)?.textContent ?? '';
    assert.ok(sealText.includes('m-1') || okRes.html.includes('m-1'), 'seal must name the pinned epoch m-1');
    assert.ok(sealText.includes(`d-${DATASET_HASH}`), 'seal must name the pinned dataset hash');
  } finally {
    await okDom.window.happyDOM.close();
  }

  // Mismatched dataset hash pin MUST be refused: [data-part="unserved"] and zero tr[data-line].
  const badPin = `https://rezono.example/slip/Item/item-a?pin=m-1@d-${WRONG_HASH}`;
  const badRes = await render({ fixture: fx, store: 'main', role: 'reader', pack: 'slip', lang: 'en', at: badPin });
  const badDom = parseHtml(badRes.html);
  try {
    assert.ok(badDom.document.querySelector(`[${M.part}="unserved"]`), 'mismatched dataset pin must render [data-part="unserved"]');
    assert.equal(badDom.document.querySelectorAll(`tr[${M.line}]`).length, 0, 'mismatched pin must draw zero slip lines');
  } finally {
    await badDom.window.happyDOM.close();
  }

  // Withdrawn epoch pin MUST render the 410 unserved page and zero tr[data-line].
  const gonePin = `https://rezono.example/slip/Item/item-a?pin=m-0@d-${DATASET_HASH}`;
  const goneRes = await render({ fixture: fx, store: 'main', role: 'reader', pack: 'slip', lang: 'en', at: gonePin });
  const goneDom = parseHtml(goneRes.html);
  try {
    const unserved = goneDom.document.querySelector(`[${M.part}="unserved"]`);
    assert.ok(unserved, 'withdrawn epoch pin must render [data-part="unserved"]');
    assert.ok(unserved.textContent.includes('410') || unserved.getAttribute(M.reason)?.includes('410'), 'withdrawn pin must show 410');
    assert.equal(goneDom.document.querySelectorAll(`tr[${M.line}]`).length, 0, 'withdrawn pin must draw zero slip lines');
  } finally {
    await goneDom.window.happyDOM.close();
  }
});
