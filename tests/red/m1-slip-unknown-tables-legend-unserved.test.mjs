import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0006-slip-conformance-boundary.md',
  summary: 'Slip conformance (3–5/7): unknown-shows-no-digit, tables-and-legend (th headers + complete data-sign coverage), and unserved-publication ([data-part=unserved] & seal checks)',
  waits_on: ['m1-slip-svelte-component']
};

test('M1 conformance [unknown-shows-no-digit]: non-known td[data-part=value] carries data-state, data-reason, a [data-sign] mark, and zero ASCII digits', () => {
  assert.fail(
    'RED TASK: verify non-known cells emit td[data-part=value][data-state][data-reason] + [data-sign] and fail if /[0-9]/ appears in cell text'
  );
});

test('M1 conformance [tables-and-legend]: every table has th headers and table[data-part=legend] lists a tr[data-sign] for every drawn [data-sign]', () => {
  assert.fail(
    'RED TASK: verify table[data-sheet=slip], every table[data-answer], and table[data-part=legend] have th headers and 100% drawn-sign coverage'
  );
});

test('M1 conformance [unserved-publication]: served page renders [data-part=seal] checks (reader-hashes, publisher-record); refused store renders [data-part=unserved] and zero tr[data-line]', () => {
  assert.fail(
    'RED TASK: verify [data-part=seal] [data-check] on served store and [data-part=unserved] with 0 tr[data-line] on tampered/refused or 410 store (fixtures/07-unserved-410.json)'
  );
});
