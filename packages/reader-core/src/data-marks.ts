/**
 * Frozen DOM & SVG data-* Test Anchors (contracts/data-marks.json, Decision 0004 & 0006).
 * Every Svelte component and SVG/canvas overlay imports attribute names from here
 * so zero tests couple to CSS classes or translated prose.
 */

export const DATA_MARKS = Object.freeze({
  theme: 'data-cartouche-theme',
  sheet: 'data-sheet',
  projection: 'data-projection',
  fold_angle: 'data-fold-angle',
  trust_tier: 'data-trust-tier',
  part: 'data-part',
  line: 'data-line',
  relation: 'data-relation',
  key: 'data-key',
  depth: 'data-depth',
  polarity: 'data-polarity',
  path: 'data-path',
  sign: 'data-sign',
  state: 'data-state',
  reason: 'data-reason',
  verb: 'data-verb',
  answer: 'data-answer',
  check: 'data-check',
  stop: 'data-stop',
  status: 'data-status',
  turn: 'data-turn',
  proof_ref: 'data-proof-ref',
  completeness_ref: 'data-completeness-ref',
  stated_proof_ref: 'data-stated-proof-ref',
  observed_proof_ref: 'data-observed-proof-ref',
  layer: 'data-layer',
  gate: 'data-gate',
  load_bearing: 'data-load-bearing'
} as const);

export type DataMarkKey = keyof typeof DATA_MARKS;
export type DataMarkAttr = (typeof DATA_MARKS)[DataMarkKey];
