import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'The slip shows the proof as a shared DAG, not a repeated tree: the filled means sentence with its bindings, every premise once, the legal or vendor sources (@) as leaves and the checker seal; its premises equal the witness premises the Rezono gate serves (proof map requirement 4)',
  waits_on: []
};

// Decision 0012 §2 (3a) and §3a (proof map, requirement 4, folded into the drawer). After the RDFox three-pane Explain
// (proof tree, graph, rule with bindings), done better: RDFox repeats a premise under every path that reaches it; here
// the proof is one shared DAG, drawn table first. The tree is the Rezono grounds question (trace back, depth all).

test('M1 [slip-proof-tree]: the slip draws the proof as a shared DAG with the filled means sentence, its bindings, @ sources and the checker seal', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. Opening why on a derived line renders table[data-answer="grounds"] with th headers: one tr per node of the proof, each with data-relation, data-key, data-depth (0 for the conclusion) and data-polarity, in the order the reader answers.',
      '2. Shared DAG, not a repeated tree: a premise reached by two paths appears as one row (one relation and key, one row), and each of its parents links to that row (a[data-line]). The number of rows equals the number of distinct premises in the reader answer.',
      '3. Gate-driven: from recorded gate answers (fixtures/10-slip-reader-answers.json, and the healthcare allowance recording once m1-sheet-reads-gate-output has made it), the set of (relation, key, polarity) of the rows equals the premises of the witness the gate serves for that conclusion, transitively. Nothing is added or dropped by Cartouche.',
      '4. The conclusion row shows the rule sentence as Rezono fills it (the means text of the rule, filled by viewer/messages/src/fill.ts) and lists the bindings of the witness (variable = value, values as published); each variable links to the premise row it came from.',
      '5. Leaves are the sources: a base fact row carries its origin sign (origin_decision, origin_vendor, origin_design or origin_observation) with its glyph and the @ source of the rule or fact (for example awir#art-3) as the reader publishes it. No leaf is a derived row.',
      '6. The seal of the page lists the checker result for the witnesses on this slip ([data-part=seal] [data-check]) as the reader serves it; no seal is computed or injected by Cartouche (#23 §2 belongs to the slip-port work).',
      '7. Zero digits on unknown cells and the legend rules still hold.'
    ].join('\n')
  );
});
