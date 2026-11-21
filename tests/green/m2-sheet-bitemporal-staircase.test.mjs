import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { buildBitemporalFixtureFromGateAnswers } from '../../packages/atlas/src/bitemporal-gate.ts';
import { buildBitemporalModel } from '../../packages/atlas/src/bitemporal-model.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'BitemporalStairSheet.svelte');
const gateRecording = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'fixtures', '11-zorgtoeslag-bitemporal-gate-answers.json'), 'utf8')
);
const fixture = buildBitemporalFixtureFromGateAnswers(gateRecording, {
  pack: 'zorgtoeslag-slice',
  role: 'checker',
  subjectId: 'ann',
  validTime: '2026-02-01'
});
const M = DATA_MARKS;
const GRID = fixture.bitemporal_grid;
const RAW = GRID.matrix.flat();
const MATRIX = `table[${M.sheet}="bitemporal-stair"]`;
const SVG = `svg[${M.sheet}="bitemporal-stair"][${M.projection}="orthographic"]`;
const TWIN = `table[${M.part}="twin"]`;
const LEGEND = `table[${M.part}="legend"]`;

async function mount(fx, props = {}) {
  const { html } = await renderSvelte(SHEET, { fixture: fx, ...props });
  return { html, ...parseHtml(html) };
}
async function withDoc(fx, props, fn) {
  const m = await mount(fx, props);
  try {
    await fn(m.document);
  } finally {
    await m.window.happyDOM.close();
  }
  return m.html;
}

function checkLegendAndTables(doc) {
  const listed = new Set([...doc.querySelectorAll(`${LEGEND} tr[${M.sign}]`)].map((n) => n.getAttribute(M.sign)));
  const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((n) => !n.closest(LEGEND));
  assert.ok(drawn.length > 0);
  for (const el of drawn) assert.ok(listed.has(el.getAttribute(M.sign)), `${el.getAttribute(M.sign)} missing from legend`);
  for (const t of doc.querySelectorAll('table')) assert.ok(t.querySelector('th'));
}

test('M2: bitemporal model from recorded gate output is headless, orthographic, collision-free and never puts unknown at z=0', () => {
  const model = buildBitemporalModel(fixture);
  assert.equal(model.scene.projection, 'orthographic');
  assert.equal(model.cells.length, GRID.epochs.length * GRID.valid_times.length);
  const spots = new Set(model.cells.map((c) => `${c.screenX},${c.screenY}`));
  assert.equal(spots.size, model.cells.length, 'every cell needs a unique screen position');
  assert.equal(new Set(model.paintOrder).size, model.cells.length);
  for (const c of model.cells) {
    const raw = GRID.matrix[c.row][c.col];
    assert.equal(c.proofRef, raw.proof_ref);
    if (raw.state === 'unknown') {
      assert.equal(c.zToken, null, 'Decision 0011 §1: unknown must not encode a height/magnitude');
      assert.equal(c.display, null);
    }
    if (raw.state === 'known') {
      assert.equal(c.zToken, null, 'flat_known_tiles: never invent client-computed Z height');
      assert.equal(c.display, raw.display);
    }
  }
  assert.deepEqual(
    [...model.drawnSigns].sort(),
    ['unknown', 'valid']
  );
  // Perspective is rejected before anything is drawn.
  const persp = structuredClone(fixture);
  persp.bitemporal_grid.projection = 'perspective';
  assert.throws(() => buildBitemporalModel(persp), /perspective/);
});

