import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { buildBitemporalModel } from '../../packages/atlas/src/bitemporal-model.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Green on arrival (Decision 0012 §2): written red against 8b3c96d, where it failed for the reason below;
// the M4 work of #30 to #33 made it pass. It stays as an independent check of that fix.

// Decision 0012 §2 (6b), issue #23 §1: sheet 05 draws unknown at z = 1, taller than every known value.
// Unknown says nothing about a magnitude, so no unknown mark may carry one. The xD rule "never at z = 0" is met by a
// hatched band of one fixed shape, the same for every unknown mark, never by a height taken from a value.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);

const SHEETS = [
  { name: 'flow-split 01', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('01-platform-drift.json') }) },
  { name: 'kringstand 03', file: 'KringstandSheet.svelte', props: () => ({ fixture: fx('03-kring-m1-to-m5-live.json') }) },
  { name: 'relief-3d 04 (2d)', file: 'Relief3DSheet.svelte', props: () => ({ fixture: fx('04-subsidy-a001-a003.json') }) },
  {
    name: 'relief-3d 04 (orthographic)',
    file: 'Relief3DSheet.svelte',
    props: () => ({ fixture: fx('04-subsidy-a001-a003.json'), projection: 'orthographic' })
  },
  { name: 'bitemporal-stair 05 (2d)', file: 'BitemporalStairSheet.svelte', props: () => ({ fixture: fx('05-subsidy-bitemporal.json') }) },
  {
    name: 'bitemporal-stair 05 (orthographic)',
    file: 'BitemporalStairSheet.svelte',
    props: () => ({ fixture: fx('05-subsidy-bitemporal.json'), view: 'orthographic' })
  },
  { name: 'monge-fold 08 at 90°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 90 }) }
];

// Size channels: a CSS custom property carrying a height, a scale transform, or a data-z attribute.
function sizeChannel(el) {
  const style = el.getAttribute('style') ?? '';
  if (/--z\s*:/.test(style)) return `style="${style}"`;
  if (/scale[XYZ3d]*\s*\(/i.test(style)) return `style="${style}"`;
  if (/scale[XYZ]?\s*\(/i.test(el.getAttribute('transform') ?? '')) return `transform="${el.getAttribute('transform')}"`;
  if (el.hasAttribute('data-z')) return `data-z="${el.getAttribute('data-z')}"`;
  return null;
}

for (const sheet of SHEETS) {
  test(`M1 [unknown-has-no-magnitude]: ${sheet.name} gives no unknown mark a height or size`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const { window, document } = parseHtml(html);
    try {
      const unknown = [...document.querySelectorAll(`[${M.state}="unknown"], [${M.sign}="unknown"]`)].filter(
        (el) => !el.closest(`table[${M.part}="legend"]`)
      );
      assert.ok(unknown.length > 0, `${sheet.name}: the fixture holds unknown values, so unknown marks are drawn`);
      const offenders = [];
      for (const mark of unknown) {
        for (const el of [mark, ...mark.querySelectorAll('*')]) {
          const channel = sizeChannel(el);
          if (channel) offenders.push(`<${el.tagName.toLowerCase()}> in unknown mark ${mark.getAttribute(M.proof_ref) ?? ''}: ${channel}`);
        }
      }
      assert.deepEqual(offenders, [], `${sheet.name}: unknown marks carry a size`);
    } finally {
      await window.happyDOM.close();
    }
  });
}

test('M1 [unknown-has-no-magnitude]: the bitemporal model gives no unknown cell a z token', () => {
  const model = buildBitemporalModel(fx('05-subsidy-bitemporal.json'));
  const unknown = model.cells.filter((c) => c.state === 'unknown');
  assert.ok(unknown.length > 0, 'fixture 05 holds unknown cells');
  assert.deepEqual(
    unknown.filter((c) => c.zToken !== null).map((c) => `${c.id} z=${c.zToken}`),
    [],
    'an unknown cell has no height: zToken must be null (draw it as a hatched band of one fixed shape)'
  );
});
