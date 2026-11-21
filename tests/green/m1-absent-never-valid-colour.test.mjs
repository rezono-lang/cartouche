import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §2 (6a), issue #23 §1: Monge must never paint an absent mark (or any descendant of one)
// with the valid green colour. Absent is verified non-existence; painting it valid says the opposite.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);
const TOKENS = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'std-view.v2.tokens.json'), 'utf8'));
const VALID_VAR = TOKENS.css_vars.valid;
const VALID_VALUES = Object.values(TOKENS.palettes).map((p) => p.tokens.valid.toLowerCase());
const PAINT_ATTRS = ['fill', 'stroke', 'color', 'stop-color', 'style'];

const SHEETS = [
  { name: 'flow-split 01', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('01-platform-drift.json') }) },
  { name: 'kringstand 03', file: 'KringstandSheet.svelte', props: () => ({ fixture: fx('03-kring-m1-to-m5-live.json') }) },
  { name: 'monge-fold 08 at 0°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 0 }) },
  { name: 'monge-fold 08 at 90°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 90 }) }
];

function validPaint(el) {
  for (const attr of PAINT_ATTRS) {
    const value = (el.getAttribute(attr) ?? '').toLowerCase();
    if (value.includes(VALID_VAR) || VALID_VALUES.some((token) => value.includes(token))) return `${attr}="${value}"`;
  }
  return null;
}

for (const sheet of SHEETS) {
  test(`M1 [absent-never-valid-colour]: ${sheet.name} paints no absent mark with the valid colour`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const { window, document } = parseHtml(html);
    try {
      const absent = [...document.querySelectorAll(`[${M.state}="absent"], [${M.sign}="absent"]`)].filter(
        (el) => !el.closest(`table[${M.part}="legend"]`)
      );
      assert.ok(absent.length > 0, `${sheet.name}: the fixture holds absent rows, so absent marks are drawn`);
      const offenders = [];
      for (const mark of absent) {
        for (const el of [mark, ...mark.querySelectorAll('*')]) {
          const paint = validPaint(el);
          if (paint) offenders.push(`<${el.tagName.toLowerCase()} ${M.proof_ref}="${mark.getAttribute(M.proof_ref) ?? ''}"> ${paint}`);
        }
      }
      assert.deepEqual(offenders, [], `${sheet.name}: absent marks painted with the valid colour (${VALID_VAR})`);
    } finally {
      await window.happyDOM.close();
    }
  });
}
