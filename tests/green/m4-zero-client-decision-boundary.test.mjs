import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore } from '../../packages/reader-core/src/index.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const M = DATA_MARKS;
const KRING_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'KringstandSheet.svelte');
const FX03_PATH = path.join(ROOT, 'fixtures', '03-kring-m1-to-m5-live.json');
const FX09_PATH = path.join(ROOT, 'fixtures', '09-slip-conformance.json');
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');

const loadJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('M4 [zero-client-decision-boundary]: Kringstand applies +1/-1 weights via DeltaStore so retractions remove rows', async () => {
  const fx = loadJson(FX03_PATH);
  const target = fx.sealed_rows.find((r) => r.key === 'step:policy-push');
  assert.ok(target);
  fx.live_provisional_delta.changes.push({ weight: -1, row: target });

  const { html } = await renderSvelte(KRING_SHEET, { fixture: fx });
  const { window: win, document: doc } = parseHtml(html);
  try {
    // Retracted row must NOT render in board lanes OR in the table twin.
    assert.equal(doc.querySelector(`tr[${M.key}="step:policy-push"]`), null, 'retracted row must be removed');
    // Added +1 row still renders in provisional layer, and Propose stays locked.
    assert.ok(doc.querySelector(`tr[${M.key}="step:worker-07"][${M.layer}="provisional"]`));
    assert.equal(doc.querySelector(`section[${M.sheet}="kringstand"]`).getAttribute(M.trust_tier), 'provisional_engine');
    assert.ok(doc.querySelector('button[data-verb="propose"]').hasAttribute('disabled'));
    assert.ok(doc.querySelector('form button[type="submit"]').hasAttribute('disabled'));

    // Retract-only live delta still removes row and locks Propose.
    const retractOnly = loadJson(FX03_PATH);
    retractOnly.live_provisional_delta.changes = [{ weight: -1, row: target }];
    const { html: html2 } = await renderSvelte(KRING_SHEET, { fixture: retractOnly });
    const parsed2 = parseHtml(html2);
    try {
      assert.equal(parsed2.document.querySelector(`tr[${M.key}="step:policy-push"]`), null);
      assert.equal(parsed2.document.querySelectorAll(`table[${M.part}="twin"] tbody tr`).length, fx.sealed_rows.length - 1);
      assert.ok(parsed2.document.querySelector('button[data-verb="propose"]').hasAttribute('disabled'));
    } finally {
      await parsed2.window.happyDOM.close();
    }
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);
});

test('M4 [zero-client-decision-boundary]: Kringstand live round never borrows a change proof_ref and supports invalid (!) cells', async () => {
  const fx = loadJson(FX03_PATH);
  fx.sealed_rows.push({
    key: 'step:schema-check',
    lane: 'stuck',
    label: 'schema-check',
    sign: 'origin_observation',
    state: 'invalid',
    reason: 'check_failed',
    proof_ref: 'round:m-4#inv-1'
  });

  const { html } = await renderSvelte(KRING_SHEET, { fixture: fx });
  const { window: win, document: doc } = parseHtml(html);
  try {
    // Live round m-5 has no own cert_hash/proof_ref -> must NOT borrow stream:m5-draft-142ms!
    const liveRound = doc.querySelector(`tr[${M.key}="m-5"][${M.layer}="provisional"]`);
    assert.ok(liveRound, 'live round row rendered');
    assert.equal(liveRound.hasAttribute(M.proof_ref), false, 'live round must not borrow a change proof_ref');
    assert.ok(liveRound.textContent.includes('no proof'), 'live round shows explicit no proof');

    // Invalid (!) cell renders cleanly with data-state="invalid", published reason, invalid sign in legend, and !.
    const invCell = doc.querySelector(`tr[${M.key}="step:schema-check"] td[${M.state}="invalid"]`);
    assert.ok(invCell);
    assert.equal(invCell.getAttribute(M.reason), 'check_failed');
    assert.equal(invCell.getAttribute(M.proof_ref), 'round:m-4#inv-1');
    assert.ok(invCell.textContent.includes('!'));
    assert.ok(invCell.querySelector(`[${M.sign}="invalid"]`));
    assert.ok(doc.querySelector(`table[${M.part}="legend"] tr[${M.sign}="invalid"]`));
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);

  // Invalid row without a published reason must throw (never invent a reason).
  const badInv = loadJson(FX03_PATH);
  badInv.sealed_rows.push({
    key: 'step:bad-inv',
    lane: 'stuck',
    label: 'bad-inv',
    sign: 'origin_observation',
    state: 'invalid',
    proof_ref: 'round:m-4#inv-bad'
  });
  await assert.rejects(() => renderSvelte(KRING_SHEET, { fixture: badInv }), /invalid row without published reason/);

  // When a live round DOES publish its own cert_hash, it renders that exact proof_ref.
  const withCert = loadJson(FX03_PATH);
  withCert.live_provisional_delta.cert_hash = 'sha256:own-m5-cert';
  const { html: htmlCert } = await renderSvelte(KRING_SHEET, { fixture: withCert });
  const parsedCert = parseHtml(htmlCert);
  try {
    const lr = parsedCert.document.querySelector(`tr[${M.key}="m-5"][${M.layer}="provisional"]`);
    assert.equal(lr.getAttribute(M.proof_ref), 'sha256:own-m5-cert');
  } finally {
    await parsedCert.window.happyDOM.close();
  }
});

