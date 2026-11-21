import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_MARKS, SIGNS } from '../../packages/reader-core/src/index.ts';
import { exportFlowSplitSvg } from '../../packages/atlas/src/flow-split-svg.ts';
import { auditA11y, parseHtml, renderSvelte } from '../../scripts/svelte-test-harness.mjs';

const FLOW_SPLIT_SHEET = path.join(process.cwd(), 'packages', 'atlas', 'src', 'FlowSplitSheet.svelte');
const FX_DRIFT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', '01-platform-drift.json'), 'utf8')
);
const FX_TENANT_A = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', '02-platform-tenant-a.json'), 'utf8')
);

test('M1 Sheet 02: renders stated || observed curtain, dual-proof drift, absent sweep, digit-free unknown, legend, twin, seal, and 0 axe violations on fixture 01', async () => {
  const { html } = await renderSvelte(FLOW_SPLIT_SHEET, { fixture: FX_DRIFT });
  const { html: htmlRepeat } = await renderSvelte(FLOW_SPLIT_SHEET, { fixture: FX_DRIFT });
  assert.equal(html, htmlRepeat, 'SSR HTML must be byte-for-byte deterministic');

  const { window: win, document: doc } = parseHtml(html);
  try {
    const sheet = doc.querySelector(`[${DATA_MARKS.sheet}="flow-split"][${DATA_MARKS.projection}="2d"]`);
    assert.ok(sheet, 'expected sheet root with data-sheet="flow-split" and data-projection="2d"');
    assert.equal(sheet.getAttribute(DATA_MARKS.trust_tier), 'sealed');

    // Curtain stated || observed
    const curtain = doc.querySelector(`svg [${DATA_MARKS.part}="curtain"]`);
    assert.ok(curtain, 'expected SVG curtain group');
    assert.ok(curtain.querySelector(`[${DATA_MARKS.layer}="stated"]`), 'expected stated curtain layer');
    assert.ok(curtain.querySelector(`[${DATA_MARKS.layer}="observed"]`), 'expected observed curtain layer');

    // Dual-proof drift tracks (==)
    const driftMarks = doc.querySelectorAll(
      `svg [${DATA_MARKS.sign}="drift"][${DATA_MARKS.stated_proof_ref}][${DATA_MARKS.observed_proof_ref}]`
    );
    assert.equal(driftMarks.length, 1, 'expected exactly one drift edge in fixture 01');
    const drift = driftMarks[0];
    assert.equal(drift.getAttribute(DATA_MARKS.stated_proof_ref), 'policy:netpol-04#L42');
    assert.equal(drift.getAttribute(DATA_MARKS.observed_proof_ref), 'obs:hubble-ep42#L419');
    assert.ok(drift.textContent.includes(SIGNS.drift.glyph), 'drift edge must render == glyph');

    const statedTrack = drift.querySelector(`[${DATA_MARKS.layer}="stated"] path[${DATA_MARKS.stated_proof_ref}]`);
    const observedTrack = drift.querySelector(`[${DATA_MARKS.layer}="observed"] path[${DATA_MARKS.observed_proof_ref}]`);
    assert.ok(statedTrack, 'drift must have stated parallel track');
    assert.ok(observedTrack, 'drift must have observed parallel track');
    assert.notEqual(
      statedTrack.getAttribute('d'),
      observedTrack.getAttribute('d'),
      'stated and observed drift tracks must be visually parallel (distinct paths)'
    );

    // Absent marks carry completeness_witness_ref
    const absentNode = doc.querySelector(`svg [${DATA_MARKS.key}="svc-backup"][${DATA_MARKS.state}="absent"]`);
    assert.ok(absentNode, 'expected absent node svc-backup');
    assert.equal(absentNode.getAttribute(DATA_MARKS.completeness_ref), 'sweep:complete-ns-12-of-12');
    assert.ok(absentNode.textContent.includes(SIGNS.absent.glyph), 'absent node must render absent glyph');

    const absentEdge = doc.querySelector(`svg [${DATA_MARKS.key}="e-backup"][${DATA_MARKS.state}="absent"]`);
    assert.ok(absentEdge, 'expected absent edge e-backup');
    assert.equal(absentEdge.getAttribute(DATA_MARKS.completeness_ref), 'sweep:complete-ns-12-of-12');

    // Unknown marks carry reason, unknown sign, hatch glyph, and ZERO ASCII digits
    const unknownSvg = doc.querySelector(`svg [${DATA_MARKS.sign}="unknown"][${DATA_MARKS.state}="unknown"]`);
    assert.ok(unknownSvg, 'expected unknown SVG mark');
    assert.equal(unknownSvg.getAttribute(DATA_MARKS.reason), 'telemetry_timeout');
    assert.equal(unknownSvg.getAttribute(DATA_MARKS.proof_ref), 'proof:edge-04-timeout');
    assert.ok(unknownSvg.textContent.includes(SIGNS.unknown.glyph), 'unknown mark must include hatch glyph');
    assert.equal(/[0-9]/.test(unknownSvg.textContent), false, 'unknown SVG mark must contain zero ASCII digits');

    const unknownTwinCell = doc.querySelector(
      `table[${DATA_MARKS.part}="twin"] td[${DATA_MARKS.part}="value"][${DATA_MARKS.state}="unknown"]`
    );
    assert.ok(unknownTwinCell, 'expected unknown value cell in Table Twin');
    assert.equal(unknownTwinCell.getAttribute(DATA_MARKS.reason), 'telemetry_timeout');
    assert.ok(unknownTwinCell.querySelector(`[${DATA_MARKS.sign}="unknown"]`), 'unknown cell must contain [data-sign] child');
    assert.equal(/[0-9]/.test(unknownTwinCell.textContent), false, 'unknown table twin cell must contain zero ASCII digits');

    // Every SVG proof mark has non-empty data-proof-ref
    const proofMarks = doc.querySelectorAll(`svg [${DATA_MARKS.proof_ref}]`);
    assert.ok(proofMarks.length >= FX_DRIFT.nodes.length + FX_DRIFT.edges.length);
    for (const mark of proofMarks) {
      assert.ok((mark.getAttribute(DATA_MARKS.proof_ref) ?? '').trim().length > 0, 'empty data-proof-ref on SVG mark');
    }

    // Legend contract: table[data-part="legend"] with <th> and every drawn [data-sign] listed
    const legendTable = doc.querySelector(`table[${DATA_MARKS.part}="legend"]`);
    assert.ok(legendTable, 'expected table[data-part="legend"]');
    assert.ok(legendTable.querySelectorAll('th').length >= 1, 'legend table must have <th> header cells');
    const legendSigns = new Set(
      [...legendTable.querySelectorAll(`tr[${DATA_MARKS.sign}]`)].map((r) => r.getAttribute(DATA_MARKS.sign))
    );
    const drawnSigns = new Set(
      [...doc.querySelectorAll(`[${DATA_MARKS.sign}]`)]
        .filter((el) => !legendTable.contains(el))
        .map((el) => el.getAttribute(DATA_MARKS.sign))
    );
    for (const s of drawnSigns) {
      assert.ok(legendSigns.has(s), `drawn sign "${s}" is missing from table[data-part="legend"]`);
    }

    // Table Twin contract: table[data-part="twin"] with <th> and all nodes + drift
    const twinTables = doc.querySelectorAll(`table[${DATA_MARKS.part}="twin"]`);
    assert.equal(twinTables.length, 2, 'expected node twin table and drift twin table on fixture 01');
    for (const tbl of twinTables) {
      assert.ok(tbl.querySelectorAll('th').length >= 1, 'twin table must have <th> header cells');
    }
    const twinNodeRows = twinTables[0].querySelectorAll(`tbody tr[${DATA_MARKS.key}]`);
    assert.equal(twinNodeRows.length, FX_DRIFT.nodes.length, 'twin node row count must match fixture nodes');

    // Cartouche Seal contract
    const seal = doc.querySelector(`[${DATA_MARKS.part}="seal"]`);
    assert.ok(seal, 'expected [data-part="seal"]');
    const hashEl = seal.querySelector(`[${DATA_MARKS.part}="manifest-hash"]`);
    assert.ok(hashEl, 'expected [data-part="manifest-hash"] inside seal');
    assert.equal(hashEl.textContent.trim(), FX_DRIFT.manifest.id);
    const checkEl = seal.querySelector(`[${DATA_MARKS.check}]`);
    assert.ok(checkEl, 'expected [data-check] inside seal');
    assert.equal(checkEl.getAttribute(DATA_MARKS.status), 'green');
  } finally {
    await win.happyDOM.close();
  }

  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], `WCAG 2.1 AA violations on fixture 01: ${JSON.stringify(violations, null, 2)}`);
});

