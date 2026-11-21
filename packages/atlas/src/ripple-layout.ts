/**
 * Sheet 04: Adaptive Distance Columns (>12 nodes) & Causal Ripple Graph (OR-shields vs AND cliffs).
 * Decision 0005: Pure headless layout, zero client compute, proof per mark, deterministic SVG + PixiJS scene data.
 */

import { DATA_MARKS, PALETTES, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicSign, EpistemicState, PaletteName, PaletteTokens, SignSpec } from '../../reader-core/src/index.ts';
import type { ReaderClient } from '../../reader-core/src/client.ts';
import { compileCausalRippleScene } from '../../scene-ir/src/compile-causal-ripple.ts';
import type {
  CausalRippleEdgeInput,
  CausalRippleFixtureInput,
  CausalRippleNodeInput
} from '../../scene-ir/src/compile-causal-ripple.ts';
import { checkGeometricInvariants } from '../../scene-ir/src/geometry-invariants.ts';
import type { CartoucheScene } from '../../scene-ir/src/types.ts';

export type RippleLayoutMode = 'distance-columns' | 'radial-rings';
export type RippleGate = 'FACT' | 'AND' | 'OR';
export type RippleNodeState = EpistemicState | 'valid' | 'changed' | 'violated';

export interface PublishedRippleEdgeInput extends CausalRippleEdgeInput {
  readonly proof_ref?: string;
}

export interface RippleFixtureWithEdges extends Omit<CausalRippleFixtureInput, 'edges'> {
  readonly layout_mode?: RippleLayoutMode;
  readonly edges?: readonly PublishedRippleEdgeInput[];
}

