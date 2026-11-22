import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary:
    'Proof map requirement 9: scale without a hairball: start from a question or key, expand by why, depends on and affects, group by kind with published counts, level of detail and semantic zoom, WebGL only above a tested node count, smooth at 5000 nodes',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 9). Recorded budgets enforced by this test:
// - GROUP_THRESHOLD: >= 12 rows of one kind collapse into a kind chip with the reader's published count.
// - WEBGL_NODE_THRESHOLD: SVG renderer for <= 400 nodes; single WebGL renderer above 400 nodes.
// - 5,000-node headless Chromium budgets: first render <= 1500 ms, pan+zoom p95 frame time <= 16.7 ms.

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const FX12_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const GROUP_THRESHOLD = 12;
const WEBGL_NODE_THRESHOLD = 400;
const FIRST_RENDER_BUDGET_MS = 1500;
const P95_FRAME_BUDGET_MS = 16.7;
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeLargeScaleFixture(nodeCount) {
  const lanes = ['source-a', 'source-b', 'source-c', 'source-d'];
  const rows = [];
  for (let i = 0; i < nodeCount; i += 1) {
    rows.push({
      id: `n-${String(i).padStart(5, '0')}`,
      relation: i < nodeCount * 0.7 ? 'fact_row' : 'derived_row',
      key: [`e-${i}`],
      lane: lanes[i % lanes.length],
      depth: i < nodeCount * 0.7 ? 0 : 1 + (i % 3),
      state: i % 17 === 0 ? 'unknown' : 'known',
      reason: i % 17 === 0 ? 'missing_source' : '',
      proofRef: `https://rezono.example/scale/witness/${String(i).padStart(64, '0')}`,
      premises: i >= nodeCount * 0.7 ? [`n-${String(i % 500).padStart(5, '0')}`] : []
    });
  }
  return {
    fixture_id: 'synthetic-scale-5000',
    lanes,
    rows,
    published_counts: {
      fact_row: rows.filter((r) => r.relation === 'fact_row').length,
      derived_row: rows.filter((r) => r.relation === 'derived_row').length
    }
  };
}

test('M2 [proof-map-scale] 1: starts as an ego graph and expands strictly by declared question answers (why/depends=grounds, affects=reach)', () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx10 = loadJson(FX10_PATH);
  const reachAnswer = fx10.reader_answers.main.reader['/slip/m-1/ask/reach?relation=group&key=%5B%22group-a%22%5D'].body;
  const groundsAnswer = fx10.reader_answers.main.reader['/slip/m-1/ask/grounds?relation=busy&key=%5B%22group-a%22%5D'].body;

  const ego = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    focus: { relation: 'group', key: ['group-a'] }
  });
  const expandedAffects = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    focus: { relation: 'group', key: ['group-a'] },
    expansions: [{ verb: 'affects', answer: reachAnswer }]
  });
  const expandedWhy = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    focus: { relation: 'busy', key: ['group-a'] },
    expansions: [{ verb: 'why', answer: groundsAnswer }]
  });

  assert.ok(ego.nodes.length >= 1, 'Ego graph must start with the focused key.');
  assert.ok(
    expandedAffects.nodes.length > ego.nodes.length,
    'Expanding with affects (reach) must add the rows served by the reach answer.'
  );

  const expectedReachKeys = new Set(reachAnswer.nodes.map((n) => `${n.relation}::${n.key}`));
  const expandedReachKeys = new Set(
    expandedAffects.nodes
      .filter((n) => n.relation && n.key !== undefined)
      .map((n) => `${n.relation}::${typeof n.key === 'string' ? n.key : JSON.stringify(n.key)}`)
  );
  for (const rk of expectedReachKeys) {
    assert.ok(expandedReachKeys.has(rk), `affects expansion must include served reach node ${rk}.`);
  }

  const expectedGroundsKeys = new Set(groundsAnswer.nodes.map((n) => `${n.relation}::${n.key}`));
  const expandedWhyKeys = new Set(
    expandedWhy.nodes
      .filter((n) => n.relation && n.key !== undefined)
      .map((n) => `${n.relation}::${typeof n.key === 'string' ? n.key : JSON.stringify(n.key)}`)
  );
  for (const gk of expectedGroundsKeys) {
    assert.ok(expandedWhyKeys.has(gk), `why expansion must include served grounds node ${gk}.`);
  }
});