test('M1 Sheet 02: tenant_a role view leaks zero restricted entities, declares not_read_in_full, and passes axe WCAG 2.1 AA', async () => {
  const { html } = await renderSvelte(FLOW_SPLIT_SHEET, { fixture: FX_TENANT_A });
  const svg = exportFlowSplitSvg(FX_TENANT_A);

  for (const forbidden of FX_TENANT_A.forbidden_leaks_check) {
    assert.equal(html.includes(forbidden), false, `Restricted identifier "${forbidden}" leaked into tenant_a HTML`);
    assert.equal(svg.includes(forbidden), false, `Restricted identifier "${forbidden}" leaked into tenant_a SVG`);
  }
  assert.equal(html.includes('🔒'), false, 'zero lock icons allowed in tenant_a view');
  assert.equal(svg.includes('🔒'), false, 'zero lock icons allowed in tenant_a SVG');
  assert.equal(/\b(redacted|hidden|restricted)\b/i.test(html), false, 'zero placeholder/hidden prose leaks allowed');

  const { window: win, document: doc } = parseHtml(html);
  try {
    const horizon = doc.querySelector(`[${DATA_MARKS.part}="horizon"][${DATA_MARKS.reason}="not_read_in_full"]`);
    assert.ok(horizon, 'expected honest incomplete horizon indicator with data-reason="not_read_in_full"');
    assert.ok(horizon.textContent.includes('not_read_in_full'));

    assert.equal(doc.querySelectorAll(`svg [${DATA_MARKS.sign}="drift"]`).length, 0, 'tenant_a must render zero drift edges');

    const twinTables = doc.querySelectorAll(`table[${DATA_MARKS.part}="twin"]`);
    assert.equal(twinTables.length, 1, 'tenant_a must render only the node twin table (no empty drift table)');
    assert.equal(
      twinTables[0].querySelectorAll(`tbody tr[${DATA_MARKS.key}]`).length,
      FX_TENANT_A.nodes.length,
      'tenant_a twin row count must equal projected node count'
    );

    const legendSigns = new Set(
      [...doc.querySelectorAll(`table[${DATA_MARKS.part}="legend"] tr[${DATA_MARKS.sign}]`)].map((r) =>
        r.getAttribute(DATA_MARKS.sign)
      )
    );
    for (const undrawn of ['drift', 'absent', 'unknown', 'violated', 'changed']) {
      assert.equal(legendSigns.has(undrawn), false, `undrawn sign "${undrawn}" must not appear in tenant_a legend`);
    }
  } finally {
    await win.happyDOM.close();
  }

  const violations = await auditA11y(html);
  assert.deepEqual(violations, [], `WCAG 2.1 AA violations on fixture 02: ${JSON.stringify(violations, null, 2)}`);
});

