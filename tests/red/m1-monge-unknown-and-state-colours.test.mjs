import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { buildMongeFoldingModel } from '../../packages/atlas/src/monge-model.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0014-quality-round-3.md',
  priority: 2,
  summary: '#46 point 10: on the Monge sheet an unknown curtain spans the whole round axis (no height of its own), and changed and not_applicable round dots never take the valid colour',
  waits_on: []
};

// Decision 0014 §4 and §7, issue #46 point 10. The Monge sheet is parked (Decision 0012 §5), but a parked sheet may not
// lie. Its z axis is the round axis: round i of n stands at (i + 1) / (n + 1) of the wall depth. The unknown curtain
// rises to the fixed CURTAIN_HEIGHT (1.2 of a wall depth of 1.65), so with the four rounds of fixture 08 it covers
// m-1 to m-3 (0.33, 0.66, 0.99) and stops below m-4 (1.32): it reads as a statement about rounds. A vertical curtain
// (Decision 0002 §2) with no height of its own (Decision 0012 6b) spans the whole axis, floor to wall top.
// MongeFoldingSheet.svelte paints every state it does not name (changed, not_applicable) in var(--c-valid).

const ROOT = process.cwd();
const M = DATA_MARKS;
const loadFx08 = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '08-monge-4d-audit.json'), 'utf8'));

test('M1 [monge-unknown-and-state-colours]: the unknown curtain is as tall as the round axis', () => {
  // At a fold of 90 degrees plane 2 stands upright, so z maps to the same screen offset on the curtain and on the wall.
  // Hand-checked on fixture 08 at 8a72c0f: one unit of z is 46.744 px; the wall (hinge to top) is -77.128 px (1.65),
  // the curtain top stands -56.093 px above its foot (1.2).
  const model = buildMongeFoldingModel(loadFx08(), 90);
  const unknown = model.services.filter((s) => s.state === 'unknown');
  assert.deepEqual(unknown.map((s) => s.id), ['ed'], 'fixture 08 has one unknown service');
  for (const s of unknown) {
    assert.ok(s.unknownCurtain, `${s.id}: an unknown service has a curtain (Decision 0002 §2)`);
    const [, , t1, t0] = s.unknownCurtain;
    const [foot, hinge2, top2] = s.rayToPlane2;
    const curtainRise = (t0.y + t1.y) / 2 - foot.y;
    const axisRise = top2.y - hinge2.y;
    assert.ok(
      Math.abs(curtainRise - axisRise) < 1e-6,
      `${s.id}: the curtain rises ${curtainRise.toFixed(3)} px, the round axis ${axisRise.toFixed(3)} px: ` +
        'the curtain stops at CURTAIN_HEIGHT between rounds m-3 and m-4 (#46 point 10)'
    );
  }
});

test('M1 [monge-unknown-and-state-colours]: changed and not_applicable round dots do not take the valid colour', async () => {
  const fx = loadFx08();
  fx.services[0].round_states = ['changed', 'not_applicable', 'valid', 'valid'];
  const { html } = await renderSvelte(path.join(ROOT, 'packages', 'atlas', 'src', 'MongeFoldingSheet.svelte'), {
    fixture: fx,
    foldAngleDeg: 90
  });
  const { window: win, document: doc } = parseHtml(html);
  try {
    const dots = (state) =>
      [...doc.querySelectorAll(`circle[${M.state}="${state}"]`)].map((c) => ({ fill: c.getAttribute('fill'), stroke: c.getAttribute('stroke') }));
    const changed = dots('changed');
    const na = dots('not_applicable');
    assert.equal(changed.length, 2, 'one changed round, drawn on plane 2 and plane 3');
    assert.equal(na.length, 2, 'one not_applicable round, drawn on plane 2 and plane 3');
    // SIGNS.changed: half-fill in the caution token; SIGNS.not_applicable: hollow-void in the inkFaint token (AGENTS rule 5).
    for (const d of changed) {
      assert.notEqual(d.fill, 'var(--c-valid)', 'a changed round dot is painted in the valid colour (#46 point 10)');
      assert.ok([d.fill, d.stroke].some((p) => (p ?? '').includes('var(--c-caution)')), `a changed dot uses its sign token: ${JSON.stringify(d)}`);
    }
    for (const d of na) {
      assert.notEqual(d.fill, 'var(--c-valid)', 'a not_applicable round dot is painted in the valid colour (#46 point 10)');
      assert.equal(d.fill, 'none', 'a not_applicable dot stays hollow');
      assert.equal(d.stroke, 'var(--c-ink-faint)', 'a not_applicable dot is drawn in its sign token');
    }
  } finally {
    await win.happyDOM.close();
  }
});
