import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { buildMongeFoldingModel } from '../../packages/atlas/src/monge-model.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';
import { loadJson } from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'MongeFoldingSheet.svelte');
const FX_08 = loadJson(ROOT, 'fixtures/08-monge-4d-audit.json');
const M = DATA_MARKS;
const LEGEND = `table[${M.part}="legend"]`;

test('M3 Sheet 06 (monge-fold): folds 0° flat <-> 40° <-> 90° orthographic prism with cobalt rays, dual drift, unknown curtain, twin, legend & axe 0', async () => {
  for (const angle of [0, 40, 90]) {
    const expectedProj = angle === 0 ? '2d' : 'orthographic';
    const { html } = await renderSvelte(SHEET, { fixture: FX_08, foldAngleDeg: angle });
    const { html: htmlAgain } = await renderSvelte(SHEET, { fixture: FX_08, foldAngleDeg: angle });
    assert.equal(html, htmlAgain, `deterministic bytes at ${angle}°`);

    const { window: win, document: doc } = parseHtml(html);
    try {
      const root = doc.querySelector(`section[${M.sheet}="monge-fold"]`);
      assert.ok(root, `root section at ${angle}°`);
      assert.equal(root.getAttribute(M.projection), expectedProj);
      assert.equal(root.getAttribute(M.fold_angle), String(angle));
      assert.equal(root.getAttribute(M.trust_tier), 'sealed');

      const svg = root.querySelector(`svg[${M.sheet}="monge-fold"]`);
      assert.ok(svg);
      assert.equal(svg.getAttribute(M.projection), expectedProj);
      assert.equal(svg.getAttribute(M.fold_angle), String(angle));

      // Orthogonal cobalt projection rays: 2 polylines (Plane II + Plane III) per service
      const rays = [...svg.querySelectorAll('polyline[stroke="var(--c-proof)"]')];
      assert.equal(rays.length, FX_08.services.length * 2);

      // Dual-track drift arc with both stated and observed proof refs
      const drift = svg.querySelector(
        `g[${M.sign}="drift"][${M.stated_proof_ref}="policy:netpol-04"][${M.observed_proof_ref}="obs:hubble-ep42"]`
      );
      assert.ok(drift, 'dual-sided drift group required');
      assert.equal(drift.querySelectorAll('path').length, 2);

      // Absent service carries completeness witness ref
      const absentG = svg.querySelector(`g[${M.key}="dr"][${M.state}="absent"]`);
      assert.ok(absentG);
      assert.equal(absentG.getAttribute(M.completeness_ref), 'sweep:m3-m4');
      assert.equal(absentG.getAttribute(M.proof_ref), 'p:dr');

      // Unknown service renders hatched uncertainty curtain (never z=0) and zero ASCII digits
      const unkG = svg.querySelector(`g[${M.key}="ed"][${M.state}="unknown"]`);
      assert.ok(unkG);
      assert.equal(unkG.getAttribute(M.reason), 'telemetry_timeout');
      assert.ok(unkG.querySelector(`polygon[fill="url(#monge-hatch)"][${M.sign}="unknown"]`));
      const unkText = unkG.querySelector('text')?.textContent ?? '';
      assert.equal(/[0-9]/.test(unkText), false, 'unknown SVG label must carry zero ASCII digits');

      // Synchronized accessible Table Twin
      const twin = root.querySelector(`table[${M.part}="twin"]`);
      assert.ok(twin);
      assert.ok(twin.querySelectorAll('th').length >= 5);
      assert.equal(twin.querySelectorAll('tbody tr').length, FX_08.services.length);
      const unkCell = twin.querySelector(`td[${M.part}="value"][${M.state}="unknown"]`);
      assert.ok(unkCell);
      assert.equal(unkCell.getAttribute(M.reason), 'telemetry_timeout');
      assert.equal(/[0-9]/.test(unkCell.textContent), false, 'unknown twin cell must carry zero ASCII digits');

      // Seal
      const seal = root.querySelector(`[${M.part}="seal"]`);
      assert.ok(seal);
      assert.equal(seal.querySelector(`[${M.part}="manifest-hash"]`)?.textContent, FX_08.manifest.id);

      // Legend covers every drawn [data-sign]
      const legend = root.querySelector(LEGEND);
      assert.ok(legend);
      const listed = new Set([...legend.querySelectorAll(`tr[${M.sign}]`)].map((n) => n.getAttribute(M.sign)));
      const drawn = [...root.querySelectorAll(`[${M.sign}]`)].filter((n) => !n.closest(LEGEND));
      assert.ok(drawn.length > 0);
      for (const el of drawn) {
        assert.ok(listed.has(el.getAttribute(M.sign)), `legend missing ${el.getAttribute(M.sign)}`);
      }
    } finally {
      await win.happyDOM.close();
    }

    assert.deepEqual(await auditA11y(html), [], `axe-core clean at ${angle}°`);
  }

  // Verify fold actually transforms Plane II / Plane III geometry between 0° and 90°
  const m0 = buildMongeFoldingModel(FX_08, 0);
  const m90 = buildMongeFoldingModel(FX_08, 90);
  assert.notEqual(m0.planes[1].points, m90.planes[1].points);
  assert.notEqual(m0.planes[2].points, m90.planes[2].points);
});

test('M3 Sheet 06 (monge-fold): rejects X/Y collisions, perspective projection, single-sided drift, malformed unknown, and invalid fold angles', () => {
  // X collision (Plane II)
  const xCollide = structuredClone(FX_08);
  xCollide.services[1].x = xCollide.services[0].x;
  assert.throws(() => buildMongeFoldingModel(xCollide, 40), /MONGE_X_COLLISION/);

  // Y collision (Plane III)
  const yCollide = structuredClone(FX_08);
  yCollide.services[3].y = yCollide.services[1].y;
  assert.throws(() => buildMongeFoldingModel(yCollide, 40), /MONGE_Y_COLLISION/);

  // Perspective 3D rejected by xD-Discipline Guard
  const persp = structuredClone(FX_08);
  persp.projection = 'perspective';
  assert.throws(() => buildMongeFoldingModel(persp, 40), /XD_NO_PERSPECTIVE/);

  // Single-sided drift rejected
  const badDrift = structuredClone(FX_08);
  badDrift.drift_arcs[0].observed_proof_ref = '';
  assert.throws(() => buildMongeFoldingModel(badDrift, 40), /EPI_DRIFT_SINGLE_SIDED/);

  // Unknown without reason or with digits in reason rejected
  const noReason = structuredClone(FX_08);
  delete noReason.services[5].reason;
  assert.throws(() => buildMongeFoldingModel(noReason, 40), /explicit reason/);

  const digitReason = structuredClone(FX_08);
  digitReason.services[5].reason = 'timeout_500ms';
  assert.throws(() => buildMongeFoldingModel(digitReason, 40), /must not contain digits/);

  // Invalid fold angles rejected
  assert.throws(() => buildMongeFoldingModel(FX_08, -1), /fold angle/);
  assert.throws(() => buildMongeFoldingModel(FX_08, 91), /fold angle/);
});
