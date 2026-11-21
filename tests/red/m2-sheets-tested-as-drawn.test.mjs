import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 3,
  summary: '#46 point 15: every sheet and the specimen are tested as drawn in a real layout engine, not only on model coordinates; the specimen is a rendered page and counts no palettes',
  waits_on: [
    'devDependency:playwright',
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

// Decision 0015 §4, issue #46 point 15. Only the flow sheet is tested as drawn (its SVG). Monge is tested on model
// coordinates; the relief, Kringstand, ripple and bitemporal sheets are not tested as drawn at all. Their HTML and CSS
// layout cannot be measured in Happy-DOM, which has no layout engine. The specimen (packages/atlas/src/specimen.ts) is
// a static list whose coverage still counts palettes, and nothing renders it. A planner adds the layout engine
// (Chromium through playwright, a devDependency, Decision 0012 §9) and writes the assertions first (Decision 0015 §3).

test('M2 [sheets-tested-as-drawn]: every sheet and the specimen are checked as the browser draws them', () => {
  assert.fail(
    [
      'RED TASK (Decision 0015). Waits on the devDependency playwright and a planner PR. Acceptance, each point an assertion of the promoted test:',
      '1. Each of the six sheets renders in Chromium (playwright) at a fixed viewport, in the swisstopo, obsidian and forced palettes, from the same build output the viewer serves.',
      '2. The geometric invariants of Decision 0002 hold on drawn boxes (getBoundingClientRect, SVG getBBox): no overlapping sibling cards or labels, unique x and y on Monge planes II and III, two drift tracks each with its own proof link, no digit on an unknown mark.',
      '3. The Monge sheet is checked as drawn, not only through monge-model.ts coordinates.',
      '4. The specimen is a rendered page: every sign and state of the contract is drawn with the component the sheets use; its coverage check names signs and states and counts no palettes (specimen.ts:66).',
      '5. axe runs in the same engine with color-contrast deciding every text node, SVG text included (no "incomplete").'
    ].join('\n')
  );
});