test('M2: Sheet 05 2D matrix from recorded gate output shows Valid x Knowledge with zero digits on unknown', async () => {
  const html = await withDoc(fixture, {}, (doc) => {
    const root = doc.querySelector(`section[${M.sheet}="bitemporal-stair"]`);
    assert.equal(root.getAttribute(M.projection), '2d');
    assert.equal(root.getAttribute(M.trust_tier), 'sealed');
    assert.equal(doc.querySelector(SVG), null);

    const tds = [...doc.querySelectorAll(`${MATRIX} td[${M.part}="value"]`)];
    assert.equal(tds.length, RAW.length);
    assert.equal(doc.querySelectorAll(`${MATRIX} thead th`).length, 1 + GRID.valid_times.length);
    assert.equal(doc.querySelectorAll(`${MATRIX} tbody th`).length, GRID.epochs.length);

    const unk = tds.filter((t) => t.getAttribute(M.state) === 'unknown');
    assert.equal(unk.length, RAW.filter((r) => r.state === 'unknown').length);
    assert.ok(unk.length > 0, 'recorded gate fixture must include at least one unknown epoch');
    for (const t of unk) {
      assert.ok(t.getAttribute(M.reason));
      assert.ok(t.querySelector(`[${M.sign}="unknown"]`));
      assert.equal(/[0-9]/.test(t.textContent), false, 'unknown cell text holds no digit');
    }

    const known = tds.filter((t) => t.getAttribute(M.state) === 'known');
    assert.equal(known.length, RAW.filter((r) => r.state === 'known').length);
    assert.ok(known.length > 0, 'recorded gate fixture must include at least one known epoch');
    for (const t of known) {
      assert.ok(t.querySelector(`[${M.sign}="valid"]`));
      assert.ok(t.textContent.includes('13500'), 'known cell renders exact gate-served display');
    }

    for (const t of tds) assert.ok(t.getAttribute(M.proof_ref));
    checkLegendAndTables(doc);
  });
  assert.deepEqual(await auditA11y(html), []);
});

test('M2: Sheet 05 3D orthographic staircase from recorded gate output has hatched unknown curtains, proof per mark, table twin', async () => {
  const html = await withDoc(fixture, { view: 'orthographic' }, (doc) => {
    assert.equal(doc.querySelector('section[data-sheet]').getAttribute(M.projection), 'orthographic');
    assert.equal(doc.querySelector(MATRIX), null);
    const svg = doc.querySelector(SVG);
    assert.ok(svg);
    assert.equal(/perspective/i.test(svg.outerHTML), false);

    const marks = [...svg.querySelectorAll(`g[${M.proof_ref}]`)];
    assert.equal(marks.length, RAW.length);
    assert.deepEqual(marks.map((g) => g.getAttribute(M.proof_ref)), (() => {
      const m = buildBitemporalModel(fixture);
      const byId = new Map(m.cells.map((c) => [c.id, c.proofRef]));
      return m.paintOrder.map((id) => byId.get(id));
    })());

    for (const g of marks) {
      const state = g.getAttribute(M.state);
      if (state === 'unknown') {
        assert.ok(g.getAttribute(M.reason));
        assert.ok(g.innerHTML.includes('url(#bt-hatch)'), 'unknown is a hatched band');
        assert.equal(g.innerHTML.includes('--z:'), false, 'Decision 0011 §1: unknown must carry no --z height/magnitude');
        assert.equal(g.querySelector('rect'), null, 'Decision 0011 §1: unknown must not draw an extruded prism');
        assert.equal(/[0-9]/.test(g.textContent), false);
      }
      if (state === 'known') {
        assert.equal(g.innerHTML.includes('--z:'), false, 'flat_known_tiles: no client-invented --z');
        assert.equal(g.querySelector('rect'), null, 'flat_known_tiles: flat tile, no extruded prism');
      }
    }
    const twin = doc.querySelector(TWIN);
    assert.equal(twin.querySelectorAll('tbody tr').length, GRID.epochs.length);
    assert.equal(twin.querySelectorAll('thead th').length, 1 + GRID.valid_times.length);
    assert.ok(twin.textContent.includes(RAW.find((r) => r.display).display));
    checkLegendAndTables(doc);
  });
  assert.deepEqual(await auditA11y(html), []);
});

test('M2: Sheet 05 refuses dishonest input instead of inventing values', async () => {
  const noReason = structuredClone(fixture);
  delete noReason.bitemporal_grid.matrix[0][0].reason;
  await assert.rejects(() => mount(noReason), /explicit reason|without published reason/);

  const noZ = structuredClone(fixture);
  delete noZ.bitemporal_grid.flat_known_tiles;
  await assert.rejects(() => mount(noZ), /without published z_norm/);

  const digitReason = structuredClone(fixture);
  digitReason.bitemporal_grid.matrix[0][0].reason = 'received in 2024';
  await assert.rejects(() => mount(digitReason), /must not contain digits/);

  const persp = structuredClone(fixture);
  persp.bitemporal_grid.projection = 'perspective';
  await assert.rejects(() => mount(persp), /perspective/);
});
