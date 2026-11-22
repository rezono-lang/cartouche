#!/usr/bin/env node
/**
 * Record what Rezono's local gate (edge/gate/src/local.ts) answers for the three-source
 * healthcare allowance proof map across 4 published epochs for both complete (`checker`) and
 * restricted (`limited`) roles (Decision 0012 §3a).
 *
 * Nothing is derived: every recorded answer is the exact HTTP status and JSON body served by
 * edge/gate/src/local.ts. Relations, kinds, and witness keys are discovered directly from the
 * served /bundle and /rows responses.
 *
 * Usage: node scripts/record-rezono-proof-map-gate.mjs --rezono <checkout> --store <store.json> --out <fixture.json> [--run <url>] [--commit <40-hex>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REZONO_SOURCE } from '../packages/slip/bin/rezono-source.ts';

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const rezono = path.resolve(arg('rezono') ?? '');
const published = JSON.parse(fs.readFileSync(arg('store') ?? '', 'utf8').replace(/^\uFEFF/, ''));
const out = path.resolve(arg('out') ?? '');
const run = arg('run') ?? null;
const commit = arg('commit') ?? REZONO_SOURCE.commit;

const { openLocalGate } = await import(pathToFileURL(path.join(rezono, 'edge', 'gate', 'src', 'local.ts')).href);

async function makeRecorder(role) {
  const handle = await openLocalGate(published.store, role);
  const recorded = new Map();
  async function query(pathname) {
    if (recorded.has(pathname)) return recorded.get(pathname);
    const response = await handle(new Request(new URL(pathname, 'http://localhost')));
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const entry = { status: response.status, body };
    recorded.set(pathname, entry);
    return entry;
  }
  return {
    query,
    toObject: () =>
      Object.fromEntries([...recorded.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  };
}

function collectBundleRelations(bundle) {
  const rels = new Set();
  for (const k of bundle.kinds ?? []) if (k.id) rels.add(k.id);
  for (const a of bundle.attributes ?? []) if (a.table) rels.add(a.table);
  for (const ar of bundle.arrows ?? []) if (ar.table) rels.add(ar.table);
  for (const r of bundle.relations ?? []) if (r.id) rels.add(r.id);
  return [...rels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const checker = await makeRecorder('checker');
const headLatest = await checker.query('/zorgtoeslag-slice/head');
if (headLatest.status !== 200 || !headLatest.body || typeof headLatest.body.manifest_sha256 !== 'string') {
  throw new Error(`record: unexpected /zorgtoeslag-slice/head response (${headLatest.status})`);
}

const bundleResp = await checker.query('/zorgtoeslag-slice/bundle');
if (bundleResp.status !== 200 || !bundleResp.body || !Array.isArray(bundleResp.body.relations)) {
  throw new Error(`record: unexpected /zorgtoeslag-slice/bundle response (${bundleResp.status})`);
}

const allowanceRelEntry = bundleResp.body.relations.find((r) => r.calc === 'allowance');
const allowanceRel = allowanceRelEntry?.id;
if (!allowanceRel) {
  throw new Error(`record: no calc=='allowance' relation found in /zorgtoeslag-slice/bundle`);
}

const epochs = [];
const allowanceRowsByEpoch = new Map();
for (const ep of published.epochs) {
  const epHead = await checker.query(`/zorgtoeslag-slice/head?m=${ep.manifest}`);
  if (epHead.status !== 200) {
    throw new Error(`record: unexpected /head?m=${ep.manifest} status ${epHead.status}`);
  }
  const epRows = await checker.query(`/zorgtoeslag-slice/${ep.manifest}/rows/${allowanceRel}`);
  if (epRows.status !== 200) {
    throw new Error(`record: unexpected /${ep.manifest}/rows/${allowanceRel} status ${epRows.status}`);
  }
  allowanceRowsByEpoch.set(ep.manifest, epRows.body?.rows ?? []);
  epochs.push({
    manifest: ep.manifest,
    as_of: ep.as_of,
    known: ep.known,
    relation: allowanceRel
  });
}

const latestManifest = published.epochs[published.epochs.length - 1].manifest;
await checker.query(`/zorgtoeslag-slice/${latestManifest}/parity`);
for (const rel of collectBundleRelations(bundleResp.body)) {
  await checker.query(`/zorgtoeslag-slice/${latestManifest}/rows/${rel}`);
}

// Record grounds & gap witnesses for key subjects across epochs (p-ann known; p-bob unknown->known transition).
const focusSubjects = new Set(['p-ann', 'p-bob', 'ann', 'bob']);
for (const ep of published.epochs) {
  const rows = allowanceRowsByEpoch.get(ep.manifest) ?? [];
  for (const row of rows) {
    if (!Array.isArray(row.key) || !focusSubjects.has(String(row.key[0]))) continue;
    const encKey = encodeURIComponent(JSON.stringify(row.key));
    await checker.query(`/zorgtoeslag-slice/${ep.manifest}/ask/grounds?relation=${allowanceRel}&key=${encKey}`);
    if (row.key[2] === 'unknown') {
      await checker.query(`/zorgtoeslag-slice/${ep.manifest}/ask/gap?relation=${allowanceRel}&key=${encKey}`);
    }
  }
}

// Record forward reach from a base person row at latestManifest for depends/affects expansion.
const personKind = bundleResp.body.kinds?.find((k) => k.id === 'persoon' || k.id === 'household')?.id;
if (personKind) {
  const pRows = await checker.query(`/zorgtoeslag-slice/${latestManifest}/rows/${personKind}`);
  const annRow = (pRows.body?.rows ?? []).find((r) => Array.isArray(r.key) && (r.key[0] === 'p-ann' || r.key[0] === 'ann'));
  if (annRow) {
    const encKey = encodeURIComponent(JSON.stringify(annRow.key));
    await checker.query(`/zorgtoeslag-slice/${latestManifest}/ask/reach?relation=${personKind}&key=${encKey}`);
  }
}

const limited = await makeRecorder('limited');
const limitedHead = await limited.query('/zorgtoeslag-slice/head');
if (limitedHead.status !== 200 || !limitedHead.body) {
  throw new Error(`record: unexpected limited /zorgtoeslag-slice/head status ${limitedHead.status}`);
}
const limitedBundle = await limited.query('/zorgtoeslag-slice/bundle');
if (limitedBundle.status !== 200 || !limitedBundle.body) {
  throw new Error(`record: unexpected limited /zorgtoeslag-slice/bundle status ${limitedBundle.status}`);
}
await limited.query(`/zorgtoeslag-slice/${latestManifest}/parity`);
await limited.query(`/zorgtoeslag-slice/${latestManifest}/rows/${allowanceRel}`);
for (const rel of collectBundleRelations(limitedBundle.body)) {
  await limited.query(`/zorgtoeslag-slice/${latestManifest}/rows/${rel}`);
}

const checkerAnswers = checker.toObject();
const limitedAnswers = limited.toObject();

const fixture = {
  fixture_id: '12-zorgtoeslag-proof-map-gate-answers',
  manifest: {
    id: `sha256:${headLatest.body.manifest_sha256}`,
    epoch: headLatest.body.epoch,
    knowledge_time: headLatest.body.knowledge_time,
    role: 'checker',
    witness_check: headLatest.body.witness_check === 'green' ? 'green' : 'failed',
    trust_tier: 'sealed'
  },
  source: {
    decision: 'decisions/0012-proof-first-plan.md',
    repository: REZONO_SOURCE.repository,
    commit,
    pack: 'examples/zorgtoeslag-slice',
    store: 'examples/zorgtoeslag_history_support.py publish_history',
    how: "Recorded from Rezono's local reader (edge/gate/src/local.ts) at the pinned commit by .github/workflows/rezono-reader-parity.yml for both complete (`checker`) and restricted (`limited`) roles (bundle with imports/kinds/premises, rows, grounds, gap, reach), with each HTTP status and JSON body as served.",
    recorded_by: run
  },
  epochs,
  reader_answers: {
    checker: checkerAnswers,
    limited: limitedAnswers
  }
};

fs.writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(
  `recorded ${Object.keys(checkerAnswers).length} checker + ${Object.keys(limitedAnswers).length} limited proof-map gate answers (${allowanceRel}) -> ${out}`
);
