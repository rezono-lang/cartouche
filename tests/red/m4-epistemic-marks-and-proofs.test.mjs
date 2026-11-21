import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M4',
  decision: 'decisions/0011-quality-review-truth-and-guards.md',
  summary: 'Issue #23 §1: absent never valid-green on Monge, unknown hatched band with no height on Sheet 05, invalid (!) drawn on every sheet + specimen, zero borrowed proofs, renderFigure contract signs, unified stated/observed line style, honest README proof claim',
  waits_on: []
};

test('M4 [epistemic-marks-and-proofs]: absent never takes valid colour, unknown encodes no height/magnitude, invalid (!) renders on every sheet + specimen, zero borrowed proofs, contract-aligned renderFigure signs, unified stated/observed lines, honest README proof claim', () => {
  assert.fail(
    [
      'RED TASK (Decision 0011 / Issue #23 §1):',
      '1. Monge absent round dots must render as absent (⦸) and never fill with the valid green token.',
      '2. Sheet 05 (BitemporalStairSheet / bitemporal-model.ts) must draw unknown as a hatched band with no height/magnitude (never z=1 taller than known values), with a test asserting no unknown mark carries a size.',
      '3. Every sheet (including BitemporalStairSheet) must render invalid (!) without throwing, and packages/atlas/src/specimen.ts must include invalid.',
      '4. Zero borrowed proofs: drift edges must not fall back to stated_proof_ref, live rounds must not borrow their first change proof_ref, and Monge round dots must not reuse the service proof_ref (carry own witness ref or render explicitly as "no proof"; assert no mark reuses another mark ref).',
      '5. README proof-verification honesty: either verify manifest/witness hashes through Rezono reader or drop the unverified "cryptographic proof per mark" claim from README.md.',
      '6. Align packages/reader-core/src/figure.ts renderFigure signs with std-view contract (remove non-contract "hatch" and "replaced" sign values).',
      '7. Unify stated vs observed line convention (solid vs dashed) across Sheet 02 (FlowSplitSheet) and Sheet 06 (MongeFoldingSheet).'
    ].join('\n')
  );
});
