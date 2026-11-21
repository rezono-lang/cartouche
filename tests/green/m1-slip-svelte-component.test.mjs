import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import { createSlipModel } from '../../packages/slip/src/slip-controller.ts';
import { SLIP_ELEMENT_TAG, defineSlipElement, renderSlipElementHtml } from '../../packages/slip/src/slip-element.ts';
import { render as renderSlipHarness } from '../../packages/slip/bin/render.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const SLIP_SVELTE = path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
}

function assertLegendCoversAllDrawnSigns(doc) {
  const legendTable = doc.querySelector(`table[${DATA_MARKS.part}="legend"]`);
  const drawnOutsideLegend = [...doc.querySelectorAll(`[${DATA_MARKS.sign}]`)].filter(
    (el) => !el.closest(`table[${DATA_MARKS.part}="legend"]`)
  );
  if (drawnOutsideLegend.length === 0) return;
  assert.ok(legendTable, 'expected table[data-part="legend"] whenever signs are drawn');
  assert.ok(legendTable.querySelector('th'), 'legend table must have at least one <th>');

  const legendSigns = new Set(
    [...legendTable.querySelectorAll(`tr[${DATA_MARKS.sign}]`)].map((tr) => tr.getAttribute(DATA_MARKS.sign))
  );
  for (const el of drawnOutsideLegend) {
    const sign = el.getAttribute(DATA_MARKS.sign);
    assert.ok(legendSigns.has(sign), `drawn sign "${sign}" missing from table[data-part="legend"]`);
  }
}

function assertAllTablesHaveHeaders(doc) {
  for (const table of doc.querySelectorAll('table')) {
    assert.ok(table.querySelector('th'), 'every rendered table must include at least one <th> header cell');
  }
}

function extractCanonicalMarks(html) {
  const { window: win, document: doc } = parseHtml(html);
  const trackedAttrs = Object.values(DATA_MARKS);
  try {
    const main = doc.querySelector('main');
    const records = [];
    for (const el of main.querySelectorAll('*')) {
      const entry = {};
      for (const attr of trackedAttrs) {
        const v = el.getAttribute(attr);
        if (v !== null) entry[attr] = v;
      }
      if (Object.keys(entry).length > 0) {
        records.push({
          tag: el.tagName.toLowerCase(),
          disabled: el.tagName.toLowerCase() === 'button' ? Boolean(el.disabled) : undefined,
          marks: entry
        });
      }
    }
    return records;
  } finally {
    win.happyDOM.close();
  }
}