test('M2 [proof-map-scale] 2 & 3: kind chips collapse rows above GROUP_THRESHOLD with published counts and zoom steps control LOD deterministically', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx12 = loadJson(FX12_PATH);
  const persoonCount = fx12.reader_answers.checker['/zorgtoeslag-slice/m-4/rows/persoon'].body.rows.length;
  assert.ok(persoonCount >= GROUP_THRESHOLD, `Expected >= ${GROUP_THRESHOLD} persoon rows in fixture 12.`);

  const collapsed = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-4',
    groupThreshold: GROUP_THRESHOLD
  });
  const expanded = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-4',
    groupThreshold: GROUP_THRESHOLD,
    expandedKinds: ['persoon']
  });

  const domCollapsed = parseHtml(collapsed.svg);
  try {
    const chip = domCollapsed.document.querySelector(`[${M.relation}="persoon"][aria-expanded="false"]`);
    assert.ok(chip, 'Kind exceeding GROUP_THRESHOLD must collapse into a chip with aria-expanded="false".');
    assert.ok(
      (chip.textContent ?? '').includes(String(persoonCount)),
      `Collapsed persoon chip must display the published count (${persoonCount}).`
    );
  } finally {
    await domCollapsed.window.happyDOM.close();
  }

  assert.equal(typeof expanded.chipTableHtml, 'string', 'Opening a kind chip must render its rows as an HTML table.');
  const domTable = parseHtml(expanded.chipTableHtml);
  try {
    assert.ok(domTable.document.querySelector('table th'), 'Opened chip table must include <th> header cells.');
    const bodyRows = domTable.document.querySelectorAll('table tbody tr');
    assert.equal(bodyRows.length, persoonCount, 'Opened chip table must list all published rows for that kind.');
  } finally {
    await domTable.window.happyDOM.close();
  }

  // Semantic zoom LOD: zoomed out shows kind + state glyph only; zoomed in shows slots and values
  const zoomOutA = atlas.compileProofMapLayout(fx12, { role: 'checker', manifest: 'm-4', zoom: 0.35 });
  const zoomOutB = atlas.compileProofMapLayout(fx12, { role: 'checker', manifest: 'm-4', zoom: 0.35 });
  const zoomIn = atlas.compileProofMapLayout(fx12, { role: 'checker', manifest: 'm-4', zoom: 1.25 });

  assert.equal(sha256(zoomOutA.svg), sha256(zoomOutB.svg), 'Zoom LOD must be a pure deterministic function of zoom.');
  assert.equal(zoomOutA.lod, 'compact', 'zoom=0.35 must select compact LOD (kind + state glyph only).');
  assert.equal(zoomIn.lod, 'detail', 'zoom=1.25 must select detail LOD (slots and published values).');
  assert.ok(zoomIn.svg.length > zoomOutA.svg.length, 'Detail LOD must render slot/value markup omitted at compact LOD.');
});

test('M2 [proof-map-scale] 4 & 5: SVG below WEBGL_NODE_THRESHOLD, single WebGL renderer above it, and 5,000-node Chromium pan/zoom p95 <= 16.7ms', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx12 = loadJson(FX12_PATH);
  const small = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-4',
    webglThreshold: WEBGL_NODE_THRESHOLD
  });
  assert.equal(small.renderer, 'svg', `Scenes with <= ${WEBGL_NODE_THRESHOLD} nodes must use SVG renderer only.`);
  assert.ok(!small.svg.includes('<canvas'), 'No WebGL <canvas> renderer may be emitted below WEBGL_NODE_THRESHOLD.');

  const largeFx = makeLargeScaleFixture(5000);
  const large = atlas.compileProofMapLayout(largeFx, {
    webglThreshold: WEBGL_NODE_THRESHOLD
  });
  assert.equal(large.renderer, 'webgl', `5,000-node scene (> ${WEBGL_NODE_THRESHOLD}) must select the single WebGL renderer.`);
  assert.equal(typeof large.twinHtml, 'string', 'WebGL proof map must emit a synchronized accessible table[data-part="twin"].');

  const twinDom = parseHtml(large.twinHtml);
  try {
    const twin = twinDom.document.querySelector(`table[${M.part}="twin"]`);
    assert.ok(twin && twin.querySelector('th'), 'WebGL proof map must preserve table[data-part="twin"] with <th> headers.');
  } finally {
    await twinDom.window.happyDOM.close();
  }

  assert.equal(
    typeof large.browserHarnessHtml,
    'string',
    'WebGL proof map must provide a self-contained browserHarnessHtml for headless Chromium frame-time measurement.'
  );

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const t0 = performance.now();
    await page.setContent(large.browserHarnessHtml, { waitUntil: 'load' });
    await page.waitForSelector('canvas');
    const firstRenderMs = performance.now() - t0;
    assert.ok(
      firstRenderMs <= FIRST_RENDER_BUDGET_MS,
      `5,000-node first render took ${firstRenderMs.toFixed(1)} ms (budget <= ${FIRST_RENDER_BUDGET_MS} ms).`
    );

    const { renderTimes, rafIntervals } = await page.evaluate(async () => {
      const renderSamples = [];
      const rafSamples = [];
      let prevRaf = performance.now();
      for (let i = 0; i < 36; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const rafNow = performance.now();
        if (i > 0) rafSamples.push(rafNow - prevRaf);
        prevRaf = rafNow;
        const tFrame = performance.now();
        window.dispatchEvent(new CustomEvent('cartouche:pan-zoom', { detail: { dx: 12, dy: -6, scale: 1 + i * 0.01 } }));
        renderSamples.push(performance.now() - tFrame);
      }
      return { renderTimes: renderSamples, rafIntervals: rafSamples };
    });

    const sortedRender = [...renderTimes].sort((a, b) => a - b);
    const p95 = sortedRender[Math.min(sortedRender.length - 1, Math.floor(sortedRender.length * 0.95))];
    assert.ok(
      p95 <= P95_FRAME_BUDGET_MS,
      `5,000-node pan/zoom p95 frame time was ${p95.toFixed(2)} ms (budget <= ${P95_FRAME_BUDGET_MS} ms).`
    );
    const sortedRaf = [...rafIntervals].sort((a, b) => a - b);
    const medianRaf = sortedRaf[Math.floor(sortedRaf.length / 2)];
    assert.ok(
      medianRaf <= 50,
      `5,000-node rAF cadence stalled (median ${medianRaf.toFixed(2)} ms > 50 ms).`
    );
  } finally {
    await browser.close();
  }
});
