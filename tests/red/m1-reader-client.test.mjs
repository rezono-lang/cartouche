import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0006-slip-conformance-boundary.md',
  summary: 'Build domain-neutral Rezono ReaderClient in packages/reader-core/src/client.ts (head, role bundle, grounds/reach/sweep/scenario, 404/501 unanswered, 410 unserved)',
  waits_on: []
};

test('M1: ReaderClient queries head, role-scoped bundle, and ask endpoints, maps 404/501 to unanswered and 410 to unserved', () => {
  assert.fail(
    'RED TASK: implement packages/reader-core/src/client.ts supporting both fetch transport and in-process handler injection with SHA-256 verification and unserved 410 handling (fixtures/07-unserved-410.json & fixtures/09-slip-conformance.json)'
  );
});