test('M1: Slip.svelte emits canonical data-* marks, 5-bar micro-prism, [M] levers, [S] Δ=1 worlds, honest seal, legend & 0 WCAG 2.1 AA violations', async () => {
  const fx = loadFixture('01-platform-drift.json');
  const store = new DeltaStore(fx.manifest, []);
  const seal = store.seal();
  const baseModel = createSlipModel({
    subjectId: 'e-drift-vault',
    proofRef: 'policy:netpol-04#L42',
    seal,
    activeVerb: 'm',
    prism5: fx.slip_enrichment.prism_5,
    missingLevers: fx.slip_enrichment.missing_levers,
    adjacentWorlds: fx.slip_enrichment.adjacent_worlds_delta1
  });

  // Render on [M] Missing without explicit sealChecks -> only honest witness check is rendered
  const { html: htmlMissing } = await renderSvelte(SLIP_SVELTE, {
    theme: 'swisstopo',
    model: baseModel,
    seal,
    activeVerb: 'm'
  });

  const { window: winM, document: docM } = parseHtml(htmlMissing);
  try {
    const root = docM.querySelector(`main [${DATA_MARKS.theme}="swisstopo"]`);
    assert.ok(root, 'expected slip root with data-cartouche-theme="swisstopo"');
    assert.equal(root.getAttribute(DATA_MARKS.trust_tier), 'sealed');

    // Seal checks & manifest hash (must NOT invent unrun reader-hashes/publisher-record)
    const sealEl = docM.querySelector(`[${DATA_MARKS.part}="seal"]`);
    assert.ok(sealEl, 'expected [data-part="seal"]');
    assert.equal(
      sealEl.querySelector(`[${DATA_MARKS.part}="manifest-hash"]`)?.textContent,
      fx.manifest.id
    );
    const defaultChecks = [...sealEl.querySelectorAll(`[${DATA_MARKS.check}]`)];
    assert.deepEqual(
      defaultChecks.map((el) => ({ id: el.getAttribute(DATA_MARKS.check), status: el.getAttribute(DATA_MARKS.status) })),
      [{ id: 'witness', status: 'green' }],
      'without server-provided sealChecks, Slip must render only the honest witness check'
    );

    // 5-bar micro-prism
    const prismRows = [...docM.querySelectorAll(`[${DATA_MARKS.part}="prism"] tr[${DATA_MARKS.key}]`)];
    assert.equal(prismRows.length, 5, 'expected exactly 5 prism bars');
    assert.deepEqual(
      prismRows.map((r) => r.getAttribute(DATA_MARKS.key)),
      fx.slip_enrichment.prism_5.map((p) => p.key)
    );
    for (let i = 0; i < prismRows.length; i++) {
      assert.ok(
        prismRows[i].textContent.includes(fx.slip_enrichment.prism_5[i].ratio_display),
        `prism bar ${i} must display opaque ratio_display verbatim`
      );
      assert.equal(prismRows[i].getAttribute(DATA_MARKS.proof_ref), 'policy:netpol-04#L42');
    }

    // 6 W/D/M/S/C/P verb buttons in canonical STD_VERBS order
    const verbBtns = [...docM.querySelectorAll(`button[${DATA_MARKS.verb}][${DATA_MARKS.key}]`)];
    assert.deepEqual(
      verbBtns.map((b) => ({ verb: b.getAttribute(DATA_MARKS.verb), key: b.getAttribute(DATA_MARKS.key) })),
      STD_VERBS.map((v) => ({ verb: v.verb, key: v.key }))
    );
    const missingBtn = docM.querySelector(`button[${DATA_MARKS.verb}="missing"][${DATA_MARKS.key}="m"]`);
    assert.equal(missingBtn?.getAttribute('aria-pressed'), 'true');
    const proposeBtn = docM.querySelector(`button[${DATA_MARKS.verb}="propose"][${DATA_MARKS.key}="p"]`);
    assert.equal(proposeBtn?.disabled, false, 'sealed store with green witness allows [P] Propose');

    // [M] Certainty Levers
    const leverRows = [...docM.querySelectorAll(`[${DATA_MARKS.part}="levers"] tr[${DATA_MARKS.key}]`)];
    assert.equal(leverRows.length, 1);
    assert.equal(leverRows[0].getAttribute(DATA_MARKS.key), 'lever-edge04');
    assert.equal(leverRows[0].getAttribute(DATA_MARKS.load_bearing), 'true');

    assertAllTablesHaveHeaders(docM);
    assertLegendCoversAllDrawnSigns(docM);
  } finally {
    await winM.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(htmlMissing), [], 'Slip [M] view must have 0 WCAG 2.1 AA violations');

  // Render with explicit server-provided sealChecks + [S] Suppose Δ=1 adjacent worlds
  const { html: htmlSuppose } = await renderSvelte(SLIP_SVELTE, {
    theme: 'obsidian',
    model: baseModel,
    seal,
    sealChecks: [
      { id: 'reader-hashes', status: 'green' },
      { id: 'publisher-record', status: 'green' }
    ],
    activeVerb: 's'
  });

  const { window: winS, document: docS } = parseHtml(htmlSuppose, { theme: 'obsidian' });
  try {
    assert.ok(docS.querySelector(`main [${DATA_MARKS.theme}="obsidian"]`));
    const explicitChecks = [...docS.querySelectorAll(`[${DATA_MARKS.part}="seal"] [${DATA_MARKS.check}]`)];
    assert.deepEqual(
      explicitChecks.map((el) => ({ id: el.getAttribute(DATA_MARKS.check), status: el.getAttribute(DATA_MARKS.status) })),
      [
        { id: 'reader-hashes', status: 'green' },
        { id: 'publisher-record', status: 'green' }
      ]
    );
    const worldRows = [...docS.querySelectorAll(`[${DATA_MARKS.part}="adjacent-worlds"] tr[${DATA_MARKS.key}]`)];
    assert.equal(worldRows.length, 3);
    assert.deepEqual(
      worldRows.map((r) => r.getAttribute(DATA_MARKS.key)),
      fx.slip_enrichment.adjacent_worlds_delta1.map((w) => w.id)
    );
    assert.deepEqual(
      worldRows.map((r) => r.getAttribute(DATA_MARKS.proof_ref)),
      fx.slip_enrichment.adjacent_worlds_delta1.map((w) => w.proof_ref)
    );
    assertAllTablesHaveHeaders(docS);
    assertLegendCoversAllDrawnSigns(docS);
  } finally {
    await winS.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(htmlSuppose, { theme: 'obsidian' }), [], 'Slip [S] view must have 0 WCAG 2.1 AA violations');
});

