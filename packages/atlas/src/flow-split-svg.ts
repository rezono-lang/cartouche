/**
 * Sheet 02: Flow & Reality-Split Curtain (stated || observed) — Pure Layout & Deterministic SVG Exporter.
 * Decision 0003: Zero client compute, proof per mark, dual-proof drift tracks, zero-leak role projection.
 */

import { DATA_MARKS, PALETTES, SIGNS } from '../../reader-core/src/index.ts';
import type { ManifestMeta, PaletteName, PaletteTokens, SignSpec } from '../../reader-core/src/index.ts';
import { compileFlowSplitScene } from '../../scene-ir/src/compilers.ts';
import { checkGeometricInvariants } from '../../scene-ir/src/geometry-invariants.ts';
import type { CartoucheScene } from '../../scene-ir/src/types.ts';

export type FlowLayer = 'stated' | 'observed' | 'both';
export type FlowNodeSign = 'origin_decision' | 'origin_design' | 'origin_observation' | 'derived';
export type FlowNodeState = 'valid' | 'changed' | 'violated' | 'absent' | 'unknown' | 'invalid';

export interface FlowSplitNodeInput {
  readonly id: string;
  readonly label: string;
  readonly zone: string;
  readonly sign: FlowNodeSign;
  readonly state: FlowNodeState;
  readonly layer?: FlowLayer;
  readonly reason?: string;
  readonly display?: string | null;
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string;
}

export interface FlowSplitEdgeInput {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly layer?: FlowLayer;
  readonly kind: string;
  readonly label?: string;
  readonly proof_ref?: string;
  readonly completeness_witness_ref?: string;
  readonly stated_proof_ref?: string;
  readonly observed_proof_ref?: string;
}

export interface FlowSplitFixtureInput {
  readonly fixture_id?: string;
  readonly manifest: ManifestMeta;
  readonly horizon: { readonly complete: boolean; readonly reason: string | null };
  readonly nodes: readonly FlowSplitNodeInput[];
  readonly edges: readonly FlowSplitEdgeInput[];
}

