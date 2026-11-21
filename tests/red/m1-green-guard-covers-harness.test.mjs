import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrPolicy } from '../../scripts/pr-red-policy.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0014-quality-round-3.md',
  priority: 2,
  summary: '#46 point 17: the PR guard protects what the tests stand on: the test harness and tests/support, the domain check, fast-check, package.json and the lockfile need the planner label',
  waits_on: []
};

// Decision 0014 §4 and §7, issue #46 point 17. scripts/pr-red-policy.mjs guards red tests, merged green tests, contracts
// and the lint scripts, but not the files the tests stand on: a worker PR can loosen the test harness (where the
// contrast checker lives), the domain check, the fast-check step list or the dependencies without the planner label.
// That the label is set by the same account is an owner decision, not a test (Decision 0014 §8).

const NOW_UNGUARDED = [
  'scripts/svelte-test-harness.mjs',
  'tests/support/answers-gap.mjs',
  'scripts/leak-and-domain-check.mjs',
  'scripts/fast-check.mjs',
  'package.json',
  'package-lock.json'
];

for (const file of NOW_UNGUARDED) {
  test(`M1 [green-guard-covers-harness]: changing ${file} needs the planner label`, () => {
    for (const status of ['M', 'D']) {
      assert.notDeepEqual(
        evaluatePrPolicy([{ status, path: file }], []),
        [],
        `a worker PR may ${status === 'M' ? 'modify' : 'delete'} ${file} without the planner label (#46 point 17)`
      );
    }
    assert.deepEqual(evaluatePrPolicy([{ status: 'M', path: file }], ['planner']), [], 'a planner PR may change it');
  });
}