export interface RippleColumnLayout {
  readonly hop: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RippleNodeLayout {
  readonly id: string;
  readonly label: string;
  readonly hop: number;
  readonly isFocal: boolean;
  readonly sign: EpistemicSign;
  readonly signGlyph: string;
  readonly state: RippleNodeState;
  readonly stateGlyph: string;
  readonly gate: RippleGate | null;
  readonly loadBearing: boolean | null;
  readonly redundancyMargin: number | null;
  readonly display: string | null;
  readonly previousDisplay: string | null;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly completenessWitnessRef: string | null;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RippleEdgeLayout {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: 'ripple' | 'drift';
  readonly absorbedByOrShield: boolean;
  readonly cliffPropagation: boolean;
  readonly proofRef: string;
  readonly statedProofRef: string | null;
  readonly observedProofRef: string | null;
  readonly label: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface RippleLegendItem {
  readonly key: string;
  readonly glyph: string;
  readonly kind: SignSpec['kind'];
  readonly token: keyof PaletteTokens;
}

export interface CausalRippleModel {
  readonly scene: CartoucheScene;
  readonly theme: PaletteName;
  readonly palette: PaletteTokens;
  readonly mode: RippleLayoutMode;
  readonly focalId: string;
  readonly dependentTotal: number;
  readonly width: number;
  readonly height: number;
  readonly columns: readonly RippleColumnLayout[];
  readonly nodes: readonly RippleNodeLayout[];
  readonly edges: readonly RippleEdgeLayout[];
  readonly legendItems: readonly RippleLegendItem[];
}

export interface CausalRippleRenderOptions {
  readonly theme?: PaletteName;
  readonly ariaLabel?: string;
  readonly mode?: RippleLayoutMode;
}

export const DISTANCE_COLUMN_THRESHOLD = 12;

const PAD_X = 32;
const HEADER_H = 56;
const COL_HEADER_H = 28;
const COL_PAD = 14;
const NODE_W = 200;
const NODE_H = 82;
const NODE_GAP_Y = 24;
const COL_W = NODE_W + COL_PAD * 2;
const COL_GAP_X = 56;
const FOOTER_H = 64;

function hasOwnSign(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNS, key);
}

function requireNonEmpty(text: string | undefined | null, label: string): string {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`CausalRipple epistemic invariant violation: missing ${label}.`);
  }
  return text;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function strokeForState(state: RippleNodeState, palette: PaletteTokens): string {
  if (state === 'violated' || state === 'invalid') return palette.violated;
  if (state === 'changed') return palette.caution;
  if (state === 'valid' || state === 'known') return palette.valid;
  if (state === 'unknown') return palette.hatchStroke;
  return palette.inkSoft;
}

function validateNode(node: CausalRippleNodeInput): void {
  if (!hasOwnSign(node.sign)) {
    throw new Error(`CausalRipple epistemic invariant violation: unrecognized sign "${String(node.sign)}" on node "${node.id}".`);
  }
  if (!hasOwnSign(node.state)) {
    throw new Error(`CausalRipple epistemic invariant violation: unrecognized state "${String(node.state)}" on node "${node.id}".`);
  }
  requireNonEmpty(node.proof_ref, `proof_ref on node "${node.id}"`);
  if (node.state === 'absent') {
    requireNonEmpty(node.completeness_witness_ref, `completeness_witness_ref on absent node "${node.id}"`);
  }
  if (node.state === 'unknown') {
    requireNonEmpty(node.reason, `reason on unknown node "${node.id}"`);
  }
}

/**
 * Pure, deterministic headless layout compiler for Sheet 04 (Causal Ripple / Adaptive Distance Columns).
 * Reuses compileCausalRippleScene and enforces checkGeometricInvariants.
 * Never fabricates unpublished edges, proofs, gates, or epistemic reasons.
 */
export function buildCausalRippleModel(
  fixture: RippleFixtureWithEdges,
  options: CausalRippleRenderOptions = {}
): CausalRippleModel {
  const theme: PaletteName = options.theme ?? 'swisstopo';
  const palette = PALETTES[theme];
  const scene = compileCausalRippleScene(fixture);

  const violations = checkGeometricInvariants(scene);
  if (violations.length > 0) {
    throw new Error(
      `CausalRipple invariant check failed: ${violations.map((v) => `[${v.code}] ${v.message}`).join('; ')}`
    );
  }

  for (const n of fixture.nodes) {
    validateNode(n);
  }

  const dependentTotal = typeof fixture.dependent_count === 'number' ? fixture.dependent_count : fixture.nodes.length;
  const mode: RippleLayoutMode = options.mode ?? fixture.layout_mode ?? 'distance-columns';

  // Group nodes by hop preserving exact server-published hop and row order (Decision 0001).
  const hopBuckets = new Map<number, CausalRippleNodeInput[]>();
  const hopOrder: number[] = [];
  for (const n of fixture.nodes) {
    let bucket = hopBuckets.get(n.hop);
    if (!bucket) {
      bucket = [];
      hopBuckets.set(n.hop, bucket);
      hopOrder.push(n.hop);
    }
    bucket.push(n);
  }

  let maxRows = 1;
  for (const bucket of hopBuckets.values()) {
    if (bucket.length > maxRows) maxRows = bucket.length;
  }

  const colCount = hopOrder.length > 0 ? hopOrder.length : 1;
  const columns: RippleColumnLayout[] = [];
  const nodes: RippleNodeLayout[] = [];
  const nodeIndex = new Map<string, RippleNodeLayout>();

  let width: number;
  let height: number;

  if (mode === 'distance-columns') {
    const contentW = colCount * COL_W + (colCount - 1) * COL_GAP_X;
    width = PAD_X * 2 + contentW;
    const colTopY = HEADER_H + 16;
    const colBodyH = COL_HEADER_H + COL_PAD * 2 + maxRows * NODE_H + (maxRows - 1) * NODE_GAP_Y;
    height = colTopY + colBodyH + 24 + FOOTER_H;

    for (let colIdx = 0; colIdx < hopOrder.length; colIdx++) {
      const hop = hopOrder[colIdx]!;
      const cx = PAD_X + colIdx * (COL_W + COL_GAP_X);
      columns.push({
        hop,
        x: cx,
        y: colTopY,
        w: COL_W,
        h: colBodyH
      });

      const bucket = hopBuckets.get(hop) ?? [];
      for (let rowIdx = 0; rowIdx < bucket.length; rowIdx++) {
        const raw = bucket[rowIdx]!;
        const nx = cx + COL_PAD;
        const ny = colTopY + COL_HEADER_H + COL_PAD + rowIdx * (NODE_H + NODE_GAP_Y);
        const signSpec = SIGNS[raw.sign]!;
        const stateSpec = SIGNS[raw.state]!;

        const layoutNode: RippleNodeLayout = {
          id: raw.id,
          label: raw.label,
          hop: raw.hop,
          isFocal: raw.id === fixture.focal_id,
          sign: raw.sign,
          signGlyph: signSpec.glyph,
          state: raw.state,
          stateGlyph: stateSpec.glyph,
          gate: raw.cut_set ? raw.cut_set.gate : null,
          loadBearing: raw.cut_set ? raw.cut_set.load_bearing : null,
          redundancyMargin: raw.cut_set ? raw.cut_set.redundancy_margin : null,
          display: raw.display ?? null,
          previousDisplay: raw.previous_display ?? null,
          reason: raw.reason ?? null,
          proofRef: raw.proof_ref,
          completenessWitnessRef: raw.completeness_witness_ref ?? null,
          x: nx,
          y: ny,
          w: NODE_W,
          h: NODE_H
        };
        nodes.push(layoutNode);
        nodeIndex.set(raw.id, layoutNode);
      }
    }
  } else {
    // Radial rings for compact graphs (<= 12 dependents): deterministic non-overlapping ring coordinates.
    const ringStepX = NODE_W + 72;
    const slotStepY = NODE_H + 32;
    const maxHopIdx = Math.max(1, hopOrder.length - 1);
    width = PAD_X * 2 + (maxHopIdx + 1) * ringStepX + NODE_W;
    height = HEADER_H + 32 + maxRows * slotStepY + 32 + FOOTER_H;
    const centerY = HEADER_H + Math.trunc((height - HEADER_H - FOOTER_H) / 2);

    for (let colIdx = 0; colIdx < hopOrder.length; colIdx++) {
      const hop = hopOrder[colIdx]!;
      const bucket = hopBuckets.get(hop) ?? [];
      const rx = PAD_X + colIdx * ringStepX;
      const bandH = bucket.length * NODE_H + Math.max(0, bucket.length - 1) * NODE_GAP_Y;
      const startY = Math.max(HEADER_H + 16, centerY - Math.trunc(bandH / 2));

      columns.push({
        hop,
        x: rx - COL_PAD,
        y: startY - COL_PAD,
        w: NODE_W + COL_PAD * 2,
        h: bandH + COL_PAD * 2
      });

      for (let rowIdx = 0; rowIdx < bucket.length; rowIdx++) {
        const raw = bucket[rowIdx]!;
        const ny = startY + rowIdx * (NODE_H + NODE_GAP_Y);
        const signSpec = SIGNS[raw.sign]!;
        const stateSpec = SIGNS[raw.state]!;

        const layoutNode: RippleNodeLayout = {
          id: raw.id,
          label: raw.label,
          hop: raw.hop,
          isFocal: raw.id === fixture.focal_id,
          sign: raw.sign,
          signGlyph: signSpec.glyph,
          state: raw.state,
          stateGlyph: stateSpec.glyph,
          gate: raw.cut_set ? raw.cut_set.gate : null,
          loadBearing: raw.cut_set ? raw.cut_set.load_bearing : null,
          redundancyMargin: raw.cut_set ? raw.cut_set.redundancy_margin : null,
          display: raw.display ?? null,
          previousDisplay: raw.previous_display ?? null,
          reason: raw.reason ?? null,
          proofRef: raw.proof_ref,
          completenessWitnessRef: raw.completeness_witness_ref ?? null,
          x: rx,
          y: ny,
          w: NODE_W,
          h: NODE_H
        };
        nodes.push(layoutNode);
        nodeIndex.set(raw.id, layoutNode);
      }
    }
  }

  // Render ONLY published edges; never fabricate unpublished causal connectors or borrow node proofs.
  const edges: RippleEdgeLayout[] = [];
  if (fixture.edges && fixture.edges.length > 0) {
    for (const rawEdge of fixture.edges) {
      const src = nodeIndex.get(rawEdge.from);
      const dst = nodeIndex.get(rawEdge.to);
      if (!src || !dst) continue;

      if (rawEdge.kind === 'drift') {
        const statedRef = requireNonEmpty(rawEdge.stated_proof_ref, `stated_proof_ref on drift edge "${rawEdge.id}"`);
        const observedRef = requireNonEmpty(rawEdge.observed_proof_ref, `observed_proof_ref on drift edge "${rawEdge.id}"`);
        const primaryProof =
          rawEdge.proof_ref && rawEdge.proof_ref.trim().length > 0 ? rawEdge.proof_ref : statedRef;
        edges.push({
          id: rawEdge.id,
          from: rawEdge.from,
          to: rawEdge.to,
          kind: 'drift',
          absorbedByOrShield: false,
          cliffPropagation: true,
          proofRef: primaryProof,
          statedProofRef: statedRef,
          observedProofRef: observedRef,
          label: rawEdge.label ?? 'DRIFT',
          x1: src.x + src.w,
          y1: src.y + Math.trunc(src.h / 2),
          x2: dst.x,
          y2: dst.y + Math.trunc(dst.h / 2)
        });
      } else {
        const edgeProof = requireNonEmpty(rawEdge.proof_ref, `proof_ref on edge "${rawEdge.id}"`);
        const absorbedByOrShield = dst.gate === 'OR' && dst.loadBearing === false;
        const cliffPropagation = dst.gate === 'AND' && dst.loadBearing === true;
        edges.push({
          id: rawEdge.id,
          from: rawEdge.from,
          to: rawEdge.to,
          kind: 'ripple',
          absorbedByOrShield,
          cliffPropagation,
          proofRef: edgeProof,
          statedProofRef: null,
          observedProofRef: null,
          label: rawEdge.label ?? '',
          x1: src.x + src.w,
          y1: src.y + Math.trunc(src.h / 2),
          x2: dst.x,
          y2: dst.y + Math.trunc(dst.h / 2)
        });
      }
    }
  }

  const legendItems: RippleLegendItem[] = [];
  for (const key of scene.usedSigns) {
    if (!hasOwnSign(key)) continue;
    const spec = SIGNS[key]!;
    legendItems.push({
      key,
      glyph: spec.glyph,
      kind: spec.kind,
      token: spec.token
    });
  }

  return Object.freeze({
    scene,
    theme,
    palette,
    mode,
    focalId: fixture.focal_id,
    dependentTotal,
    width,
    height,
    columns: Object.freeze(columns),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    legendItems: Object.freeze(legendItems)
  });
}

function edgeCurveD(e: RippleEdgeLayout, offsetY = 0): string {
  const x1 = e.x1;
  const y1 = e.y1 + offsetY;
  const x2 = e.x2;
  const y2 = e.y2 + offsetY;
  const dx = Math.trunc((x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

/**
 * Deterministic SVG renderer for Sheet 04 (headless fallback and test/export target).
 * Single source of truth for SVG structure and canonical contracts/data-marks.json anchors.
 */
export function renderCausalRippleSvg(model: CausalRippleModel, ariaLabel?: string): string {
  const { palette, scene } = model;
  const lines: string[] = [];
  const a11yAttrs = ariaLabel ? ` role="img" aria-label="${escapeXml(ariaLabel)}"` : '';

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg"${a11yAttrs} viewBox="0 0 ${model.width} ${model.height}" width="${model.width}" height="${model.height}" ${DATA_MARKS.sheet}="causal-ripple" ${DATA_MARKS.projection}="2d" ${DATA_MARKS.trust_tier}="${escapeXml(scene.seal.trustTier)}">`
  );

  lines.push('  <defs>');
  lines.push('    <pattern id="cartouche-hatch-45" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">');
  lines.push(`      <line x1="0" y1="0" x2="0" y2="8" stroke="${escapeXml(palette.hatchStroke)}" stroke-width="2" />`);
  lines.push('    </pattern>');
  lines.push('  </defs>');

  lines.push(`  <rect x="0" y="0" width="${model.width}" height="${model.height}" fill="${escapeXml(palette.paper)}" />`);
  lines.push(
    `  <text x="${PAD_X}" y="34" fill="${escapeXml(palette.ink)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600">${escapeXml(model.mode)} · dependents=${model.dependentTotal}</text>`
  );

  if (!scene.horizon.complete) {
    const reasonText = scene.horizon.reason ?? 'incomplete';
    lines.push(
      `  <g ${DATA_MARKS.part}="horizon" ${DATA_MARKS.status}="warning" ${DATA_MARKS.reason}="${escapeXml(reasonText)}">`
    );
    lines.push(
      `    <text x="${model.width - PAD_X}" y="34" text-anchor="end" fill="${escapeXml(palette.caution)}" font-family="ui-monospace, monospace" font-size="12">incomplete: ${escapeXml(reasonText)}</text>`
    );
    lines.push('  </g>');
  }

  // Distance columns / hop rings (purely structural; no fabricated data-relation)
  lines.push('  <g>');
  for (const col of model.columns) {
    lines.push(`    <g ${DATA_MARKS.key}="hop-${col.hop}">`);
    lines.push(
      `      <rect x="${col.x}" y="${col.y}" width="${col.w}" height="${col.h}" rx="4" fill="${escapeXml(palette.paperElev)}" stroke="${escapeXml(palette.rule)}" stroke-width="1" />`
    );
    lines.push(
      `      <text x="${col.x + 12}" y="${col.y + 19}" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="11" font-weight="600">hop ${col.hop}</text>`
    );
    lines.push('    </g>');
  }
  lines.push('  </g>');

  // Published edges only
  const driftGlyph = SIGNS.drift?.glyph ?? '══';
  if (model.edges.length > 0) {
    lines.push('  <g>');
    for (const e of model.edges) {
      if (e.kind === 'drift') {
        const statedRef = e.statedProofRef!;
        const observedRef = e.observedProofRef!;
        lines.push(
          `    <g ${DATA_MARKS.key}="${escapeXml(e.id)}" ${DATA_MARKS.relation}="drift" ${DATA_MARKS.sign}="drift" ${DATA_MARKS.state}="violated" ${DATA_MARKS.proof_ref}="${escapeXml(e.proofRef)}" ${DATA_MARKS.stated_proof_ref}="${escapeXml(statedRef)}" ${DATA_MARKS.observed_proof_ref}="${escapeXml(observedRef)}">`
        );
        lines.push(
          `      <path d="${edgeCurveD(e, -4)}" fill="none" stroke="${escapeXml(palette.proof)}" stroke-width="2" stroke-dasharray="6 3" ${DATA_MARKS.proof_ref}="${escapeXml(statedRef)}" ${DATA_MARKS.stated_proof_ref}="${escapeXml(statedRef)}" />`
        );
        lines.push(
          `      <path d="${edgeCurveD(e, 4)}" fill="none" stroke="${escapeXml(palette.violated)}" stroke-width="2.5" ${DATA_MARKS.proof_ref}="${escapeXml(observedRef)}" ${DATA_MARKS.observed_proof_ref}="${escapeXml(observedRef)}" />`
        );
        lines.push(
          `      <text x="${Math.trunc((e.x1 + e.x2) / 2)}" y="${Math.trunc((e.y1 + e.y2) / 2) - 6}" text-anchor="middle" fill="${escapeXml(palette.violated)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(driftGlyph)} ${escapeXml(e.label)}</text>`
        );
        lines.push('    </g>');
      } else {
        const stroke = e.cliffPropagation
          ? palette.violated
          : e.absorbedByOrShield
            ? palette.valid
            : palette.ruleStrong;
        const dash = e.absorbedByOrShield ? ' stroke-dasharray="4 4"' : '';
        const widthAttr = e.cliffPropagation ? '2.5' : '1.5';
        const rel = e.absorbedByOrShield ? 'or-shield' : e.cliffPropagation ? 'and-cliff' : 'ripple';
        lines.push(
          `    <g ${DATA_MARKS.key}="${escapeXml(e.id)}" ${DATA_MARKS.relation}="${rel}" ${DATA_MARKS.proof_ref}="${escapeXml(e.proofRef)}" ${DATA_MARKS.load_bearing}="${e.cliffPropagation ? 'true' : 'false'}">`
        );
        lines.push(
          `      <path d="${edgeCurveD(e, 0)}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${widthAttr}"${dash} />`
        );
        lines.push('    </g>');
      }
    }
    lines.push('  </g>');
  }

  // Nodes
  const unknownGlyph = SIGNS.unknown?.glyph ?? '▨';
  const absentGlyph = SIGNS.absent?.glyph ?? '⦸';
  lines.push('  <g>');
  for (const n of model.nodes) {
    const stroke = strokeForState(n.state, palette);
    const compAttr = n.completenessWitnessRef
      ? ` ${DATA_MARKS.completeness_ref}="${escapeXml(n.completenessWitnessRef)}"`
      : '';
    const reasonAttr = n.reason ? ` ${DATA_MARKS.reason}="${escapeXml(n.reason)}"` : '';
    const gateAttr = n.gate !== null ? ` ${DATA_MARKS.gate}="${escapeXml(n.gate)}"` : '';
    const lbAttr = n.loadBearing !== null ? ` ${DATA_MARKS.load_bearing}="${n.loadBearing ? 'true' : 'false'}"` : '';
    const dashAttr = n.state === 'absent' ? ' stroke-dasharray="5 4"' : '';

    lines.push(
      `    <g ${DATA_MARKS.key}="${escapeXml(n.id)}" ${DATA_MARKS.sign}="${escapeXml(n.sign)}" ${DATA_MARKS.state}="${escapeXml(n.state)}"${gateAttr}${lbAttr} ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}"${compAttr}${reasonAttr}>`
    );

    // Outer shield or cliff ring (only when cut_set is published)
    if (n.gate === 'OR' && n.loadBearing === false) {
      lines.push(
        `      <rect x="${n.x - 4}" y="${n.y - 4}" width="${n.w + 8}" height="${n.h + 8}" rx="8" fill="none" stroke="${escapeXml(palette.valid)}" stroke-width="2" stroke-dasharray="6 3" />`
      );
    } else if (n.gate === 'AND' && n.loadBearing === true) {
      lines.push(
        `      <rect x="${n.x - 4}" y="${n.y - 4}" width="${n.w + 8}" height="${n.h + 8}" rx="4" fill="none" stroke="${escapeXml(palette.violated)}" stroke-width="2.5" />`
      );
    }

    lines.push(
      `      <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="${escapeXml(palette.paper)}" stroke="${escapeXml(stroke)}" stroke-width="1.5"${dashAttr} />`
    );

    if (n.state === 'unknown') {
      const reason = n.reason!;
      lines.push(
        `      <rect x="${n.x + 2}" y="${n.y + 44}" width="${n.w - 4}" height="${n.h - 46}" rx="2" fill="url(#cartouche-hatch-45)" />`
      );
      lines.push(
        `      <g ${DATA_MARKS.sign}="unknown" ${DATA_MARKS.state}="unknown" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}" ${DATA_MARKS.reason}="${escapeXml(reason)}">`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 64}" fill="${escapeXml(palette.ink)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(unknownGlyph)} unknown · ${escapeXml(reason)}</text>`
      );
      lines.push('      </g>');
    } else if (n.state === 'absent') {
      lines.push(
        `      <g ${DATA_MARKS.sign}="absent" ${DATA_MARKS.state}="absent" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}"${compAttr}>`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 64}" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(absentGlyph)} absent</text>`
      );
      lines.push('      </g>');
    } else if (n.state === 'invalid') {
      const reason = n.reason ?? '';
      lines.push(
        `      <g ${DATA_MARKS.sign}="invalid" ${DATA_MARKS.state}="invalid" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}" ${DATA_MARKS.reason}="${escapeXml(reason)}">`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 64}" fill="${escapeXml(palette.violated)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(n.stateGlyph)} invalid${reason ? ` · ${escapeXml(reason)}` : ''}</text>`
      );
      lines.push('      </g>');
    } else {
      const transition =
        n.previousDisplay && n.display
          ? `${n.previousDisplay} → ${n.display}`
          : n.display ?? n.state;
      lines.push(
        `      <text x="${n.x + 10}" y="${n.y + 64}" fill="${escapeXml(stroke)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(n.stateGlyph)} ${escapeXml(transition)}</text>`
      );
    }

