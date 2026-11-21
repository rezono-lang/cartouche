import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, PALETTES } from '../../packages/reader-core/src/index.ts';
import { HASH_HEADER, ReaderClient, payloadHash } from '../../packages/reader-core/src/client.ts';
import { compileReliefScene } from '../../packages/scene-ir/src/compilers.ts';
import { buildReliefModel, loadReliefFromReader } from '../../packages/atlas/src/relief-model.ts';
import { buildCausalRippleModel, loadCausalRippleFromReader } from '../../packages/atlas/src/ripple-layout.ts';
import { buildPixiDrawPlan } from '../../packages/atlas/src/ripple-pixi.ts';
import { formatAtlasMessage, formatReasonLabel } from '../../packages/atlas/src/i18n-mf2.ts';
import { findDomainWordViolation } from '../../scripts/leak-and-domain-check.mjs';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';
import { loadJson } from '../../scripts/contract-validators.mjs';

const ROOT = process.cwd();
const FX_04 = loadJson(ROOT, 'fixtures/04-subsidy-a001-a003.json');
const FX_06 = loadJson(ROOT, 'fixtures/06-keycloak-dense-28.json');
const RELIEF_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'StatutoryRelief3D.svelte');
const RIPPLE_SHEET = path.join(ROOT, 'packages', 'atlas', 'src', 'CausalRippleSheet.svelte');

test('M4 [honest-claims-domain-and-i18n]: removes unused three/@threlte deps and aligns README claims honestly', () => {
  const pkg = loadJson(ROOT, 'package.json');
  assert.equal(pkg.dependencies?.three, undefined, 'unused three dependency must be removed');
  assert.equal(pkg.dependencies?.['@threlte/core'], undefined, 'unused @threlte/core dependency must be removed');
  assert.ok(pkg.dependencies?.['pixi.js'], 'pixi.js must remain installed');

  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.equal(/cryptographic proof per mark/i.test(readme), false, 'README must not claim unverified cryptographic proof per mark');
  assert.equal(/\bbreathing\b/i.test(readme), false, 'README must not claim unbuilt breathing sheets');
  assert.equal(/60\s*fps/i.test(readme), false, 'README must not claim unverified 60fps');
  assert.equal(/<250\s*ms/i.test(readme), false, 'README must not claim unverified <250ms');
  assert.equal(/\bthrelte\b/i.test(readme), false, 'README must not claim unused Threlte 3D');
});

test('M4 [honest-claims-domain-and-i18n]: ripple-pixi.ts derives every color strictly from canonical PALETTES', () => {
  for (const theme of ['swisstopo', 'obsidian', 'forced']) {
    const model = buildCausalRippleModel(FX_06, { theme });
    const plan = buildPixiDrawPlan(model);
    const paletteValues = new Set(Object.values(PALETTES[theme]));
    assert.equal(plan.background, PALETTES[theme].paper, `background must equal PALETTES.${theme}.paper`);
    assert.ok(plan.commands.length > 0);
    for (const cmd of plan.commands) {
      assert.ok(paletteValues.has(cmd.stroke), `stroke "${cmd.stroke}" must come from PALETTES.${theme}`);
      if (cmd.kind === 'rect' && cmd.fill !== null) {
        assert.ok(paletteValues.has(cmd.fill), `fill "${cmd.fill}" must come from PALETTES.${theme}`);
      }
    }
  }
});

test('M4 [honest-claims-domain-and-i18n]: domain-free relief compiler + CamelCase domain-word guard', () => {
  const scene = compileReliefScene(FX_04);
  assert.equal(scene.archetype, 'relief-3d');

  const model = buildReliefModel(FX_04);
  assert.equal(model.subjects[0].xAxisCell?.display, '€ 34.000');
  assert.equal(model.subjects[0].yAxisCell?.display, '€ 18.000');

  // CamelCase and snake_case domain words are caught; domain-neutral names pass
  assert.ok(findDomainWordViolation('export function compileSubsidyReliefScene() {}'));
  assert.ok(findDomainWordViolation('const incomeCell = sub.income_cell;'));
  assert.ok(findDomainWordViolation('const assetsCell = sub.assets_cell;'));
  assert.ok(findDomainWordViolation('const TaxableIncome = 1;'));
  assert.equal(findDomainWordViolation('export function compileReliefScene() { const xAxisCell = 1; }'), null);
});

