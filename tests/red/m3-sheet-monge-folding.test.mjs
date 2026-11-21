import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0002-cartouche-scene-ir-and-xd-discipline.md',
  summary: 'Build Sheet 06 (Monge Orthographic Folding Atlas 0° flat <-> 90° 3D prism with orthogonal cobalt projection rays)',
  waits_on: ['m2-sheet-3d-swisstopo-relief', 'm1-sheet-split-curtain']
};

test('M3: Sheet 06 folds three hinged planes cleanly from 0° to 90° with zero X/Y collisions and live Monge projection rays', () => {
  assert.fail('RED TASK: implement packages/atlas/src/sheets/MongeFoldingSheet.svelte against fixtures/08-monge-4d-audit.json');
});
