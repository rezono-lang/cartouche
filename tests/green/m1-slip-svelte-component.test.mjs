import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, DeltaStore, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import { createSlipModel } from '../../packages/slip/src/slip-controller.ts';
import { SLIP_ELEMENT_TAG, defineSlipElement } from '../../packages/slip/src/slip-element.ts';
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

test('M1: Slip.svelte emits canonical data-* marks, 5-bar micro-prism, [M] levers, [S] Δ=1 worlds, seal, legend & 0 WCAG 2.1 AA violations', async () => {
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

  // Render on [M] Missing to verify 5-bar prism, verbs, seal, and certainty levers
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

    // Seal checks & manifest hash
    const sealEl = docM.querySelector(`[${DATA_MARKS.part}="seal"]`);
    assert.ok(sealEl, 'expected [data-part="seal"]');
    assert.equal(
      sealEl.querySelector(`[${DATA_MARKS.part}="manifest-hash"]`)?.textContent,
      fx.manifest.id
    );
    assert.equal(
      sealEl.querySelector(`[${DATA_MARKS.check}="reader-hashes"]`)?.getAttribute(DATA_MARKS.status),
      'green'
    );
    assert.equal(
      sealEl.querySelector(`[${DATA_MARKS.check}="publisher-record"]`)?.getAttribute(DATA_MARKS.status),
      'green'
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

  // Render on [S] Suppose to verify Δ=1 adjacent worlds
  const { html: htmlSuppose } = await renderSvelte(SLIP_SVELTE, {
    theme: 'obsidian',
    model: baseModel,
    seal,
    activeVerb: 's'
  });

  const { window: winS, document: docS } = parseHtml(htmlSuppose, { theme: 'obsidian' });
  try {
    assert.ok(docS.querySelector(`[${DATA_MARKS.theme}="obsidian"]`));
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

test('M1: Slip.svelte physically disables [P] Propose when trust tier is provisional_engine', async () => {
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
});

test('M1: Slip.svelte and bin/render.ts render HTTP 410 unserved state with [data-part="unserved"] and zero tr[data-line]', async () => {
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
});

test('M1: <rezono-slip> Web Component handles W/D/M/S/C/P shortcuts, locks [P] on provisional_engine, and renders 410 unserved', async () => {
  const fxFlow = loadFixture('01-platform-drift.json');
  const fxKring = loadFixture('03-kring-m1-to-m5-live.json');
  const fx410 = loadFixture('07-unserved-410.json');

  const { window: win, document: doc } = parseHtml('');
  try {
    const Ctor = defineSlipElement(win);
    assert.ok(Ctor, 'defineSlipElement must register <rezono-slip>');
    // Idempotent second registration returns same constructor
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
    const customElHtml = el.innerHTML;
    assert.deepEqual(await auditA11y(customElHtml), [], '<rezono-slip> [S] markup must have 0 WCAG 2.1 AA violations');

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
});

test('M1: packages/slip/bin/render.ts is deterministic on fixtures/09-slip-conformance.json and passes opaque-token mutation', async () => {
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
    assert.equal(sentenceLinks.length, 2, 'home claim sentence must bind {$i} and {$a} to a[data-line]');
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
      assert.ok(cell.getAttribute(DATA_MARKS.reason), 'unknown cell requires data-reason');
      assert.ok(cell.querySelector(`[${DATA_MARKS.sign}="unknown"]`), 'unknown cell requires [data-sign="unknown"]');
      assert.equal(/[0-9]/.test(cell.textContent), false, `unknown cell must contain 0 ASCII digits, got "${cell.textContent}"`);
    }
    assertLegendCoversAllDrawnSigns(docU);
  } finally {
    await winU.happyDOM.close();
  }

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
