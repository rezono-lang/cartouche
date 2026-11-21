import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../packages/reader-core/src/index.ts';
import { compileFlowSplitScene } from '../../packages/scene-ir/src/index.ts';

test('Role-safe zero-leak projection: tenant_a contains zero traces of restricted nodes and declares not_read_in_full', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures', '02-platform-tenant-a.json'), 'utf8')
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
