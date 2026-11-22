import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as atlas from '../../packages/atlas/src/index.ts';
import { checkGeometricInvariants } from '../../packages/scene-ir/src/geometry-invariants.ts';

// Decision 0012 §3a (proof map, requirement 1). After RDFox Explore and the Stardog Studio visual, done better: the
// layout says where a fact comes from and how far it is derived. First case: Rezono examples/zorgtoeslag-slice, whose
// source packs (person, civil, tax, insurer) form a colimit along Persoon (Rezono decisions/healthcare-allowance-three-sources.md).

const ROOT = process.cwd();
const FIXTURE_PATH = path.join(ROOT, 'fixtures', '12-zorgtoeslag-proof-map-gate-answers.json');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function loadRecordedFixture() {
  assert.ok(
    fs.existsSync(FIXTURE_PATH),
    `Expected recorded three-source proof-map gate fixture at ${path.relative(ROOT, FIXTURE_PATH)}.`
  );
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('M2 [proof-map-semantic-layout] 1: fixture is recorded from Rezono gate at the single pinned commit with 4 source packs, distinct Partner kinds, and derivation edges', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'rezono-pin.json'), 'utf8'));
  const fx = loadRecordedFixture();

  assert.equal(fx.source?.repository, 'rezono-lang/rezono', 'Fixture must come from rezono-lang/rezono.');
  assert.equal(
    fx.source?.commit,
    pin.pinned_commit,
    `Fixture source.commit must match contracts/rezono-pin.json (${pin.pinned_commit}).`
  );

  const bundle = fx.reader_answers?.checker?.['/zorgtoeslag-slice/bundle']?.body;
  assert.ok(bundle && Array.isArray(bundle.imports), 'Recorded /bundle must expose role-filtered pack imports.');
  assert.ok(bundle.imports.length >= 4, `Expected >= 4 source packs in imports, got ${bundle.imports.length}.`);

  const partnerKinds = (bundle.kinds ?? []).filter((k) => k.class === 'Partner');
  assert.equal(partnerKinds.length, 2, 'Recorded /bundle must keep two distinct Partner kinds from different packs.');
  assert.notEqual(partnerKinds[0].pack, partnerKinds[1].pack, 'Partner kinds must carry distinct source pack names.');

  const allowance = (bundle.relations ?? []).find((r) => r.calc === 'allowance');
  assert.ok(
    allowance && Array.isArray(allowance.premises) && allowance.premises.length > 0,
    'Recorded /bundle must expose calc__allowance derivation premises.'
  );
});

test('M2 [proof-map-semantic-layout] 2 & 3: source packs form lanes in import order, facts sit at depth 0, derived nodes sit strictly right of their deepest premise', () => {
  const fx = loadRecordedFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const bundle = fx.reader_answers.checker['/zorgtoeslag-slice/bundle'].body;
  const expectedLanes = bundle.imports.map((imp) => imp.name);
  const layout = atlas.compileProofMapLayout(fx, { role: 'checker' });

  assert.deepEqual(
    layout.lanes.map((l) => l.pack),
    expectedLanes,
    'Source pack lanes must match bundle.imports in exact import order.'
  );

  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  for (const node of layout.nodes) {
    if (node.kind === 'source') {
      assert.equal(node.depth, 0, `Source node "${node.id}" must sit at depth 0.`);
      assert.ok(expectedLanes.includes(node.lane), `Source node "${node.id}" must belong to a declared source pack lane.`);
    } else {
      assert.ok(node.depth >= 1, `Derived node "${node.id}" must sit at depth >= 1.`);
      for (const premId of node.premises) {
        const prem = byId.get(premId);
        if (!prem) continue;
        assert.ok(
          node.depth > prem.depth,
          `Derived node "${node.id}" (depth=${node.depth}) must have depth strictly greater than premise "${premId}" (depth=${prem.depth}).`
        );
        assert.ok(
          node.x > prem.x,
          `Derived node "${node.id}" (x=${node.x}) must stand strictly right of premise "${premId}" (x=${prem.x}).`
        );
      }
    }
  }

  // Lane headers in rendered SVG carry pack names using only frozen data-marks + ARIA
  assert.equal(typeof layout.svg, 'string', 'compileProofMapLayout must produce deterministic SVG.');
  for (const packName of expectedLanes) {
    assert.match(
      layout.svg,
      new RegExp(`role="region"[^>]*aria-label="${packName}"|aria-label="${packName}"[^>]*role="region"`),
      `Rendered SVG must include a lane region header naming source pack "${packName}".`
    );
  }
});

