import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 10: every derived edge carries a mark that DuckDB and Feldera agree on it, or a visible disagreement mark, as the Rezono parity record publishes it',
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

// Decision 0012 §3a (proof map, requirement 10). Rezono records engine parity (decisions/feldera-calculation-parity.md).
// The owner sketched ! for disagreement; ! is the invalid sign of the key, so the disagreement sign is agreed in the
// Rezono key first (planner), and never by colour alone.

const ROOT = process.cwd();
const FIXTURE_12 = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const M = DATA_MARKS;
const PARITY_PATH = '/zorgtoeslag-slice/m-4/parity';

function loadFixture12() {
  return JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
}

test('M2 [proof-map-engine-agreement] 1 & 2: derived edges project recorded /parity (agree, disagree ≠, unknown) with parity record links and zero confusion with invalid (!)', async () => {
  const fx = loadFixture12();
  const parityEntry = fx.reader_answers?.checker?.[PARITY_PATH];
  assert.equal(parityEntry?.status, 200, `Fixture 12 must record 200 ${PARITY_PATH}.`);
  assert.equal(parityEntry.body?.format, 'rezono.parity/1');
  assert.equal(SIGNS.engine_disagreement?.glyph, '≠', 'Frozen key must define engine_disagreement sign ≠.');
  assert.notEqual(SIGNS.engine_disagreement.glyph, SIGNS.invalid.glyph, 'engine_disagreement ≠ must stay distinct from invalid !.');

  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  // 1) Recorded no_parity_record -> unknown with its published reason and link to parity record.
  const unknownLayout = atlas.compileProofMapLayout(fx, { role: 'checker' });
  const unknownHtml = unknownLayout.html ?? unknownLayout.svg;
  const { window: wUnk, document: dUnk } = parseHtml(unknownHtml);
  try {
    const unknownParityMarks = [...dUnk.querySelectorAll(`[${M.reason}="no_parity_record"]`)];
    assert.ok(unknownParityMarks.length > 0, 'Derived edges with no parity record must render data-reason="no_parity_record".');
    const parityLinks = [...dUnk.querySelectorAll(`a[href*="${PARITY_PATH}"]`)];
    assert.ok(parityLinks.length > 0, 'Derived edges must link to the published /parity record.');
  } finally {
    await wUnk.happyDOM.close();
  }

  // 2) Published agree + disagree records -> quiet agreement mark & ≠ engine_disagreement mark in SVG and table twin.
  const mixed = structuredClone(fx);
  const rels = mixed.reader_answers.checker[PARITY_PATH].body.relations;
  for (const r of rels) {
    if (r.relation === 'calc__allowance') {
      r.agreement = 'agree';
      delete r.reason;
    } else if (r.relation === 'toeslagpartner') {
      r.agreement = 'disagree';
      r.reason = 'engine_value_differs';
    }
  }

  const mixedLayout = atlas.compileProofMapLayout(mixed, { role: 'checker' });
  const mixedHtml = mixedLayout.html ?? mixedLayout.svg;
  const { window: wMix, document: dMix } = parseHtml(mixedHtml);
  try {
    const svgDisagree = [...dMix.querySelectorAll(`svg [${M.sign}="engine_disagreement"]`)];
    assert.ok(svgDisagree.length > 0, 'Disagreeing derived edge must draw data-sign="engine_disagreement" in SVG.');
    assert.ok(
      svgDisagree.some((el) => (el.textContent ?? '').includes('≠')),
      'Disagreeing derived edge must display the ≠ glyph (never colour alone).'
    );
    const twinDisagree = [...dMix.querySelectorAll(`table[${M.part}="twin"] [${M.sign}="engine_disagreement"]`)];
    assert.ok(twinDisagree.length > 0, 'Disagreeing derived edge must also carry data-sign="engine_disagreement" in table[data-part="twin"].');
    assert.equal(
      dMix.querySelectorAll(`svg [${M.relation}="toeslagpartner"][${M.sign}="invalid"]`).length,
      0,
      'Engine disagreement must never be drawn with the invalid (!) sign.'
    );
  } finally {
    await wMix.happyDOM.close();
  }
});

test('M2 [proof-map-engine-agreement] 3 & 4: Cartouche projects the published /parity record verbatim without comparing engine outputs itself', () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  // Flip ONLY the published agreement status on identical row values; output must follow the published record verbatim.
  const agreeFx = structuredClone(fx);
  const disagreeFx = structuredClone(fx);
  for (const r of agreeFx.reader_answers.checker[PARITY_PATH].body.relations) {
    if (r.relation === 'calc__allowance') {
      r.agreement = 'agree';
      delete r.reason;
    }
  }
  for (const r of disagreeFx.reader_answers.checker[PARITY_PATH].body.relations) {
    if (r.relation === 'calc__allowance') {
      r.agreement = 'disagree';
      r.reason = 'engine_value_differs';
    }
  }

  const agreeLayout = atlas.compileProofMapLayout(agreeFx, { role: 'checker' });
  const disagreeLayout = atlas.compileProofMapLayout(disagreeFx, { role: 'checker' });
  assert.equal(
    (agreeLayout.svg ?? '').includes('data-sign="engine_disagreement"'),
    false,
    'Published agree record must not emit engine_disagreement.'
  );
  assert.equal(
    (disagreeLayout.svg ?? '').includes('data-sign="engine_disagreement"'),
    true,
    'Published disagree record must emit engine_disagreement without client engine comparison.'
  );
});