export interface FlowSplitZoneLayout {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FlowSplitNodeLayout {
  readonly id: string;
  readonly label: string;
  readonly zone: string;
  readonly sign: FlowNodeSign;
  readonly signGlyph: string;
  readonly state: FlowNodeState;
  readonly stateGlyph: string;
  readonly layer: FlowLayer;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly completenessWitnessRef: string | null;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FlowSplitEdgeLayout {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly layer: FlowLayer;
  readonly kind: 'standard' | 'absent' | 'drift';
  readonly label: string;
  readonly proofRef: string | null;
  readonly completenessWitnessRef: string | null;
  readonly statedProofRef: string | null;
  readonly observedProofRef: string | null;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly midX: number;
  readonly midY: number;
}

export interface FlowSplitLegendItem {
  readonly key: string;
  readonly glyph: string;
  readonly kind: SignSpec['kind'];
  readonly token: keyof PaletteTokens;
}

export interface FlowSplitModel {
  readonly scene: CartoucheScene;
  readonly theme: PaletteName;
  readonly palette: PaletteTokens;
  readonly curtainSplit: number;
  readonly width: number;
  readonly height: number;
  readonly curtainY: number;
  readonly zones: readonly FlowSplitZoneLayout[];
  readonly nodes: readonly FlowSplitNodeLayout[];
  readonly edges: readonly FlowSplitEdgeLayout[];
  readonly driftEdges: readonly FlowSplitEdgeLayout[];
  readonly legendItems: readonly FlowSplitLegendItem[];
}

export interface FlowSplitRenderOptions {
  readonly theme?: PaletteName;
  readonly curtainSplit?: number;
  readonly ariaLabel?: string;
}

const PAD_X = 32;
const HEADER_H = 56;
const ZONE_HEADER_H = 28;
const ZONE_PAD = 12;
const NODE_W = 180;
const NODE_H = 78;
const NODE_GAP_Y = 24;
const COL_W = NODE_W + ZONE_PAD * 2;
const COL_GAP_X = 48;
const FOOTER_H = 64;
const DRIFT_TRACK_OFFSET = 5;

function clampCurtainSplit(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 50;
  if (raw < 20) return 20;
  if (raw > 80) return 80;
  return Math.trunc(raw);
}

function requireNonEmpty(text: string | undefined | null, label: string): string {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`FlowSplit epistemic invariant violation: missing ${label}.`);
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

function edgeKindOf(rawKind: string): 'standard' | 'absent' | 'drift' {
  if (rawKind === 'drift') return 'drift';
  if (rawKind === 'absent') return 'absent';
  return 'standard';
}

function hasOwnSign(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNS, key);
}

function stateSignKey(state: FlowNodeState): string {
  return state === 'invalid' ? 'violated' : state;
}

function strokeForState(state: FlowNodeState, palette: PaletteTokens): string {
  if (state === 'violated' || state === 'invalid') return palette.violated;
  if (state === 'changed') return palette.caution;
  if (state === 'valid') return palette.valid;
  if (state === 'unknown') return palette.hatchStroke;
  return palette.inkSoft;
}

/**
 * Builds the pure, deterministic layout model for Sheet 02 (Flow & Reality-Split Curtain).
 * Enforces geometric & epistemic invariants (never fabricates proofs, reasons, or fallback states).
 * Places stated-only nodes in the upper stated plane, observed-only in the lower observed plane,
 * and shared ("both") nodes on the central plane straddling the curtain rail.
 */
export function buildFlowSplitModel(
  fixture: FlowSplitFixtureInput,
  options: FlowSplitRenderOptions = {}
): FlowSplitModel {
  const theme: PaletteName = options.theme ?? 'swisstopo';
  const palette = PALETTES[theme];
  const curtainSplit = clampCurtainSplit(options.curtainSplit);
  const scene = compileFlowSplitScene({
    manifest: fixture.manifest,
    horizon: fixture.horizon,
    nodes: fixture.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      zone: n.zone,
      sign: n.sign,
      state: n.state === 'invalid' ? 'violated' : n.state,
      ...(n.reason !== undefined ? { reason: n.reason } : {}),
      proof_ref: n.proof_ref,
      ...(n.completeness_witness_ref !== undefined ? { completeness_witness_ref: n.completeness_witness_ref } : {})
    })),
    edges: fixture.edges
  });

  const violations = checkGeometricInvariants(scene);
  if (violations.length > 0) {
    throw new Error(
      `FlowSplit invariant check failed: ${violations.map((v) => `[${v.code}] ${v.message}`).join('; ')}`
    );
  }

  // Validate nodes and preserve exact first-seen zone order from server-projected nodes
  const zoneOrder: string[] = [];
  const zoneBuckets = new Map<
    string,
    { stated: FlowSplitNodeInput[]; both: FlowSplitNodeInput[]; observed: FlowSplitNodeInput[] }
  >();

  for (const node of fixture.nodes) {
    if (!hasOwnSign(node.sign)) {
      throw new Error(`FlowSplit epistemic invariant violation: unrecognized sign "${String(node.sign)}" on node "${node.id}".`);
    }
    const mappedStateSign = stateSignKey(node.state);
    if (!hasOwnSign(mappedStateSign)) {
      throw new Error(`FlowSplit epistemic invariant violation: unrecognized state "${String(node.state)}" on node "${node.id}".`);
    }
    requireNonEmpty(node.proof_ref, `proof_ref on node "${node.id}"`);
    if (node.state === 'absent') {
      requireNonEmpty(node.completeness_witness_ref, `completeness_witness_ref on absent node "${node.id}"`);
    }
    if (node.state === 'unknown' || node.state === 'invalid') {
      requireNonEmpty(node.reason, `reason on ${node.state} node "${node.id}"`);
    }

    let bucket = zoneBuckets.get(node.zone);
    if (!bucket) {
      bucket = { stated: [], both: [], observed: [] };
      zoneBuckets.set(node.zone, bucket);
      zoneOrder.push(node.zone);
    }
    const layer: FlowLayer = node.layer ?? 'both';
    bucket[layer].push(node);
  }

  let maxStated = 0;
  let maxBoth = 0;
  let maxObserved = 0;
  for (const bucket of zoneBuckets.values()) {
    if (bucket.stated.length > maxStated) maxStated = bucket.stated.length;
    if (bucket.both.length > maxBoth) maxBoth = bucket.both.length;
    if (bucket.observed.length > maxObserved) maxObserved = bucket.observed.length;
  }

  const statedBandH = maxStated > 0 ? maxStated * NODE_H + (maxStated - 1) * NODE_GAP_Y + NODE_GAP_Y : 0;
  const bothBandH = maxBoth > 0 ? maxBoth * NODE_H + (maxBoth - 1) * NODE_GAP_Y : NODE_H;
  const observedBandH = maxObserved > 0 ? NODE_GAP_Y + maxObserved * NODE_H + (maxObserved - 1) * NODE_GAP_Y : 0;

  const colCount = zoneOrder.length > 0 ? zoneOrder.length : 1;
  const contentW = colCount * COL_W + (colCount - 1) * COL_GAP_X;
  const width = PAD_X * 2 + contentW;
  const zoneTopY = HEADER_H + 16;
  const nodesStartY = zoneTopY + ZONE_HEADER_H + ZONE_PAD;
  const zoneBodyH = ZONE_HEADER_H + ZONE_PAD * 2 + statedBandH + bothBandH + observedBandH;
  const height = zoneTopY + zoneBodyH + 24 + FOOTER_H;

  // Horizontal reality-split curtain rail: stated plane sits above curtainY, observed plane below.
  const bothMidY = nodesStartY + statedBandH + Math.trunc(bothBandH / 2);
  const curtainY =
    curtainSplit === 50
      ? bothMidY
      : zoneTopY + Math.trunc((zoneBodyH * curtainSplit) / 100);

  const zones: FlowSplitZoneLayout[] = [];
  const nodes: FlowSplitNodeLayout[] = [];
  const nodeIndex = new Map<string, FlowSplitNodeLayout>();

  for (let colIdx = 0; colIdx < zoneOrder.length; colIdx++) {
    const zoneName = zoneOrder[colIdx]!;
    const zx = PAD_X + colIdx * (COL_W + COL_GAP_X);
    zones.push({
      name: zoneName,
      x: zx,
      y: zoneTopY,
      w: COL_W,
      h: zoneBodyH
    });

    const bucket = zoneBuckets.get(zoneName)!;
    const placeBand = (items: readonly FlowSplitNodeInput[], baseY: number): void => {
      for (let rowIdx = 0; rowIdx < items.length; rowIdx++) {
        const raw = items[rowIdx]!;
        const nx = zx + ZONE_PAD;
        const ny = baseY + rowIdx * (NODE_H + NODE_GAP_Y);
        const signSpec = SIGNS[raw.sign]!;
        const stateSpec = SIGNS[stateSignKey(raw.state)]!;
        const layoutNode: FlowSplitNodeLayout = {
          id: raw.id,
          label: raw.label,
          zone: raw.zone,
          sign: raw.sign,
          signGlyph: signSpec.glyph,
          state: raw.state,
          stateGlyph: raw.state === 'invalid' ? '!' : stateSpec.glyph,
          layer: raw.layer ?? 'both',
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
    };

    placeBand(bucket.stated, nodesStartY);
    placeBand(bucket.both, nodesStartY + statedBandH);
    placeBand(bucket.observed, nodesStartY + statedBandH + bothBandH + NODE_GAP_Y);
  }

  const edges: FlowSplitEdgeLayout[] = [];
  const driftEdges: FlowSplitEdgeLayout[] = [];

  for (const rawEdge of fixture.edges) {
    const src = nodeIndex.get(rawEdge.from);
    const dst = nodeIndex.get(rawEdge.to);
    if (!src || !dst) continue;

    const kind = edgeKindOf(rawEdge.kind);
    let statedRef: string | null = null;
    let observedRef: string | null = null;
    let completenessRef: string | null = null;
    let primaryProof: string | null;

    if (kind === 'drift') {
      statedRef = requireNonEmpty(rawEdge.stated_proof_ref, `stated_proof_ref on drift edge "${rawEdge.id}"`);
      observedRef = requireNonEmpty(rawEdge.observed_proof_ref, `observed_proof_ref on drift edge "${rawEdge.id}"`);
      // Decision 0011 §1: drift edge carries stated & observed proofs; NEVER borrow stated_proof_ref as generic proof_ref.
      primaryProof = rawEdge.proof_ref && rawEdge.proof_ref.trim().length > 0 ? rawEdge.proof_ref : null;
    } else if (kind === 'absent') {
      primaryProof = requireNonEmpty(rawEdge.proof_ref, `proof_ref on absent edge "${rawEdge.id}"`);
      completenessRef = requireNonEmpty(
        rawEdge.completeness_witness_ref,
        `completeness_witness_ref on absent edge "${rawEdge.id}"`
      );
    } else {
      primaryProof = requireNonEmpty(rawEdge.proof_ref, `proof_ref on edge "${rawEdge.id}"`);
    }

    const sameCol = src.x === dst.x;
    const forward = src.x < dst.x;

    const x1 = sameCol ? src.x + src.w : forward ? src.x + src.w : src.x;
    const y1 = src.y + Math.trunc(src.h / 2);
    const x2 = sameCol ? dst.x + dst.w : forward ? dst.x : dst.x + dst.w;
    const y2 = dst.y + Math.trunc(dst.h / 2);
    const midX = sameCol ? x1 + 28 : Math.trunc((x1 + x2) / 2);
    const midY = Math.trunc((y1 + y2) / 2);

    const layoutEdge: FlowSplitEdgeLayout = {
      id: rawEdge.id,
      from: rawEdge.from,
      to: rawEdge.to,
      layer: rawEdge.layer ?? 'both',
      kind,
      label: rawEdge.label ?? (kind === 'drift' ? 'DRIFT' : ''),
      proofRef: primaryProof,
      completenessWitnessRef: completenessRef,
      statedProofRef: statedRef,
      observedProofRef: observedRef,
      x1,
      y1,
      x2,
      y2,
      midX,
      midY
    };

    edges.push(layoutEdge);
    if (kind === 'drift') {
      driftEdges.push(layoutEdge);
    }
  }

  const legendItems: FlowSplitLegendItem[] = [];
  for (const key of scene.usedSigns) {
    const spec = SIGNS[key];
    if (!spec) continue;
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
    curtainSplit,
    width,
    height,
    curtainY,
    zones: Object.freeze(zones),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    driftEdges: Object.freeze(driftEdges),
    legendItems: Object.freeze(legendItems)
  });
}

