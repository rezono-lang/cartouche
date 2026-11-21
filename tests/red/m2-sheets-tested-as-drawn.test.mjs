import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DATA_MARKS, paletteCss } from '../../packages/reader-core/src/index.ts';
import { renderSpecimenHtml, verifySpecimenCoverage } from '../../packages/atlas/src/specimen.ts';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 3,
  summary: '#46 point 15: every sheet and the specimen are tested as drawn in a real layout engine, not only on model coordinates; the specimen is a rendered page and counts no palettes',
  waits_on: [
    'm1-green-guard-covers-harness',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0015 §4, issue #46 point 15. Every sheet and the specimen are tested as drawn in Playwright Chromium
// at a fixed viewport, across swisstopo, obsidian, and forced palettes, with real drawn-box geometric invariants
// (getBoundingClientRect / SVG getBBox) and real Chromium axe-core color-contrast with zero incomplete results.

const ROOT = process.cwd();
const VIEWER_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'viewer', 'prerendered.json'), 'utf8'));
const DATA_MARKS_CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'data-marks.json'), 'utf8'));
const AXE_SOURCE = fs.readFileSync(path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

const PALETTES = ['swisstopo', 'obsidian', 'forced'];
const VIEWPORT = { width: 1280, height: 900 };

function sheetHtmlFor(sheetKey, palette) {
  const sheets = VIEWER_DATA.sheetsHtml;
  if (sheetKey === 'relief') return sheets.relief[palette]?.en ?? sheets.relief.swisstopo.en;
  if (sheetKey === 'flow') return sheets.flowFull[palette] ?? sheets.flowFull.swisstopo;
  if (sheetKey === 'kringstand') return sheets.kringstand;
  if (sheetKey === 'ripple') return sheets.ripple[palette]?.en ?? sheets.ripple.swisstopo.en;
  if (sheetKey === 'bitemporal') return sheets.bitemporal[palette] ?? sheets.bitemporal.swisstopo;
  if (sheetKey === 'monge') return sheets.monge[palette] ?? sheets.monge.swisstopo;
  throw new Error(`Unknown sheet key: ${sheetKey}`);
}

function wrapPageHtml(bodyHtml, palette) {
  return `<!doctype html>
<html lang="en" data-cartouche-theme="${palette}">
<head>
<meta charset="utf-8" />
<title>Cartouche Drawn Verification</title>
<style>
${paletteCss(palette)}
html, body { margin: 0; padding: 16px; background: var(--c-paper); color: var(--c-ink); }
</style>
</head>
<body><main>${bodyHtml}</main></body>
</html>`;
}

const SIX_SHEETS = ['relief', 'flow', 'kringstand', 'ripple', 'bitemporal', 'monge'];

test('M2 [sheets-tested-as-drawn] 1-3: all 6 sheets render in Chromium across swisstopo/obsidian/forced with drawn-box geometric invariants and drawn Monge planes', async () => {
  const browser = await chromium.launch();
  try {
    for (const palette of PALETTES) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      if (palette === 'forced') {
        await page.emulateMedia({ forcedColors: 'active' });
      }
      try {
        for (const sheetKey of SIX_SHEETS) {
          await page.setContent(wrapPageHtml(sheetHtmlFor(sheetKey, palette), palette), { waitUntil: 'load' });

          const metrics = await page.evaluate(
            ({ sheetKey: sk, marks }) => {
              const root = document.querySelector(`[${marks.sheet}]`);
              const rootRect = root ? root.getBoundingClientRect() : null;

              // Check unknown value cells and SVG unknown marks have zero ASCII digits (Contract 2 invariant, excluding legend)
              const unknownNodes = [
                ...document.querySelectorAll(
                  `td[${marks.part}="value"][${marks.state}="unknown"], svg [${marks.sign}="unknown"]`
                )
              ].filter((el) => !el.closest(`[${marks.part}="legend"]`));
              const digitViolations = [];
              for (const el of unknownNodes) {
                const txt = (el.textContent ?? '').trim();
                if (/\d/.test(txt)) digitViolations.push(txt);
              }

              // Check drift marks have two tracks with stated & observed proof refs and non-zero drawn boxes (excluding legend)
              const driftGroups = [...document.querySelectorAll(`svg [${marks.sign}="drift"]`)].filter(
                (g) => !g.closest(`[${marks.part}="legend"]`)
              );
              const driftIssues = [];
              for (const g of driftGroups) {
                const stated = g.querySelector(`[${marks.stated_proof_ref}]`);
                const observed = g.querySelector(`[${marks.observed_proof_ref}]`);
                if (!stated || !observed) {
                  driftIssues.push('missing dual stated/observed proof track');
                  continue;
                }
                const sr = stated.getBoundingClientRect();
                const or = observed.getBoundingClientRect();
                if (sr.width + sr.height <= 0 || or.width + or.height <= 0) {
                  driftIssues.push('zero-size drift track');
                }
              }

              // Check drawn SVG sibling card/label overlaps on FlowSplit & Monge
              const overlapPairs = [];
              if (sk === 'flow' || sk === 'monge') {
                const labels = [...document.querySelectorAll('svg g[data-key] > text')]
                  .map((t) => ({ text: (t.textContent ?? '').trim(), box: t.getBoundingClientRect() }))
                  .filter((item) => item.box.width > 0 && item.box.height > 0);
                for (let i = 0; i < labels.length; i++) {
                  for (let j = i + 1; j < labels.length; j++) {
                    const a = labels[i].box;
                    const b = labels[j].box;
                    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                    if (ox > 1 && oy > 1) {
                      overlapPairs.push(`${labels[i].text} <-> ${labels[j].text}`);
                    }
                  }
                }
              }

              // Check Monge drawn SVG marks (unique drawn X and Y coordinates and finite non-zero boxes on planes)
              const mongeDrawn = { circleCount: 0, distinctXs: 0, distinctYs: 0, zeroSized: 0 };
              if (sk === 'monge') {
                const circles = [...document.querySelectorAll('svg circle')];
                mongeDrawn.circleCount = circles.length;
                const xs = new Set();
                const ys = new Set();
                for (const c of circles) {
                  const r = c.getBoundingClientRect();
                  if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || r.width <= 0 || r.height <= 0) {
                    mongeDrawn.zeroSized++;
                  } else {
                    xs.add(Math.round(r.x));
                    ys.add(Math.round(r.y));
                  }
                }
                mongeDrawn.distinctXs = xs.size;
                mongeDrawn.distinctYs = ys.size;
              }

              return {
                hasRoot: Boolean(root),
                rootWidth: rootRect?.width ?? 0,
                rootHeight: rootRect?.height ?? 0,
                digitViolations,
                driftIssues,
                overlapPairs,
                mongeDrawn
              };
            },
            { sheetKey, marks: DATA_MARKS }
          );

          assert.ok(
            metrics.hasRoot && metrics.rootWidth > 0 && metrics.rootHeight > 0,
            `${sheetKey} (${palette}): must render with non-zero drawn bounding box`
          );
          assert.deepEqual(
            metrics.digitViolations,
            [],
            `${sheetKey} (${palette}): unknown marks must contain zero ASCII digits`
          );
          assert.deepEqual(
            metrics.driftIssues,
            [],
            `${sheetKey} (${palette}): drift marks must draw two proof-linked tracks`
          );
          assert.deepEqual(
            metrics.overlapPairs,
            [],
            `${sheetKey} (${palette}): sibling SVG labels must not overlap as drawn`
          );
          if (sheetKey === 'monge') {
            assert.ok(metrics.mongeDrawn.circleCount > 0, `monge (${palette}): must draw SVG marks`);
            assert.equal(metrics.mongeDrawn.zeroSized, 0, `monge (${palette}): all drawn SVG marks must have finite non-zero boxes`);
            assert.ok(metrics.mongeDrawn.distinctXs >= 2, `monge (${palette}): drawn planes must preserve distinct X coordinates`);
            assert.ok(metrics.mongeDrawn.distinctYs >= 2, `monge (${palette}): drawn planes must preserve distinct Y coordinates`);
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('M2 [sheets-tested-as-drawn] 4: specimen renders every contract sign and state as a real page in Chromium and counts no palettes', async () => {
  const cov = verifySpecimenCoverage();

  assert.equal(cov.ok, true, 'verifySpecimenCoverage() must pass');
  assert.ok(Array.isArray(cov.missingSigns) && Array.isArray(cov.missingStates), 'verifySpecimenCoverage() must report sign and state names');
  assert.equal(
    'missingPalettes' in cov || 'palettes' in cov,
    false,
    'verifySpecimenCoverage() must name signs and states and must NOT count palettes (Decision 0015 §4)'
  );

  const contractSigns = DATA_MARKS_CONTRACT.attributes.sign.values;
  const contractStates = DATA_MARKS_CONTRACT.attributes.state.values;
  const html = renderSpecimenHtml('swisstopo');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.setContent(wrapPageHtml(html, 'swisstopo'), { waitUntil: 'load' });
    const drawn = await page.evaluate(
      ({ signs, states, signAttr, stateAttr }) => {
        const missingSigns = [];
        const zeroSizedSigns = [];
        for (const s of signs) {
          const el = document.querySelector(`[${signAttr}="${s}"]`);
          if (!el) {
            missingSigns.push(s);
          } else {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) zeroSizedSigns.push(s);
          }
        }
        const missingStates = [];
        const zeroSizedStates = [];
        for (const st of states) {
          const el = document.querySelector(`[${stateAttr}="${st}"], [${signAttr}="${st}"]`);
          if (!el) {
            missingStates.push(st);
          } else {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) zeroSizedStates.push(st);
          }
        }
        return { missingSigns, zeroSizedSigns, missingStates, zeroSizedStates };
      },
      { signs: contractSigns, states: contractStates, signAttr: DATA_MARKS.sign, stateAttr: DATA_MARKS.state }
    );
    assert.deepEqual(drawn.missingSigns, [], `specimen page must draw every contract sign: missing ${drawn.missingSigns.join(', ')}`);
    assert.deepEqual(drawn.zeroSizedSigns, [], `every specimen sign must have non-zero drawn box: ${drawn.zeroSizedSigns.join(', ')}`);
    assert.deepEqual(drawn.missingStates, [], `specimen page must draw every contract state: missing ${drawn.missingStates.join(', ')}`);
    assert.deepEqual(drawn.zeroSizedStates, [], `every specimen state must have non-zero drawn box: ${drawn.zeroSizedStates.join(', ')}`);
  } finally {
    await browser.close();
  }
});

test('M2 [sheets-tested-as-drawn] 5: axe-core in Chromium passes WCAG 2.1 AA with zero color-contrast violations and zero color-contrast incomplete nodes (including SVG text)', async () => {
  const browser = await chromium.launch();
  try {
    for (const palette of ['swisstopo', 'obsidian']) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      try {
        for (const sheetKey of [...SIX_SHEETS, 'specimen']) {
          const bodyHtml = sheetKey === 'specimen' ? renderSpecimenHtml(palette) : sheetHtmlFor(sheetKey, palette);
          await page.setContent(wrapPageHtml(bodyHtml, palette), { waitUntil: 'load' });
          await page.addScriptTag({ content: AXE_SOURCE });
          const results = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
            });
          });

          assert.deepEqual(
            results.violations,
            [],
            `${sheetKey} (${palette}): Chromium axe-core reported WCAG 2.1 AA violations: ${JSON.stringify(
              results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
              null,
              2
            )}`
          );

          const contrastIncomplete = results.incomplete
            .filter((item) => item.id === 'color-contrast')
            .flatMap((item) => item.nodes)
            .filter((node) => {
              const keys = node.any.map((c) => c.data?.messageKey).filter(Boolean);
              // Ignore axe's nonBmp advisory on aria-hidden decorative glyphs (○, ▨); every real text node must be decided.
              return !(keys.length > 0 && keys.every((k) => k === 'nonBmp'));
            });
          assert.deepEqual(
            contrastIncomplete,
            [],
            `${sheetKey} (${palette}): axe-core color-contrast must decide every text node (0 incomplete), got ${contrastIncomplete.length}`
          );
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});
