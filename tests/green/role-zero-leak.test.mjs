import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, canonicalJson } from '../../packages/reader-core/src/index.ts';
import { compileFlowSplitScene } from '../../packages/scene-ir/src/index.ts';
import { exportFlowSplitSvg } from '../../packages/atlas/src/flow-split-svg.ts';
import { render as renderSlip } from '../../packages/slip/bin/render.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const FLOW_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'FlowSplitSheet.svelte');

test('Role-safe zero-leak projection: tenant_a contains zero traces of restricted nodes and declares not_read_in_full', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'fixtures', '02-platform-tenant-a.json'), 'utf8')
  );
  const scene = compileFlowSplitScene(fx);
  const serialized = canonicalJson(scene);

  assert.equal(scene.seal.role, 'tenant_a');
  assert.equal(scene.horizon.complete, false);
  assert.equal(scene.horizon.reason, 'not_read_in_full');
  assert.equal(scene.driftEdges.length, 0);

  for (const forbidden of fx.forbidden_leaks_check) {
    assert.equal(serialized.includes(forbidden), false, `Restricted identifier "${forbidden}" leaked into tenant_a scene!`);
  }
});

test('Role-safe zero-leak projection (complete -> restricted): published tenant_a fixture leaves zero complete-only IDs, labels, placeholders, or count leaks in scene, SVG, and DOM', async () => {
  const complete = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '01-platform-drift.json'), 'utf8'));
  const projected = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', '02-platform-tenant-a.json'), 'utf8'));
  const visibleIds = new Set(projected.nodes.map((n) => n.id));
  const restrictedIds = new Set(complete.nodes.map((n) => n.id).filter((id) => !visibleIds.has(id)));
  assert.ok(restrictedIds.size > 0, 'complete fixture must contain nodes absent from tenant_a publication');
  const restrictedTokens = [
    ...restrictedIds,
    ...(projected.forbidden_leaks_check ?? []),
    'e-drift-vault',
    'e-absent-backup'
  ];

  const scene = compileFlowSplitScene(projected);
  const sceneJson = canonicalJson(scene);
  const svg = exportFlowSplitSvg(projected);
  const { html } = await renderSvelte(FLOW_SHEET, { fixture: projected });

  assert.equal(scene.nodes.length, projected.nodes.length, 'scene node count must equal visible count (no placeholder nodes)');
  assert.equal(scene.horizon.complete, false);
  assert.equal(scene.horizon.reason, 'not_read_in_full');

  for (const token of restrictedTokens) {
    assert.equal(sceneJson.includes(token), false, `restricted token "${token}" leaked into scene JSON`);
    assert.equal(svg.includes(token), false, `restricted token "${token}" leaked into exported SVG`);
    assert.equal(html.includes(token), false, `restricted token "${token}" leaked into rendered HTML`);
  }

  const { window, document } = parseHtml(html);
  try {
    const drawnNodes = document.querySelectorAll(`svg g[${DATA_MARKS.key}]`);
    // Each visible node is drawn on stated/observed curtain layers; zero restricted keys exist
    for (const g of drawnNodes) {
      const k = g.getAttribute(DATA_MARKS.key) ?? '';
      for (const bad of restrictedIds) {
        assert.equal(k.includes(bad), false, `restricted key "${bad}" leaked into SVG DOM`);
      }
    }
    const twinRows = document.querySelectorAll(`table[${DATA_MARKS.part}="twin"] tbody tr`);
    assert.equal(twinRows.length, projected.nodes.length, 'table twin must contain only visible rows, zero hidden placeholders');
  } finally {
    await window.happyDOM.close();
  }
});

test('Role-safe zero-leak projection (reader store -> summary role): partial-read role in fixture 10 leaks zero full-reader sweep answers', async () => {
  const res = await renderSlip({
    fixture: 'fixtures/10-slip-reader-answers.json',
    store: 'sweeps',
    role: 'summary',
    pack: 'slip',
    lang: 'en',
    keys: [{ line: 1, key: 's' }]
  });
  const { window, document } = parseHtml(res.html);
  try {
    const stops = [...document.querySelectorAll(`[${DATA_MARKS.stop}]`)];
    assert.ok(stops.length > 0, 'summary role renders sweep stops');
    for (const stop of stops) {
      assert.equal(stop.getAttribute(DATA_MARKS.status), 'unavailable', 'partial-read role must see only unavailable stops');
    }
    assert.equal(res.html.includes('too_large'), false, 'restricted invariant check id must not leak into summary role');
  } finally {
    await window.happyDOM.close();
  }
});
