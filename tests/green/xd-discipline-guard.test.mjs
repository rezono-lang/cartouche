import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileSubsidyReliefScene, validateXDDiscipline } from '../../packages/scene-ir/src/index.ts';

test('xD-Discipline Guard accepts valid orthographic 3D relief with hatched unknown curtain', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures', '04-subsidy-a001-a003.json'), 'utf8')
  );
  const scene = compileSubsidyReliefScene(fx);
  assert.deepEqual(validateXDDiscipline(scene), []);
});

test('xD-Discipline Guard rejects perspective 3D, nominal Z height, and unknown at z=0', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures', '04-subsidy-a001-a003.json'), 'utf8')
  );
  const validScene = compileSubsidyReliefScene(fx);

  const badScene = {
    ...validScene,
    projection: 'perspective',
    axes: [
      validScene.axes[0],
      validScene.axes[1],
      { axis: 'z', dim: 'D1', kind: 'nominal', label: 'Service ID' }
    ],
    unknownManifolds: []
  };

  const codes = validateXDDiscipline(badScene).map((v) => v.code);
  assert.ok(codes.includes('XD_NO_PERSPECTIVE'));
  assert.ok(codes.includes('XD_NOMINAL_Z_FORBIDDEN'));
  assert.ok(codes.includes('XD_UNKNOWN_AT_ZERO_FORBIDDEN'));
});
