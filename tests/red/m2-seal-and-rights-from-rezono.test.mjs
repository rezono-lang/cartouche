import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0014-quality-round-3.md',
  priority: 3,
  summary: 'Once Rezono serves them (rezono-lang/rezono#1451): the seal shows the served trust tier, Propose unlocks only on the served right, a sealed round enters only as served, reader-hashes and origin signs quote the reader',
  waits_on: [
    'rezono-lang/rezono#1451',
    'planner:assertions',
    'm1-contrast-reads-svg-fill',
    'm1-green-guard-covers-harness',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-injected-seal-checks',
    'm1-origin-signs-and-bindings-from-reader',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-seal-checks-only-as-served',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-refuses-request-model',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-no-browser-seal',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0014 §6, issue #46 points 4, 5, 6 and 7. The M1 tests hold the interim: Propose locked and "not served",
// reader-hashes unavailable, no origin sign, no guessed field read. This task is the positive direction, once Rezono
// serves the fields. A planner first records /slip/head and the grounds answers at the pin that serves them and
// replaces this list with executable assertions (Decision 0014 §3); the worker then makes them pass.

test('M2 [seal-and-rights-from-rezono]: the seal and the right to propose come from what Rezono serves', () => {
  assert.fail(
    [
      'RED TASK (Decision 0014). Waits on rezono-lang/rezono#1451 and a planner PR. Acceptance, each point an assertion of the promoted test:',
      '1. With /slip/head recorded at a pin that serves the trust tier (rezono#1451 item 1), the seal states exactly the served tier under the name Rezono uses, for every store and role in the recording; a head without it states none.',
      '2. Propose unlocks only when the recorded head says this role may propose (rezono#1451 item 2) and the served tier is not the live engine; otherwise it stays locked with the served reason, or propose_locked_not_served. No Cartouche code (DeltaStore, render.ts, KringstandSheet.svelte, the viewer) derives the right.',
      "3. DeltaStore.ingestSealedSnapshot, or what replaces it, accepts a sealed round only as the reader served it (rezono#1451 item 1); a caller-built ManifestMeta with trust_tier 'sealed' is refused (#46 point 7).",
      '4. The seal shows the reader hash check per witness as served (rezono#1451 item 3); a witness without a served check reads unavailable; reader-hashes is never green by inference.',
      '5. Every leaf row shows the origin sign the reader serves for its source (rezono#1451 item 4), and a source without a served sign shows none.',
      '6. The recording is made by the CI recorder at the one pin (contracts/rezono-pin.json), like fixture 10; m1-reads-only-served-head-fields is re-planned with the served names in the same planner PR.'
    ].join('\n')
  );
});