function edgePathD(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.trunc((x2 - x1) / 2);
  if (x1 === x2) {
    return `M ${x1} ${y1} C ${x1 + 36} ${y1} ${x2 + 36} ${y2} ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

export function edgePathFor(edge: FlowSplitEdgeLayout, offsetY = 0): string {
  return edgePathD(edge.x1, edge.y1 + offsetY, edge.x2, edge.y2 + offsetY);
}

/**
 * Renders the deterministic SVG markup from a pre-built FlowSplitModel.
 * Shared as the single source of truth between FlowSplitSheet.svelte and exportFlowSplitSvg.
 */
export function renderFlowSplitSvg(model: FlowSplitModel, ariaLabel?: string): string {
  const { palette, scene } = model;
  const lines: string[] = [];
  const a11yAttrs = ariaLabel ? ` role="img" aria-label="${escapeXml(ariaLabel)}"` : '';

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg"${a11yAttrs} viewBox="0 0 ${model.width} ${model.height}" width="${model.width}" height="${model.height}" ${DATA_MARKS.sheet}="flow-split" ${DATA_MARKS.projection}="2d" ${DATA_MARKS.trust_tier}="${escapeXml(scene.seal.trustTier)}">`
  );

  // Defs: 45-degree diagonal hatch for unknown (▨)
  lines.push('  <defs>');
  lines.push('    <pattern id="cartouche-hatch-45" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">');
  lines.push(`      <line x1="0" y1="0" x2="0" y2="8" stroke="${escapeXml(palette.hatchStroke)}" stroke-width="2" />`);
  lines.push('    </pattern>');
  lines.push('  </defs>');

  // Paper background
  lines.push(`  <rect x="0" y="0" width="${model.width}" height="${model.height}" fill="${escapeXml(palette.paper)}" />`);

  // Curtain split plane backdrop (stated upper || observed lower)
  const statedH = Math.max(0, model.curtainY - HEADER_H);
  const observedH = Math.max(0, model.height - FOOTER_H - model.curtainY);
  lines.push(`  <g ${DATA_MARKS.part}="curtain">`);
  lines.push(`    <g ${DATA_MARKS.layer}="stated">`);
  lines.push(`      <rect x="0" y="${HEADER_H}" width="${model.width}" height="${statedH}" fill="${escapeXml(palette.paperTint)}" opacity="0.45" />`);
  lines.push('    </g>');
  lines.push(`    <g ${DATA_MARKS.layer}="observed">`);
  lines.push(`      <rect x="0" y="${model.curtainY}" width="${model.width}" height="${observedH}" fill="${escapeXml(palette.paper)}" opacity="0.45" />`);
  lines.push('    </g>');
  lines.push(`    <line x1="0" y1="${model.curtainY}" x2="${model.width}" y2="${model.curtainY}" stroke="${escapeXml(palette.proof)}" stroke-width="1.5" stroke-dasharray="4 4" />`);
  lines.push(`    <text x="${PAD_X}" y="34" fill="${escapeXml(palette.ink)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600">stated ∥ observed</text>`);
  lines.push('  </g>');

  // Horizon status (honest boundary when incomplete)
  if (!scene.horizon.complete) {
    const reasonText = scene.horizon.reason ?? 'not_read_in_full';
    lines.push(
      `  <g ${DATA_MARKS.part}="horizon" ${DATA_MARKS.status}="warning" ${DATA_MARKS.reason}="${escapeXml(reasonText)}">`
    );
    lines.push(
      `    <text x="${model.width - PAD_X}" y="34" text-anchor="end" fill="${escapeXml(palette.caution)}" font-family="ui-monospace, monospace" font-size="12">incomplete: ${escapeXml(reasonText)}</text>`
    );
    lines.push('  </g>');
  }

  // Zone columns
  lines.push('  <g>');
  for (const z of model.zones) {
    lines.push(`    <g ${DATA_MARKS.key}="${escapeXml(z.name)}">`);
    lines.push(`      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="4" fill="${escapeXml(palette.paperElev)}" stroke="${escapeXml(palette.rule)}" stroke-width="1" />`);
    lines.push(`      <text x="${z.x + 12}" y="${z.y + 19}" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="11" font-weight="600">${escapeXml(z.name)}</text>`);
    lines.push('    </g>');
  }
  lines.push('  </g>');

  // Edges
  const driftGlyph = SIGNS.drift?.glyph ?? '══';
  const absentGlyph = SIGNS.absent?.glyph ?? '⦸';
  const unknownGlyph = SIGNS.unknown?.glyph ?? '▨';

  lines.push('  <g>');
  for (const e of model.edges) {
    if (e.kind === 'drift') {
      const statedRef = e.statedProofRef!;
      const observedRef = e.observedProofRef!;
      const dStated = edgePathFor(e, -DRIFT_TRACK_OFFSET);
      const dObserved = edgePathFor(e, DRIFT_TRACK_OFFSET);
      const ownProofAttr = e.proofRef ? ` ${DATA_MARKS.proof_ref}="${escapeXml(e.proofRef)}"` : '';
      lines.push(
        `    <g ${DATA_MARKS.key}="${escapeXml(e.id)}" ${DATA_MARKS.relation}="drift" ${DATA_MARKS.sign}="drift" ${DATA_MARKS.state}="violated" ${DATA_MARKS.layer}="both"${ownProofAttr} ${DATA_MARKS.stated_proof_ref}="${escapeXml(statedRef)}" ${DATA_MARKS.observed_proof_ref}="${escapeXml(observedRef)}">`
      );
      lines.push(
        `      <g ${DATA_MARKS.layer}="stated" ${DATA_MARKS.stated_proof_ref}="${escapeXml(statedRef)}">`
      );
      lines.push(
        `        <path d="${dStated}" fill="none" stroke="${escapeXml(palette.proof)}" stroke-width="2" stroke-dasharray="6 3" ${DATA_MARKS.stated_proof_ref}="${escapeXml(statedRef)}" />`
      );
      lines.push('      </g>');
      lines.push(
        `      <g ${DATA_MARKS.layer}="observed" ${DATA_MARKS.observed_proof_ref}="${escapeXml(observedRef)}">`
      );
      lines.push(
        `        <path d="${dObserved}" fill="none" stroke="${escapeXml(palette.violated)}" stroke-width="2.5" ${DATA_MARKS.observed_proof_ref}="${escapeXml(observedRef)}" />`
      );
      lines.push('      </g>');
      lines.push(
        `      <rect x="${e.midX - 46}" y="${e.midY - 12}" width="92" height="24" rx="3" fill="${escapeXml(palette.paperElev)}" stroke="${escapeXml(palette.violated)}" stroke-width="1.5" />`
      );
      lines.push(
        `      <text x="${e.midX}" y="${e.midY + 4}" text-anchor="middle" fill="${escapeXml(palette.violated)}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">${escapeXml(driftGlyph)} ${escapeXml(e.label)}</text>`
      );
      lines.push('    </g>');
    } else if (e.kind === 'absent') {
      const d = edgePathFor(e, 0);
      const compRef = e.completenessWitnessRef!;
      lines.push(
        `    <g ${DATA_MARKS.key}="${escapeXml(e.id)}" ${DATA_MARKS.relation}="absent" ${DATA_MARKS.sign}="absent" ${DATA_MARKS.state}="absent" ${DATA_MARKS.layer}="${escapeXml(e.layer)}" ${DATA_MARKS.proof_ref}="${escapeXml(e.proofRef!)}" ${DATA_MARKS.completeness_ref}="${escapeXml(compRef)}">`
      );
      lines.push(
        `      <path d="${d}" fill="none" stroke="${escapeXml(palette.inkSoft)}" stroke-width="1.5" stroke-dasharray="5 5" />`
      );
      lines.push(
        `      <text x="${e.midX}" y="${e.midY - 4}" text-anchor="middle" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="11">${escapeXml(absentGlyph)}</text>`
      );
      lines.push('    </g>');
    } else {
      const d = edgePathFor(e, 0);
      lines.push(
        `    <g ${DATA_MARKS.key}="${escapeXml(e.id)}" ${DATA_MARKS.relation}="standard" ${DATA_MARKS.layer}="${escapeXml(e.layer)}" ${DATA_MARKS.proof_ref}="${escapeXml(e.proofRef!)}">`
      );
      lines.push(
        `      <path d="${d}" fill="none" stroke="${escapeXml(palette.ruleStrong)}" stroke-width="1.5" />`
      );
      lines.push('    </g>');
    }
  }
  lines.push('  </g>');

  // Nodes
  lines.push('  <g>');
  for (const n of model.nodes) {
    const strokeColor = strokeForState(n.state, palette);
    const dashAttr = n.state === 'absent' ? ' stroke-dasharray="5 4"' : n.state === 'invalid' ? ' stroke-dasharray="3 2"' : '';
    const compAttr = n.completenessWitnessRef
      ? ` ${DATA_MARKS.completeness_ref}="${escapeXml(n.completenessWitnessRef)}"`
      : '';
    const reasonAttr = n.reason ? ` ${DATA_MARKS.reason}="${escapeXml(n.reason)}"` : '';
    lines.push(
      `    <g ${DATA_MARKS.key}="${escapeXml(n.id)}" ${DATA_MARKS.sign}="${escapeXml(n.sign)}" ${DATA_MARKS.state}="${escapeXml(n.state)}" ${DATA_MARKS.layer}="${escapeXml(n.layer)}" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}"${compAttr}${reasonAttr}>`
    );
    lines.push(
      `      <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="${escapeXml(palette.paper)}" stroke="${escapeXml(strokeColor)}" stroke-width="1.5"${dashAttr} />`
    );
    if (n.state === 'unknown') {
      const reason = n.reason!;
      lines.push(
        `      <rect x="${n.x + 2}" y="${n.y + 42}" width="${n.w - 4}" height="${n.h - 44}" rx="2" fill="url(#cartouche-hatch-45)" />`
      );
      lines.push(
        `      <g ${DATA_MARKS.sign}="unknown" ${DATA_MARKS.state}="unknown" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}" ${DATA_MARKS.reason}="${escapeXml(reason)}">`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 62}" fill="${escapeXml(palette.ink)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(unknownGlyph)} unknown · ${escapeXml(reason)}</text>`
      );
      lines.push('      </g>');
    } else if (n.state === 'absent') {
      lines.push(
        `      <g ${DATA_MARKS.sign}="absent" ${DATA_MARKS.state}="absent" ${DATA_MARKS.proof_ref}="${escapeXml(n.proofRef)}"${compAttr}>`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 56}" fill="${escapeXml(palette.inkSoft)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(absentGlyph)} absent</text>`
      );
      lines.push('      </g>');
    } else if (n.state === 'invalid') {
      const reason = n.reason!;
      lines.push(
        `      <g ${DATA_MARKS.sign}="violated" ${DATA_MARKS.state}="invalid" ${DATA_MARKS.reason}="${escapeXml(reason)}">`
      );
      lines.push(
        `        <text x="${n.x + 10}" y="${n.y + 56}" fill="${escapeXml(palette.violated)}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">! invalid · ${escapeXml(reason)}</text>`
      );
      lines.push('      </g>');
    } else {
      lines.push(
        `      <text x="${n.x + 10}" y="${n.y + 56}" fill="${escapeXml(strokeColor)}" font-family="ui-monospace, monospace" font-size="10">${escapeXml(n.stateGlyph)} ${escapeXml(n.state)}</text>`
      );
    }
    lines.push(
      `      <text x="${n.x + 10}" y="${n.y + 24}" fill="${escapeXml(palette.ink)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(n.signGlyph)} ${escapeXml(n.label)}</text>`
    );
    lines.push('    </g>');
  }
  lines.push('  </g>');

  // Footer: Auto-generated Legend + 3-tier Cartouche Corner Seal
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

/**
 * Deterministic, pure SVG exporter for Sheet 02 (Flow & Reality-Split Curtain).
 * Same input always yields identical UTF-8 bytes.
 */
export function exportFlowSplitSvg(
  fixture: FlowSplitFixtureInput,
  options: FlowSplitRenderOptions = {}
): string {
  const model = buildFlowSplitModel(fixture, options);
  return renderFlowSplitSvg(model, options.ariaLabel);
}
