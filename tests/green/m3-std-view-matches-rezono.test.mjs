import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, SIGNS, STD_VERBS } from '../../packages/reader-core/src/index.ts';
import { compileFlowSplitScene } from '../../packages/scene-ir/src/index.ts';
import { drawnSigns, exportTypst } from '../../packages/scene-ir/src/typst-export.ts';
import { render } from '../../packages/slip/bin/render.ts';
import { REZONO_SOURCE, rezonoMessageFiller, rezonoStdPacks } from '../../packages/slip/bin/rezono-source.ts';
import { loadSlip } from '../../packages/slip/src/model.ts';
import { renderSlipElementHtml } from '../../packages/slip/src/slip-element.ts';
import { slipPropsFromView } from '../../packages/slip/src/slip-props.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const ROOT = process.cwd();
const loadJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('M3 [std-view-matches-rezono]: SIGNS, STD_VERBS, data-sign values and rezono-pin equal Rezono packs/std-view at the pinned commit', async () => {
  const packs = await rezonoStdPacks();
  const tokens = loadJson('contracts/std-view.v2.tokens.json');
  const marks = loadJson('contracts/data-marks.json');
  const sceneSchema = loadJson('contracts/cartouche-scene.v2.schema.json');
  const projSchema = loadJson('contracts/server-projections.schema.json');
  const pin = loadJson('contracts/rezono-pin.json');

  // 1. rezono-pin.json pins the exact commit from packages/slip/rezono-source.json
  assert.equal(pin.pinned_commit, REZONO_SOURCE.commit);

  // 2. Sign names equal Rezono key.yaml signs + statuses (exact set, no missing, no extra)
  const rezonoSignNames = [
    ...packs.signs.map((s) => s.sign),
    ...packs.statuses.map((s) => s.status)
  ].sort();

  assert.deepEqual(Object.keys(SIGNS).sort(), rezonoSignNames, 'reader-core SIGNS keys must equal Rezono signs + statuses');
  assert.deepEqual(Object.keys(tokens.signs).sort(), rezonoSignNames, 'std-view.v2.tokens.json signs must equal Rezono signs + statuses');
  assert.deepEqual([...marks.attributes.sign.values].sort(), rezonoSignNames, 'data-marks.json data-sign values must equal Rezono signs + statuses');
  assert.deepEqual([...sceneSchema.properties.usedSigns.items.enum].sort(), rezonoSignNames, 'cartouche-scene.v2.schema.json usedSigns must equal Rezono signs + statuses');

  // Origin sign enums in scene & projection schemas match Rezono's 5 origin signs
  const rezonoOrigins = ['origin_decision', 'origin_vendor', 'origin_design', 'origin_observation', 'derived'].sort();
  assert.deepEqual([...sceneSchema.$defs.SceneNodeMark.properties.sign.enum].sort(), rezonoOrigins);
  assert.deepEqual([...projSchema.$defs.EpistemicSign.enum].sort(), rezonoOrigins);

  // Every glyph defined in Rezono key.yaml matches our frozen glyph character-for-character
  for (const s of packs.signs) {
    if (s.glyph) {
      assert.equal(SIGNS[s.sign].glyph, s.glyph, `glyph mismatch for sign "${s.sign}"`);
      assert.equal(tokens.signs[s.sign].glyph, s.glyph, `token glyph mismatch for sign "${s.sign}"`);
    }
  }
  for (const s of packs.statuses) {
    if (s.glyph) {
      assert.equal(SIGNS[s.status].glyph, s.glyph, `glyph mismatch for status "${s.status}"`);
      assert.equal(tokens.signs[s.status].glyph, s.glyph, `token glyph mismatch for status "${s.status}"`);
    }
  }

  // 3. STD_VERBS equal Rezono sheets.yaml verbs (same order, keys, optional questions, primary)
  const expectedVerbs = packs.verbs.map((v) => ({
    verb: v.verb,
    key: v.key,
    ...(v.question !== undefined ? { question: v.question } : {}),
    ...(v.primary !== undefined ? { primary: v.primary } : {})
  }));
  assert.deepEqual(STD_VERBS, expectedVerbs, 'reader-core STD_VERBS must equal Rezono sheets.yaml verbs');
  assert.deepEqual(tokens.verbs, expectedVerbs, 'std-view.v2.tokens.json verbs must equal Rezono sheets.yaml verbs');

  // Specifically assert suppose, compare, propose have no question
  for (const viewerAction of ['suppose', 'compare', 'propose']) {
    const spec = STD_VERBS.find((v) => v.verb === viewerAction);
    assert.ok(spec, `missing verb ${viewerAction}`);
    assert.equal(spec.question, undefined, `${viewerAction} must have no question (viewer action)`);
  }
});

