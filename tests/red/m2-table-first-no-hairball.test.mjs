import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'No hairballs: every exploration view opens as a table, and a node-link graph shows only the distance-1 neighbours of one focused conclusion, each a link to its own slip',
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

// Decision 0012 §8, avoiding what users dislike in RDFox and Stardog explorers.

test('M2 [table-first-no-hairball]: table first; a graph only for distance-1 neighbours', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The key page, the slip answers and the question desk open on a table (table first in reading order, with th headers).',
      '2. Any view that draws connectors between nodes draws them only between the focused conclusion and its distance-1 neighbours as the reader answers them (grounds depth 1 or reach ring 1); a farther node appears only after it is focused itself.',
      '3. Each neighbour is a link to its slip (m1-mark-opens-slip) and to its own focus.',
      '4. Layered views that are tables in disguise (distance columns of sheet 04) are allowed and draw no connectors beyond ring 1.'
    ].join('\n')
  );
});
