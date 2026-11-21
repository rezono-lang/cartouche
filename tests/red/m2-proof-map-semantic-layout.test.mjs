import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 1,
  summary: 'Proof map requirement 1, first item of M2: a semantic, deterministic layout, not force-directed: source packs are lanes (the colimit of sources is visible), depth follows derivation, same-name kinds from different sources stay distinct; first case the healthcare allowance recorded from the Rezono gate',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at'
  ]
};

// Decision 0012 §3a (proof map, requirement 1). After RDFox Explore and the Stardog Studio visual, done better: the
// layout says where a fact comes from and how far it is derived. First case: Rezono examples/zorgtoeslag-slice, whose
// source packs (person, civil, tax, insurer) form a colimit along Persoon (Rezono decisions/healthcare-allowance-three-sources.md).

test('M2 [proof-map-semantic-layout]: source packs are lanes, depth follows derivation, same-name kinds stay distinct, the layout is deterministic', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. First fixture: the healthcare allowance publication of Rezono examples/zorgtoeslag-slice, recorded from the Rezono gate in CI (as fixture 10 is), at the one Rezono pin; nothing written by hand. If the pin predates the slice, the pin bump is the slip-port work (#23 §3).',
      '2. Lanes: every source pack of the publication is one lane, in the order the publication imports them (for the first case civil registry, tax authority, insurer, with the shared kernel Persoon); derived kinds stand to the right of every lane they draw from. Each node carries the lane as data and its pack is named in the lane header.',
      '3. Depth: the x position of a derived node is one step right of its deepest premise, as the reader answers the derivation; facts sit at depth 0 in their lane.',
      '4. Same-name kinds stay distinct: civil.Partner and tax.Partner are two nodes in two lanes with their qualified names; nothing merges them, and toeslagpartner is a third, derived node.',
      '5. First case, as the owner saw it in the mockup: three source lanes, and toeslagpartner, toetsingsinkomen (joint_income in the slice) and zorgtoeslag (allowance) on the right. Names come from the recording.',
      '6. Deterministic: the same answers give byte-identical SVG and scene IR; no force simulation, no random seed, no wall clock. The geometry passes checkGeometricInvariants (no overlapping cards).',
      '7. Domain words stay in the fixture and MF2 messages; packages remain domain-free (scripts/leak-and-domain-check.mjs).'
    ].join('\n')
  );
});
