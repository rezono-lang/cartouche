import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §3a (proof map, requirement 3). The owner listed: stated fact with its origin glyph, ○ derived,
// ◇ supposed, ▨ unknown (hatched, dashed edge), ⦸ absent (only after a complete sweep), ! invalid. In the key, ● is
// the origin glyph of an observation; a stated fact shows its own origin glyph (◆ ▲ ■ ●).

const ROOT = process.cwd();
const M = DATA_MARKS;
const FIXTURE_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const SHEET_PATH = path.join(ROOT, 'packages', 'atlas', 'src', 'ProofMapSheet.svelte');

const REQUIRED_SIGNS = [
  'origin_decision',
  'origin_vendor',
  'origin_design',
  'origin_observation',
  'derived',
  'supposed',
  'unknown',
  'absent',
  'invalid'
];

function loadFixture() {
  assert.ok(fs.existsSync(FIXTURE_PATH), `Expected recorded fixture at ${path.relative(ROOT, FIXTURE_PATH)}.`);
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function fixtureWithAllStates({ includeCompleteSweep = true } = {}) {
  const fx = loadFixture();
  fx.proof_map_state_samples = [
    { id: 'sample-decision', relation: 'persoon', key: 'p-ann', sign: 'origin_decision', state: 'known', proof_ref: 'w:dec-1' },
    { id: 'sample-vendor', relation: 'polis', key: 'pol-1', sign: 'origin_vendor', state: 'known', proof_ref: 'w:ven-1' },
    { id: 'sample-design', relation: 'adres', key: 'adr-1', sign: 'origin_design', state: 'known', proof_ref: 'w:des-1' },
    { id: 'sample-observation', relation: 'inkomen', key: 'inc-1', sign: 'origin_observation', state: 'known', proof_ref: 'w:obs-1' },
    { id: 'sample-derived', relation: 'calc__allowance', key: 'p-ann', sign: 'derived', state: 'known', proof_ref: 'w:der-1' },
    { id: 'sample-supposed', relation: 'inkomen', key: 'inc-sup', sign: 'supposed', state: 'changed', proof_ref: 'w:sup-1' },
    {
      id: 'sample-unknown',
      relation: 'calc__allowance',
      key: 'p-bob',
      sign: 'unknown',
      state: 'unknown',
      reason: 'no_version_applies',
      proof_ref: 'w:unk-1'
    },
    {
      id: 'sample-absent',
      relation: 'polis',
      key: 'p-bob',
      sign: 'absent',
      state: 'absent',
      reason: 'complete_sweep',
      proof_ref: 'w:abs-1',
      ...(includeCompleteSweep ? { completeness_ref: 'sweep:m-4:polis' } : {})
    },
    {
      id: 'sample-invalid',
      relation: 'inkomen',
      key: 'inc-bad',
      sign: 'invalid',
      state: 'invalid',
      reason: 'violated_constraint',
      proof_ref: 'w:inv-1'
    }
  ];
  return fx;
}

test('M2 [proof-map-state-glyphs] 1 & 2: every row carries data-sign and canonical key glyph, unknown uses canonical 6x6 hatch, and absent requires data-completeness-ref', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fxWithSweep = fixtureWithAllStates({ includeCompleteSweep: true });
  const layout = atlas.compileProofMapLayout(fxWithSweep, { role: 'checker', manifest: 'm-4' });
  const { window: win, document: doc } = parseHtml(layout.svg);
  try {
    // Every required sign renders with its exact glyph from SIGNS
    for (const signId of REQUIRED_SIGNS) {
      const marks = [...doc.querySelectorAll(`svg [${M.sign}="${signId}"]`)];
      assert.ok(marks.length > 0, `Proof map must render at least one mark with data-sign="${signId}".`);
      const glyph = SIGNS[signId]?.glyph;
      assert.ok(glyph, `SIGNS must define canonical glyph for "${signId}".`);
      assert.ok(
        marks.some((el) => (el.textContent ?? '').includes(glyph)),
        `Mark with data-sign="${signId}" must render key glyph "${glyph}".`
      );
    }

    // Unknown row uses the canonical 6x6 45deg var(--c-hatch) pattern (m2-hatch-signature)
    const patterns = [...doc.querySelectorAll('svg pattern')];
    assert.ok(patterns.length > 0, 'Proof map SVG must define the canonical 6x6 hatch <pattern> for unknown rows.');
    const canonicalHatch = patterns.find((pat) => {
      const line = pat.querySelector('line');
      return (
        pat.getAttribute('width') === '6' &&
        pat.getAttribute('height') === '6' &&
        (pat.getAttribute('patternTransform') ?? '').replace(/\s+/g, '') === 'rotate(45)' &&
        line?.getAttribute('stroke-width') === '1' &&
        line?.getAttribute('stroke') === 'var(--c-hatch)'
      );
    });
    assert.ok(canonicalHatch, 'Unknown row hatch pattern must match canonical 6x6 / rotate(45) / stroke-width=1 / var(--c-hatch).');

    // Absent row carries data-completeness-ref when complete sweep is published
    const absentMarks = [...doc.querySelectorAll(`svg [${M.sign}="absent"]`)];
    assert.ok(absentMarks.length > 0, 'Absent row must render when complete sweep is published.');
    for (const mark of absentMarks) {
      const ref = mark.getAttribute(M.completeness_ref) ?? mark.closest(`[${M.completeness_ref}]`)?.getAttribute(M.completeness_ref);
      assert.ok(ref && ref.length > 0, 'Every absent row must carry data-completeness-ref.');
    }
  } finally {
    await win.happyDOM.close();
  }

  // Without a published complete sweep, the row must NOT be drawn as absent
  const fxWithoutSweep = fixtureWithAllStates({ includeCompleteSweep: false });
  const layoutNoSweep = atlas.compileProofMapLayout(fxWithoutSweep, { role: 'checker', manifest: 'm-4' });
  const { window: win2, document: doc2 } = parseHtml(layoutNoSweep.svg);
  try {
    const forbiddenAbsent = [...doc2.querySelectorAll(`svg [${M.sign}="absent"], svg [${M.state}="absent"]`)];
    assert.equal(
      forbiddenAbsent.length,
      0,
      'Without a published complete sweep (completeness_ref), a row must never be drawn as absent.'
    );
  } finally {
    await win2.happyDOM.close();
  }
});

