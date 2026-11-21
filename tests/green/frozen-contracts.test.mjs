import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, PALETTES, SIGNS, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import {
  compileFlowSplitScene,
  compileMongeScene,
  compileSubsidyReliefScene,
  GEOM_INVARIANT_CODES,
  validateXDDiscipline,
  XD_LAW_CODES
} from '../../packages/scene-ir/src/index.ts';
import { SPECIMEN_ENTRIES } from '../../packages/atlas/src/index.ts';
import {
  loadJson,
  validateDataMarksContract,
  validateFixtureProjection,
  validateFreezeLock,
  validateSceneContractSync,
  validateSceneShape,
  validateStdViewTokensContract
} from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();

test('Frozen Contract Lock: SHA-256 lock passes and detects any contract tampering immediately', () => {
  const lock = loadJson(ROOT, 'contracts/freeze-lock.json');
  assert.deepEqual(validateFreezeLock(ROOT, lock), []);

  const tampered = structuredClone(lock);
  tampered.contracts['contracts/std-view.v2.tokens.json'].sha256 = '0'.repeat(64);
  const errs = validateFreezeLock(ROOT, tampered);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /FROZEN CONTRACT TAMPERED/);
});

test('Contract 1 (CartoucheScene v2 + xD-Discipline): schema sync, valid scenes, and Law 0/5/6 rejections', () => {
  const sceneContract = loadJson(ROOT, 'contracts/cartouche-scene.v2.schema.json');
  assert.deepEqual(validateSceneContractSync(sceneContract, XD_LAW_CODES, GEOM_INVARIANT_CODES), []);

  const flow = compileFlowSplitScene(loadJson(ROOT, 'fixtures/01-platform-drift.json'));
  const relief = compileSubsidyReliefScene(loadJson(ROOT, 'fixtures/04-subsidy-a001-a003.json'));
  const monge = compileMongeScene(loadJson(ROOT, 'fixtures/08-monge-4d-audit.json'));

  for (const sc of [flow, relief, monge]) {
    assert.deepEqual(validateSceneShape(sc, sceneContract), []);
    assert.deepEqual(validateXDDiscipline(sc), []);
  }

  // Adversarial Law 0 (wrong schemaVersion) & Law 5 (non-stratified Monge Z)
  const badMonge = {
    ...monge,
    schemaVersion: 'cartouche.scene/1',
    axes: [monge.axes[0], monge.axes[1], { axis: 'z', dim: 'D3', kind: 'metric', label: 'Bad Z' }]
  };
  const mongeCodes = validateXDDiscipline(badMonge).map((v) => v.code);
  assert.ok(mongeCodes.includes('XD_UNKNOWN_SCHEMA_VERSION'));
  assert.ok(mongeCodes.includes('XD_MONGE_Z_NOT_STRATIFIED'));

  // Adversarial Law 6 (bitemporal staircase missing two bitemporal axes)
  const badBitemporal = {
    ...flow,
    archetype: 'bitemporal-stair',
    projection: 'orthographic'
  };
  const btCodes = validateXDDiscipline(badBitemporal).map((v) => v.code);
  assert.ok(btCodes.includes('XD_BITEMPORAL_REQUIRES_BITEMPORAL_AXES'));
});

test('Contract 2 (data-* DOM & SVG Marks): syncs with DATA_MARKS + std-view signs and rejects drift', () => {
  const marks = loadJson(ROOT, 'contracts/data-marks.json');
  const tokens = loadJson(ROOT, 'contracts/std-view.v2.tokens.json');
  assert.deepEqual(validateDataMarksContract(marks, tokens, DATA_MARKS), []);

  const mutatedMarks = structuredClone(marks);
  mutatedMarks.attributes.sign.values = ['origin_decision'];
  const errs = validateDataMarksContract(mutatedMarks, tokens, DATA_MARKS);
  assert.ok(errs.some((e) => e.includes('sign values mismatch')));
});

test('Contract 3 (Five Minimal Server Projections): validates all 10 golden fixtures and blocks invalid payloads', () => {
  const projContract = loadJson(ROOT, 'contracts/server-projections.schema.json');
  const fixtureFiles = fs.readdirSync(path.join(ROOT, 'fixtures')).filter((f) => f.endsWith('.json')).sort();
  // 10: Rezono's reader answers for the slip (decisions/0009-slip-reads-rezono-reader.md).
  assert.equal(fixtureFiles.length, 10);
  for (const file of fixtureFiles) {
    const fx = loadJson(ROOT, `fixtures/${file}`);
    assert.deepEqual(validateFixtureProjection(fx, projContract), [], `Fixture ${file} failed schema validation`);
  }

  // Adversarial projection violations across all 5 projections:
  const badDrift = loadJson(ROOT, 'fixtures/01-platform-drift.json');
  badDrift.edges[5].observed_proof_ref = '';
  badDrift.slip_enrichment.prism_5.pop(); // 4 bars instead of 5
  const driftErrs = validateFixtureProjection(badDrift, projContract);
  assert.ok(driftErrs.some((e) => e.includes('BOTH stated_proof_ref and observed_proof_ref')));
  assert.ok(driftErrs.some((e) => e.includes('exactly 5 spectra')));

  const badSweep = loadJson(ROOT, 'fixtures/04-subsidy-a001-a003.json');
  badSweep.subjects[1].amount_cell.display = '€ 0'; // unknown masquerading as zero!
  badSweep.sweep_2d.projection = 'perspective';
  const sweepErrs = validateFixtureProjection(badSweep, projContract);
  assert.ok(sweepErrs.some((e) => e.includes('unknown cell must have display=null')));
  assert.ok(sweepErrs.some((e) => e.includes('projection must be "orthographic"')));

  const badBitemp = loadJson(ROOT, 'fixtures/05-subsidy-bitemporal.json');
  badBitemp.bitemporal_grid.matrix[0][1] = { state: 'known', display: '€ 100', proof_ref: 'bt:future-leak' };
  const btErrs = validateFixtureProjection(badBitemp, projContract);
  assert.ok(btErrs.some((e) => e.includes('future-knowledge upper triangle cell must be "not_applicable"')));
});

test('Contract 4 (std-view v2 OKLCH Tokens): verifies palettes, contrast bounds, signs, verbs, and rejects low contrast', () => {
  const tokens = loadJson(ROOT, 'contracts/std-view.v2.tokens.json');
  assert.deepEqual(validateStdViewTokensContract(tokens, { PALETTES, SIGNS, STD_VERBS }, SPECIMEN_ENTRIES), []);

  // Adversarial: low-contrast semantic token or duplicate glyph rejected
  const lowContrast = structuredClone(tokens);
  lowContrast.palettes.swisstopo.tokens.proof = 'oklch(0.910 0.040 258)'; // delta L = 0.072 < 0.40!
  lowContrast.signs.absent.glyph = lowContrast.signs.unknown.glyph;
  const errs = validateStdViewTokensContract(lowContrast, { PALETTES, SIGNS, STD_VERBS }, SPECIMEN_ENTRIES);
  assert.ok(errs.some((e) => e.includes('semantic token "proof" lightness separation below')));
  assert.ok(errs.some((e) => e.includes('Duplicate glyph')));
});
