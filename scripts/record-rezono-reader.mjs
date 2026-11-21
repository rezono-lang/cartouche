#!/usr/bin/env node
/**
 * Record what Rezono's local reader answers to the slip (Decision 0009, point 3).
 *
 * Run only by .github/workflows/rezono-reader-parity.yml. It opens Rezono's own local reader
 * (edge/gate/src/local.ts in a checkout at the pinned commit) on the stores scripts/publish-rezono-slip-stores.py
 * published, lets @rezono/slip's view model (packages/slip/src/model.ts) ask it for every page the slip tests draw,
 * and keeps each request with the reader's status and body. Nothing is derived: what is written is what was served.
 *
 * Usage: node scripts/record-rezono-reader.mjs --rezono <checkout> --stores <stores.json> --out <fixture.json> [--run <url>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rezonoMessageFiller, rezonoStdPacks, REZONO_SOURCE } from '../packages/slip/bin/rezono-source.ts';
import { loadSlip } from '../packages/slip/src/model.ts';

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const rezono = path.resolve(arg('rezono') ?? '');
const stores = JSON.parse(fs.readFileSync(arg('stores') ?? '', 'utf8'));
const out = path.resolve(arg('out') ?? '');
const run = arg('run') ?? null;

// The pages the slip tests draw (tests/green/m2-slip-*.test.mjs), per store and role.
const REASON = 'fact recorded_amount.amount is missing';
const PAGES = {
  main: {
    reader: [
      undefined,
      { relation: 'group_size', key: ['group-a', '2'] },
      { relation: 'busy', key: ['group-a'] },
      { relation: 'calc__capped_amount', key: ['item-a', '12', 'known', ''] },
      { relation: 'calc__capped_amount', key: ['item-c', '', 'unknown', REASON] }
    ],
    summary: [undefined]
  },
  sweeps: { reader: [undefined], summary: [undefined] }
};

const { openLocalGate } = await import(pathToFileURL(path.join(rezono, 'edge', 'gate', 'src', 'local.ts')).href);
const stdPacks = await rezonoStdPacks();
const filler = await rezonoMessageFiller();

const readerAnswers = {};
for (const [store, roles] of Object.entries(PAGES)) {
  readerAnswers[store] = {};
  for (const [role, rows] of Object.entries(roles)) {
    const handle = await openLocalGate(stores[store], role);
    const recorded = new Map();
    const fetchFn = async (input, init) => {
      const request = new Request(new URL(String(input), 'http://localhost'), init);
      const response = await handle(request);
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      const url = new URL(request.url);
      recorded.set(url.pathname + url.search, { status: response.status, body });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    for (const row of rows) {
      await loadSlip(fetchFn, { pack: 'slip', lang: 'en', row }, stdPacks, filler);
    }
    // Requests run concurrently inside the model; the file lists them in path order.
    readerAnswers[store][role] = Object.fromEntries([...recorded.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}

const head = readerAnswers.main.reader['/slip/head']?.body;
if (!head || typeof head.manifest_sha256 !== 'string') throw new Error('record: the reader served no head for main/reader');
const fixture = {
  fixture_id: '10-slip-reader-answers',
  manifest: {
    id: `sha256:${head.manifest_sha256}`,
    epoch: head.epoch,
    knowledge_time: head.knowledge_time,
    role: 'reader',
    witness_check: head.witness_check === 'green' ? 'green' : 'failed',
    trust_tier: 'sealed'
  },
  source: {
    decision: 'decisions/0009-slip-reads-rezono-reader.md',
    repository: REZONO_SOURCE.repository,
    commit: REZONO_SOURCE.commit,
    pack: 'tests/fixtures/slip',
    stores: {
      main: 'tests/slip/slip_support.py publish_main',
      sweeps: `tests/slip/slip_support.py publish_sweeps, then drop_variant(${stores.dropped})`
    },
    how: "Recorded from Rezono's local reader (edge/gate/src/local.ts) at the commit by .github/workflows/rezono-reader-parity.yml: every request packages/slip/src/model.ts sends for the slip tests' pages, with the reader's status and body as served. Git dates of the sweeps repository fixed at 2026-01-01T00:00:00Z.",
    recorded_by: run
  },
  reader_answers: readerAnswers
};
fs.writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`recorded ${Object.values(readerAnswers).flatMap((r) => Object.values(r)).reduce((n, a) => n + Object.keys(a).length, 0)} answers -> ${out}`);