test('M4 [zero-client-decision-boundary]: DeltaStore removes client self-sealing and handles -1 retractions', () => {
  const fx = loadJson(FX03_PATH);
  const store = new DeltaStore(fx.manifest, fx.sealed_rows);

  assert.equal('sealProvisionalAsRound' in store, false);
  assert.equal(Object.prototype.hasOwnProperty.call(DeltaStore.prototype, 'sealProvisionalAsRound'), false);

  // Provisional retraction removes a sealed key from rows() and keeps provisional_engine lock.
  const retracted = fx.sealed_rows[0];
  store.applyProvisionalStep('provisional_engine', [{ weight: -1, row: retracted }]);
  assert.equal(store.rows().some((e) => e.row.key === retracted.key), false);
  assert.equal(store.seal().provisionalCount, 1);
  assert.equal(store.seal().trustTier, 'provisional_engine');
  assert.equal(store.seal().canPropose, false);

  // Only a server-sealed snapshot with trust_tier="sealed" can replace the sealed layer.
  assert.throws(
    () => store.ingestSealedSnapshot({ ...fx.manifest, trust_tier: 'provisional_engine' }, fx.sealed_rows),
    /trust_tier="sealed"/
  );
  store.ingestSealedSnapshot({ ...fx.manifest, id: 'sha256:round-m5', epoch: 43, trust_tier: 'sealed' }, fx.sealed_rows);
  assert.equal(store.seal().trustTier, 'sealed');
  assert.equal(store.seal().provisionalCount, 0);
  assert.equal(store.seal().canPropose, true);
});

