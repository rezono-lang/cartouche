import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, canonicalJson } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 6: switching the role lens shows exactly what that role may read; a hidden premise reads not readable for your role and the conclusion says n premises hidden as the reader publishes it, never a silent omission',
  waits_on: [
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

// Decision 0012 §3a (proof map, requirement 6). RDFox omits what a role may not read without a word. The count of
// hidden premises comes from the reader (AGENTS.md rule 6: Cartouche counts no hidden rows itself).

const ROOT = process.cwd();
const FIXTURE_12 = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const M = DATA_MARKS;
const PACK = 'zorgtoeslag-slice';

function loadFixture12() {
  return JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
}

function onlyRole(fx, role) {
  return {
    ...fx,
    reader_answers: { [role]: fx.reader_answers[role] }
  };
}

test('M2 [proof-map-role-lens] 1 & 2: role lens offers only reader-served roles and drawn nodes match each role exactly', () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const checkerLayout = atlas.compileProofMapLayout(fx, { role: 'checker' });
  const limitedLayout = atlas.compileProofMapLayout(onlyRole(fx, 'limited'), { role: 'limited' });

  // Role lens offers only roles present in the reader answers, never unserved roles.
  const servedRoles = Object.keys(fx.reader_answers).sort();
  assert.deepEqual(
    [...(checkerLayout.availableRoles ?? [])].sort(),
    servedRoles,
    'Role lens must offer only the roles the reader serves.'
  );

  // Drawn nodes for each role match only the kinds/relations served in that role's /bundle.
  const limitedBundle = fx.reader_answers.limited[`/${PACK}/bundle`].body;
  const limitedAllowedIds = new Set([
    ...(limitedBundle.kinds ?? []).map((k) => k.id),
    ...(limitedBundle.relations ?? []).map((r) => r.id)
  ]);
  for (const node of limitedLayout.nodes) {
    assert.ok(
      limitedAllowedIds.has(node.id),
      `Restricted role drew node "${node.id}" not present in limited /bundle.`
    );
  }
  assert.ok(
    checkerLayout.nodes.some((n) => n.id === 'calc__allowance'),
    'Complete role (checker) must include calc__allowance.'
  );
  assert.equal(
    limitedLayout.nodes.some((n) => n.id === 'calc__allowance'),
    false,
    'Restricted role (limited) must not include withheld calc__allowance.'
  );
});

test('M2 [proof-map-role-lens] 3: hidden premise notice is localized MF2 without placeholders/locks, and hidden count renders only when published by reader', async () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const limitedLayout = atlas.compileProofMapLayout(onlyRole(fx, 'limited'), { role: 'limited', lang: 'en' });
  assert.equal(limitedLayout.scene.horizon.complete, false, 'Restricted role scene horizon must be incomplete.');
  assert.equal(limitedLayout.scene.horizon.reason, 'not_read_in_full');

  const html = limitedLayout.html ?? limitedLayout.svg;
  const { window, document } = parseHtml(html);
  try {
    const horizons = [...document.querySelectorAll(`[${M.part}="horizon"]`)];
    assert.equal(horizons.length, 1, 'Restricted proof map must render exactly one horizon omission notice.');
    assert.equal(horizons[0].getAttribute(M.reason), 'not_read_in_full');
    const text = horizons[0].textContent?.trim() ?? '';
    assert.ok(text.length > 0 && !text.includes('not_read_in_full'), 'Horizon notice must be localized MF2, never raw snake_case.');
    assert.equal(/\d/.test(text), false, 'Without a reader-published hidden count, horizon notice must leak zero digits.');
    assert.equal(html.includes('🔒'), false, 'Restricted map must render zero lock icons.');
    assert.equal(/placeholder/i.test(text), false, 'Restricted map must render zero per-row placeholders.');
  } finally {
    await window.happyDOM.close();
  }

  // When the reader explicitly publishes a hidden-premise count on a conclusion, Cartouche renders that exact count.
  const withPublishedCount = structuredClone(onlyRole(fx, 'limited'));
  withPublishedCount.reader_answers.limited[`/${PACK}/head`].body.hidden_premises = 1;
  const countedLayout = atlas.compileProofMapLayout(withPublishedCount, { role: 'limited', lang: 'en' });
  const countedHtml = countedLayout.html ?? countedLayout.svg;
  assert.ok(
    countedHtml.includes('1'),
    'When the reader publishes hidden_premises=1, the proof map must display that reader-published count.'
  );
});

test('M2 [proof-map-role-lens] 4: passing full two-role recording under restricted role leaks zero complete-only IDs into html, svg, or scene IR', () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const checkerSubjects = (fx.reader_answers.checker[`/${PACK}/m-4/rows/persoon`]?.body?.rows ?? []).map((r) => String(r.key[0]));
  const limitedSubjects = new Set(
    (fx.reader_answers.limited[`/${PACK}/m-4/rows/persoon`]?.body?.rows ?? []).map((r) => String(r.key[0]))
  );
  const hiddenSubjects = checkerSubjects.filter((id) => !limitedSubjects.has(id));
  assert.ok(hiddenSubjects.length > 0, 'Complete role must have subjects hidden from limited role.');

  const checkerRels = new Set((fx.reader_answers.checker[`/${PACK}/bundle`].body.relations ?? []).map((r) => r.id));
  const limitedRels = new Set((fx.reader_answers.limited[`/${PACK}/bundle`].body.relations ?? []).map((r) => r.id));
  const hiddenRels = [...checkerRels].filter((id) => !limitedRels.has(id));
  assert.ok(hiddenRels.includes('calc__allowance'));

  // Pass the FULL recording (with checker present) while requesting role: 'limited'.
  const limitedLayout = atlas.compileProofMapLayout(fx, { role: 'limited' });
  const sceneJson = canonicalJson(limitedLayout.scene);
  const html = limitedLayout.html ?? '';
  const svg = limitedLayout.svg ?? '';

  for (const forbidden of [...hiddenSubjects, ...hiddenRels]) {
    const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokenRe = new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`);
    assert.equal(tokenRe.test(sceneJson), false, `Complete-only id "${forbidden}" leaked into limited scene IR.`);
    assert.equal(tokenRe.test(svg), false, `Complete-only id "${forbidden}" leaked into limited SVG.`);
    assert.equal(tokenRe.test(html), false, `Complete-only id "${forbidden}" leaked into limited HTML.`);
  }
});
