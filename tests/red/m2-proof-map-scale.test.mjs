import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 9: scale without a hairball: start from a question or key, expand by why, depends on and affects, group by kind with published counts, level of detail and semantic zoom, WebGL only above a tested node count, smooth at 5000 nodes',
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

// Decision 0012 §3a (proof map, requirement 9). Stardog Explorer freezes at about 5000 nodes. The duplicate Pixi canvas
// is parked (§5); the map decides the single renderer: SVG below a tested node count, one WebGL renderer above it.
// Measuring frame time needs a layout engine in CI (the same devDependency as m1-contrast-wcag-aa).

test('M2 [proof-map-scale]: the map starts as an ego graph, grows on request, groups by kind and stays smooth at 5000 nodes', () => {
  assert.fail(
    [
      'RED TASK (Decision 0012). Acceptance, each point an assertion of the promoted test:',
      '1. The map opens from a declared question or a key as an ego graph (m2-table-first-no-hairball). Expansions are answers of declared Rezono questions: why and depends on go back (grounds), affects goes forward (reach, impact); each adds exactly the rows the answer holds.',
      '2. Above a threshold set in this test, rows of one kind collapse into a chip with the count the reader publishes, like the Stardog chips; opening a chip lists its rows as a table.',
      '3. Level of detail: zoomed out, cards show kind and state glyph only; zoomed in, slots and values; the step is by zoom level, not by a timer.',
      '4. Renderer: SVG up to a node count N chosen and recorded by this test; above N one WebGL renderer draws the same scene IR with the same palette tokens and the same data marks in its table twin. No second renderer below N.',
      '5. Performance budget: in headless Chromium on the CI runner, with a recorded or generated 5000-node scene, the 95th percentile frame time while panning and zooming is at most 16.7 ms, and the first render is under the budget this test records. The numbers are measured by this test, not claimed (m1-claims-match-build).'
    ].join('\n')
  );
});
