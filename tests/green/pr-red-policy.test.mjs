import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrPolicy } from '../../scripts/pr-red-policy.mjs';

test('PR red-policy blocks worker tampering with frozen contracts, red tests, or guard scripts', () => {
  const v1 = evaluatePrPolicy([{ status: 'M', path: 'contracts/std-view.v2.tokens.json' }], []);
  assert.ok(v1.some((e) => e.includes('Frozen contract')));

  const v2 = evaluatePrPolicy([{ status: 'M', path: 'tests/red/m1-reader-client.test.mjs' }], []);
  assert.ok(v2.some((e) => e.includes('cannot be added or weakened')));

  const v3 = evaluatePrPolicy([{ status: 'M', path: 'scripts/zero-compute-ast.mjs' }], []);
  assert.ok(v3.some((e) => e.includes('Protected guard/policy file')));

  const v4 = evaluatePrPolicy([{ status: 'D', path: 'tests/red/m1-reader-client.test.mjs' }], []);
  assert.ok(v4.some((e) => e.includes('without promoting it')));
});

test('PR red-policy permits valid worker promotion (red -> green + packages/) and planner label updates', () => {
  const workerPromotion = evaluatePrPolicy(
    [
      { status: 'A', path: 'packages/reader-core/src/client.ts' },
      { status: 'D', path: 'tests/red/m1-reader-client.test.mjs' },
      { status: 'A', path: 'tests/green/m1-reader-client.test.mjs' }
    ],
    []
  );
  assert.deepEqual(workerPromotion, []);

  const plannerUpdate = evaluatePrPolicy(
    [
      { status: 'M', path: 'contracts/data-marks.json' },
      { status: 'M', path: 'contracts/freeze-lock.json' },
      { status: 'A', path: 'tests/red/m2-new-task.test.mjs' }
    ],
    ['planner']
  );
  assert.deepEqual(plannerUpdate, []);
});
