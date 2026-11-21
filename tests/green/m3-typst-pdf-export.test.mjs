import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNS } from '../../packages/reader-core/src/index.ts';
import {
  compileFlowSplitScene,
  compileMongeScene,
  compileSubsidyReliefScene
} from '../../packages/scene-ir/src/compilers.ts';
import { compileBitemporalScene } from '../../packages/scene-ir/src/compile-bitemporal.ts';
import { compileKringstandScene } from '../../packages/scene-ir/src/compile-kringstand.ts';
import { drawnSigns, exportTypst, exportTypstDossier, typstString } from '../../packages/scene-ir/src/typst-export.ts';

const load = (n) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', n), 'utf8'));
const fx01 = load('01-platform-drift.json');
const fx03 = load('03-kring-m1-to-m5-live.json');
const fx04 = load('04-subsidy-a001-a003.json');
const fx05 = load('05-subsidy-bitemporal.json');
const fx08 = load('08-monge-4d-audit.json');
const reasons = (nodes) => Object.fromEntries(nodes.filter((n) => n.state === 'unknown').map((n) => [n.id, n.reason]));

const CASES = {
  flow: { scene: compileFlowSplitScene(fx01), opts: { reasonByNodeId: reasons(fx01.nodes) } },
  relief: { scene: compileSubsidyReliefScene(fx04), opts: {} },
  bitemporal: { scene: compileBitemporalScene(fx05), opts: {} },
  monge: { scene: compileMongeScene(fx08), opts: { reasonByNodeId: reasons(fx08.services) } },
  kring: { scene: compileKringstandScene(fx03), opts: {} }
};
const lines = (src, prefix) => src.split('\n').filter((l) => l.includes(prefix));
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('M3: Typst export is byte-deterministic and carries no clock', () => {
  for (const [name, { scene, opts }] of Object.entries(CASES)) {
    const a = exportTypst(scene, opts);
    const b = exportTypst(structuredClone(scene), opts);
    assert.equal(a, b, name);
    assert.equal(digest(a), digest(b));
    assert.ok(a.includes('date: none'), 'no creation timestamp');
    assert.equal(a.includes('\r'), false);
    assert.equal(/datetime|today\(/.test(a), false);
    assert.equal(a.charCodeAt(0) === 0xfeff, false);
  }
});

test('M3: every export carries the identical manifest seal and a legend of exactly the drawn signs', () => {
  for (const [name, { scene, opts }] of Object.entries(CASES)) {
    const src = exportTypst(scene, opts);
    const s = scene.seal;
    assert.ok(src.includes(`#seal-block(${[s.manifestId, String(s.epoch), s.knowledgeTime, s.role, s.witnessCheck, s.trustTier, String(s.provisionalCount)].map(typstString).join(', ')})`), name);
    assert.ok(src.includes(`raw(${typstString(`${s.manifestId} ${s.trustTier}`)})`), `${name}: footer seal`);

    const legendRows = src.slice(src.indexOf('#heading(level: 2, "Legend")'));
    const listed = Object.keys(SIGNS).filter((k) => legendRows.includes(`  ${typstString(SIGNS[k].glyph)},\n  ${typstString(k)},\n  ${typstString(SIGNS[k].pattern)},\n`));
    assert.deepEqual(listed, [...drawnSigns(scene)], `${name}: legend lists exactly the drawn signs`);
    for (const n of scene.nodes) {
      assert.ok(listed.includes(n.sign), `${name}: sign ${n.sign} in legend`);
      if (n.state in SIGNS) assert.ok(listed.includes(n.state), `${name}: state ${n.state} in legend`);
    }
    if (scene.driftEdges.length > 0) assert.ok(listed.includes('drift'));
    // Table twin is present with every published row.
    assert.ok(src.includes('#heading(level: 2, "Table twin")'));
    for (const h of scene.tableTwin.headers) assert.ok(src.includes(typstString(h)));
    assert.equal(lines(src, 'proof-cell(').length >= scene.nodes.length, true, name);
  }
});

test('M3: unknown is hatched with a published reason and zero digits; absent keeps its witness; n/a stays hollow', () => {
  for (const [name, { scene, opts }] of Object.entries(CASES)) {
    const src = exportTypst(scene, opts);
    const unknownMarks = lines(src, 'mark("unknown"');
    const expected = scene.nodes.filter((n) => n.state === 'unknown').length + scene.unknownManifolds.length;
    assert.equal(unknownMarks.length, expected, name);
    for (const l of unknownMarks) {
      assert.ok(l.includes('reason: "'), `${name}: unknown mark needs a reason`);
      assert.equal(/[0-9]/.test(l), false, `${name}: digit on an unknown mark: ${l}`);
    }
    if (expected > 0) {
      assert.ok(src.includes('#let hatch-box'));
      assert.ok(src.includes(typstString(SIGNS.unknown.glyph)));
    }
    for (const n of scene.nodes.filter((x) => x.state === 'absent')) {
      assert.ok(src.includes(`witness: ${typstString(n.completenessWitnessRef)}`), `${name}: witness for ${n.id}`);
    }
    const na = scene.nodes.filter((n) => n.state === 'not_applicable').length;
    assert.equal(lines(src, 'mark("not_applicable"').length, na, name);
    if (na > 0) assert.ok(src.includes('#let hollow-box'));
  }
  const na = CASES.bitemporal.scene.nodes.filter((n) => n.state === 'not_applicable').length;
  assert.equal(na, fx05.bitemporal_grid.matrix.flat().filter((c) => c.state === 'not_applicable').length);
  assert.ok(na > 0);
});

test('M3: drift is two parallel tracks with both proof refs; each fixture drift edge appears once', () => {
  for (const key of ['flow', 'monge']) {
    const { scene, opts } = CASES[key];
    const src = exportTypst(scene, opts);
    const calls = lines(src, '#drift-mark(');
    assert.equal(calls.length, scene.driftEdges.length);
    assert.ok(calls.length > 0);
    for (const e of scene.driftEdges) {
      assert.equal(calls.filter((c) => c.includes(typstString(e.statedProofRef)) && c.includes(typstString(e.observedProofRef))).length, 1);
      assert.notEqual(e.statedProofRef, e.observedProofRef);
    }
  }
  const proto = exportTypst(CASES.flow.scene, CASES.flow.opts);
  assert.ok(proto.includes('[stated], line(length: 100%'));
  assert.ok(proto.includes('[observed], line(length: 100%'));
});

test('M3: provisional scenes carry an unsealed banner, and dossiers keep one seal per scene', () => {
  const live = CASES.kring.scene;
  assert.equal(live.seal.trustTier, 'provisional_engine');
  const src = exportTypst(live);
  assert.ok(src.includes('#banner("provisional_engine: unsealed, Propose and approval are locked")'));
  assert.equal(exportTypst(CASES.relief.scene).includes('#banner("sealed'), false);

  const dossier = exportTypstDossier([CASES.relief.scene, CASES.bitemporal.scene]);
  assert.equal(lines(dossier, '#seal-block(').length, 2);
  assert.equal(lines(dossier, '#pagebreak()').length, 1);
  assert.equal(dossier, exportTypstDossier([CASES.relief.scene, CASES.bitemporal.scene]));
  assert.throws(() => exportTypstDossier([]), /at least one scene/);
});

test('M3: typst strings are escaped so labels cannot break out of the source', () => {
  assert.equal(typstString('a"b\\c\nd'), '"a\\"b\\\\c\\nd"');
  const scene = structuredClone(CASES.relief.scene);
  scene.nodes[0].label = 'x"] #panic("boom") \\';
  const src = exportTypst(scene);
  assert.ok(src.includes('"x\\"] #panic(\\"boom\\") \\\\"'));
  assert.equal(src.includes('"x"] #panic'), false);
});

test('M3: dishonest or malformed scenes are rejected, never repaired', () => {
  const noReason = () => exportTypst(CASES.flow.scene); // flow nodes keep no reason on the scene
  assert.throws(noReason, /unknown mark .* has no published reason/);

  const digit = { reasonByNodeId: { ...CASES.flow.opts.reasonByNodeId, 'svc-edge-04': 'timeout after 30 s' } };
  assert.throws(() => exportTypst(CASES.flow.scene, digit), /must not contain digits/);

  const noWitness = structuredClone(CASES.flow.scene);
  noWitness.nodes.find((n) => n.state === 'absent').completenessWitnessRef = null;
  assert.throws(() => exportTypst(noWitness, CASES.flow.opts), /completeness witness/);

  const oneSided = structuredClone(CASES.monge.scene);
  oneSided.driftEdges[0] = { ...oneSided.driftEdges[0], observedProofRef: '' };
  assert.throws(() => exportTypst(oneSided, CASES.monge.opts), /observed side/);

  const noProof = structuredClone(CASES.relief.scene);
  noProof.nodes[0] = { ...noProof.nodes[0], proofRef: '' };
  assert.throws(() => exportTypst(noProof), /zero-proof/);

  const persp = structuredClone(CASES.relief.scene);
  persp.projection = 'perspective';
  assert.throws(() => exportTypst(persp), /perspective/);

  const badSign = structuredClone(CASES.relief.scene);
  badSign.nodes[0] = { ...badSign.nodes[0], sign: 'made_up' };
  assert.throws(() => exportTypst(badSign), /no std-view sign/);
});