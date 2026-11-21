import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';
import { loadJson } from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();
const SIGN_MARK = path.join(ROOT, 'packages', 'slip', 'src', 'SignMark.svelte');
const VALUE_CELL = path.join(ROOT, 'packages', 'slip', 'src', 'SlipValueCell.svelte');
const UNSERVED = path.join(ROOT, 'packages', 'slip', 'src', 'SlipUnserved.svelte');
const M = DATA_MARKS;

test('M2 honesty: SignMark.svelte renders known std-view signs and throws on unknown or prototype signs', async () => {
  const { html } = await renderSvelte(SIGN_MARK, {
    sign: 'unknown',
    proofRef: 'proof:sign-1',
    state: 'unknown',
    reason: 'missing_document'
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const el = doc.querySelector(`[${M.sign}="unknown"]`);
    assert.ok(el);
    assert.equal(el.getAttribute(M.proof_ref), 'proof:sign-1');
    assert.ok(el.textContent.includes(SIGNS.unknown.glyph));
  } finally {
    await win.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(html), []);

  // Must throw on unknown sign instead of silently falling back to derived
  await assert.rejects(
    () => renderSvelte(SIGN_MARK, { sign: 'bogus_sign', proofRef: 'proof:bad-1' }),
    /Unknown std-view sign/
  );
  await assert.rejects(
    () => renderSvelte(SIGN_MARK, { sign: 'toString', proofRef: 'proof:bad-2' }),
    /Unknown std-view sign/
  );
});

test('M2 honesty: SlipValueCell.svelte enforces published data-reason on not_applicable/unknown/invalid and emits it on absent when published', async () => {
  const fx05 = loadJson(ROOT, 'fixtures/05-subsidy-bitemporal.json');
  const naCell = fx05.bitemporal_grid.matrix[0][1];
  assert.equal(naCell.state, 'not_applicable');

  // 1. not_applicable with published reason emits data-reason
  const { html: naHtml } = await renderSvelte(VALUE_CELL, { cell: naCell });
  const { window: winNa, document: docNa } = parseHtml(`<table><tbody><tr>${naHtml}</tr></tbody></table>`);
  try {
    const td = docNa.querySelector(`td[${M.part}="value"][${M.state}="not_applicable"]`);
    assert.ok(td);
    assert.equal(td.getAttribute(M.reason), 'valid_after_knowledge');
    assert.equal(td.getAttribute(M.proof_ref), naCell.proof_ref);
    assert.ok(td.querySelector(`[${M.sign}="not_applicable"]`));
  } finally {
    await winNa.happyDOM.close();
  }

  // 2. not_applicable missing reason (or whitespace-only) MUST throw
  const naMissing = { ...naCell };
  delete naMissing.reason;
  await assert.rejects(() => renderSvelte(VALUE_CELL, { cell: naMissing }), /without published reason/);
  await assert.rejects(
    () => renderSvelte(VALUE_CELL, { cell: { ...naCell, reason: '   ' } }),
    /without published reason/
  );

  // 3. absent with published reason emits BOTH data-completeness-ref and data-reason
  const fx09 = loadJson(ROOT, 'fixtures/09-slip-conformance.json');
  const absentBase = fx09.slip_conformance.rows['flagged::item-a::12'].grounds_distance_1[0].cell;
  const absentWithReason = { ...absentBase, reason: 'no_matching_hold_record' };
  const { html: absReasonHtml } = await renderSvelte(VALUE_CELL, { cell: absentWithReason });
  const { window: winAbs1, document: docAbs1 } = parseHtml(`<table><tbody><tr>${absReasonHtml}</tr></tbody></table>`);
  try {
    const td = docAbs1.querySelector(`td[${M.part}="value"][${M.state}="absent"]`);
    assert.ok(td);
    assert.equal(td.getAttribute(M.completeness_ref), 'sweep:complete-held');
    assert.equal(td.getAttribute(M.reason), 'no_matching_hold_record');
  } finally {
    await winAbs1.happyDOM.close();
  }

  // 4. absent from frozen fixture 09 (no reason field, completeness_witness_ref present) omits data-reason honestly
  const { html: absPlainHtml } = await renderSvelte(VALUE_CELL, { cell: absentBase });
  const { window: winAbs2, document: docAbs2 } = parseHtml(`<table><tbody><tr>${absPlainHtml}</tr></tbody></table>`);
  try {
    const td = docAbs2.querySelector(`td[${M.part}="value"][${M.state}="absent"]`);
    assert.ok(td);
    assert.equal(td.getAttribute(M.completeness_ref), 'sweep:complete-held');
    assert.equal(td.hasAttribute(M.reason), false);
  } finally {
    await winAbs2.happyDOM.close();
  }

  // 5. invalid without published reason throws
  await assert.rejects(
    () => renderSvelte(VALUE_CELL, { cell: { state: 'invalid', display: null, proof_ref: 'p:inv' } }),
    /without published reason/
  );
});

test('M2 honesty: SlipUnserved.svelte rejects null unserved+httpStatus instead of emitting http_status_null', async () => {
  await assert.rejects(
    () => renderSvelte(UNSERVED, { unserved: null, httpStatus: null }),
    /requires either a published refusal payload or an HTTP status/
  );
  await assert.rejects(
    () => renderSvelte(UNSERVED, { unserved: { code: '   ' }, httpStatus: 410 }),
    /non-empty published code/
  );

  const { html } = await renderSvelte(UNSERVED, { unserved: null, httpStatus: 410 });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const el = doc.querySelector(`[${M.part}="unserved"]`);
    assert.ok(el);
    assert.equal(el.getAttribute(M.reason), 'http_status_410');
  } finally {
    await win.happyDOM.close();
  }
});
