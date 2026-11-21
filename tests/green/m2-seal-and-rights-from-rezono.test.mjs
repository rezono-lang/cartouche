import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore, manifestFromReaderHead } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const FX03_PATH = path.join(ROOT, 'fixtures', '03-kring-m1-to-m5-live.json');
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const KRING_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'KringstandSheet.svelte');
const M = DATA_MARKS;
const REQUEST = { store: 'main', role: 'reader', pack: 'slip', lang: 'en' };

function cloneFx10() {
  return JSON.parse(fs.readFileSync(FX10_PATH, 'utf8'));
}

test('M2 [seal-and-rights-from-rezono] (1): seal states exactly the served trust_tier and states none when omitted', async () => {
  for (const tier of ['sealed', 'provisional_checked', 'provisional_engine']) {
    const fx = cloneFx10();
    fx.reader_answers.main.reader['/slip/head'].body.trust_tier = tier;
    const { window: win, document: doc } = parseHtml((await render({ fixture: fx, ...REQUEST })).html);
    try {
      const seal = doc.querySelector(`[${M.part}="seal"]`);
      assert.ok(seal, `seal rendered for served tier ${tier}`);
      assert.equal(seal.getAttribute(M.trust_tier), tier, `seal data-trust-tier must match served ${tier}`);
      const tierEl = seal.querySelector('.slip-seal-tier');
      assert.equal(tierEl?.textContent?.trim(), tier, `seal tier text must state ${tier}`);
    } finally {
      await win.happyDOM.close();
    }
  }

  // Head without trust_tier states none.
  const fxOmitted = cloneFx10();
  delete fxOmitted.reader_answers.main.reader['/slip/head'].body.trust_tier;
  const { window: win, document: doc } = parseHtml((await render({ fixture: fxOmitted, ...REQUEST })).html);
  try {
    const seal = doc.querySelector(`[${M.part}="seal"]`);
    assert.ok(seal);
    assert.equal(seal.hasAttribute(M.trust_tier), false, 'seal must omit data-trust-tier when head omits trust_tier');
    assert.equal(seal.querySelector('.slip-seal-tier'), null, 'seal must not render tier text when head omits trust_tier');
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [seal-and-rights-from-rezono] (2): Propose unlocks only when served may_propose is true and tier is not provisional_engine', async () => {
  // may_propose: true + sealed -> unlocked (no lock banner).
  const fxGranted = cloneFx10();
  fxGranted.reader_answers.main.reader['/slip/head'].body.trust_tier = 'sealed';
  fxGranted.reader_answers.main.reader['/slip/head'].body.may_propose = true;
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fxGranted, ...REQUEST })).html);
    try {
      assert.equal(
        doc.querySelector(`[${M.reason}="propose_locked_no_reader_grant"]`),
        null,
        'served may_propose=true on sealed head must unlock Propose'
      );
      assert.equal(
        doc.querySelector(`[${M.reason}="propose_locked_unsealed_live_stream"]`),
        null,
        'sealed head must not show live-stream lock'
      );
    } finally {
      await win.happyDOM.close();
    }
  }

  // may_propose: true + provisional_engine -> locked with live-stream reason.
  const fxLive = cloneFx10();
  fxLive.reader_answers.main.reader['/slip/head'].body.trust_tier = 'provisional_engine';
  fxLive.reader_answers.main.reader['/slip/head'].body.may_propose = true;
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fxLive, ...REQUEST })).html);
    try {
      assert.ok(
        doc.querySelector(`[${M.reason}="propose_locked_unsealed_live_stream"]`),
        'provisional_engine must physically lock Propose even when may_propose is true'
      );
    } finally {
      await win.happyDOM.close();
    }
  }

  // may_propose: false + sealed -> locked with propose_locked_no_reader_grant.
  const fxDenied = cloneFx10();
  fxDenied.reader_answers.main.reader['/slip/head'].body.trust_tier = 'sealed';
  fxDenied.reader_answers.main.reader['/slip/head'].body.may_propose = false;
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fxDenied, ...REQUEST })).html);
    try {
      assert.ok(
        doc.querySelector(`[${M.reason}="propose_locked_no_reader_grant"]`),
        'may_propose=false must keep Propose locked'
      );
    } finally {
      await win.happyDOM.close();
    }
  }

  // KringstandSheet unlocks on served may_propose=true + sealed, locks on may_propose=false.
  const fx03 = JSON.parse(fs.readFileSync(FX03_PATH, 'utf8'));
  for (const [mayPropose, expectDisabled] of [
    [true, false],
    [false, true]
  ]) {
    const { html } = await renderSvelte(KRING_SHEET, {
      fixture: { ...fx03, manifest: { ...fx03.manifest, may_propose: mayPropose }, live_provisional_delta: null }
    });
    const { window: win, document: doc } = parseHtml(html);
    try {
      const propose = doc.querySelector(`button[${M.verb}="propose"]`);
      const approve = doc.querySelector('form button[type="submit"]');
      assert.equal(propose?.hasAttribute('disabled'), expectDisabled);
      assert.equal(approve?.hasAttribute('disabled'), expectDisabled);
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('M2 [seal-and-rights-from-rezono] (3): DeltaStore.ingestSealedSnapshot refuses caller-built ManifestMeta and accepts reader-served sealed head', () => {
  const fx03 = JSON.parse(fs.readFileSync(FX03_PATH, 'utf8'));
  const store = new DeltaStore(fx03.manifest, fx03.sealed_rows);

  // Caller-built object literal with trust_tier: 'sealed' MUST be refused (#46 point 7).
  assert.throws(
    () =>
      store.ingestSealedSnapshot(
        { ...fx03.manifest, id: 'm-99', epoch: 99, trust_tier: 'sealed', may_propose: true },
        fx03.sealed_rows
      ),
    /caller-built ManifestMeta is refused/
  );

  // Reader-served non-sealed head MUST also be refused by ingestSealedSnapshot.
  const provisionalHead = manifestFromReaderHead(
    {
      id: 'm-99',
      epoch: 99,
      knowledge_time: '2026-06-01T00:00:00Z',
      manifest_sha256: 'b'.repeat(64),
      witness_check: 'green',
      trust_tier: 'provisional_checked',
      may_propose: false
    },
    'reader'
  );
  assert.throws(() => store.ingestSealedSnapshot(provisionalHead, fx03.sealed_rows), /trust_tier="sealed"/);

  // Reader-served sealed head IS accepted and reflects served may_propose verbatim.
  const sealedHead = manifestFromReaderHead(
    {
      id: 'm-100',
      epoch: 100,
      knowledge_time: '2026-06-01T00:00:00Z',
      manifest_sha256: 'c'.repeat(64),
      witness_check: 'green',
      trust_tier: 'sealed',
      may_propose: true
    },
    'reader'
  );
  store.ingestSealedSnapshot(sealedHead, fx03.sealed_rows);
  const seal = store.seal();
  assert.equal(seal.manifestId, 'm-100');
  assert.equal(seal.trustTier, 'sealed');
  assert.equal(seal.canPropose, true);
});

test('M2 [seal-and-rights-from-rezono] (4): seal shows per-witness reader-hashes as served and marks unchecked witnesses unavailable', async () => {
  const fx = cloneFx10();
  const answers = fx.reader_answers.main.reader;
  const groundsPath = Object.keys(answers).find((k) => k.includes('/ask/grounds?relation=flagged&'));
  assert.ok(groundsPath, 'fixture 10 contains the home row /ask/grounds answer');
  const grounds = answers[groundsPath].body;
  const witness = (grounds.witnesses ?? [])[0];
  assert.ok(witness, 'grounds answer has at least one witness');

  // Case A: served reader_hashes covers the witness -> green on both per-witness check and reader-hashes.
  grounds.reader_hashes = {
    status: 'green',
    checked_witnesses: [
      {
        conclusion: witness.conclusion,
        status: 'green',
        piece_sha256: 'd'.repeat(64)
      }
    ]
  };
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fx, ...REQUEST })).html);
    try {
      const seal = doc.querySelector(`[${M.part}="seal"]`);
      assert.ok(seal);
      const checks = Object.fromEntries(
        [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)])
      );
      const witnessKey = `reader-hashes:${witness.conclusion.relation}:${witness.conclusion.key}`;
      assert.equal(checks[witnessKey], 'green', 'served per-witness check must quote green');
      assert.equal(checks['reader-hashes'], 'green', 'aggregate reader-hashes quotes served green when all witnesses are checked');
    } finally {
      await win.happyDOM.close();
    }
  }

  // Case B: a witness has no served check in checked_witnesses -> reads unavailable, never green by inference.
  grounds.reader_hashes = {
    status: 'green',
    checked_witnesses: []
  };
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fx, ...REQUEST })).html);
    try {
      const seal = doc.querySelector(`[${M.part}="seal"]`);
      assert.ok(seal);
      const checks = Object.fromEntries(
        [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)])
      );
      const witnessKey = `reader-hashes:${witness.conclusion.relation}:${witness.conclusion.key}`;
      assert.equal(checks[witnessKey], 'unavailable', 'unchecked witness must read unavailable');
      assert.equal(checks['reader-hashes'], 'unavailable', 'reader-hashes must never be green by inference when any witness is unchecked');
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('M2 [seal-and-rights-from-rezono] (5): leaf rows show served origin_sign and show none when source omits origin_sign', async () => {
  const fx = cloneFx10();
  const answers = fx.reader_answers.main.reader;
  const groundsPath = Object.keys(answers).find((k) => k.includes('/ask/grounds?relation=flagged&'));
  assert.ok(groundsPath);
  const grounds = answers[groundsPath].body;
  const leafNode = (grounds.nodes ?? []).find((n) => n.distance === 1 && Array.isArray(n.sources) && n.sources.length > 0);
  assert.ok(leafNode, 'home row grounds answer has at least one distance-1 sourced leaf node');

  // With served origin_sign = 'origin_observation', the leaf row renders [data-sign="origin_observation"].
  leafNode.sources[0].origin_sign = 'origin_observation';
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fx, ...REQUEST })).html);
    try {
      const row = doc.querySelector(`tr[${M.line}][${M.relation}="${leafNode.relation}"]`);
      assert.ok(row, 'leaf row rendered');
      assert.ok(
        row.querySelector(`[${M.sign}="origin_observation"]`),
        'leaf row must show served origin_sign'
      );
    } finally {
      await win.happyDOM.close();
    }
  }

  // Without served origin_sign (or sign), the leaf row shows no origin sign.
  delete leafNode.sources[0].origin_sign;
  delete leafNode.sources[0].sign;
  {
    const { window: win, document: doc } = parseHtml((await render({ fixture: fx, ...REQUEST })).html);
    try {
      const row = doc.querySelector(`tr[${M.line}][${M.relation}="${leafNode.relation}"]`);
      assert.ok(row, 'leaf row rendered');
      assert.equal(
        row.querySelector(`[${M.sign}^="origin_"]`),
        null,
        'leaf row without served origin_sign must show no origin sign'
      );
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('M2 [seal-and-rights-from-rezono] (6): recorded fixture 10 at the Rezono pin serves trust_tier, may_propose, and reader_hashes for every store and role', async () => {
  const fx = cloneFx10();
  for (const [store, roles] of Object.entries(fx.reader_answers)) {
    for (const [role, answers] of Object.entries(roles)) {
      const head = answers['/slip/head'].body;
      assert.equal(typeof head.trust_tier, 'string', `${store}/${role}: recorded /slip/head must serve trust_tier`);
      assert.equal(typeof head.may_propose, 'boolean', `${store}/${role}: recorded /slip/head must serve may_propose`);
      const { window: win, document: doc } = parseHtml(
        (await render({ fixture: FX10_PATH, store, role, pack: 'slip', lang: 'en' })).html
      );
      try {
        const seal = doc.querySelector(`[${M.part}="seal"]`);
        assert.ok(seal, `${store}/${role}: seal rendered`);
        assert.equal(
          seal.getAttribute(M.trust_tier),
          head.trust_tier,
          `${store}/${role}: seal data-trust-tier must quote served ${head.trust_tier}`
        );
        const checks = Object.fromEntries(
          [...seal.querySelectorAll(`[${M.check}]`)].map((el) => [el.getAttribute(M.check), el.getAttribute(M.status)])
        );
        assert.equal(checks['reader-hashes'], 'green', `${store}/${role}: seal quotes served reader-hashes`);
      } finally {
        await win.happyDOM.close();
      }
    }
  }
});