    lines.push(
      `      <text x="${n.x + 10}" y="${n.y + 22}" fill="${escapeXml(palette.ink)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(n.signGlyph)} ${escapeXml(n.label)}</text>`
    );
    if (n.gate !== null && n.state !== 'invalid') {
      const metaLabel = n.redundancyMargin !== null ? `${n.gate} · margin=${n.redundancyMargin}` : n.gate;
      lines.push(
        `      <text x="${n.x + 10}" y="${n.y + 39}" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(metaLabel)}</text>`
      );
    }
    lines.push('    </g>');
  }
  lines.push('  </g>');

  // Footer: Legend + Seal
  const footerY = model.height - FOOTER_H + 12;
  lines.push(`  <g ${DATA_MARKS.part}="legend">`);
  let legX = PAD_X;
  for (const item of model.legendItems) {
    const color = palette[item.token];
    lines.push(`    <g ${DATA_MARKS.sign}="${escapeXml(item.key)}">`);
    lines.push(
      `      <text x="${legX}" y="${footerY + 18}" fill="${escapeXml(color)}" font-family="ui-monospace, monospace" font-size="11">${escapeXml(item.glyph)} ${escapeXml(item.key)}</text>`
    );
    lines.push('    </g>');
    legX += 96;
  }
  lines.push('  </g>');

  const sealStatus = scene.seal.witnessCheck === 'green' ? 'green' : 'red';
  lines.push(`  <g ${DATA_MARKS.part}="seal" ${DATA_MARKS.status}="${sealStatus}">`);
  lines.push(
    `    <text x="${model.width - PAD_X}" y="${footerY + 18}" text-anchor="end" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="11">${escapeXml(scene.seal.trustTier)} · role=${escapeXml(scene.seal.role)} · epoch=${scene.seal.epoch} · ${escapeXml(scene.seal.knowledgeTime)}</text>`
  );
  lines.push('  </g>');

  lines.push('</svg>');
  return lines.join('\n');
}

export function exportCausalRippleSvg(
  fixture: RippleFixtureWithEdges,
  options: CausalRippleRenderOptions = {}
): string {
  const model = buildCausalRippleModel(fixture, options);
  return renderCausalRippleSvg(model, options.ariaLabel);
}

export interface CausalRippleReaderLoadResult {
  readonly model: CausalRippleModel;
  readonly fixture: RippleFixtureWithEdges;
  readonly verified: boolean;
  readonly sha256: string;
}

/**
 * Loads a Causal Ripple projection directly from a Rezono ReaderClient (`POST /ask/reach`)
 * with SHA-256 verification and builds the headless CausalRippleModel.
 */
export async function loadCausalRippleFromReader(
  client: ReaderClient,
  question: unknown,
  options: CausalRippleRenderOptions = {}
): Promise<CausalRippleReaderLoadResult> {
  const res = await client.reach(question);
  if (res.kind !== 'ok') {
    throw new Error(`ReaderClient reach failed (${res.kind}, HTTP ${res.status}).`);
  }
  const fixture = res.body as RippleFixtureWithEdges;
  const model = buildCausalRippleModel(fixture, options);
  return { model, fixture, verified: res.verified, sha256: res.sha256 };
}
