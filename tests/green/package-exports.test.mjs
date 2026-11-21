import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as readerCore from '../../packages/reader-core/src/index.ts';
import * as sceneIr from '../../packages/scene-ir/src/index.ts';
import * as slip from '../../packages/slip/src/index.ts';
import * as atlas from '../../packages/atlas/src/index.ts';

const ROOT = process.cwd();

test('Package barrel exports: @rezono/reader-core exposes all M1-M4 modules', () => {
  for (const fn of [
    'asOpaqueCell',
    'renderOpaqueText',
    'DeltaStore',
    'renderFigure',
    'PALETTES',
    'SIGNS',
    'STD_VERBS',
    'paletteCss',
    'DATA_MARKS',
    'canonicalJson',
    'ReaderClient'
  ]) {
    assert.ok(fn in readerCore, `@rezono/reader-core missing export "${fn}"`);
  }
});

test('Package barrel exports: @rezono/scene-ir exposes all compilers, guards, and Typst exporter', () => {
  for (const fn of [
    'CARTOUCHE_SCENE_SCHEMA_VERSION',
    'assertXDDiscipline',
    'checkGeometricInvariants',
    'compileFlowSplitScene',
    'compileReliefScene',
    'compileMongeScene',
    'compileKringstandScene',
    'compileCausalRippleScene',
    'compileBitemporalScene',
    'exportTypst'
  ]) {
    assert.ok(fn in sceneIr, `@rezono/scene-ir missing export "${fn}"`);
  }
});

test('Package barrel exports: @rezono/slip exposes browser runtime modules and NEVER exports build-time model.ts', () => {
  for (const fn of [
    'createSlipModel',
    'resolveSlipShortcut',
    'defineSlipElement',
    'renderSlipElementHtml',
    'validateSweepStops',
    'canFoldStop',
    'resolveLineVerbs',
    'buildAnswerTable',
    'SLIP_COMPONENTS'
  ]) {
    assert.ok(fn in slip, `@rezono/slip missing export "${fn}"`);
  }

  // Build-time model.ts must NOT be exported from the browser barrel (Decision 0009 & 0011)
  const slipIndexSource = fs.readFileSync(path.join(ROOT, 'packages', 'slip', 'src', 'index.ts'), 'utf8');
  assert.equal(/['"]\.\/model\.ts['"]/.test(slipIndexSource), false, 'packages/slip/src/index.ts must NOT export model.ts');
  assert.equal('buildSlipView' in slip, false, 'buildSlipView from build-time model.ts must not be exported from slip barrel');

  // All 6 Svelte component paths in SLIP_COMPONENTS resolve to real files
  assert.equal(Object.keys(slip.SLIP_COMPONENTS).length, 6);
  for (const rel of Object.values(slip.SLIP_COMPONENTS)) {
    const abs = path.resolve(ROOT, 'packages', 'slip', 'src', rel);
    assert.equal(fs.existsSync(abs), true, `SLIP_COMPONENTS target missing: ${rel}`);
  }
});

test('Package barrel exports: @rezono/cartouche-atlas exposes all 6 sheet helpers, i18n, specimen, and sheet manifest', () => {
  for (const fn of [
    'SPECIMEN_ENTRIES',
    'verifySpecimenCoverage',
    'buildReliefModel',
    'loadReliefFromReader',
    'buildFlowSplitModel',
    'exportFlowSplitSvg',
    'escapeXml',
    'buildCausalRippleModel',
    'loadCausalRippleFromReader',
    'exportCausalRippleSvg',
    'buildPixiDrawPlan',
    'mountCausalRipplePixi',
    'buildBitemporalModel',
    'buildMongeFoldingModel',
    'normalizeFoldAngle',
    'ATLAS_MF2_MESSAGES',
    'formatAtlasMessage',
    'formatReasonLabel',
    'ATLAS_SHEETS'
  ]) {
    assert.ok(fn in atlas, `@rezono/cartouche-atlas missing export "${fn}"`);
  }

  // All 6 Svelte sheet paths in ATLAS_SHEETS resolve to real files
  assert.equal(Object.keys(atlas.ATLAS_SHEETS).length, 6);
  for (const rel of Object.values(atlas.ATLAS_SHEETS)) {
    const abs = path.resolve(ROOT, 'packages', 'atlas', 'src', rel);
    assert.equal(fs.existsSync(abs), true, `ATLAS_SHEETS target missing: ${rel}`);
  }
});