test('M4 [honest-claims-domain-and-i18n]: Rezono MF2 i18n replaces hard-coded English and raw snake_case reasons in en & nl', async () => {
  assert.equal(formatAtlasMessage('nl', 'sheet.relief.title'), 'Orthografisch Reliëf');
  assert.equal(formatReasonLabel('nl', 'depth_limit_hop_2'), 'Doorzoeking gestopt bij staplimiet');
  assert.equal(formatReasonLabel('en', 'income_statement_not_received'), 'Income statement not received');
  assert.equal(
    formatReasonLabel('nl', 'income_statement_not_received', {
      nl: { 'reason.income_statement_not_received': 'Inkomensverklaring nog niet ontvangen' }
    }),
    'Inkomensverklaring nog niet ontvangen'
  );

  // Render CausalRippleSheet in Dutch (nl) and verify MF2 labels + non-snake_case horizon text
  const { html: rippleNl } = await renderSvelte(RIPPLE_SHEET, { fixture: FX_06, lang: 'nl' });
  const { window: winR, document: docR } = parseHtml(rippleNl, { lang: 'nl' });
  try {
    assert.equal(docR.querySelector('#causal-ripple-title')?.textContent, 'Causale Rimpeleffecten & Afstandskolommen');
    const horizon = docR.querySelector(`[${DATA_MARKS.part}="horizon"]`);
    assert.equal(horizon?.getAttribute(DATA_MARKS.reason), 'depth_limit_hop_2');
    assert.equal(horizon?.textContent?.includes('depth_limit_hop_2'), false, 'raw snake_case reason must not appear in visible prose');
    assert.ok(horizon?.textContent?.includes('Doorzoeking gestopt bij staplimiet'));
  } finally {
    await winR.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(rippleNl, { lang: 'nl' }), []);

  // Render StatutoryRelief3D in Dutch (nl) with MF2 reason override
  const { html: reliefNl } = await renderSvelte(RELIEF_SHEET, {
    fixture: FX_04,
    lang: 'nl',
    messages: { nl: { 'reason.income_statement_not_received': 'Document ontbreekt' } }
  });
  const { window: winS, document: docS } = parseHtml(reliefNl, { lang: 'nl' });
  try {
    assert.equal(docS.querySelector('#relief-3d-title')?.textContent, 'Orthografisch Reliëf');
    const curtain = docS.querySelector(`[${DATA_MARKS.part}="curtain"]`);
    assert.equal(curtain?.getAttribute(DATA_MARKS.reason), 'income_statement_not_received');
    assert.equal(curtain?.textContent?.includes('income_statement_not_received'), false);
    assert.ok(curtain?.textContent?.includes('Document ontbreekt'));
  } finally {
    await winS.happyDOM.close();
  }
  assert.deepEqual(await auditA11y(reliefNl, { lang: 'nl' }), []);
});

test('M4 [honest-claims-domain-and-i18n]: ReaderClient loads Relief & CausalRipple from verified gate responses and nightly-live.yml checks out pinned Rezono', async () => {
  const reachHash = await payloadHash(FX_06);
  const sweepHash = await payloadHash(FX_04);

  const client = new ReaderClient({
    role: 'platform_admin',
    handler: async (req) => {
      if (req.path === '/ask/reach') {
        return { status: 200, headers: { [HASH_HEADER]: reachHash }, body: FX_06 };
      }
      if (req.path === '/ask/sweep') {
        return { status: 200, headers: { [HASH_HEADER]: sweepHash }, body: FX_04 };
      }
      return { status: 404 };
    }
  });

  const rippleLoaded = await loadCausalRippleFromReader(client, { focal_id: 'svc-keycloak' });
  assert.equal(rippleLoaded.verified, true);
  assert.equal(rippleLoaded.sha256, reachHash);
  assert.equal(rippleLoaded.model.nodes.length, FX_06.nodes.length);

  const reliefLoaded = await loadReliefFromReader(client, { subject_id: 'A001' });
  assert.equal(reliefLoaded.verified, true);
  assert.equal(reliefLoaded.sha256, sweepHash);
  assert.equal(reliefLoaded.model.subjects.length, FX_04.subjects.length);

  // Tampered SHA-256 is rejected by ReaderClient before reaching sheet model
  const tamperedClient = new ReaderClient({
    handler: async () => ({
      status: 200,
      headers: { [HASH_HEADER]: 'sha256:' + '0'.repeat(64) },
      body: FX_06
    })
  });
  await assert.rejects(() => loadCausalRippleFromReader(tamperedClient, {}), /ReaderClient reach failed/);

  // nightly-live.yml checks out rezono-lang/rezono at contracts/rezono-pin.json commit
  const nightly = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'nightly-live.yml'), 'utf8');
  assert.ok(nightly.includes('contracts/rezono-pin.json'), 'nightly-live.yml must read contracts/rezono-pin.json');
  assert.ok(nightly.includes('repository: rezono-lang/rezono'), 'nightly-live.yml must check out rezono-lang/rezono');
  assert.ok(nightly.includes('rezono-source.json'), 'nightly-live.yml must verify pinned Rezono files');
});
