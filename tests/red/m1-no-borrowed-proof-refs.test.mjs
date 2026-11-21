import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS as M } from '../../packages/reader-core/src/index.ts';
import { parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

export const RED_META = {
  milestone: 'M1',
  decision: 'decisions/0012-proof-first-plan.md',
  summary: 'No mark borrows another mark proof reference: same ref means same data-key, a drift mark never uses a side ref as its own, and within one svg two separate status marks never share a ref (live round, Monge round dots, drift fallback; issue #23 §1)',
  waits_on: []
};

// Decision 0012 §2 (6e), issue #23 §1: a drift edge falls back to its stated ref, a live round uses its first
// change's ref, and Monge round dots use the service's ref. #30 and #33 fixed those three; the relief sheet still
// gives one conclusion two keys (A003 and curtain:A003), which this test reads as one ref used by two marks. Each mark carries the witness of its own conclusion. Where
// the source publishes none, the element leaves data-proof-ref off (and is not a link, see m1-mark-opens-slip), or
// the mark is not drawn; it never takes another mark's ref. A mark's data-key names its own conclusion, without a
// prefix such as "curtain:" that makes one conclusion look like two.

const ROOT = process.cwd();
const fx = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', name), 'utf8'));
const atlas = (file) => path.join(ROOT, 'packages', 'atlas', 'src', file);
const STATUS = new Set(['valid', 'changed', 'violated', 'unknown', 'not_applicable', 'absent', 'invalid', 'supposed']);

const SHEETS = [
  { name: 'flow-split 01', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('01-platform-drift.json') }) },
  { name: 'flow-split 02', file: 'FlowSplitSheet.svelte', props: () => ({ fixture: fx('02-platform-tenant-a.json') }) },
  { name: 'kringstand 03', file: 'KringstandSheet.svelte', props: () => ({ fixture: fx('03-kring-m1-to-m5-live.json') }) },
  { name: 'relief-3d 04', file: 'StatutoryRelief3D.svelte', props: () => ({ fixture: fx('04-subsidy-a001-a003.json') }) },
  { name: 'bitemporal-stair 05', file: 'BitemporalStairSheet.svelte', props: () => ({ fixture: fx('05-subsidy-bitemporal.json') }) },
  { name: 'causal-ripple 06', file: 'CausalRippleSheet.svelte', props: () => ({ fixture: fx('06-keycloak-dense-28.json') }) },
  { name: 'monge-fold 08 at 0°', file: 'MongeFoldingSheet.svelte', props: () => ({ fixture: fx('08-monge-4d-audit.json'), foldAngleDeg: 0 }) }
];

const status = (el) => {
  const state = el.getAttribute(M.state);
  if (state) return state === 'known' ? 'valid' : state;
  const sign = el.getAttribute(M.sign);
  return sign && STATUS.has(sign) ? sign : null;
};

function borrowed(document) {
  const found = [];
  // 1. One ref, one conclusion: every element carrying a ref belongs to the data-key of that conclusion.
  const keysByRef = new Map();
  for (const el of document.querySelectorAll(`[${M.proof_ref}]`)) {
    const keyed = el.closest(`[${M.key}]`);
    if (!keyed) continue;
    const ref = el.getAttribute(M.proof_ref);
    if (!keysByRef.has(ref)) keysByRef.set(ref, new Set());
    keysByRef.get(ref).add(keyed.getAttribute(M.key));
  }
  for (const [ref, keys] of keysByRef) if (keys.size > 1) found.push(`ref ${ref} is used by keys ${[...keys].join(', ')}`);
  // 2. A drift mark's own ref is its own witness, never one of its two sides.
  for (const el of document.querySelectorAll(`[${M.sign}="drift"][${M.proof_ref}]`)) {
    const own = el.getAttribute(M.proof_ref);
    if (own === el.getAttribute(M.stated_proof_ref) || own === el.getAttribute(M.observed_proof_ref)) {
      found.push(`drift ${el.getAttribute(M.key) ?? ''} uses side ref ${own} as its own`);
    }
  }
  // 3. Within one drawing, two status marks that are not parts of one another never share a ref,
  //    and a part of a mark never shows another status under the mark's ref.
  for (const svg of document.querySelectorAll('svg')) {
    const byRef = new Map();
    for (const el of svg.querySelectorAll(`[${M.proof_ref}]`)) {
      if (!status(el)) continue;
      const ref = el.getAttribute(M.proof_ref);
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push(el);
    }
    for (const [ref, els] of byRef) {
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const [a, b] = [els[i], els[j]];
          const nested = a.contains(b) || b.contains(a);
          if (!nested) found.push(`svg: two separate marks share ref ${ref}`);
          else if (status(a) !== status(b)) found.push(`svg: ref ${ref} shows ${status(a)} and ${status(b)}`);
        }
      }
    }
  }
  return [...new Set(found)];
}

for (const sheet of SHEETS) {
  test(`M1 [no-borrowed-proof-refs]: ${sheet.name} lets no mark borrow another mark's ref`, async () => {
    const { html } = await renderSvelte(atlas(sheet.file), sheet.props());
    const { window, document } = parseHtml(html);
    try {
      assert.ok(document.querySelectorAll(`[${M.proof_ref}]`).length > 0, `${sheet.name}: marks carry refs`);
      assert.deepEqual(borrowed(document), [], `${sheet.name}: borrowed proof references`);
    } finally {
      await window.happyDOM.close();
    }
  });
}
