import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 4: selecting a conclusion highlights its whole witness in the same map as a shared DAG of all ancestors, equal to the witness premises the Rezono gate serves, with the slip as side panel (means sentence, bindings, @ sources)',
  waits_on: [
    'planner:assertions',
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed',
    'm2-proof-map-semantic-layout'
  ]
};

// Decision 0012 §3a (proof map, requirement 4). The drawer part (sentence, bindings, sources, shared DAG) is
// m1-slip-proof-tree; this test is the map part. RDFox Explain repeats the tree endlessly; here every ancestor is
// highlighted once, in place.

test('M2 [proof-map-proof-in-place]: a selected conclusion highlights its whole witness in place and opens the slip beside it', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Selecting a conclusion marks it and every ancestor of its witness (transitively) as selected, in the same map, each node and edge once; nodes outside the witness are dimmed but stay readable.',
      '2. Gate-driven: from the recorded healthcare allowance answers, the set of highlighted (relation, key) equals the transitive premises of the witness the gate serves for that conclusion; an expansion beyond the ego graph is added for this, by the reader answer, not by client graph search.',
      '3. The side panel is the slip of that conclusion (m1-slip-proof-tree): the filled means sentence with its bindings and the @ sources; selecting a row in the panel selects the same node in the map, and the reverse.',
      '4. With several witnesses (m1-slip-all-witnesses) the panel switches between them and the highlight follows.'
    ].join('\n')
  );
});
