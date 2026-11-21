import test from 'node:test';
import assert from 'node:assert/strict';
import { auditA11y } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 2,
  summary: 'N6 (#46 point 17): the contrast audit decides SVG text by its fill, reads @media screen rules, and counts opacity; low-contrast text of each kind is a color-contrast violation',
  waits_on: []
};

// Decision 0015 §2 N6, issue #46 point 17. The contrast checker of #44 (auditDomColorContrast in
// scripts/svelte-test-harness.mjs) skips every <svg> subtree, reads only CSS color and background, drops every @ block
// and ignores opacity. Most sheet text is SVG text coloured by fill (flow-split-svg.ts draws its labels that way), so
// m1-contrast-wcag-aa passes without seeing it. Either fix holds: decide these cases in the harness, or run axe in a real
// layout engine (a planner adds the devDependency, Decision 0012 §9). Ratios are hand-checked against white
// (WCAG 2.1 relative luminance): #aaaaaa 2.32:1; #595959 7.00:1, at opacity 0.5 over white #acacac 2.27:1.

const CASES = [
  {
    name: 'SVG text coloured by its fill attribute',
    html: '<svg viewBox="0 0 120 20" width="120" height="20"><text x="0" y="14" fill="#aaaaaa" data-probe="low">faint label</text></svg>'
  },
  {
    name: 'SVG text coloured by a CSS fill rule',
    html: '<style>.lbl { fill: #aaaaaa; }</style><svg viewBox="0 0 120 20" width="120" height="20"><text class="lbl" x="0" y="14" data-probe="low">faint label</text></svg>'
  },
  {
    name: 'text coloured inside an @media screen block',
    html: '<style>@media screen { .faint { color: #aaaaaa; } }</style><p class="faint" data-probe="low">faint text</p>'
  },
  {
    name: 'text made faint by opacity',
    html: '<p style="color: #595959; opacity: 0.5" data-probe="low">faint text</p>'
  }
];

for (const c of CASES) {
  test(`M1 [contrast-reads-svg-fill]: ${c.name} below 4.5:1 is a violation`, async () => {
    const violations = await auditA11y(c.html);
    const contrast = violations.filter((v) => v.id === 'color-contrast' && (v.nodes ?? []).some((n) => (n.html ?? '').includes('data-probe="low"')));
    assert.ok(contrast.length > 0, `the contrast audit passes ${c.name} at about 2.3:1 (#46 point 17)`);
  });
}

test('M1 [contrast-reads-svg-fill]: control: dark SVG text passes', async () => {
  const violations = await auditA11y('<svg viewBox="0 0 120 20" width="120" height="20"><text x="0" y="14" fill="#000000">ink label</text></svg>');
  assert.deepEqual(violations.filter((v) => v.id === 'color-contrast'), []);
});