test('M4 [zero-client-decision-boundary]: renderFromReader reads trustTier and canPropose from reader /head, never hard-coding sealed', async () => {
  // Fixture 10's /head does not publish trust_tier or can_propose -> must NOT fabricate data-trust-tier="sealed".
  const resDefault = await render({ fixture: FX10_PATH, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const parsedDefault = parseHtml(resDefault.html);
  try {
    const root = parsedDefault.document.querySelector('main [data-cartouche-theme]');
    const seal = parsedDefault.document.querySelector(`[${M.part}="seal"]`);
    assert.ok(root && seal);
    assert.equal(root.hasAttribute(M.trust_tier), false, 'must not fabricate trust_tier="sealed" when reader omits it');
    assert.equal(seal.hasAttribute(M.trust_tier), false, 'seal must not fabricate trust_tier="sealed"');
  } finally {
    await parsedDefault.window.happyDOM.close();
  }

  // When reader /head publishes trust_tier="provisional_engine", rendered seal carries provisional_engine.
  const fxProv = loadJson(FX10_PATH);
  fxProv.reader_answers.main.reader['/slip/head'].body.trust_tier = 'provisional_engine';
  fxProv.reader_answers.main.reader['/slip/head'].body.can_propose = true;
  const resProv = await render({ fixture: fxProv, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const parsedProv = parseHtml(resProv.html);
  try {
    assert.equal(parsedProv.document.querySelector(`[${M.part}="seal"]`).getAttribute(M.trust_tier), 'provisional_engine');
  } finally {
    await parsedProv.window.happyDOM.close();
  }

  // When reader /head publishes trust_tier="sealed" and rights.can_propose=true, rendered seal carries sealed.
  const fxSealed = loadJson(FX10_PATH);
  fxSealed.reader_answers.main.reader['/slip/head'].body.trust_tier = 'sealed';
  fxSealed.reader_answers.main.reader['/slip/head'].body.rights = { can_propose: true };
  const resSealed = await render({ fixture: fxSealed, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  const parsedSealed = parseHtml(resSealed.html);
  try {
    assert.equal(parsedSealed.document.querySelector(`[${M.part}="seal"]`).getAttribute(M.trust_tier), 'sealed');
  } finally {
    await parsedSealed.window.happyDOM.close();
  }

  // Unknown trust_tier from reader /head is rejected.
  const fxBadTier = loadJson(FX10_PATH);
  fxBadTier.reader_answers.main.reader['/slip/head'].body.trust_tier = 'invented_tier';
  await assert.rejects(
    () => render({ fixture: fxBadTier, store: 'main', role: 'reader', pack: 'slip', lang: 'en' }),
    /unknown trust_tier/
  );
});

test('M4 [zero-client-decision-boundary]: no client role===summary projection and no caller-injected seal/sealChecks overrides', async () => {
  const renderSrc = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'bin', 'render.ts'), 'utf8');
  assert.equal(/role\s*===\s*['"]summary['"]/.test(renderSrc), false, 'render.ts must not branch on role === "summary"');

  // Requesting a different role against a single-role fixture is refused (role projection belongs to Rezono).
  await assert.rejects(
    () => render({ fixture: FX09_PATH, role: 'summary', pack: 'slip', lang: 'en', row: 'flagged::item-a::12' }),
    /client-side role projection is forbidden/
  );

  // Caller-injected seal or sealChecks overrides are rejected.
  await assert.rejects(
    () =>
      render({
        fixture: FX09_PATH,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        seal: {
          manifestId: 'sha256:forged',
          epoch: 99,
          knowledgeTime: '2026-01-01T00:00:00Z',
          role: 'admin',
          witnessCheck: 'green',
          trustTier: 'sealed',
          provisionalCount: 0,
          canPropose: true
        }
      }),
    /caller-injected seal or sealChecks are forbidden/
  );

  await assert.rejects(
    () =>
      render({
        fixture: FX09_PATH,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        sealChecks: [{ id: 'reader-hashes', status: 'green' }]
      }),
    /caller-injected seal or sealChecks are forbidden/
  );
});

test('M4 [zero-client-decision-boundary]: packages/slip/src/model.ts runs strictly at build time and documents all 10 computation dispositions', async () => {
  const pageFiles = [
    'Slip.svelte',
    'slip-element.ts',
    'index.ts',
    'SlipValueCell.svelte',
    'SlipSeal.svelte',
    'SlipUnserved.svelte',
    'SlipSweep.svelte',
    'SignMark.svelte'
  ];
  for (const name of pageFiles) {
    const src = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', name), 'utf8');
    assert.equal(
      /from\s+['"]\.\/model(?:\.ts)?['"]/.test(src),
      false,
      `page-bundle file ${name} must NEVER import model.ts`
    );
  }

  // Built asset hash map emitted by render() must not ship model.ts into the page bundle.
  const res = await render({ fixture: FX10_PATH, store: 'main', role: 'reader', pack: 'slip', lang: 'en' });
  assert.equal('packages/slip/src/model.ts' in res.files, false, 'model.ts must not be part of page bundle files');

  // Header records explicit disposition for all 10 audited computations.
  const modelHeader = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', 'model.ts'), 'utf8').slice(0, 3500);
  assert.ok(modelHeader.includes('Computation Disposition Audit'), 'model.ts must include disposition audit header');
  for (let i = 1; i <= 10; i++) {
    assert.ok(new RegExp(`\\*\\s+${i}\\.`).test(modelHeader), `model.ts header missing disposition entry #${i}`);
  }
});
