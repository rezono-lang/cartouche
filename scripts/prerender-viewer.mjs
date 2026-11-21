#!/usr/bin/env node
/**
 * Build-time prerenderer for apps/atlas-viewer (Decision 0014, Issue #46 items 1-2).
 * Compiles all 6 CartoucheScene Typst exports and prerenders @rezono/slip HTML from
 * Rezono's recorded reader answers (fixtures/10-slip-reader-answers.json) + 410 unserved
 * (fixtures/07-unserved-410.json) at build time so the browser viewer NEVER constructs
 * DeltaStore, compiles scenes, runs exportTypst, or passes a browser-built seal to Slip.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  compileFlowSplitScene,
  compileMongeScene,
  compileReliefScene
} from '../packages/scene-ir/src/compilers.ts';
import { compileKringstandScene } from '../packages/scene-ir/src/compile-kringstand.ts';
import { compileCausalRippleScene } from '../packages/scene-ir/src/compile-causal-ripple.ts';
import { compileBitemporalScene } from '../packages/scene-ir/src/compile-bitemporal.ts';
import { exportTypst } from '../packages/scene-ir/src/typst-export.ts';
import { render as renderSlip } from '../packages/slip/bin/render.ts';

const ROOT = process.cwd();
const loadJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

function collectReasons(items) {
  const out = {};
  for (const item of items) {
    const id = item.id ?? item.key;
    if (id && item.reason) out[id] = item.reason;
  }
  return out;
}

const fx01 = loadJson('fixtures/01-platform-drift.json');
const fx02 = loadJson('fixtures/02-platform-tenant-a.json');
const fx03 = loadJson('fixtures/03-kring-m1-to-m5-live.json');
const fx04 = loadJson('fixtures/04-subsidy-a001-a003.json');
const fx05 = loadJson('fixtures/05-subsidy-bitemporal.json');
const fx06 = loadJson('fixtures/06-keycloak-dense-28.json');
const fx08 = loadJson('fixtures/08-monge-4d-audit.json');

const PALETTES = ['swisstopo', 'obsidian', 'forced'];
const SLIP_ROWS = [
  { id: 'flagged::item-a::12', row: { relation: 'flagged', key: ['item-a', '12'] } },
  { id: 'group_size::group-a::2', row: { relation: 'group_size', key: ['group-a', '2'] } },
  { id: 'busy::group-a', row: { relation: 'busy', key: ['group-a'] } },
  { id: 'calc__capped_amount::item-a', row: { relation: 'calc__capped_amount', key: ['item-a', '12', 'known', ''] } },
  {
    id: 'calc__capped_amount::item-c',
    row: { relation: 'calc__capped_amount', key: ['item-c', '', 'unknown', 'fact recorded_amount.amount is missing'] }
  }
];

const servedHtml = {};
const unservedHtml = {};

for (const theme of PALETTES) {
  servedHtml[theme] = {};
  for (const entry of SLIP_ROWS) {
    const res = await renderSlip({
      fixture: 'fixtures/10-slip-reader-answers.json',
      role: 'reader',
      pack: 'slip',
      lang: 'en',
      theme,
      row: entry.row
    });
    servedHtml[theme][entry.id] = res.html;
  }
  const unservedRes = await renderSlip({
    fixture: 'fixtures/07-unserved-410.json',
    role: 'reader',
    pack: 'slip',
    lang: 'en',
    theme
  });
  unservedHtml[theme] = unservedRes.html;
}

const typst = {
  relief: exportTypst(compileReliefScene(fx04), { title: 'Sheet 01 — Orthographic Relief' }),
  flowFull: exportTypst(compileFlowSplitScene(fx01), {
    title: 'Sheet 02 — Flow & Reality-Split',
    reasonByNodeId: collectReasons(fx01.nodes)
  }),
  flowRestricted: exportTypst(compileFlowSplitScene(fx02), {
    title: 'Sheet 02 — Flow & Reality-Split',
    reasonByNodeId: collectReasons(fx02.nodes)
  }),
  kringstand: exportTypst(compileKringstandScene(fx03), { title: 'Sheet 03 — Kringstand' }),
  ripple: exportTypst(compileCausalRippleScene(fx06), { title: 'Sheet 04 — Causal Ripple' }),
  bitemporal: exportTypst(compileBitemporalScene(fx05), { title: 'Sheet 05 — Bitemporal Staircase' }),
  monge: exportTypst(compileMongeScene(fx08), {
    title: 'Sheet 06 — Monge Folding Atlas',
    reasonByNodeId: collectReasons(fx08.services)
  })
};

const output = {
  sheets: {
    relief: fx04,
    flowFull: fx01,
    flowRestricted: fx02,
    kringstand: fx03,
    ripple: fx06,
    bitemporal: fx05,
    monge: fx08
  },
  slip: {
    rowKeys: SLIP_ROWS.map((r) => r.id),
    servedHtml,
    unservedHtml
  },
  typst
};

const outPath = path.join(ROOT, 'fixtures', 'viewer', 'prerendered.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`✅ Prerendered viewer artifact written to fixtures/viewer/prerendered.json (${SLIP_ROWS.length} slip rows x ${PALETTES.length} palettes + 7 Typst sheets).`);
