import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, canonicalJson } from '../../packages/reader-core/src/index.ts';
import { compileBitemporalScene } from '../../packages/scene-ir/src/compile-bitemporal.ts';
import { buildBitemporalFixtureFromGateAnswers } from '../../packages/atlas/src/bitemporal-gate.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0015-quality-round-3.md',
  priority: 3,
  summary: '#46 point 14: the role zero-leak test renders a restricted role from the gate output recorded for that role, not from a fixture the test filters itself',
  waits_on: [
    'm1-green-guard-covers-harness',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0015 §4, issue #46 point 14: the role zero-leak test renders a restricted role from the
// gate output recorded for that role at contracts/rezono-pin.json, not from a hand-written fixture.

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'BitemporalStairSheet.svelte');
const PIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
const RECORDING = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'fixtures', '11-zorgtoeslag-bitemporal-gate-answers.json'), 'utf8')
);
const M = DATA_MARKS;
const PACK = 'zorgtoeslag-slice';

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function restrictedOnlyRecording(fullRecording) {
  return {
    fixture_id: fullRecording.fixture_id,
    manifest: fullRecording.manifest,
    source: fullRecording.source,
    epochs: fullRecording.epochs,
    reader_answers: {
      limited: fullRecording.reader_answers.limited
    }
  };
}

test('M2 [role-leak-on-reader-output]: fixture 11 records complete and restricted roles at the pinned Rezono commit', () => {
  assert.equal(RECORDING.source.commit, PIN.pinned_commit, 'fixture 11 must match contracts/rezono-pin.json');
  assert.ok(RECORDING.reader_answers.checker, 'complete role (checker) recording must exist');
  assert.ok(RECORDING.reader_answers.limited, 'restricted role (limited) recording must exist');

  const checkerHead = RECORDING.reader_answers.checker[`/${PACK}/head`];
  const limitedHead = RECORDING.reader_answers.limited[`/${PACK}/head`];
  assert.equal(checkerHead?.status, 200);
  assert.equal(limitedHead?.status, 200);

  const checkerHh = checkerHead.body.snapshots.find((s) => s.relation === 'household');
  const limitedHh = limitedHead.body.snapshots.find((s) => s.relation === 'household');
  assert.equal(checkerHh?.full, true, 'complete role reads household in full');
  assert.equal(limitedHh?.full, false, 'restricted role marks household full=false');
});

