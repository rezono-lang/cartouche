import test from 'node:test';
import assert from 'node:assert/strict';
import * as atlas from '../../packages/atlas/src/index.ts';
import { asOpaqueCell } from '../../packages/reader-core/src/opaque.ts';

export const RED_META = {
  milestone: 'M2',
  decision: 'decisions/0012-proof-first-plan.md',
  summary:
    'Coverage sheet after Stardog Designer question scoring: per declared question whether it is answered with proof, unknown or untested, and which kinds or slots no question uses',
  waits_on: [
    'm1-absent-never-valid-colour',
    'm1-claims-match-build',
    'm1-contrast-wcag-aa',
    'm1-forced-colors-reduced-motion',
    'm1-green-guard-covers-harness',
    'm1-invalid-drawn-everywhere',
    'm1-mark-opens-slip',
    'm1-monge-unknown-and-state-colours',
    'm1-motion-between-epochs',
    'm1-no-borrowed-proof-refs',
    'm1-proof-refs-only-as-served',
    'm1-propose-locked-until-served',
    'm1-reads-only-served-head-fields',
    'm1-sheet-reads-gate-output',
    'm1-slip-all-witnesses',
    'm1-slip-proof-tree',
    'm1-slip-why-not-why-unknown',
    'm1-time-valid-at-known-at',
    'm1-viewer-prerendered-and-guarded',
    'm1-zero-compute-lint-fails-closed'
  ]
};

// Decision 0012 §3 (9).

const SAMPLE_COVERAGE_INPUT = Object.freeze({
  locale: 'en',
  manifest: Object.freeze({
    id: 'm-4',
    epoch: 'm-4',
    knowledge_time: '2026-05-01T00:00:00Z',
    role: 'checker',
    witness_check: 'green',
    trust_tier: 'sealed'
  }),
  publishedCounts: Object.freeze({
    answered: asOpaqueCell({ display: '7_PUB_ANSWERED', state: 'known', proof_ref: 'coverage:answered' }),
    unknown: asOpaqueCell({ display: '2_PUB_UNKNOWN', state: 'known', proof_ref: 'coverage:unknown' }),
    untested: asOpaqueCell({ display: '3_PUB_UNTESTED', state: 'known', proof_ref: 'coverage:untested' }),
    unusedKinds: asOpaqueCell({ display: '1_PUB_UNUSED_KINDS', state: 'known', proof_ref: 'coverage:unused_kinds' }),
    unusedSlots: asOpaqueCell({ display: '4_PUB_UNUSED_SLOTS', state: 'known', proof_ref: 'coverage:unused_slots' })
  }),
  questions: Object.freeze([
    Object.freeze({
      id: 'q.eligibility',
      label: 'Eligibility check',
      coverageState: 'answered',
      exampleAnswerHref: '#slip/calc__outcome/a-1?pin=m-4@d-0000',
      proofRef: 'witness:q.eligibility:a-1',
      publishedRowCount: asOpaqueCell({ display: '11_PUB_ROWS', state: 'known', proof_ref: 'coverage:q.eligibility' })
    }),
    Object.freeze({
      id: 'q.pending_gap',
      label: 'Pending gap check',
      coverageState: 'unknown',
      reason: 'fact_missing',
      publishedRowCount: asOpaqueCell({ display: '5_PUB_GAP', state: 'known', proof_ref: 'coverage:q.pending_gap' })
    }),
    Object.freeze({
      id: 'q.untested_edge',
      label: 'Untested edge check',
      coverageState: 'untested',
      reason: 'no_recorded_answer'
    })
  ]),
  unusedKinds: Object.freeze([
    Object.freeze({ id: 'audit_note', label: 'Audit note' })
  ]),
  unusedSlots: Object.freeze([
    Object.freeze({ id: 'record.archived_flag', kind: 'record', label: 'Archived flag' }),
    Object.freeze({ id: 'record.legacy_code', kind: 'record', label: 'Legacy code' })
  ])
});