test('M1: Slip.svelte physically disables [P] Propose on provisional_engine and omits data-trust-tier when unsealed/no seal', async () => {
  const fxFlow = loadFixture('01-platform-drift.json');
  const fxKring = loadFixture('03-kring-m1-to-m5-live.json');
  const store = new DeltaStore(fxKring.manifest, fxKring.sealed_rows);
  store.applyProvisionalStep('provisional_engine', fxKring.live_provisional_delta.changes);
  const seal = store.seal();

  const model = createSlipModel({
    subjectId: 'step:worker-07',
    proofRef: 'stream:m5-draft-142ms',
    seal,
    prism5: fxFlow.slip_enrichment.prism_5,
    missingLevers: fxFlow.slip_enrichment.missing_levers,
    adjacentWorlds: fxFlow.slip_enrichment.adjacent_worlds_delta1
  });

  const { html } = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', model, seal });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const sealEl = doc.querySelector(`[${DATA_MARKS.part}="seal"]`);
    assert.equal(sealEl?.getAttribute(DATA_MARKS.trust_tier), 'provisional_engine');

    const proposeBtn = doc.querySelector(`button[${DATA_MARKS.verb}="propose"][${DATA_MARKS.key}="p"]`);
    assert.ok(proposeBtn, 'expected [P] Propose button');
    assert.equal(proposeBtn.disabled, true, '[P] Propose must be physically disabled on provisional_engine');
    assert.equal(proposeBtn.getAttribute('aria-disabled'), 'true');
    assert.equal(
      proposeBtn.querySelector(`[${DATA_MARKS.reason}]`)?.getAttribute(DATA_MARKS.reason),
      'propose_locked_unsealed_live_stream'
    );
  } finally {
    await win.happyDOM.close();
  }

  assert.deepEqual(await auditA11y(html), [], 'Provisional Slip view must have 0 WCAG 2.1 AA violations');

  // With no seal provided, neither Slip.svelte nor slip-element may default data-trust-tier to "sealed"
  const { html: noSealHtml } = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', seal: null });
  const noSealElHtml = renderSlipElementHtml({ theme: 'swisstopo', seal: null });
  for (const fragment of [noSealHtml, noSealElHtml]) {
    const { window: winN, document: docN } = parseHtml(fragment);
    try {
      const root = docN.querySelector(`main [${DATA_MARKS.theme}="swisstopo"]`);
      assert.equal(
        root?.getAttribute(DATA_MARKS.trust_tier),
        null,
        'missing seal must omit data-trust-tier rather than claiming "sealed"'
      );
    } finally {
      await winN.happyDOM.close();
    }
  }
});

