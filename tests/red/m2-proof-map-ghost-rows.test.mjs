import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary:
    'Proof map requirement 5: why unknown and why not in the map: a missing premise is a ghost row with its published reason, and the conclusion stays unknown, never no; first case the unknown income of p-bob in the healthcare allowance',
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

// Decision 0012 §3a (proof map, requirement 5). The drawer part is m1-slip-why-not-why-unknown; this is the map part.
// In fixtures/12-zorgtoeslag-proof-map-gate-answers.json:
// - At m-1 (as_of=2026-02-01, known=2025-11-15), p-bob's calc__allowance is ["p-bob","","unknown","no_version_applies"].
// - At m-4 (as_of=2026-01-01, known=2026-05-01), p-bob's calc__allowance is ["p-bob","10700","known",""].
// In fixtures/10-slip-reader-answers.json:
// - item-c's calc__capped_amount is ["item-c","","unknown","fact recorded_amount.amount is missing"].

const ROOT = process.cwd();
const M = DATA_MARKS;
const FX10_PATH = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const FX12_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('M2 [proof-map-ghost-rows] 1 & 2: missing premise renders as a hatched ghost row with published reason, dashed edge, and unknown conclusion (zero digits)', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx10 = loadJson(FX10_PATH);
  const unknownPath =
    '/slip/m-1/ask/grounds?relation=calc__capped_amount&key=%5B%22item-c%22%2C%22%22%2C%22unknown%22%2C%22fact%20recorded_amount.amount%20is%20missing%22%5D';
  const unknownAnswer = fx10.reader_answers.main.reader[unknownPath].body;
  assert.ok(unknownAnswer, 'Fixture 10 must include the recorded unknown calc__capped_amount answer for item-c.');

  const layout = atlas.compileProofMapLayout(fx10, {
    store: 'main',
    role: 'reader',
    selected: {
      relation: 'calc__capped_amount',
      key: ['item-c', '', 'unknown', 'fact recorded_amount.amount is missing']
    },
    groundsAnswer: unknownAnswer
  });

  // Ghost row exists in scene/layout with published reason and dashed edge to conclusion
  const ghostNodes = (layout.nodes ?? []).filter((n) => n.ghost === true);
  assert.ok(ghostNodes.length >= 1, 'Missing premise must be materialized as a ghost node in its source lane.');
  for (const ghost of ghostNodes) {
    assert.ok(
      typeof ghost.reason === 'string' && ghost.reason.length > 0,
      'Ghost node must carry the published epistemic reason.'
    );
    assert.equal(ghost.state, 'unknown', 'Ghost node must stay epistemic unknown (never absent/zero/false).');
  }

  const dashedEdges = (layout.edges ?? []).filter((e) => e.dashed === true);
  assert.ok(dashedEdges.length >= 1, 'Edge from a ghost row to its conclusion must be marked dashed.');

  const { window: win, document: doc } = parseHtml(layout.svg);
  try {
    const unknownConclusion = doc.querySelector(
      `[${M.relation}="calc__capped_amount"][${M.state}="unknown"][${M.reason}]`
    );
    assert.ok(
      unknownConclusion,
      'Conclusion supported by a ghost row must render with data-state="unknown" and published data-reason.'
    );
    const valueEl = unknownConclusion.querySelector(`[${M.part}="value"]`) ?? unknownConclusion;
    assert.doesNotMatch(
      valueEl.textContent ?? '',
      /[0-9]/,
      'Unknown conclusion and ghost row value must contain zero ASCII digits (never collapsed to 0).'
    );

    const dashedPath = doc.querySelector('path[stroke-dasharray], line[stroke-dasharray]');
    assert.ok(dashedPath, 'Rendered SVG must draw the ghost-row dependency edge with stroke-dasharray.');
  } finally {
    await win.happyDOM.close();
  }
});

test('M2 [proof-map-ghost-rows] 3: first case p-bob in zorgtoeslag-slice — ghost row in tax lane at m-1 (unknown), resolved to known 10700 at m-4 with ghost gone', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx12 = loadJson(FX12_PATH);
  const m1Rows = fx12.reader_answers.checker['/zorgtoeslag-slice/m-1/rows/calc__allowance'].body.rows;
  const m4Rows = fx12.reader_answers.checker['/zorgtoeslag-slice/m-4/rows/calc__allowance'].body.rows;
  const bobM1 = m1Rows.find((r) => r.key[0] === 'p-bob');
  const bobM4 = m4Rows.find((r) => r.key[0] === 'p-bob');
  assert.equal(bobM1.key[2], 'unknown', 'Fixture 12 m-1 must publish p-bob calc__allowance as unknown.');
  assert.equal(bobM4.key[2], 'known', 'Fixture 12 m-4 must publish p-bob calc__allowance as known.');

  const atM1 = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-1',
    focusEntity: 'p-bob'
  });
  const atM4 = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    manifest: 'm-4',
    focusEntity: 'p-bob'
  });

  // At m-1: ghost row in tax lane + p-bob allowance unknown with published reason
  const taxGhostsM1 = (atM1.nodes ?? []).filter((n) => n.ghost === true && n.lane === 'zorgtoeslag-tax');
  assert.ok(
    taxGhostsM1.length >= 1,
    'At m-1 (as_of=2026-02-01, known=2025-11-15), missing p-bob income must appear as a ghost row in the zorgtoeslag-tax lane.'
  );

  const domM1 = parseHtml(atM1.svg);
  try {
    const bobUnknown = domM1.document.querySelector(
      `[${M.relation}="calc__allowance"][${M.state}="unknown"][${M.reason}="${bobM1.key[3]}"]`
    );
    assert.ok(
      bobUnknown,
      `At m-1, p-bob calc__allowance must render data-state="unknown" and data-reason="${bobM1.key[3]}".`
    );
    const valSlot = bobUnknown.querySelector(`[${M.part}="value"]`);
    if (valSlot) {
      assert.doesNotMatch(valSlot.textContent ?? '', /[0-9]/, 'Unknown p-bob allowance at m-1 must show zero digits.');
    }
  } finally {
    await domM1.window.happyDOM.close();
  }

  // At m-4: ghost row is gone and p-bob allowance is known with published value 10700
  const taxGhostsM4 = (atM4.nodes ?? []).filter((n) => n.ghost === true && n.lane === 'zorgtoeslag-tax');
  assert.equal(taxGhostsM4.length, 0, 'At m-4 (known=2026-05-01), p-bob income ghost row must be gone.');

  const domM4 = parseHtml(atM4.svg);
  try {
    const bobKnown = domM4.document.querySelector(`[${M.relation}="calc__allowance"][${M.state}="known"]`);
    assert.ok(bobKnown, 'At m-4, p-bob calc__allowance must render with data-state="known".');
    assert.ok(
      (bobKnown.textContent ?? '').includes(bobM4.key[1]),
      `At m-4, p-bob calc__allowance must display its published value (${bobM4.key[1]}).`
    );
  } finally {
    await domM4.window.happyDOM.close();
  }
});
