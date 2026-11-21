#!/usr/bin/env node
/**
 * Decision 0007: Contract Freeze Guard.
 * Verifies BEFORE every worker PR or merge:
 *  1. LF-normalized SHA-256 freeze lock across all 4 frozen contracts + rezono-pin.json.
 *  2. Zero drift between frozen JSON contracts and browser-safe TypeScript exports
 *     (PALETTES, SIGNS, STD_VERBS, DATA_MARKS, SPECIMEN_ENTRIES, XD_LAW_CODES, GEOM_INVARIANT_CODES).
 *  3. Perceptual OKLCH contrast & non-color sign glyph invariants on std-view v2.
 *  4. Full conformance of compiled CartoucheScene v2 outputs AND all 8 golden fixtures (01..08.json).
 *
 * Planners updating a frozen contract after a Decision bump may pass `--write-lock` to refresh
 * contracts/freeze-lock.json. Worker PRs must never modify frozen contracts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, PALETTES, SIGNS, STD_VERBS } from '../packages/reader-core/src/index.ts';
import {
  checkGeometricInvariants,
  compileFlowSplitScene,
  compileMongeScene,
  compileReliefScene,
  GEOM_INVARIANT_CODES,
  validateXDDiscipline,
  XD_LAW_CODES
} from '../packages/scene-ir/src/index.ts';
import { SPECIMEN_ENTRIES } from '../packages/atlas/src/index.ts';
import {
  loadJson,
  sha256Normalized,
  validateDataMarksContract,
  validateFixtureProjection,
  validateFreezeLock,
  validateSceneContractSync,
  validateSceneShape,
  validateStdViewTokensContract
} from './contract-validators.mjs';

const ROOT = process.cwd();
const LOCK_PATH = path.join(ROOT, 'contracts', 'freeze-lock.json');

const FROZEN_FILES = [
  {
    path: 'contracts/cartouche-scene.v2.schema.json',
    contract_id: 'cartouche.scene-ir/2',
    decision: 'decisions/0002-cartouche-scene-ir-and-xd-discipline.md'
  },
  {
    path: 'contracts/data-marks.json',
    contract_id: 'cartouche.data-marks/1',
    decision: 'decisions/0004-swisstopo-oklch-palette-and-data-marks.md'
  },
  {
    path: 'contracts/server-projections.schema.json',
    contract_id: 'rezono.cartouche-projections/1',
    decision: 'decisions/0005-rezono-core-five-projections.md'
  },
  {
    path: 'contracts/std-view.v2.tokens.json',
    contract_id: 'rezono.std-view-tokens/2',
    decision: 'decisions/0004-swisstopo-oklch-palette-and-data-marks.md'
  },
  {
    path: 'contracts/rezono-pin.json',
    contract_id: 'rezono.core-pin/1',
    decision: 'decisions/0006-slip-conformance-boundary.md'
  }
];

if (process.argv.includes('--write-lock')) {
  const contracts = {};
  for (const item of FROZEN_FILES) {
    contracts[item.path] = {
      contract_id: item.contract_id,
      decision: item.decision,
      sha256: sha256Normalized(path.join(ROOT, item.path))
    };
  }
  const lockDoc = {
    lock_version: 'cartouche.freeze-lock/1',
    freeze_decision: 'decisions/0007-frozen-contracts-wave-0.md',
    frozen_before_wave: 'M1',
    normalization: 'lf-utf8-sha256',
    contracts
  };
  fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lockDoc, null, 2)}\n`, 'utf8');
  console.log(`🔒 Wrote contracts/freeze-lock.json (${FROZEN_FILES.length} frozen files pinned).`);
  process.exit(0);
}

const errors = [];

// 1. Verify freeze-lock SHA-256 digests
if (!fs.existsSync(LOCK_PATH)) {
  errors.push('Missing contracts/freeze-lock.json. Run planner lock generation first.');
} else {
  const lockObj = loadJson(ROOT, 'contracts/freeze-lock.json');
  errors.push(...validateFreezeLock(ROOT, lockObj));
}

// 2. Load the 4 frozen contracts
const sceneContract = loadJson(ROOT, 'contracts/cartouche-scene.v2.schema.json');
const marksContract = loadJson(ROOT, 'contracts/data-marks.json');
const projectionsContract = loadJson(ROOT, 'contracts/server-projections.schema.json');
const tokensContract = loadJson(ROOT, 'contracts/std-view.v2.tokens.json');

// 3. Cross-check TypeScript exports & invariants against frozen contracts
errors.push(
  ...validateStdViewTokensContract(tokensContract, { PALETTES, SIGNS, STD_VERBS }, SPECIMEN_ENTRIES),
  ...validateDataMarksContract(marksContract, tokensContract, DATA_MARKS),
  ...validateSceneContractSync(sceneContract, XD_LAW_CODES, GEOM_INVARIANT_CODES)
);

// 4. Validate ALL 8 golden fixtures against contracts/server-projections.schema.json
const fixtureDir = path.join(ROOT, 'fixtures');
const fixtureFiles = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json')).sort();
for (const file of fixtureFiles) {
  const fx = loadJson(ROOT, `fixtures/${file}`);
  errors.push(...validateFixtureProjection(fx, projectionsContract));
}

// 5. Validate compiled CartoucheScene v2 IR outputs against contracts/cartouche-scene.v2.schema.json
const compiledScenes = [
  compileFlowSplitScene(loadJson(ROOT, 'fixtures/01-platform-drift.json')),
  compileReliefScene(loadJson(ROOT, 'fixtures/04-subsidy-a001-a003.json')),
  compileMongeScene(loadJson(ROOT, 'fixtures/08-monge-4d-audit.json'))
];
for (const sc of compiledScenes) {
  errors.push(...validateSceneShape(sc, sceneContract));
  for (const v of validateXDDiscipline(sc)) errors.push(`[${v.code}] ${v.message}`);
  for (const g of checkGeometricInvariants(sc)) errors.push(`[${g.code}] ${g.message}`);
}

if (errors.length > 0) {
  console.error(`❌ contract-freeze-guard FAILED (${errors.length} violation(s)):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

console.log(
  `🔒 contract-freeze-guard passed (4 frozen contracts + pin locked via SHA-256, TS exports synced, ${fixtureFiles.length} golden fixtures & ${compiledScenes.length} CartoucheScene v2 outputs verified).`
);