test('M2 [proof-map-semantic-layout] 4 & 5: same-name Partner kinds stay distinct in two lanes and derived toeslagpartner/joint_income/allowance stand on the right', () => {
  const fx = loadRecordedFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const layout = atlas.compileProofMapLayout(fx, { role: 'checker' });
  const partnerSourceNodes = layout.nodes.filter((n) => n.kind === 'source' && n.className === 'Partner');
  assert.equal(
    partnerSourceNodes.length,
    2,
    'Same-name Partner kinds from civil and tax packs must remain two distinct source nodes (never merged).'
  );
  assert.notEqual(
    partnerSourceNodes[0].lane,
    partnerSourceNodes[1].lane,
    'The two Partner kinds must sit in distinct source pack lanes.'
  );
  assert.notEqual(
    partnerSourceNodes[0].qualifiedName,
    partnerSourceNodes[1].qualifiedName,
    'The two Partner kinds must carry distinct qualified names.'
  );

  const toeslagpartner = layout.nodes.find((n) => n.id === 'toeslagpartner');
  const jointIncome = layout.nodes.find((n) => n.id === 'calc__joint_income');
  const allowance = layout.nodes.find((n) => n.id === 'calc__allowance');
  assert.ok(toeslagpartner && toeslagpartner.kind === 'derived', 'toeslagpartner must be a distinct derived node.');
  assert.ok(jointIncome && jointIncome.kind === 'derived', 'calc__joint_income must be a derived node.');
  assert.ok(allowance && allowance.kind === 'derived', 'calc__allowance must be a derived node.');

  const maxSourceX = Math.max(...layout.nodes.filter((n) => n.kind === 'source').map((n) => n.x));
  assert.ok(toeslagpartner.x > maxSourceX, 'toeslagpartner must stand strictly right of source lanes.');
  assert.ok(jointIncome.x > toeslagpartner.x, 'calc__joint_income must stand strictly right of toeslagpartner.');
  assert.ok(allowance.x > jointIncome.x, 'calc__allowance must stand strictly right of calc__joint_income.');
});

test('M2 [proof-map-semantic-layout] 6: layout is byte-deterministic and passes checkGeometricInvariants with zero overlapping cards', () => {
  const fx = loadRecordedFixture();
  assert.equal(
    typeof atlas.compileProofMapLayout,
    'function',
    'packages/atlas/src/index.ts must export compileProofMapLayout(fixture, options).'
  );

  const first = atlas.compileProofMapLayout(fx, { role: 'checker' });
  const second = atlas.compileProofMapLayout(fx, { role: 'checker' });

  assert.equal(sha256(first.svg), sha256(second.svg), 'Repeated runs must emit byte-identical SVG.');
  assert.equal(
    sha256(JSON.stringify(first.scene)),
    sha256(JSON.stringify(second.scene)),
    'Repeated runs must emit byte-identical CartoucheScene IR.'
  );

  const violations = checkGeometricInvariants(first.scene);
  assert.deepEqual(
    violations,
    [],
    `Proof map scene must pass checkGeometricInvariants with zero overlaps/violations, got: ${JSON.stringify(violations)}`
  );
});

test('M2 [proof-map-semantic-layout] 7: packages remain domain-free under scripts/leak-and-domain-check.mjs', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'leak-and-domain-check.mjs')], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.match(out, /passed|ok|✅/i, 'scripts/leak-and-domain-check.mjs must pass with packages remaining domain-free.');
});
