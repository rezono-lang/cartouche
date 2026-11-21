import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0006-slip-conformance-boundary.md',
  summary: 'Slip conformance (6/7): verbs-that-answer — dynamic std-view verb visibility, table[data-answer] opening, and zero page code change when reader adds a question',
  waits_on: ['m1-slip-svelte-component']
};

test('M1 conformance [verbs-that-answer]: shows button[data-verb][data-key] strictly when reader answers that verb, opens table[data-answer] with th headers, and auto-surfaces new reader questions with identical built files hash', () => {
  assert.fail(
    'RED TASK: drive packages/slip/bin/render.ts with plain vs extended reader capability (e.g. adding gap/missing) and assert button[data-verb][data-key], table[data-answer] th, and identical built files sha256 map'
  );
});
