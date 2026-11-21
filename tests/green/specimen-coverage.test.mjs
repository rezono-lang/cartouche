import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS } from '../../packages/reader-core/src/index.ts';
import {
  REQUIRED_EPISTEMIC_STATES,
  REQUIRED_PALETTES,
  SPECIMEN_ENTRIES,
  renderSpecimenHtml,
  verifySpecimenCoverage
} from '../../packages/atlas/src/specimen.ts';

test('Specimen coverage verifies every std-view sign and every epistemic state including invalid (!)', () => {
  const report = verifySpecimenCoverage();
  assert.equal(report.ok, true);
  assert.deepEqual(report.missingTokens, []);
  assert.deepEqual(report.missingSigns, []);
  assert.deepEqual(report.missingStates, []);
  assert.deepEqual(report.missingRenderedEntries, []);

  for (const palette of REQUIRED_PALETTES) {
    const html = renderSpecimenHtml(palette);
    assert.ok(html.includes(`data-specimen-theme="${palette}"`), `rendered specimen missing theme ${palette}`);
    assert.ok(html.includes('data-entry="state:invalid"'), `rendered specimen missing invalid sign on ${palette}`);
  }

  const coveredNames = new Set(
    SPECIMEN_ENTRIES.filter((e) => e.kind !== 'trust_tier').map((e) => e.dataEntry.split(':')[1])
  );
  for (const sign of Object.keys(SIGNS)) {
    assert.ok(coveredNames.has(sign), `SPECIMEN_ENTRIES missing std-view sign "${sign}"`);
  }

  for (const state of REQUIRED_EPISTEMIC_STATES) {
    const entry = SPECIMEN_ENTRIES.find((e) => e.dataEntry === `state:${state}`);
    assert.ok(entry, `SPECIMEN_ENTRIES missing epistemic state "${state}"`);
  }

  const invalidEntry = SPECIMEN_ENTRIES.find((e) => e.dataEntry === 'state:invalid');
  assert.equal(invalidEntry?.glyph, '!');
});
