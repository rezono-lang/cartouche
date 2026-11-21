import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const SIGN_MARK = path.join(process.cwd(), 'packages', 'slip', 'src', 'SignMark.svelte');

test('Svelte 5 + Happy-DOM + axe-core smoke: SignMark.svelte emits canonical data-* marks with 0 WCAG 2.1 AA violations', async () => {
  const { html } = await renderSvelte(SIGN_MARK, {
    sign: 'unknown',
    proofRef: 'witness:sub-A003-missing',
    label: 'unknown · income_statement_not_received',
    state: 'unknown',
    reason: 'income_statement_not_received'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    const el = doc.querySelector(`[${DATA_MARKS.sign}="unknown"]`);
    assert.ok(el, 'expected element with canonical data-sign="unknown"');
    assert.equal(el.getAttribute(DATA_MARKS.proof_ref), 'witness:sub-A003-missing');
    assert.equal(el.getAttribute(DATA_MARKS.state), 'unknown');
    assert.equal(el.getAttribute(DATA_MARKS.reason), 'income_statement_not_received');
    assert.ok(el.textContent.includes('▨'), 'expected std-view non-color unknown glyph ▨');
    assert.equal(/[0-9]/.test(el.textContent), false, 'unknown mark must contain zero ASCII digits');
  } finally {
    await win.happyDOM.close();
  }

  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], `WCAG 2.1 AA violations: ${JSON.stringify(violations, null, 2)}`);
});