test('M1: Slip.svelte and bin/render.ts render HTTP 410 unserved state with [data-part="unserved"], no invented code, and zero tr[data-line]', async () => {
  const fx410 = loadFixture('07-unserved-410.json');

  const { html: directHtml } = await renderSvelte(SLIP_SVELTE, {
    theme: 'swisstopo',
    unserved: fx410.unserved,
    httpStatus: fx410.http_status
  });
  const harnessRes = await renderSlipHarness({
    fixture: 'fixtures/07-unserved-410.json',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  });

  for (const html of [directHtml, harnessRes.html]) {
    const { window: win, document: doc } = parseHtml(html);
    try {
      const root = doc.querySelector(`main [${DATA_MARKS.theme}="swisstopo"]`);
      assert.equal(root?.getAttribute(DATA_MARKS.trust_tier), null, 'unserved 410 must not claim sealed trust tier');

      const unservedEl = doc.querySelector(`[${DATA_MARKS.part}="unserved"]`);
      assert.ok(unservedEl, 'expected [data-part="unserved"]');
      assert.equal(unservedEl.getAttribute(DATA_MARKS.reason), fx410.unserved.code);
      assert.ok(unservedEl.textContent.includes(fx410.unserved.superseded_by));
      assert.ok(unservedEl.textContent.includes(fx410.unserved.reason_message_id));
      const decisionLink = unservedEl.querySelector(`a[${DATA_MARKS.proof_ref}]`);
      assert.equal(
        decisionLink?.getAttribute(DATA_MARKS.proof_ref),
        fx410.unserved.withdrawn_by_decision_ref
      );
      assert.equal(doc.querySelectorAll(`tr[${DATA_MARKS.line}]`).length, 0, 'unserved state must emit 0 tr[data-line]');
      assert.equal(doc.querySelectorAll(`table[${DATA_MARKS.sheet}="slip"]`).length, 0);
    } finally {
      await win.happyDOM.close();
    }
    assert.deepEqual(await auditA11y(html), [], 'Unserved 410 view must have 0 WCAG 2.1 AA violations');
  }

  // HTTP 410 without an unserved payload must NOT fabricate "publication_withdrawn" (honest http_status_410 only)
  const { html: bare410 } = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', unserved: null, httpStatus: 410 });
  const { window: winB, document: docB } = parseHtml(bare410);
  try {
    const el = docB.querySelector(`[${DATA_MARKS.part}="unserved"]`);
    assert.ok(el);
    assert.equal(el.getAttribute(DATA_MARKS.reason), 'http_status_410', 'bare 410 must report http_status_410, not fabricate publication_withdrawn');
  } finally {
    await winB.happyDOM.close();
  }
});

