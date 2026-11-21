import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 3,
  summary: '#46 point 14: the role zero-leak test renders a restricted role from the gate output recorded for that role, not from a fixture the test filters itself',
  waits_on: [
    'planner:assertions',
    'm1-green-guard-covers-harness',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0015 §4, issue #46 point 14. tests/green/role-zero-leak.test.mjs (second test) filtered the hidden nodes out
// of fixture 01 inside the test; #53 reads the hand-written fixture 02 instead. Both are Cartouche's own projection of
// a role, not Rezono's (Decision 0011 §2); the real check needs the gate's output for two roles, which
// m1-sheet-reads-gate-output records first. The fixture-10 case of that file is already a real check and stays. The
// other half of point 14, m2-slip-sweep-stops-and-fold feeding in the stops it checks, was fixed by #53.

test('M2 [role-leak-on-reader-output]: a restricted role renders only what the gate served it', () => {
  assert.fail(
    [
      'RED TASK (Decision 0015). Waits on the gate recording and a planner PR. Acceptance, each point an assertion of the promoted test:',
      '1. The gate output for the sheet of m1-sheet-reads-gate-output is recorded for a complete role and a restricted role at the pinned commit, by the CI recorder.',
      '2. The restricted page is rendered from the restricted recording only. Every relation, key, label and value that only the complete recording holds is absent from its scene IR, SVG, DOM, table twin and hashed state.',
      '3. The page shows no placeholder, lock icon or count for what is hidden; the horizon reads not_read_in_full as the reader serves it (AGENTS rule 6).',
      '4. The hand-written projection in tests/green/role-zero-leak.test.mjs (fixture 02 as the tenant_a role) is replaced by this check in the same planner PR; no assertion of that file is dropped without its replacement here.'
    ].join('\n')
  );
});
