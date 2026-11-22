import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS, SIGNS, canonicalJson } from '../../packages/reader-core/src/index.ts';
import { parseHtml } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  priority: 2,
  summary: 'Proof map requirement 8: a suppose toggle on a fact ripples through to the conclusions as the reader publishes the variant, with the turning points marked',
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

// Decision 0012 §3a (proof map, requirement 8). Rezono publishes sweeps, variants and turning points; Cartouche shows them.

const ROOT = process.cwd();
const FIXTURE_10 = path.join(ROOT, 'fixtures', '10-slip-reader-answers.json');
const FIXTURE_12 = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const M = DATA_MARKS;
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function loadRecordedSweep() {
  const fx10 = JSON.parse(fs.readFileSync(FIXTURE_10, 'utf8'));
  const sweepsReader = fx10.reader_answers?.sweeps?.reader;
  assert.ok(sweepsReader, 'fixtures/10-slip-reader-answers.json must hold sweeps/reader answers.');
  const sweepKey = Object.keys(sweepsReader).find((k) => k.includes('/ask/sweep'));
  assert.ok(sweepKey, 'fixtures/10 sweeps/reader must contain a recorded /ask/sweep answer.');
  return { fx10, sweep: sweepsReader[sweepKey].body };
}

test('M2 [proof-map-suppose] 1 & 2: suppose toggle renders reader-published variant with <del>/<ins>, supposed sign, and marked impact edges', async () => {
  const fx12 = JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
  const { fx10, sweep } = loadRecordedSweep();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const turningStop = (sweep.series ?? []).find((s) => s.turn === 'turns' && s.manifest);
  assert.ok(turningStop, 'Recorded sweep must contain a turning-point stop with a published manifest.');

  const base = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader'
  });
  const supposed = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader',
    supposeVariant: turningStop.manifest
  });

  const baseHtml = base.html ?? base.svg;
  const supHtml = supposed.html ?? supposed.svg;

  const { window: wBase, document: dBase } = parseHtml(baseHtml);
  try {
    const toggle = dBase.querySelector(`button[${M.verb}="suppose"], button[${M.verb}="s"]`);
    assert.ok(toggle, 'A fact row with a published sweep/variant must show a suppose toggle button.');
  } finally {
    await wBase.happyDOM.close();
  }

  const { window: wSup, document: dSup } = parseHtml(supHtml);
  try {
    const dels = [...dSup.querySelectorAll('del')];
    const ins = [...dSup.querySelectorAll('ins')];
    assert.ok(dels.length > 0 && ins.length > 0, 'Active suppose variant must show old value in <del> and new value in <ins>.');

    const supposedMarks = [...dSup.querySelectorAll(`[${M.sign}="supposed"]`)];
    assert.ok(supposedMarks.length > 0, 'Active suppose variant must mark supposed rows/edges with data-sign="supposed".');
    assert.ok(supHtml.includes(SIGNS.supposed.glyph), `Active suppose variant must display the ◇ supposed glyph (${SIGNS.supposed.glyph}).`);
  } finally {
    await wSup.happyDOM.close();
  }
});

test('M2 [proof-map-suppose] 3: turning points carry data-turn="turns" and red / not_computed stops show no fabricated new value', async () => {
  const fx12 = JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
  const { fx10 } = loadRecordedSweep();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const layout = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader'
  });
  const html = layout.html ?? layout.svg;
  const { window, document } = parseHtml(html);
  try {
    const turnStops = [...document.querySelectorAll(`[${M.stop}][${M.turn}="turns"]`)];
    assert.ok(turnStops.length > 0, 'Published turning points must be marked with [data-stop][data-turn="turns"].');

    const nonComputed = [
      ...document.querySelectorAll(`[${M.stop}][${M.status}="red"]`),
      ...document.querySelectorAll(`[${M.stop}][${M.status}="not_computed"]`)
    ];
    assert.ok(
      nonComputed.length > 0,
      'Recorded sweep must render its red and not_computed stops.'
    );
    for (const stopEl of nonComputed) {
      assert.equal(
        stopEl.querySelector('ins'),
        null,
        'Red and not_computed stops must never fabricate a new <ins> value.'
      );
    }
  } finally {
    await window.happyDOM.close();
  }
});

test('M2 [proof-map-suppose] 4: toggling suppose back off restores exact byte-identical SVG and CartoucheScene IR', () => {
  const fx12 = JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
  const { fx10, sweep } = loadRecordedSweep();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const turningStop = (sweep.series ?? []).find((s) => s.turn === 'turns' && s.manifest);
  assert.ok(turningStop, 'Recorded sweep must contain a turning-point stop with a published manifest.');
  const before = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader'
  });
  // Activate suppose, then restore without supposeVariant.
  atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader',
    supposeVariant: turningStop.manifest
  });
  const after = atlas.compileProofMapLayout(fx12, {
    role: 'checker',
    sweepRecording: fx10,
    sweepStore: 'sweeps',
    sweepRole: 'reader'
  });

  assert.equal(sha256(after.svg), sha256(before.svg), 'Toggling suppose back off must restore exact SVG hash.');
  assert.equal(
    sha256(canonicalJson(after.scene)),
    sha256(canonicalJson(before.scene)),
    'Toggling suppose back off must restore exact CartoucheScene IR hash.'
  );
});