test('M1: <rezono-slip> Web Component handles W/D/M/S/C/P shortcuts, locks [P] on provisional_engine, and matches Slip.svelte data-* marks on fixtures 01/03/07/09', async () => {
  const fxFlow = loadFixture('01-platform-drift.json');
  const fxKring = loadFixture('03-kring-m1-to-m5-live.json');
  const fx410 = loadFixture('07-unserved-410.json');
  const fxConf = loadFixture('09-slip-conformance.json');

  const { window: win, document: doc } = parseHtml('');
  try {
    const Ctor = defineSlipElement(win);
    assert.ok(Ctor, 'defineSlipElement must register <rezono-slip>');
    assert.equal(defineSlipElement(win), Ctor);

    const el = doc.createElement(SLIP_ELEMENT_TAG);
    doc.querySelector('main').appendChild(el);

    const sealedSeal = new DeltaStore(fxFlow.manifest, []).seal();
    const sealedModel = createSlipModel({
      subjectId: 'e-drift-vault',
      proofRef: 'policy:netpol-04#L42',
      seal: sealedSeal,
      prism5: fxFlow.slip_enrichment.prism_5,
      missingLevers: fxFlow.slip_enrichment.missing_levers,
      adjacentWorlds: fxFlow.slip_enrichment.adjacent_worlds_delta1
    });

    const events = [];
    el.addEventListener('slip:verb-change', (ev) => events.push({ type: 'change', detail: ev.detail }));
    el.addEventListener('slip:verb-blocked', (ev) => events.push({ type: 'blocked', detail: ev.detail }));

    el.state = { theme: 'swisstopo', model: sealedModel, seal: sealedSeal };
    assert.equal(el.getAttribute(DATA_MARKS.theme), 'swisstopo');
    assert.equal(el.querySelectorAll(`[${DATA_MARKS.part}="prism"] tr[${DATA_MARKS.key}]`).length, 5);
    assert.equal(el.querySelectorAll(`button[${DATA_MARKS.verb}][${DATA_MARKS.key}]`).length, 6);

    // Keyboard shortcut 'm' -> opens [M] Certainty Levers
    el.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    assert.ok(el.querySelector(`[${DATA_MARKS.part}="levers"] tr[${DATA_MARKS.key}="lever-edge04"]`));
    assert.equal(events.at(-1)?.detail.verb, 'missing');

    // Keyboard shortcut 's' -> opens [S] Δ=1 Adjacent Worlds and adds supposed sign to legend
    el.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's', bubbles: true }));
    assert.equal(el.querySelectorAll(`[${DATA_MARKS.part}="adjacent-worlds"] tr[${DATA_MARKS.key}]`).length, 3);
    assertLegendCoversAllDrawnSigns(el);
    assertAllTablesHaveHeaders(el);
    assert.deepEqual(await auditA11y(el.innerHTML), [], '<rezono-slip> [S] markup must have 0 WCAG 2.1 AA violations');

    // Keyboard shortcuts 'w', 'd', 'c', 'p' on sealed store
    for (const [k, expectedVerb] of [['w', 'why'], ['d', 'depends'], ['c', 'compare'], ['p', 'propose']]) {
      el.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
      assert.equal(events.at(-1)?.type, 'change');
      assert.equal(events.at(-1)?.detail.verb, expectedVerb);
    }

    // Switch to provisional_engine stream -> 'p' shortcut MUST be blocked
    const liveStore = new DeltaStore(fxKring.manifest, fxKring.sealed_rows);
    liveStore.applyProvisionalStep('provisional_engine', fxKring.live_provisional_delta.changes);
    const liveSeal = liveStore.seal();
    const liveModel = createSlipModel({
      subjectId: 'step:worker-07',
      proofRef: 'stream:m5-draft-142ms',
      seal: liveSeal,
      activeVerb: 'w',
      prism5: fxFlow.slip_enrichment.prism_5,
      missingLevers: fxFlow.slip_enrichment.missing_levers,
      adjacentWorlds: fxFlow.slip_enrichment.adjacent_worlds_delta1
    });
    el.state = { theme: 'forced', model: liveModel, seal: liveSeal };
    assert.equal(el.getAttribute(DATA_MARKS.theme), 'forced');

    el.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    assert.equal(events.at(-1)?.type, 'blocked');
    assert.equal(events.at(-1)?.detail.reason, 'propose_locked_unsealed_live_stream');
    assert.equal(el.state.activeVerb, undefined);
    assert.equal(el.querySelector(`button[${DATA_MARKS.verb}="propose"]`)?.disabled, true);

    // Switch to HTTP 410 unserved state
    el.state = { theme: 'swisstopo', unserved: fx410.unserved, httpStatus: fx410.http_status };
    assert.ok(el.querySelector(`[${DATA_MARKS.part}="unserved"]`));
    assert.equal(el.querySelectorAll(`tr[${DATA_MARKS.line}]`).length, 0);
  } finally {
    await win.happyDOM.close();
  }

  // Exact data-* mark parity between Slip.svelte and renderSlipElementHtml on fixtures 01, 03, 07, and 09
  const sealedSeal01 = new DeltaStore(fxFlow.manifest, []).seal();
  const sealedModel01 = createSlipModel({
    subjectId: 'e-drift-vault',
    proofRef: 'policy:netpol-04#L42',
    seal: sealedSeal01,
    activeVerb: 's',
    prism5: fxFlow.slip_enrichment.prism_5,
    missingLevers: fxFlow.slip_enrichment.missing_levers,
    adjacentWorlds: fxFlow.slip_enrichment.adjacent_worlds_delta1
  });
  const svelte01 = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', model: sealedModel01, seal: sealedSeal01, activeVerb: 's' });
  const elem01 = renderSlipElementHtml({ theme: 'swisstopo', model: sealedModel01, seal: sealedSeal01, activeVerb: 's' });
  assert.deepEqual(extractCanonicalMarks(elem01), extractCanonicalMarks(svelte01.html), 'fixture 01 [S] data-* parity');

  const svelte410 = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', unserved: fx410.unserved, httpStatus: 410 });
  const elem410 = renderSlipElementHtml({ theme: 'swisstopo', unserved: fx410.unserved, httpStatus: 410 });
  assert.deepEqual(extractCanonicalMarks(elem410), extractCanonicalMarks(svelte410.html), 'fixture 07 410 data-* parity');

  const seal09 = new DeltaStore(fxConf.manifest, []).seal();
  const ruleRow09 = {
    ...fxConf.slip_conformance.rows['flagged::item-a::12'],
    sentence_template: fxConf.slip_conformance.messages.en['rule.flagged']
  };
  const svelte09Rule = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', seal: seal09, conformanceRow: ruleRow09 });
  const elem09Rule = renderSlipElementHtml({ theme: 'swisstopo', seal: seal09, conformanceRow: ruleRow09 });
  assert.deepEqual(extractCanonicalMarks(elem09Rule), extractCanonicalMarks(svelte09Rule.html), 'fixture 09 rule row data-* parity');

  const calcRow09 = {
    ...fxConf.slip_conformance.rows['calc__capped_amount::item-c'],
    sentence_template: fxConf.slip_conformance.messages.en['calc.capped_amount']
  };
  const svelte09Calc = await renderSvelte(SLIP_SVELTE, { theme: 'swisstopo', seal: seal09, conformanceRow: calcRow09 });
  const elem09Calc = renderSlipElementHtml({ theme: 'swisstopo', seal: seal09, conformanceRow: calcRow09 });
  assert.deepEqual(extractCanonicalMarks(elem09Calc), extractCanonicalMarks(svelte09Calc.html), 'fixture 09 unknown calc row data-* parity');
});