test('M2 [proof-map-state-glyphs] 3: unknown-premise edges are dashed with data-state="unknown" and known-premise edges are solid', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx = loadFixture();
  const layoutM1 = atlas.compileProofMapLayout(fx, { role: 'checker', manifest: 'm-1' });
  const { window: win, document: doc } = parseHtml(layoutM1.svg);
  try {
    const unknownEdges = [...doc.querySelectorAll(`svg g[${M.state}="unknown"] path`)];
    assert.ok(unknownEdges.length > 0, 'm-1 map must render edge groups carrying data-state="unknown" from unknown premises.');
    for (const edge of unknownEdges) {
      const dash = edge.getAttribute('stroke-dasharray');
      assert.ok(dash && dash !== 'none', 'Edge from an unknown premise must be dashed (stroke-dasharray).');
    }
  } finally {
    await win.happyDOM.close();
  }

  const layoutM4 = atlas.compileProofMapLayout(fx, { role: 'checker', manifest: 'm-4' });
  const { window: win4, document: doc4 } = parseHtml(layoutM4.svg);
  try {
    const knownEdges = [...doc4.querySelectorAll(`svg g[${M.state}="known"] path`)];
    assert.ok(knownEdges.length > 0, 'm-4 map must render edge groups carrying data-state="known" from known premises.');
    for (const edge of knownEdges) {
      const dash = edge.getAttribute('stroke-dasharray');
      assert.ok(!dash || dash === 'none', `Known-premise edge must be solid, got stroke-dasharray="${dash}".`);
    }
  } finally {
    await win4.happyDOM.close();
  }
});

test('M2 [proof-map-state-glyphs] 4 & 5: every state is distinguishable by (glyph, hatch, dash) in forced palette/greyscale and every drawn sign appears in the legend', async () => {
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const fx = fixtureWithAllStates({ includeCompleteSweep: true });
  const { html } = await renderSvelte(SHEET_PATH, {
    fixture: fx,
    focusKey: 'calc__allowance::p-ann',
    role: 'checker',
    manifest: 'm-4',
    theme: 'forced'
  });

  const { window: win, document: doc } = parseHtml(html);
  try {
    const legend = doc.querySelector(`table[${M.part}="legend"]`);
    assert.ok(legend, 'ProofMapSheet must render table[data-part="legend"].');
    const legendSigns = new Set(
      [...legend.querySelectorAll(`tr[${M.sign}]`)].map((tr) => tr.getAttribute(M.sign)).filter(Boolean)
    );
    assert.ok(legendSigns.size > 0, 'Legend table must list tr[data-sign] rows.');

    // Every [data-sign] drawn outside table[data-part="legend"] must appear in the legend
    const drawnMarks = [...doc.querySelectorAll(`[${M.sign}]`)].filter((el) => !el.closest(`table[${M.part}="legend"]`));
    assert.ok(drawnMarks.length > 0, 'ProofMapSheet must render drawn marks with data-sign outside the legend.');
    for (const mark of drawnMarks) {
      const sign = mark.getAttribute(M.sign);
      assert.ok(legendSigns.has(sign), `Drawn data-sign="${sign}" must be listed in table[data-part="legend"].`);
    }

    // Distinguishability without colour (forced / greyscale): each required sign has a unique (glyph, hatch, dash) signature
    const signatures = new Map();
    for (const signId of REQUIRED_SIGNS) {
      const glyph = SIGNS[signId]?.glyph ?? '';
      const hasHatch = signId === 'unknown';
      const isDashed = signId === 'unknown';
      const sig = `${glyph}|hatch:${hasHatch}|dash:${isDashed}`;
      assert.equal(
        signatures.has(sig),
        false,
        `Sign "${signId}" shares non-colour signature "${sig}" with "${signatures.get(sig)}".`
      );
      signatures.set(sig, signId);
    }
  } finally {
    await win.happyDOM.close();
  }
});