test('M2 [coverage-sheet] 1: renders one table-first row per declared question with published data-state (answered, unknown, untested)', () => {
  assert.equal(
    typeof atlas.renderCoverageSheet,
    'function',
    'packages/atlas/src/index.ts must export renderCoverageSheet(input) for the M2 coverage sheet.'
  );

  const html = atlas.renderCoverageSheet(SAMPLE_COVERAGE_INPUT);
  assert.equal(typeof html, 'string', 'renderCoverageSheet must return an HTML string.');

  const firstTableIdx = html.indexOf('<table');
  const firstSvgIdx = html.indexOf('<svg');
  assert.ok(firstTableIdx >= 0, 'Coverage sheet must render a <table>.');
  assert.ok(
    firstSvgIdx === -1 || firstTableIdx < firstSvgIdx,
    'Coverage sheet must be table-first (questions table before any SVG).'
  );

  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  assert.ok(tables.length >= 2, `Expected at least 2 tables (questions + unused kinds/slots), got ${tables.length}.`);

  const qTable = tables[0];
  assert.match(qTable, /<th\b/i, 'Questions table must include <th> header cells.');

  // Every declared question has one row with its published state
  assert.match(qTable, /data-key="q\.eligibility"/, 'Answered question row must carry data-key.');
  assert.match(
    qTable,
    /data-key="q\.eligibility"[^>]*data-state="(?:known|valid)"|data-state="(?:known|valid)"[^>]*data-key="q\.eligibility"/,
    'Answered question row must carry a known/valid data-state from contracts/data-marks.json.'
  );
  assert.match(
    qTable,
    /data-key="q\.pending_gap"[^>]*data-state="unknown"|data-state="unknown"[^>]*data-key="q\.pending_gap"/,
    'Unknown question row must carry data-state="unknown".'
  );
  assert.match(
    qTable,
    /data-reason="fact_missing"/,
    'Unknown question row must carry its published data-reason.'
  );
  assert.match(
    qTable,
    /data-key="q\.untested_edge"[^>]*data-state="(?:absent|not_applicable)"|data-state="(?:absent|not_applicable)"[^>]*data-key="q\.untested_edge"/,
    'Untested question row must carry data-state="absent" or "not_applicable" from contracts/data-marks.json.'
  );
});

test('M2 [coverage-sheet] 2: second table lists unused kinds and slots from the reader catalogue', () => {
  assert.equal(
    typeof atlas.renderCoverageSheet,
    'function',
    'packages/atlas/src/index.ts must export renderCoverageSheet(input).'
  );

  const html = atlas.renderCoverageSheet(SAMPLE_COVERAGE_INPUT);
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  assert.ok(tables.length >= 2, 'Coverage sheet must render a second table for unused kinds and slots.');

  const unusedTable = tables[1];
  assert.match(unusedTable, /<th\b/i, 'Unused kinds/slots table must include <th> header cells.');
  assert.match(unusedTable, /audit_note|Audit note/, 'Unused table must list unused kind audit_note.');
  assert.match(unusedTable, /record\.archived_flag|Archived flag/, 'Unused table must list unused slot record.archived_flag.');
  assert.match(unusedTable, /record\.legacy_code|Legacy code/, 'Unused table must list unused slot record.legacy_code.');
});

test('M2 [coverage-sheet] 3: every count displayed is an opaque published value (zero client counting)', () => {
  assert.equal(
    typeof atlas.renderCoverageSheet,
    'function',
    'packages/atlas/src/index.ts must export renderCoverageSheet(input).'
  );

  const html = atlas.renderCoverageSheet(SAMPLE_COVERAGE_INPUT);
  for (const token of [
    '7_PUB_ANSWERED',
    '2_PUB_UNKNOWN',
    '3_PUB_UNTESTED',
    '1_PUB_UNUSED_KINDS',
    '4_PUB_UNUSED_SLOTS',
    '11_PUB_ROWS',
    '5_PUB_GAP'
  ]) {
    assert.ok(
      html.includes(token),
      `Coverage sheet must render published opaque count "${token}" verbatim without recomputing counts client-side.`
    );
  }
});

test('M2 [coverage-sheet] 4: answered questions link to an example answer and its slip; untested questions do not fabricate links', () => {
  assert.equal(
    typeof atlas.renderCoverageSheet,
    'function',
    'packages/atlas/src/index.ts must export renderCoverageSheet(input).'
  );

  const html = atlas.renderCoverageSheet(SAMPLE_COVERAGE_INPUT);
  assert.match(
    html,
    /<a\b[^>]*href="#slip\/calc__outcome\/a-1\?pin=m-4@d-0000"[^>]*data-proof-ref="witness:q\.eligibility:a-1"|<a\b[^>]*data-proof-ref="witness:q\.eligibility:a-1"[^>]*href="#slip\/calc__outcome\/a-1\?pin=m-4@d-0000"/,
    'Answered question must link to its example answer and slip with href and data-proof-ref.'
  );

  const untestedRow = html.match(/<tr\b[^>]*data-key="q\.untested_edge"[\s\S]*?<\/tr>/i)?.[0] ?? '';
  assert.ok(untestedRow.length > 0, 'Expected a <tr> for untested question q.untested_edge.');
  assert.doesNotMatch(
    untestedRow,
    /data-proof-ref=/,
    'Untested question row must not fabricate a data-proof-ref link.'
  );
});