test('M1: packages/slip/bin/render.ts enforces asOpaqueCell guards (no invented reasons/witnesses), rejects unknown signs, avoids index-guessing links, and passes opaque mutation', async () => {
  const req = {
    fixture: 'fixtures/09-slip-conformance.json',
    role: 'reader',
    pack: 'slip',
    lang: 'en'
  };
  const first = await renderSlipHarness(req);
  const second = await renderSlipHarness(req);
  assert.equal(first.html, second.html, 'deterministic render must emit identical HTML bytes');
  assert.deepEqual(first.files, second.files, 'deterministic render must emit identical files SHA-256 map');
  assert.ok(Object.keys(first.files).length >= 5, 'files map must hash @rezono/slip assets');

  const { window: win, document: doc } = parseHtml(first.html);
  try {
    const sentenceLinks = [...doc.querySelectorAll(`[${DATA_MARKS.part}="sentence"] a[${DATA_MARKS.line}]`)];
    assert.equal(sentenceLinks.length, 2, 'home claim sentence must bind {$i} and {$a} via explicit premise_position');
    assert.deepEqual(sentenceLinks.map((a) => a.getAttribute(DATA_MARKS.line)), ['2', '2']);

    const lines = [...doc.querySelectorAll(`table[${DATA_MARKS.sheet}="slip"] tr[${DATA_MARKS.line}]`)];
    assert.equal(lines.length, 2);
    assert.equal(lines[0].getAttribute(DATA_MARKS.relation), 'held');
    assert.equal(lines[0].getAttribute(DATA_MARKS.polarity), 'negative');
    assert.equal(
      lines[0].querySelector(`td[${DATA_MARKS.part}="value"]`)?.getAttribute(DATA_MARKS.completeness_ref),
      'sweep:complete-held'
    );
    assert.equal(lines[1].getAttribute(DATA_MARKS.relation), 'item__amount');
    assert.equal(lines[1].getAttribute(DATA_MARKS.polarity), 'positive');

    assertAllTablesHaveHeaders(doc);
    assertLegendCoversAllDrawnSigns(doc);
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(first.html), [], '09-slip-conformance home claim must have 0 WCAG 2.1 AA violations');

  // Row whose grounds omit premise_position must NOT guess links by array index, while aggregate links to part=total
  const groupRes = await renderSlipHarness({
    fixture: 'fixtures/09-slip-conformance.json',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: 'group_size::group-a::2'
  });
  const { window: winG, document: docG } = parseHtml(groupRes.html);
  try {
    const links = [...docG.querySelectorAll(`[${DATA_MARKS.part}="sentence"] a[${DATA_MARKS.line}]`)];
    assert.deepEqual(
      links.map((a) => ({ line: a.getAttribute(DATA_MARKS.line), text: a.textContent })),
      [{ line: '2', text: '2' }],
      'only aggregate/explicit premise_position bindings should emit a[data-line] links'
    );
  } finally {
    await winG.happyDOM.close();
  }

  // Verify unknown calc row contains zero ASCII digits in td[data-part="value"][data-state="unknown"]
  const calcUnknown = await renderSlipHarness({
    fixture: 'fixtures/09-slip-conformance.json',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    row: 'calc__capped_amount::item-c'
  });
  const { window: winU, document: docU } = parseHtml(calcUnknown.html);
  try {
    const unknownCells = [...docU.querySelectorAll(`td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="unknown"]`)];
    assert.ok(unknownCells.length >= 2, 'expected unknown value cells in calc__capped_amount::item-c');
    for (const cell of unknownCells) {
      assert.equal(cell.getAttribute(DATA_MARKS.reason), 'fact recorded_amount.amount is missing');
      assert.ok(cell.querySelector(`[${DATA_MARKS.sign}="unknown"]`), 'unknown cell requires [data-sign="unknown"]');
      assert.equal(/[0-9]/.test(cell.textContent), false, `unknown cell must contain 0 ASCII digits, got "${cell.textContent}"`);
    }
    assertLegendCoversAllDrawnSigns(docU);
  } finally {
    await winU.happyDOM.close();
  }

  // Counterexample 1 (P1): unknown cell with reason deleted MUST throw (never fabricate "unspecified")
  const fxMissingReason = loadFixture('09-slip-conformance.json');
  delete fxMissingReason.slip_conformance.rows['calc__capped_amount::item-c'].result_cell.reason;
  await assert.rejects(
    () =>
      renderSlipHarness({
        store: fxMissingReason,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        row: 'calc__capped_amount::item-c'
      }),
    /explicit reason/
  );

  // Counterexample 2 (P1): absent cell without completeness_witness_ref MUST throw
  const fxMissingWitness = loadFixture('09-slip-conformance.json');
  delete fxMissingWitness.slip_conformance.rows['flagged::item-a::12'].grounds_distance_1[0].cell.completeness_witness_ref;
  await assert.rejects(
    () =>
      renderSlipHarness({
        store: fxMissingWitness,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        row: 'flagged::item-a::12'
      }),
    /completeness_witness_ref/
  );

  // Counterexample 3 (P1): known cell without display MUST throw
  const fxMissingDisplay = loadFixture('09-slip-conformance.json');
  delete fxMissingDisplay.slip_conformance.rows['flagged::item-a::12'].grounds_distance_1[1].cell.display;
  await assert.rejects(
    () =>
      renderSlipHarness({
        store: fxMissingDisplay,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        row: 'flagged::item-a::12'
      }),
    /display/
  );

  // Counterexample 4 (P2): unknown sign name MUST throw instead of falling back to derived
  const fxBadSign = loadFixture('09-slip-conformance.json');
  fxBadSign.slip_conformance.rows['flagged::item-a::12'].grounds_distance_1[1].sign = 'nonexistent_sign';
  await assert.rejects(
    () =>
      renderSlipHarness({
        store: fxBadSign,
        role: 'reader',
        pack: 'slip',
        lang: 'en',
        row: 'flagged::item-a::12'
      }),
    /Unknown std-view sign/
  );
  assert.throws(
    () =>
      renderSlipElementHtml({
        theme: 'swisstopo',
        conformanceRow: fxBadSign.slip_conformance.rows['flagged::item-a::12']
      }),
    /Unknown std-view sign/
  );

  // Opaque-token mutation test on Slip.svelte: mutated strings pass through verbatim with zero NaN
  const fx = loadFixture('01-platform-drift.json');
  const seal = new DeltaStore(fx.manifest, []).seal();
  const mutatedPrism = fx.slip_enrichment.prism_5.map((p, idx) => ({
    ...p,
    ratio_display: `OPAQUE_RATIO_${idx}`
  }));
  const mutatedWorlds = fx.slip_enrichment.adjacent_worlds_delta1.map((w, idx) => ({
    ...w,
    outcome_display: `OPAQUE_OUTCOME_${idx}`
  }));
  const mutatedModel = createSlipModel({
    subjectId: 'opaque-subject',
    proofRef: 'proof:opaque',
    seal,
    activeVerb: 's',
    prism5: mutatedPrism,
    missingLevers: fx.slip_enrichment.missing_levers,
    adjacentWorlds: mutatedWorlds
  });
  const { html: mutatedHtml } = await renderSvelte(SLIP_SVELTE, {
    theme: 'swisstopo',
    model: mutatedModel,
    seal,
    activeVerb: 's'
  });
  assert.equal(mutatedHtml.includes('NaN'), false, 'mutated opaque tokens must never produce NaN');
  for (const p of mutatedPrism) {
    assert.ok(mutatedHtml.includes(p.ratio_display), `expected opaque token ${p.ratio_display} verbatim`);
  }
  for (const w of mutatedWorlds) {
    assert.ok(mutatedHtml.includes(w.outcome_display), `expected opaque token ${w.outcome_display} verbatim`);
  }
});
