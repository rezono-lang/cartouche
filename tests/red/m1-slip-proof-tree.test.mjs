import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'The slip shows the proof as a tree: the filled means sentence of the rule, the premises nested by depth down to the legal or vendor sources (@) as leaves, and the seal of the Rezono checker',
  waits_on: []
};

// Decision 0012 §2 (3a), after the RDFox three-pane Explain (proof tree, graph, rule with bindings), done as a table.
// The tree is Rezono's grounds question (std-explain: trace back, depth all), drawn table first.

test('M1 [slip-proof-tree]: the slip draws the proof tree with the means sentence, @ sources as leaves and the checker seal', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Opening why on a derived line renders table[data-answer="grounds"] with th headers, one tr per node of the proof in the order the reader answers, each with data-relation, data-key, data-depth (0 for the conclusion) and data-polarity.',
      '2. The conclusion row shows the rule sentence as Rezono fills it (the means text of the rule, filled by viewer/messages/src/fill.ts with the bindings of the witness); each variable links (a[data-line]) to the premise row it came from.',
      '3. Leaves are the sources: a base fact row carries its origin sign (origin_decision, origin_vendor, origin_design or origin_observation) and the @ source of the rule or fact (for example policy#art-3) as the reader publishes it. No leaf is a derived row.',
      '4. The seal of the page lists the checker result for the witnesses on this slip ([data-part=seal] [data-check]) as the reader serves it; no seal is computed or injected by Cartouche (#23 §2 belongs to the slip-port work).',
      '5. Tested against recorded reader answers for a conclusion of depth at least 2 with at least one @ source. Zero digits on unknown cells and the legend rules still hold.'
    ].join('\n')
  );
});
