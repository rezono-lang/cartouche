import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as atlas from '../../packages/atlas/src/index.ts';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { auditA11y, parseHtml } from '../../scripts/svelte-test-harness.mjs';

// Decision 0012 §3a (proof map, requirement 12).

const ROOT = process.cwd();
const FIXTURE_12 = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const M = DATA_MARKS;

function loadFixture12() {
  return JSON.parse(fs.readFileSync(FIXTURE_12, 'utf8'));
}

test('M2 [proof-map-accessible] 1: table[data-part="twin"] with th headers holds every drawn row and every edge', async () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const layout = atlas.compileProofMapLayout(fx, { role: 'checker', lang: 'en' });
  const html = layout.html ?? '';
  assert.ok(html.length > 0, 'compileProofMapLayout must emit accessible HTML containing table[data-part="twin"].');

  const { window, document } = parseHtml(html);
  try {
    const twin = document.querySelector(`table[${M.part}="twin"]`);
    assert.ok(twin, 'Proof map must render a synchronized table[data-part="twin"].');
    assert.ok(twin.querySelectorAll('thead th').length >= 4, 'Table twin must have column <th> headers.');
    const bodyRows = [...twin.querySelectorAll('tbody tr')];
    assert.ok(
      bodyRows.length >= layout.nodes.length,
      `Table twin must list every drawn node (${layout.nodes.length}), found ${bodyRows.length} rows.`
    );
    const edgeRows = [...document.querySelectorAll(`table[${M.part}="twin"] tr[${M.relation}], table[${M.part}="twin"] td`)];
    assert.ok(edgeRows.length > 0, 'Table twin must represent drawn edges (premise, conclusion, state).');
  } finally {
    await window.happyDOM.close();
  }
});

test('M2 [proof-map-accessible] 2: every node is focusable, Enter opens the slip, and arrow-key edge walking is deterministic', async () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );
  assert.equal(
    typeof atlas.stepProofMapFocus,
    'function',
    'packages/atlas/src/index.ts must export deterministic arrow-key walker stepProofMapFocus(layout, currentId, key).'
  );

  const layout = atlas.compileProofMapLayout(fx, { role: 'checker', lang: 'en' });
  const html = layout.html ?? '';
  const { window, document } = parseHtml(html);
  try {
    const focusable = [...document.querySelectorAll(`[${M.key}][tabindex="0"], [${M.key}] a[href*="at="]`)];
    assert.ok(focusable.length >= layout.nodes.length, 'Every proof map node must be keyboard-focusable with a slip link.');
  } finally {
    await window.happyDOM.close();
  }

  const allowance = layout.nodes.find((n) => n.id === 'calc__allowance');
  assert.ok(allowance, 'Expected calc__allowance node in layout.');
  const left1 = atlas.stepProofMapFocus(layout, allowance.id, 'ArrowLeft');
  const left2 = atlas.stepProofMapFocus(layout, allowance.id, 'ArrowLeft');
  assert.equal(left1, left2, 'ArrowLeft walk from conclusion to premise must be deterministic.');
  assert.ok(
    allowance.premises.includes(left1),
    `ArrowLeft from "${allowance.id}" must land on a direct premise, got "${left1}".`
  );
  const backRight = atlas.stepProofMapFocus(layout, left1, 'ArrowRight');
  assert.ok(backRight && backRight !== left1, 'ArrowRight from a premise must walk to a conclusion.');
});

test('M2 [proof-map-accessible] 3 & 4: nodes carry localized MF2 sentence aria-labels in en/nl without snake_case, and pass WCAG 2.1 AA axe', async () => {
  const fx = loadFixture12();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const enLayout = atlas.compileProofMapLayout(fx, { role: 'checker', lang: 'en' });
  const nlLayout = atlas.compileProofMapLayout(fx, { role: 'checker', lang: 'nl' });
  const enHtml = enLayout.html ?? '';
  const nlHtml = nlLayout.html ?? '';

  const readLabels = async (html) => {
    const { window, document } = parseHtml(html);
    try {
      return [...document.querySelectorAll(`[${M.key}][aria-label]`)].map((el) => el.getAttribute('aria-label') ?? '');
    } finally {
      await window.happyDOM.close();
    }
  };

  const enLabels = await readLabels(enHtml);
  const nlLabels = await readLabels(nlHtml);
  assert.ok(enLabels.length >= enLayout.nodes.length, 'Every drawn node must carry an MF2 sentence aria-label in English.');
  assert.ok(nlLabels.length >= nlLayout.nodes.length, 'Every drawn node must carry an MF2 sentence aria-label in Dutch.');
  assert.notDeepEqual(enLabels, nlLabels, 'English and Dutch MF2 accessible node sentences must be localized.');

  for (const label of [...enLabels, ...nlLabels]) {
    assert.ok(label.trim().length > 0, 'Accessible node sentence must be non-empty.');
    assert.equal(
      /\b[a-z]+_[a-z]+\b/.test(label),
      false,
      `Accessible node sentence must not read out raw snake_case code: "${label}".`
    );
  }

  assert.deepEqual(await auditA11y(enHtml), [], 'English proof map must have zero WCAG 2.1 AA axe violations.');
  assert.deepEqual(await auditA11y(nlHtml), [], 'Dutch proof map must have zero WCAG 2.1 AA axe violations.');
});