test('M2 [role-leak-on-reader-output]: restricted page renders only from restricted recording with zero complete-only leaks and honest horizon', async () => {
  const checkerRowsHh = RECORDING.reader_answers.checker[`/${PACK}/m-4/rows/household`].body.rows;
  const limitedRowsHh = RECORDING.reader_answers.limited[`/${PACK}/m-4/rows/household`].body.rows;
  const visibleSubjects = new Set(limitedRowsHh.map((r) => String(r.key[0])));
  const hiddenSubjects = checkerRowsHh
    .map((r) => String(r.key[0]))
    .filter((id) => !visibleSubjects.has(id));
  assert.ok(hiddenSubjects.length > 0, 'complete role must contain subjects hidden from restricted role');

  const checkerRels = new Set(RECORDING.reader_answers.checker[`/${PACK}/bundle`].body.relations.map((r) => r.id));
  const limitedRels = new Set(RECORDING.reader_answers.limited[`/${PACK}/bundle`].body.relations.map((r) => r.id));
  const hiddenRelations = [...checkerRels].filter((id) => !limitedRels.has(id));
  assert.ok(hiddenRelations.includes('calc__allowance'), 'complete-only calc__allowance must be absent from restricted bundle');

  const checkerAllowanceRows = RECORDING.reader_answers.checker[`/${PACK}/m-4/rows/calc__allowance`].body.rows;
  const hiddenValues = [
    ...new Set(
      checkerAllowanceRows
        .map((r) => String(r.key[1] ?? ''))
        .filter((v) => v.length >= 4 && v !== '0')
    )
  ];
  assert.ok(hiddenValues.length > 0, 'complete role must contain complete-only allowance displays');

  // Render strictly from the restricted-only recording (zero access to checker answers).
  const onlyLimited = restrictedOnlyRecording(RECORDING);
  let limitedFx;
  try {
    limitedFx = buildBitemporalFixtureFromGateAnswers(onlyLimited, {
      pack: PACK,
      role: 'limited',
      subjectId: 'ann',
      validTime: '2026-01-01',
      relation: 'household__joint_income'
    });
  } catch (err) {
    assert.fail(`buildBitemporalFixtureFromGateAnswers must support restricted role projection: ${err.message}`);
  }

  const scene = compileBitemporalScene(limitedFx);
  const sceneJson = canonicalJson(scene);
  const { html: html2d } = await renderSvelte(SHEET, { fixture: limitedFx, view: '2d', lang: 'en' });
  const { html: html3d } = await renderSvelte(SHEET, { fixture: limitedFx, view: 'orthographic', lang: 'en' });

  assert.equal(scene.seal.role, 'limited');
  assert.equal(scene.horizon.complete, false);
  assert.equal(scene.horizon.reason, 'not_read_in_full');
  assert.equal(scene.nodes.length, 1, 'restricted scene must draw only visible cells (zero placeholders)');

  // Hashed state must be independent of complete-only data.
  const altComplete = structuredClone(RECORDING);
  altComplete.reader_answers.checker[`/${PACK}/m-4/rows/calc__allowance`].body.rows = [];
  const limitedFxFromAlt = buildBitemporalFixtureFromGateAnswers(restrictedOnlyRecording(altComplete), {
    pack: PACK,
    role: 'limited',
    subjectId: 'ann',
    validTime: '2026-01-01',
    relation: 'household__joint_income'
  });
  assert.equal(
    sha256(canonicalJson(compileBitemporalScene(limitedFxFromAlt))),
    sha256(sceneJson),
    'restricted hashed state must depend solely on the restricted recording'
  );

  // Every complete-only relation, key, and value must be absent from scene IR, SVG, DOM, and table twin.
  const forbiddenTokens = [...hiddenRelations, ...hiddenSubjects, ...hiddenValues];
  for (const token of forbiddenTokens) {
    assert.equal(sceneJson.includes(token), false, `complete-only token "${token}" leaked into restricted scene IR`);
    assert.equal(html2d.includes(token), false, `complete-only token "${token}" leaked into restricted 2D DOM`);
    assert.equal(html3d.includes(token), false, `complete-only token "${token}" leaked into restricted 3D SVG/twin`);
  }

  // Verify horizon notice, zero lock icons, zero placeholders, zero hidden counts, and WCAG 2.1 AA.
  for (const html of [html2d, html3d]) {
    const { window, document } = parseHtml(html);
    try {
      const horizons = [...document.querySelectorAll(`[${M.part}="horizon"]`)];
      assert.equal(horizons.length, 1, 'restricted sheet must emit exactly one horizon notice');
      assert.equal(horizons[0].getAttribute(M.reason), 'not_read_in_full');
      const noticeText = horizons[0].textContent?.trim() ?? '';
      assert.ok(noticeText.length > 0 && !noticeText.includes('not_read_in_full'), 'horizon text must be localized, not raw code');
      assert.equal(/\d/.test(noticeText), false, 'horizon notice must never leak hidden counts');
      assert.equal(html.includes('🔒'), false, 'restricted page must never render a lock icon');
      assert.equal(/placeholder|hidden|redacted|locked/i.test(noticeText), false, 'horizon notice must not use placeholder/lock wording');
    } finally {
      await window.happyDOM.close();
    }
    assert.deepEqual(await auditA11y(html), []);
  }

  // Requesting the withheld relation (calc__allowance) from the restricted recording produces zero cells and zero leaks.
  const withheldFx = buildBitemporalFixtureFromGateAnswers(onlyLimited, {
    pack: PACK,
    role: 'limited',
    subjectId: 'ann',
    validTime: '2026-01-01',
    relation: 'calc__allowance'
  });
  const withheldScene = compileBitemporalScene(withheldFx);
  assert.equal(withheldScene.nodes.length, 0);
  assert.equal(withheldScene.horizon.complete, false);
  assert.equal(withheldScene.horizon.reason, 'not_read_in_full');
});