test('M1 Sheet 02: deterministic SVG export produces identical bytes and valid structural snapshots for fixtures 01 and 02', () => {
  const svg01a = exportFlowSplitSvg(FX_DRIFT);
  const svg01b = exportFlowSplitSvg(FX_DRIFT);
  assert.equal(svg01a, svg01b, 'fixture 01 SVG export must be byte-for-byte deterministic');
  assert.equal(
    Buffer.compare(Buffer.from(svg01a, 'utf8'), Buffer.from(svg01b, 'utf8')),
    0,
    'fixture 01 SVG UTF-8 buffers must match'
  );

  const svg02a = exportFlowSplitSvg(FX_TENANT_A);
  const svg02b = exportFlowSplitSvg(FX_TENANT_A);
  assert.equal(svg02a, svg02b, 'fixture 02 SVG export must be byte-for-byte deterministic');
  assert.equal(
    Buffer.compare(Buffer.from(svg02a, 'utf8'), Buffer.from(svg02b, 'utf8')),
    0,
    'fixture 02 SVG UTF-8 buffers must match'
  );

  // Structural SVG snapshot assertions
  assert.ok(svg01a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg01a.endsWith('</svg>'));
  assert.ok(svg01a.includes('id="cartouche-hatch-45"'));
  assert.ok(svg01a.includes(`${DATA_MARKS.stated_proof_ref}="policy:netpol-04#L42"`));
  assert.ok(svg01a.includes(`${DATA_MARKS.observed_proof_ref}="obs:hubble-ep42#L419"`));
  assert.ok(svg01a.includes(`${DATA_MARKS.completeness_ref}="sweep:complete-ns-12-of-12"`));
  assert.ok(svg01a.includes(`${DATA_MARKS.reason}="telemetry_timeout"`));

  assert.ok(svg02a.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg02a.endsWith('</svg>'));
  assert.ok(svg02a.includes(`${DATA_MARKS.reason}="not_read_in_full"`));
  assert.notEqual(
    crypto.createHash('sha256').update(svg01a).digest('hex'),
    crypto.createHash('sha256').update(svg02a).digest('hex'),
    'distinct fixtures must produce distinct SVG digests'
  );
});
