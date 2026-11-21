import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M4',
  decision: 'decisions/0011-quality-review-truth-and-guards.md',
  summary: 'Issue #23 §5 + §3: remove unused three/@threlte/core or build real 3D + align unbuilt claims, single PALETTES source in ripple-pixi.ts, remove domain words + CamelCase leak guard, Rezono MF2 i18n replacing English/snake_case, wire ReaderClient into a sheet + nightly-live.yml Rezono checkout',
  waits_on: ['m3-std-view-matches-rezono']
};

test('M4 [honest-claims-domain-and-i18n]: remove unused 3D deps/unbuilt claims, single palette in ripple-pixi.ts, domain-free packages + CamelCase guard, MF2 i18n messages, real ReaderClient sheet wiring, and nightly-live.yml Rezono checkout', () => {
  assert.fail(
    [
      'RED TASK (Decision 0011 / Issue #23 §5 + §3, waits on m3-std-view-matches-rezono):',
      '1. Remove unused three and @threlte/core dependencies (or build real 3D rendering) and align/remove unbuilt claims (breathing sheets, 60 fps, <250 ms, radial rings) from docs and README.',
      '2. Remove the duplicate hard-coded palette in packages/atlas/src/ripple-pixi.ts and consume canonical PALETTES from @rezono/reader-core.',
      '3. Remove domain words (compileSubsidyReliefScene, income_cell, assets_cell) from packages/ and update scripts/leak-and-domain-check.mjs to catch CamelCase domain identifiers.',
      '4. Replace hard-coded English sheet prose and raw snake_case reason codes with MF2 messages from Rezono.',
      '5. Wire ReaderClient / real gate output into at least one Atlas sheet (so ReaderClient is not used solely by its own unit test).',
      '6. Update .github/workflows/nightly-live.yml to check out the pinned Rezono commit and regenerate the fixture 10 transcript from Rezono.'
    ].join('\n')
  );
});
