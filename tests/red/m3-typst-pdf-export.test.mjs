import test from 'node:test';
import assert from 'node:assert/strict';

export const RED_META = {
  milestone: 'M3',
  decision: 'decisions/0003-atlas-six-sheets-and-slip-backbone.md',
  summary: 'Add Typst (Apache-2.0) compiler backend from CartoucheScene v2 IR to print-grade vector PDF dossiers with Cartouche seal',
  waits_on: ['m1-sheet-split-curtain', 'm2-sheet-3d-swisstopo-relief']
};

test('M3: CartoucheScene IR exports deterministic Typst source & vector PDF carrying identical manifest seal and legend', () => {
  assert.fail('RED TASK: implement packages/scene-ir/src/typst-export.ts (Apache-2.0) verified against golden fixtures');
});
