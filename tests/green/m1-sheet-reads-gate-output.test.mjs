import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS } from '../../packages/reader-core/src/index.ts';
import { buildBitemporalFixtureFromGateAnswers } from '../../packages/atlas/src/bitemporal-gate.ts';
import { buildBitemporalModel } from '../../packages/atlas/src/bitemporal-model.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'BitemporalStairSheet.svelte');
const RECORDING = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'fixtures', '11-zorgtoeslag-bitemporal-gate-answers.json'), 'utf8')
);
const PIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
const M = DATA_MARKS;
const LEGEND = `table[${M.part}="legend"]`;
const TWIN = `table[${M.part}="twin"]`;
const SVG = `svg[${M.sheet}="bitemporal-stair"][${M.projection}="orthographic"]`;

async function withRendered(fixture, props, fn) {
  const { html } = await renderSvelte(SHEET, { fixture, ...props });
  const { window, document } = parseHtml(html);
  try {
    await fn(document);
  } finally {
    await window.happyDOM.close();
  }
  return html;
}

function recordedKeySet(recording, pack, role) {
  const keys = new Set();
  const answers = recording.reader_answers[role];
  for (const ep of recording.epochs) {
    const body = answers[`/${pack}/${ep.manifest}/rows/${ep.relation}`]?.body;
    for (const row of body?.rows ?? []) {
      keys.add(`${ep.manifest}/${ep.relation}/${JSON.stringify(row.key)}`);
    }
  }
  return keys;
}

function assertLegendAndSeal(doc, expectedManifestId) {
  const listed = new Set([...doc.querySelectorAll(`${LEGEND} tr[${M.sign}]`)].map((n) => n.getAttribute(M.sign)));
  const drawn = [...doc.querySelectorAll(`[${M.sign}]`)].filter((n) => !n.closest(LEGEND));
  assert.ok(drawn.length > 0);
  for (const el of drawn) {
    assert.ok(listed.has(el.getAttribute(M.sign)), `${el.getAttribute(M.sign)} missing from legend`);
  }
  const seal = doc.querySelector(`[${M.part}="seal"]`);
  assert.ok(seal);
  assert.equal(seal.getAttribute(M.trust_tier), 'sealed');
  assert.equal(doc.querySelector(`[${M.part}="manifest-hash"]`)?.textContent?.trim(), expectedManifestId);
  assert.equal(doc.querySelector(`[${M.check}="witness"]`)?.getAttribute(M.status), 'green');
}

test('M1 [sheet-reads-gate-output]: fixture 11 provenance matches pinned Rezono commit and workflow', () => {
  assert.equal(RECORDING.source.repository, 'rezono-lang/rezono');
  assert.equal(RECORDING.source.commit, PIN.pinned_commit);
  assert.match(RECORDING.source.how, /\.github\/workflows\/rezono-reader-parity\.yml/);
  const bundle = RECORDING.reader_answers.checker['/zorgtoeslag-slice/bundle'];
  assert.equal(bundle?.status, 200);
  assert.ok(bundle?.body?.relations?.some((r) => r.calc === 'allowance'));
  assert.equal(RECORDING.epochs.length, 4);
  for (const ep of RECORDING.epochs) {
    const head = RECORDING.reader_answers.checker[`/zorgtoeslag-slice/head?m=${ep.manifest}`];
    assert.equal(head?.status, 200);
    assert.equal(head?.body?.witness_check, 'green');
    const rows = RECORDING.reader_answers.checker[`/zorgtoeslag-slice/${ep.manifest}/rows/${ep.relation}`];
    assert.equal(rows?.status, 200);
    assert.ok(Array.isArray(rows?.body?.rows) && rows.body.rows.length > 0);
  }
});

