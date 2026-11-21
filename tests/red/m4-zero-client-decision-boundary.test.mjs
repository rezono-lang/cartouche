import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M4',
  decision: 'decisions/0011-quality-review-truth-and-guards.md',
  summary: 'Issue #23 §2 + §1 retractions: Kringstand applies +1/-1 weights via DeltaStore, remove DeltaStore.sealProvisionalAsRound, renderFromReader reads trustTier/canPropose from reader, remove client role===summary projection & caller-injected seal bypass, audit model.ts computations',
  waits_on: []
};

test('M4 [zero-client-decision-boundary]: Kringstand retractions remove rows via DeltaStore, no client self-sealing, reader-owned trustTier/canPropose/seal/role projection, and model.ts computation disposition', () => {
  assert.fail(
    [
      'RED TASK (Decision 0011 / Issue #23 §2 + §1 retractions):',
      '1. KringstandSheet must apply live +1/-1 Z-set weights through DeltaStore so a weight=-1 retraction removes the row instead of rendering it as a row.',
      '2. Remove DeltaStore.sealProvisionalAsRound (only Rezono seals a round; client must never promote provisional rows to sealed).',
      '3. renderFromReader must obtain trustTier and canPropose from the reader (head, seal, rights) instead of hard-coding trustTier: "sealed" and deriving canPropose client-side.',
      '4. Remove fixture/client-side role === "summary" stop selection (role projection belongs exclusively to Rezono).',
      '5. Remove caller-injected seal and sealChecks bypasses so seals come exclusively from the reader.',
      '6. Audit and record disposition of every computation listed in packages/slip/src/model.ts header (move each to Rezono gate/publisher or build-time scene compiler and document which).'
    ].join('\n')
  );
});
