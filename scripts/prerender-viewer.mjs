#!/usr/bin/env node
/**
 * Build-time prerenderer for apps/atlas-viewer (Decision 0014 & Decision 0015 N2, Issue #46 items 1-2).
 * Prerenders ALL 6 Atlas sheets, @rezono/slip HTML (from fixtures/10-slip-reader-answers.json +
 * 07-unserved-410.json), and all 7 CartoucheScene Typst exports at build time so the browser bundle
 * holds ZERO scene compilers, ZERO layout models, ZERO DeltaStore, ZERO Typst exporter, and ZERO
 * golden fixture JSON files.
 */

import crypto from 'node:crypto';
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
import { renderSvelte } from './svelte-test-harness.mjs';

const ROOT = process.cwd();
const loadJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const sheetPath = (name) => path.join(ROOT, 'packages', 'atlas', 'src', name);

function collectReasons(items) {
  const out = {};
  for (const item of items) {
    const id = item.id ?? item.key;
    if (id && item.reason) out[id] = item.reason;
  }
  return out;
}

async function renderSheetHtml(svelteFile, props) {
  const { html, head } = await renderSvelte(svelteFile, props);
  return `${head}${html}`;
}

const fx01 = loadJson('fixtures/01-platform-drift.json');
const fx02 = loadJson('fixtures/02-platform-tenant-a.json');
const fx03 = loadJson('fixtures/03-kring-m1-to-m5-live.json');
const fx04 = loadJson('fixtures/04-subsidy-a001-a003.json');
const fx05 = loadJson('fixtures/05-subsidy-bitemporal.json');
const fx06 = loadJson('fixtures/06-keycloak-dense-28.json');
const fx08 = loadJson('fixtures/08-monge-4d-audit.json');

const PALETTES = ['swisstopo', 'obsidian', 'forced'];
const LOCALES = ['en', 'nl'];
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

const sheetsHtml = {
  relief: {},
  flowFull: {},
  flowRestricted: {},
  kringstand: await renderSheetHtml(sheetPath('KringstandSheet.svelte'), { fixture: fx03 }),
  ripple: {},
  bitemporal: {},
  monge: {}
};

for (const theme of PALETTES) {
  sheetsHtml.relief[theme] = {};
  sheetsHtml.ripple[theme] = {};
  for (const lang of LOCALES) {
    sheetsHtml.relief[theme][lang] = await renderSheetHtml(sheetPath('Relief3DSheet.svelte'), {
      fixture: fx04,
      theme,
      lang
    });
    sheetsHtml.ripple[theme][lang] = await renderSheetHtml(sheetPath('CausalRippleSheet.svelte'), {
      fixture: fx06,
      theme,
      lang
    });
  }
  sheetsHtml.flowFull[theme] = await renderSheetHtml(sheetPath('FlowSplitSheet.svelte'), {
    fixture: fx01,
    theme
  });
  sheetsHtml.flowRestricted[theme] = await renderSheetHtml(sheetPath('FlowSplitSheet.svelte'), {
    fixture: fx02,
    theme
  });
  sheetsHtml.bitemporal[theme] = await renderSheetHtml(sheetPath('BitemporalStairSheet.svelte'), {
    fixture: fx05,
    theme
  });
  sheetsHtml.monge[theme] = await renderSheetHtml(sheetPath('MongeFoldingSheet.svelte'), {
    fixture: fx08,
    theme
  });
}

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

const TIME_EPOCHS = ['m-1', 'm-2', 'm-3', 'm-4'];
const TIME_VALID_DATES = ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'];
const MANIFEST_BY_EPOCH = Object.fromEntries(
  TIME_EPOCHS.map((ep) => [
    ep,
    `sha256:${crypto.createHash('sha256').update(`${fx05.manifest.id}:${ep}`).digest('hex').slice(0, 32)}`
  ])
);
const fx05Bitemporal = {
  ...fx05,
  bitemporal_grid: {
    ...fx05.bitemporal_grid,
    valid_times: TIME_VALID_DATES,
    epochs: TIME_EPOCHS
  }
};

const bitemporalByTime = {};
for (const theme of PALETTES) {
  bitemporalByTime[theme] = {};
  for (const knownAt of TIME_EPOCHS) {
    bitemporalByTime[theme][knownAt] = {};
    for (const validAt of TIME_VALID_DATES) {
      bitemporalByTime[theme][knownAt][validAt] = await renderSheetHtml(sheetPath('BitemporalStairSheet.svelte'), {
        fixture: fx05Bitemporal,
        theme,
        activeValidAt: validAt,
        activeKnownAt: knownAt,
        activeManifestId: MANIFEST_BY_EPOCH[knownAt]
      });
    }
  }
}

const output = {
  sheetsHtml,
  timeControl: {
    validTimes: TIME_VALID_DATES,
    servedEpochs: TIME_EPOCHS,
    manifestByEpoch: MANIFEST_BY_EPOCH,
    bitemporalByTime
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
console.log(
  `✅ Prerendered viewer artifact written to fixtures/viewer/prerendered.json (7 sheets + ${SLIP_ROWS.length} slip rows x ${PALETTES.length} palettes + 7 Typst exports).`
);