test('M1 [sheet-reads-gate-output]: BitemporalStairSheet renders bob (unknown -> 10500) from recorded gate answers', async () => {
  const validProofRefs = recordedKeySet(RECORDING, 'zorgtoeslag-slice', 'checker');
  const fixture = buildBitemporalFixtureFromGateAnswers(RECORDING, {
    pack: 'zorgtoeslag-slice',
    role: 'checker',
    subjectId: 'bob',
    validTime: '2026-02-01'
  });

  const model = buildBitemporalModel(fixture);
  assert.equal(model.cells.length, 2);
  assert.equal(model.cells[0].state, 'unknown');
  assert.equal(model.cells[0].display, null);
  assert.equal(model.cells[0].zToken, null);
  assert.equal(model.cells[1].state, 'known');
  assert.equal(model.cells[1].display, '10500');
  assert.equal(model.cells[1].zToken, null, 'flat known tile never invents client-computed Z height');

  const html2d = await withRendered(fixture, { view: '2d' }, (doc) => {
    const tds = [...doc.querySelectorAll(`table[${M.sheet}="bitemporal-stair"] td[${M.part}="value"]`)];
    assert.equal(tds.length, 2);
    assert.equal(tds[0].getAttribute(M.state), 'unknown');
    assert.equal(/[0-9]/.test(tds[0].textContent ?? ''), false, 'unknown cell holds zero digits');
    assert.equal(tds[1].getAttribute(M.state), 'known');
    assert.ok((tds[1].textContent ?? '').includes('10500'));
    for (const td of tds) {
      assert.ok(validProofRefs.has(td.getAttribute(M.proof_ref)), `proof_ref not in gate recording: ${td.getAttribute(M.proof_ref)}`);
    }
    assertLegendAndSeal(doc, RECORDING.manifest.id);
  });
  assert.deepEqual(await auditA11y(html2d), []);

  const html3d = await withRendered(fixture, { view: 'orthographic' }, (doc) => {
    const marks = [...doc.querySelectorAll(`${SVG} g[${M.proof_ref}]`)];
    assert.equal(marks.length, 2);
    for (const g of marks) {
      assert.ok(validProofRefs.has(g.getAttribute(M.proof_ref)), `svg proof_ref not in gate recording: ${g.getAttribute(M.proof_ref)}`);
      assert.equal(g.innerHTML.includes('--z:'), false, 'no invented --z height');
      if (g.getAttribute(M.state) === 'unknown') {
        assert.ok(g.innerHTML.includes('url(#bt-hatch)'));
        assert.equal(/[0-9]/.test(g.textContent ?? ''), false);
      }
    }
    const twin = doc.querySelector(TWIN);
    assert.ok(twin?.textContent?.includes('10500'));
    assertLegendAndSeal(doc, RECORDING.manifest.id);
  });
  assert.deepEqual(await auditA11y(html3d), []);
});

test('M1 [sheet-reads-gate-output]: BitemporalStairSheet renders gus across epochs (13500 at m-3, 8500 at m-4) verbatim without client diffing', async () => {
  const validProofRefs = recordedKeySet(RECORDING, 'zorgtoeslag-slice', 'checker');
  const fixture = buildBitemporalFixtureFromGateAnswers(RECORDING, {
    pack: 'zorgtoeslag-slice',
    role: 'checker',
    subjectId: 'gus',
    validTime: '2026-01-01'
  });

  const html2d = await withRendered(fixture, { view: '2d' }, (doc) => {
    const tds = [...doc.querySelectorAll(`table[${M.sheet}="bitemporal-stair"] td[${M.part}="value"]`)];
    assert.equal(tds.length, 2);
    assert.equal(tds[0].getAttribute(M.state), 'known');
    assert.ok((tds[0].textContent ?? '').includes('13500'));
    assert.equal(tds[1].getAttribute(M.state), 'known');
    assert.ok((tds[1].textContent ?? '').includes('8500'));
    assert.equal(tds[1].querySelector('del'), null, 'no client-computed epoch diffing');
    for (const td of tds) {
      assert.ok(validProofRefs.has(td.getAttribute(M.proof_ref)));
    }
    assertLegendAndSeal(doc, RECORDING.manifest.id);
  });
  assert.deepEqual(await auditA11y(html2d), []);
});
