#!/usr/bin/env node
/**
 * Record what Rezono's local gate (edge/gate/src/local.ts) answers for the healthcare allowance
 * bitemporal staircase across 4 published epochs (Decision 0012 §2).
 *
 * Run by .github/workflows/rezono-reader-parity.yml against the store published by
 * scripts/publish-rezono-zorgtoeslag-store.py. Nothing is derived: every recorded answer is the
 * exact HTTP status and JSON body served by edge/gate/src/local.ts.
 *
 * Usage: node scripts/record-rezono-zorgtoeslag-gate.mjs --rezono <checkout> --store <store.json> --out <fixture.json> [--run <url>] [--commit <40-hex>]
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
const handle = await openLocalGate(published.store, 'checker');

const recorded = new Map();
async function query(pathname) {
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

const headLatest = await query('/zorgtoeslag-slice/head');
if (headLatest.status !== 200 || !headLatest.body || typeof headLatest.body.manifest_sha256 !== 'string') {
  throw new Error(`record: unexpected /zorgtoeslag-slice/head response (${headLatest.status})`);
}

const bundleResp = await query('/zorgtoeslag-slice/bundle');
if (bundleResp.status !== 200 || !bundleResp.body || !Array.isArray(bundleResp.body.relations)) {
  throw new Error(`record: unexpected /zorgtoeslag-slice/bundle response (${bundleResp.status})`);
}

const allowanceRelEntry = bundleResp.body.relations.find((r) => r.calc === 'allowance');
const allowanceRel = allowanceRelEntry?.id;
if (!allowanceRel) {
  throw new Error(`record: no calc=='allowance' relation found in /zorgtoeslag-slice/bundle`);
}

const epochs = [];
for (const ep of published.epochs) {
  const epHead = await query(`/zorgtoeslag-slice/head?m=${ep.manifest}`);
  if (epHead.status !== 200) {
    throw new Error(`record: unexpected /head?m=${ep.manifest} status ${epHead.status}`);
  }
  const epRows = await query(`/zorgtoeslag-slice/${ep.manifest}/rows/${allowanceRel}`);
  if (epRows.status !== 200) {
    throw new Error(`record: unexpected /${ep.manifest}/rows/${allowanceRel} status ${epRows.status}`);
  }
  epochs.push({
    manifest: ep.manifest,
    as_of: ep.as_of,
    known: ep.known,
    relation: allowanceRel
  });
}

const checkerAnswers = Object.fromEntries(
  [...recorded.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
);

const fixture = {
  fixture_id: '11-zorgtoeslag-bitemporal-gate-answers',
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
    how: "Recorded from Rezono's local reader (edge/gate/src/local.ts) at the pinned commit by .github/workflows/rezono-reader-parity.yml: /zorgtoeslag-slice/head, /zorgtoeslag-slice/head?m=m-1..m-4, and /zorgtoeslag-slice/m-1..m-4/rows/<allowance_relation>, with each HTTP status and JSON body as served.",
    recorded_by: run
  },
  epochs,
  reader_answers: {
    checker: checkerAnswers
  }
};

fs.writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`recorded ${Object.keys(checkerAnswers).length} gate answers (${allowanceRel}) -> ${out}`);
