import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Green on arrival (Decision 0012 §2): written red against 8b3c96d, where it failed for the reason below;
// the M4 work of #30 to #33 made it pass. It stays as an independent check of that fix.

// Decision 0012 §2 (6g), issue #23 §1: Monge draws stated solid and observed dashed, the reverse of sheet 02.
// The convention is sheet 02's: what is stated (declared intent) is dashed with the drift dash of Rezono's
// packs/std-view/key.yaml ("6 3"); what is observed is solid. Each track carries its own side reference, so a reader
// can tell the two apart without colour.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);
const DASH = '6 3';
const LINES = 'path, line, polyline';

const SHEETS = [
  { name: 'flow-split 01', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('01-platform-drift.json') }) },
  { name: 'monge-fold 08 at 0°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 0 }) },
  { name: 'monge-fold 08 at 90°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 90 }) }
];

const dash = (el) => (el.getAttribute('stroke-dasharray') ?? '').trim().replace(/[\s,]+/g, ' ');

for (const sheet of SHEETS) {
  test(`M1 [stated-observed-one-convention]: ${sheet.name} draws stated dashed (${DASH}) and observed solid`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const { window, document } = parseHtml(html);
    try {
      const drifts = document.querySelectorAll(`svg [${M.sign}="drift"][${M.stated_proof_ref}][${M.observed_proof_ref}]`);
      assert.ok(drifts.length > 0, `${sheet.name}: the fixture holds a drift`);
      for (const drift of drifts) {
        const statedRef = drift.getAttribute(M.stated_proof_ref);
        const observedRef = drift.getAttribute(M.observed_proof_ref);
        const stated = [...drift.querySelectorAll(LINES)].filter((l) => l.getAttribute(M.stated_proof_ref) === statedRef);
        const observed = [...drift.querySelectorAll(LINES)].filter((l) => l.getAttribute(M.observed_proof_ref) === observedRef);
        assert.equal(stated.length, 1, `${sheet.name}: one stated track carrying data-stated-proof-ref="${statedRef}"`);
        assert.equal(observed.length, 1, `${sheet.name}: one observed track carrying data-observed-proof-ref="${observedRef}"`);
        assert.equal(dash(stated[0]), DASH, `${sheet.name}: the stated track is dashed ${DASH}`);
        assert.equal(dash(observed[0]), '', `${sheet.name}: the observed track is solid`);
      }
    } finally {
      await window.happyDOM.close();
    }
  });
}
