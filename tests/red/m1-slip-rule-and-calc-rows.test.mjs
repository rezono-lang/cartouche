import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0006-slip-conformance-boundary.md',
  summary: 'Slip conformance (1–2/7): slip-rule-row (home claim, a[data-line] links, grounds order, aggregate total) & slip-calculated-row (CalcWitness paths, constants omitted)',
  waits_on: ['m1-slip-svelte-component']
};

test('M1 conformance [slip-rule-row]: renders home claim sentence with a[data-line] links, exact grounds distance-1 order, polarity/depth, and aggregate tr[data-part=total] before depth-1 contributors', () => {
  assert.fail(
    'RED TASK: implement packages/slip/bin/render.ts and verify table[data-sheet=slip], [data-part=sentence] a[data-line], tr[data-line][data-relation][data-key][data-polarity][data-depth], and tr[data-line][data-part=total] ordering'
  );
});

test('M1 conformance [slip-calculated-row]: renders CalcWitness steps with data-path and data-depth in published order and emits no line for constant arguments', () => {
  assert.fail(
    'RED TASK: render calculated row CalcWitness steps in packages/slip/ with tr[data-path][data-depth] and verify constants produce no tr[data-path]'
  );
});
