import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import {
  checkGeometricInvariants,
  compileFlowSplitScene,
  compileMongeScene,
  compileReliefScene
} from '../../packages/scene-ir/src/index.ts';
import { verifySpecimenCoverage } from '../../packages/atlas/src/index.ts';
import { exportFlowSplitSvg } from '../../packages/atlas/src/flow-split-svg.ts';
import { buildMongeFoldingModel } from '../../packages/atlas/src/monge-model.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

test('Headless geometric invariants pass on golden Flow, Relief, and Monge fixtures (<20ms)', () => {
  const fxFlow = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8'));
  const fxSub = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '04-subsidy-a001-a003.json'), 'utf8'));
  const fxMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));

  assert.deepEqual(checkGeometricInvariants(compileFlowSplitScene(fxFlow)), []);
  assert.deepEqual(checkGeometricInvariants(compileReliefScene(fxSub)), []);
  assert.deepEqual(checkGeometricInvariants(compileMongeScene(fxMonge)), []);
  assert.equal(verifySpecimenCoverage().ok, true);
});

test('Headless geometric invariants catch Monge Y-axis collisions and single-sided drift immediately', () => {
  const fxMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));
  // Force two services onto identical Y (the exact regression we caught visually!)
  fxMonge.services[3].y = fxMonge.services[1].y;
  fxMonge.drift_arcs[0].observed_proof_ref = '';

  const scene = compileMongeScene(fxMonge);
  const codes = checkGeometricInvariants(scene).map((e) => e.code);
  assert.ok(codes.includes('MONGE_Y_COLLISION'));
  assert.ok(codes.includes('EPI_DRIFT_SINGLE_SIDED'));
});

test('Drawn SVG layout geometry: FlowSplit exported SVG boxes are finite, inside viewBox, and pairwise non-overlapping', async () => {
  const fxFlow = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8'));
  const svg = exportFlowSplitSvg(fxFlow);
  assert.equal(/\b(NaN|Infinity)\b/.test(svg), false, 'SVG must contain zero NaN/Infinity coordinates');

  const { window, document } = parseHtml(svg);
  try {
    const svgEl = document.querySelector('svg');
    assert.ok(svgEl, 'expected <svg>');
    const viewBox = (svgEl.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
    assert.equal(viewBox.length, 4);
    const [vx, vy, vw, vh] = viewBox;
    assert.ok(vw > 0 && vh > 0);

    const rects = [...svgEl.querySelectorAll(`g[${DATA_MARKS.key}][${DATA_MARKS.state}][${DATA_MARKS.proof_ref}]:not([${DATA_MARKS.relation}])`)]
      .map((g) => {
        const r = g.querySelector(':scope > rect');
        if (!r) return null;
        return {
          key: g.getAttribute(DATA_MARKS.key) ?? '',
          layer: g.getAttribute(DATA_MARKS.layer) ?? '',
          x: Number(r.getAttribute('x')),
          y: Number(r.getAttribute('y')),
          w: Number(r.getAttribute('width')),
          h: Number(r.getAttribute('height'))
        };
      })
      .filter(Boolean);
    assert.ok(rects.length >= fxFlow.nodes.length, 'expected drawn node rects in SVG');

    for (const b of rects) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && b.w > 0 && b.h > 0, `invalid drawn rect for ${b.key}`);
      assert.ok(b.x >= vx && b.y >= vy && b.x + b.w <= vx + vw && b.y + b.h <= vy + vh, `drawn rect ${b.key} escapes viewBox`);
    }

    // Zero pairwise bounding-box overlaps among all drawn node rects
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        assert.equal(overlaps, false, `drawn SVG overlap between "${a.key}" (${a.layer}) and "${b.key}" (${b.layer})`);
      }
    }
  } finally {
    await window.happyDOM.close();
  }
});

test('Drawn Monge orthographic projection: actual projected coordinates across 0/40/90 deg preserve unique Y and finite linear rays', () => {
  const fxMonge = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', '08-monge-4d-audit.json'), 'utf8'));
  for (const angle of [0, 40, 90]) {
    const model = buildMongeFoldingModel(fxMonge, angle);
    assert.equal(model.projection, angle === 0 ? '2d' : 'orthographic');
    const seenY = new Set();
    for (const svc of model.services) {
      assert.ok(Number.isFinite(svc.plane1.x) && Number.isFinite(svc.plane1.y), `finite Plane I coords for ${svc.id} at ${angle}deg`);
      assert.equal(svc.rayToPlane2.length, 3, `Plane I->II ray has 3 points for ${svc.id}`);
      assert.equal(svc.rayToPlane3.length, 3, `Plane I->III ray has 3 points for ${svc.id}`);
      for (const pt of [...svc.rayToPlane2, ...svc.rayToPlane3]) {
        assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), `finite ray point for ${svc.id} at ${angle}deg`);
      }
      const yBucket = Math.round(svc.plane1.y * 10);
      assert.equal(seenY.has(yBucket), false, `projected Plane I Y collision at ${angle}deg for ${svc.id}`);
      seenY.add(yBucket);
    }
  }
});