test('M3 [std-view-matches-rezono]: slip drops the unshared-sign filter, draws all reader signs, and rejects unknown signs', async () => {
  const fx10 = loadJson('fixtures/10-slip-reader-answers.json');
  const answers = fx10.reader_answers.main.reader;
  const fetchFn = async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const recorded = answers[url.pathname + url.search];
    assert.ok(recorded, `recorded: ${url.pathname + url.search}`);
    return Response.json(recorded.body, { status: recorded.status });
  };
  const view = await loadSlip(fetchFn, { pack: 'slip', lang: 'en' }, await rezonoStdPacks(), await rezonoMessageFiller());
  const props = slipPropsFromView(view);

  assert.equal('signsLeftOut' in props, false, 'signsLeftOut filter must be removed');

  // Unknown sign from a corrupted view must throw rather than be silently dropped
  const tampered = structuredClone(view);
  tampered.lines[0].originSign = { name: 'not_a_real_sign', glyph: '?' };
  assert.throws(() => slipPropsFromView(tampered), /unknown std-view sign/);

  // Rendered page emits no .slip-signs-left-out notice and covers every drawn sign in the legend
  const res = await render({ fixture: 'fixtures/10-slip-reader-answers.json', role: 'reader', pack: 'slip', lang: 'en' });
  const { window, document } = parseHtml(res.html);
  try {
    assert.equal(document.querySelector('.slip-signs-left-out'), null);
    const legendSigns = new Set(
      [...document.querySelectorAll(`table[${DATA_MARKS.part}="legend"] tr[${DATA_MARKS.sign}]`)].map((tr) =>
        tr.getAttribute(DATA_MARKS.sign)
      )
    );
    const drawn = [...document.querySelectorAll(`[${DATA_MARKS.sign}]`)].filter(
      (el) => !el.closest(`table[${DATA_MARKS.part}="legend"]`)
    );
    assert.ok(drawn.length > 0);
    for (const el of drawn) {
      assert.ok(legendSigns.has(el.getAttribute(DATA_MARKS.sign)), `drawn sign missing from legend: ${el.getAttribute(DATA_MARKS.sign)}`);
    }
  } finally {
    await window.happyDOM.close();
  }
});

test('M3 [std-view-matches-rezono]: invalid cell state renders with invalid (!) sign in Slip.svelte, slip-element, and typst-export without throwing', async () => {
  const slipPath = path.join(ROOT, 'packages', 'slip', 'src', 'Slip.svelte');
  const invalidRow = {
    kind: 'rule',
    rule_id: 'rule.check',
    sentence: [{ text: 'Check failed.' }],
    grounds_distance_1: [
      {
        relation: 'check_target',
        key: ['item-z'],
        polarity: 'positive',
        depth: 0,
        sign: 'origin_observation',
        cell: { state: 'invalid', display: null, reason: 'check_failed', proof_ref: 'p:inv' },
        answered_verbs: []
      }
    ]
  };

  // 1. Slip.svelte
  const { html: svelteHtml } = await renderSvelte(slipPath, { conformanceRow: invalidRow });
  const { window: winS, document: docS } = parseHtml(svelteHtml);
  try {
    const td = docS.querySelector(`td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="invalid"]`);
    assert.ok(td, 'Slip.svelte renders data-state="invalid"');
    assert.ok(td.querySelector(`[${DATA_MARKS.sign}="invalid"]`), 'Slip.svelte draws invalid state with invalid sign');
    assert.ok(docS.querySelector(`table[${DATA_MARKS.part}="legend"] tr[${DATA_MARKS.sign}="invalid"]`), 'Slip.svelte legend lists invalid');
  } finally {
    await winS.happyDOM.close();
  }

  // 2. renderSlipElementHtml parity
  const elHtml = renderSlipElementHtml({ conformanceRow: invalidRow });
  const { window: winE, document: docE } = parseHtml(elHtml);
  try {
    const td = docE.querySelector(`td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="invalid"]`);
    assert.ok(td, 'slip-element renders data-state="invalid"');
    assert.ok(td.querySelector(`[${DATA_MARKS.sign}="invalid"]`), 'slip-element draws invalid state with invalid sign');
    assert.ok(docE.querySelector(`table[${DATA_MARKS.part}="legend"] tr[${DATA_MARKS.sign}="invalid"]`), 'slip-element legend lists invalid');
  } finally {
    await winE.happyDOM.close();
  }

  // 3. exportTypst on a scene with an invalid node
  const fx01 = loadJson('fixtures/01-platform-drift.json');
  const scene = compileFlowSplitScene(fx01);
  const mutatedScene = {
    ...scene,
    nodes: scene.nodes.map((n, idx) => (idx === 0 ? { ...n, state: 'invalid' } : n))
  };
  const reasons = Object.fromEntries(fx01.nodes.filter((n) => n.state === 'unknown').map((n) => [n.id, n.reason]));
  const signs = drawnSigns(mutatedScene);
  assert.ok(signs.includes('invalid'), 'drawnSigns emits invalid for invalid state');
  const typ = exportTypst(mutatedScene, { reasonByNodeId: reasons });
  assert.ok(typ.includes('sign-glyph.invalid'), 'exportTypst uses sign-glyph.invalid for invalid state');
  assert.ok(typ.includes('"invalid"'), 'exportTypst legend lists invalid');
});
