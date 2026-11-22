/**
 * Decision 0012 §3a (Requirement 1): Semantic, Deterministic Proof Map Layout Compiler.
 * - Source packs form lanes in exact `bundle.imports` order (colimit visible).
 * - Source kinds sit at depth 0 inside their source pack lane with qualified names (`<pack>.<Class>`),
 *   so same-name kinds from different packs never merge.
 * - Derived relations sit strictly to the right of their deepest premise, following the DAG of
 *   served `bundle.rules` and `bundle.relations[].premises`.
 * - Deterministic grid geometry with zero force simulation, zero randomness, zero wall clock,
 *   and zero overlapping bounding boxes (`checkGeometricInvariants` clean).
 */

import { asOpaqueCell } from '../../reader-core/src/index.ts';
import type { CartoucheSeal, EpistemicState, TrustTier } from '../../reader-core/src/index.ts';
import { CARTOUCHE_SCENE_SCHEMA_VERSION } from '../../scene-ir/src/types.ts';
import type { CartoucheScene, SceneNodeMark } from '../../scene-ir/src/types.ts';
import { escapeXml } from './flow-split-svg.ts';
import {
  collectProofMapLegendEntries,
  normalizeProofMapStateSamples,
  renderProofMapEdgeGroupSvg,
  renderProofMapHatchDefs,
  renderProofMapNodeCardSvg,
  resolveManifestRowState,
  resolveProofMapEdgeState
} from './proof-map-signs.ts';
import type { ProofMapLegendEntry, ProofMapSignId } from './proof-map-signs.ts';
import { extractEpochRowNodes, resolveProofMapEpoch } from './proof-map-time.ts';
import type { ProofMapRowSlot } from './proof-map-time.ts';

export interface ProofMapLane {
  readonly pack: string;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ProofMapSemanticNode {
  readonly id: string;
  readonly kind: 'source' | 'derived';
  readonly className: string;
  readonly lane: string;
  readonly qualifiedName: string;
  readonly depth: number;
  readonly premises: readonly string[];
  readonly sign: ProofMapSignId;
  readonly state: EpistemicState;
  readonly reason?: string | undefined;
  readonly completenessRef?: string | undefined;
  readonly proofRef: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly relation?: string;
  readonly key?: string;
  readonly slots?: readonly ProofMapRowSlot[];
}

export interface ProofMapSemanticEdge {
  readonly from: string;
  readonly to: string;
  readonly state: EpistemicState;
}

export interface ProofMapSemanticLayout {
  readonly role: string;
  readonly manifestId: string;
  readonly validAt: string | null;
  readonly knownAt: string | null;
  readonly lanes: readonly ProofMapLane[];
  readonly nodes: readonly ProofMapSemanticNode[];
  readonly edges: readonly ProofMapSemanticEdge[];
  readonly usedSigns: readonly ProofMapSignId[];
  readonly legend: readonly ProofMapLegendEntry[];
  readonly svgWidth: number;
  readonly svgHeight: number;
  readonly svg: string;
  readonly scene: CartoucheScene;
}

export interface ProofMapLayoutOptions {
  readonly role?: string | undefined;
  readonly manifest?: string | undefined;
  readonly focusKey?: string | undefined;
  readonly selection?: string | undefined;
  readonly validAt?: string | undefined;
  readonly knownAt?: string | undefined;
  readonly epoch?: number | undefined;
  readonly expansions?: readonly string[] | undefined;
}

interface BundleImportLike {
  readonly name?: unknown;
}

interface BundleKindLike {
  readonly id?: unknown;
  readonly class?: unknown;
  readonly pack?: unknown;
  readonly module?: unknown;
}

interface BundleSlotLike {
  readonly kind?: unknown;
  readonly table?: unknown;
}

interface BundleRelationLike {
  readonly id?: unknown;
  readonly calc?: unknown;
  readonly premises?: unknown;
}

interface BundleRuleLike {
  readonly relation?: unknown;
  readonly head?: { readonly relation?: unknown };
  readonly body?: readonly { readonly kind?: unknown; readonly relation?: unknown }[];
}

interface BundleLike {
  readonly pack?: { readonly id?: unknown };
  readonly imports?: readonly BundleImportLike[];
  readonly kinds?: readonly BundleKindLike[];
  readonly attributes?: readonly BundleSlotLike[];
  readonly arrows?: readonly BundleSlotLike[];
  readonly relations?: readonly BundleRelationLike[];
  readonly rules?: readonly BundleRuleLike[];
}

interface GateFixtureLike {
  readonly manifest?: {
    readonly id?: unknown;
    readonly epoch?: unknown;
    readonly knowledge_time?: unknown;
    readonly role?: unknown;
    readonly witness_check?: unknown;
    readonly trust_tier?: unknown;
  };
  readonly reader_answers?: Readonly<Record<string, Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>>>>;
  readonly proof_map_state_samples?: unknown;
}

const LANE_X = 24;
const CARD_W = 220;
const CARD_H = 44;
const CARD_GAP_Y = 14;
const LANE_PAD_X = 14;
const LANE_HEADER_H = 28;
const LANE_PAD_BOTTOM = 14;
const LANE_GAP_Y = 18;
const COL_GAP_X = 56;
const DERIVED_COL_TOP_Y = 24;

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function findRoleBundle(fixture: GateFixtureLike, role: string): BundleLike {
  const roleMap = fixture.reader_answers?.[role];
  if (!roleMap) {
    throw new Error(`No recorded reader answers for role "${role}".`);
  }
  const bundlePath = Object.keys(roleMap)
    .sort(cmpStr)
    .find((p) => p.endsWith('/bundle') && roleMap[p]?.status === 200);
  if (!bundlePath || !roleMap[bundlePath]?.body || typeof roleMap[bundlePath]?.body !== 'object') {
    throw new Error(`No 200 /bundle response found for role "${role}".`);
  }
  return roleMap[bundlePath]!.body as BundleLike;
}

function findRoleHorizon(
  fixture: GateFixtureLike,
  role: string
): Readonly<{ complete: boolean; reason: string | null }> {
  const roleMap = fixture.reader_answers?.[role];
  if (!roleMap) return Object.freeze({ complete: true, reason: null });
  const headPath = Object.keys(roleMap)
    .sort(cmpStr)
    .find((p) => p.endsWith('/head') && roleMap[p]?.status === 200);
  const headBody = headPath ? (roleMap[headPath]?.body as { snapshots?: readonly { full?: boolean }[] } | undefined) : undefined;
  const incomplete =
    Array.isArray(headBody?.snapshots) && headBody.snapshots.some((s) => s && s.full === false);
  return incomplete
    ? Object.freeze({ complete: false, reason: 'not_read_in_full' })
    : Object.freeze({ complete: true, reason: null });
}

function packOfKind(k: BundleKindLike, fallbackPack: string): string {
  if (typeof k.pack === 'string' && k.pack.length > 0) return k.pack;
  if (typeof k.module === 'string') {
    const colon = k.module.indexOf(':');
    if (colon > 0) return k.module.slice(0, colon);
  }
  return fallbackPack;
}

/**
 * Compiles a recorded Rezono gate bundle into a deterministic, semantic Proof Map layout,
 * SVG string, and CartoucheScene IR passing checkGeometricInvariants.
 */
export function compileProofMapLayout(
  fixture: GateFixtureLike,
  options: ProofMapLayoutOptions = {}
): ProofMapSemanticLayout {
  const role = options.role ?? (typeof fixture.manifest?.role === 'string' ? fixture.manifest.role : 'checker');
  const bundle = findRoleBundle(fixture, role);

  const packId = typeof bundle.pack?.id === 'string' ? bundle.pack.id : 'publication';
  const epochSel = resolveProofMapEpoch(fixture, options);
  const manifestId = epochSel.manifestId;
  const epoch = typeof fixture.manifest?.epoch === 'number' ? fixture.manifest.epoch : 0;
  const knowledgeTime =
    epochSel.knownAt ??
    (typeof fixture.manifest?.knowledge_time === 'string' ? fixture.manifest.knowledge_time : '1970-01-01T00:00:00Z');
  const rawTier = fixture.manifest?.trust_tier;
  const trustTier: TrustTier =
    rawTier === 'sealed' || rawTier === 'provisional_checked' || rawTier === 'provisional_engine'
      ? rawTier
      : 'sealed';
  const witnessCheck: 'green' | 'failed' = fixture.manifest?.witness_check === 'green' ? 'green' : 'failed';

  // 1. Source pack lanes in exact bundle.imports order
  const lanePacks: string[] = [];
  for (const imp of bundle.imports ?? []) {
    if (typeof imp.name === 'string' && imp.name.length > 0 && !lanePacks.includes(imp.name)) {
      lanePacks.push(imp.name);
    }
  }

  // 2. Source kind nodes (depth 0), keeping same-name classes from distinct packs separate
  const sourceKindsByLane = new Map<string, { id: string; className: string; lane: string; qualifiedName: string }[]>();
  for (const lp of lanePacks) sourceKindsByLane.set(lp, []);

  const sourceKindIds = new Set<string>();
  const sortedKinds = [...(bundle.kinds ?? [])]
    .filter((k): k is BundleKindLike & { id: string } => typeof k.id === 'string' && k.id.length > 0)
    .sort((a, b) => cmpStr(a.id, b.id));

  for (const k of sortedKinds) {
    const lane = packOfKind(k, packId);
    if (!sourceKindsByLane.has(lane)) {
      lanePacks.push(lane);
      sourceKindsByLane.set(lane, []);
    }
    const className = typeof k.class === 'string' && k.class.length > 0 ? k.class : k.id;
    const qualifiedName = `${lane}.${className}`;
    sourceKindsByLane.get(lane)!.push({ id: k.id, className, lane, qualifiedName });
    sourceKindIds.add(k.id);
  }

  // Map attribute & arrow tables back to their owning source kind
  const tableToKind = new Map<string, string>();
  for (const slot of [...(bundle.attributes ?? []), ...(bundle.arrows ?? [])]) {
    if (typeof slot.table === 'string' && typeof slot.kind === 'string' && sourceKindIds.has(slot.kind)) {
      tableToKind.set(slot.table, slot.kind);
    }
  }

  // 3. Derived relations & direct premise graph from bundle.rules + bundle.relations[].premises
  const derivedRelations = [...(bundle.relations ?? [])]
    .filter((r): r is BundleRelationLike & { id: string } => typeof r.id === 'string' && r.id.length > 0)
    .sort((a, b) => cmpStr(a.id, b.id));
  const derivedIds = new Set(derivedRelations.map((r) => r.id));

  const premiseSets = new Map<string, Set<string>>();
  for (const r of derivedRelations) premiseSets.set(r.id, new Set<string>());

  const addPremise = (targetId: string, rawRel: string): void => {
    const target = premiseSets.get(targetId);
    if (!target || rawRel === targetId) return;
    if (derivedIds.has(rawRel) || sourceKindIds.has(rawRel)) {
      target.add(rawRel);
      return;
    }
    const owningKind = tableToKind.get(rawRel);
    if (owningKind) target.add(owningKind);
  };

  for (const r of derivedRelations) {
    if (Array.isArray(r.premises)) {
      for (const p of r.premises) {
        if (typeof p === 'string') addPremise(r.id, p);
      }
    }
  }

  for (const rule of bundle.rules ?? []) {
    const headRel = typeof rule.head?.relation === 'string'
      ? rule.head.relation
      : typeof rule.relation === 'string'
        ? rule.relation
        : '';
    if (!headRel || !derivedIds.has(headRel)) continue;
    for (const lit of rule.body ?? []) {
      if ((lit.kind === 'atom' || lit.kind === 'aggregate') && typeof lit.relation === 'string') {
        addPremise(headRel, lit.relation);
      }
    }
  }

  // 4. Deterministic DAG depth relaxation (source = 0, derived = 1 + max(premise depth))
  const depthMap = new Map<string, number>();
  for (const id of sourceKindIds) depthMap.set(id, 0);
  for (const id of derivedIds) depthMap.set(id, 1);

  const maxPasses = derivedRelations.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const r of derivedRelations) {
      const prems = premiseSets.get(r.id)!;
      let best = 1;
      for (const p of prems) {
        const pd = depthMap.get(p);
        if (pd !== undefined && pd + 1 > best) {
          best = pd + 1;
        }
      }
      if (best !== depthMap.get(r.id)) {
        depthMap.set(r.id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 5. Place source lanes vertically on the left (depth 0)
  const roleMap = fixture.reader_answers?.[role];
  const activeManifest = options.manifest;
  const servedAtManifest = new Set<string>();
  const laneWidth = CARD_W + LANE_PAD_X * 2;
  const lanes: ProofMapLane[] = [];
  const nodes: ProofMapSemanticNode[] = [];
  let cursorY = DERIVED_COL_TOP_Y;

  for (let i = 0; i < lanePacks.length; i++) {
    const pack = lanePacks[i]!;
    const laneKinds = sourceKindsByLane.get(pack) ?? [];
    const laneY = cursorY;
    let cardY = laneY + LANE_HEADER_H;
    const cardX = LANE_X + LANE_PAD_X;

    for (const k of laneKinds) {
      const rowState = resolveManifestRowState(roleMap, packId, activeManifest, k.id);
      if (rowState.served) servedAtManifest.add(k.id);
      const sign: ProofMapSignId = rowState.state === 'unknown' ? 'unknown' : 'origin_observation';
      nodes.push(
        Object.freeze({
          id: k.id,
          kind: 'source',
          className: k.className,
          lane: pack,
          qualifiedName: k.qualifiedName,
          depth: 0,
          premises: Object.freeze([]),
          sign,
          state: rowState.state,
          ...(rowState.reason ? { reason: rowState.reason } : {}),
          proofRef: `${manifestId}/${k.id}`,
          x: cardX,
          y: cardY,
          w: CARD_W,
          h: CARD_H
        })
      );
      cardY += CARD_H + CARD_GAP_Y;
    }

    const contentHeight = laneKinds.length > 0 ? cardY - CARD_GAP_Y - laneY + LANE_PAD_BOTTOM : LANE_HEADER_H + LANE_PAD_BOTTOM;
    lanes.push(
      Object.freeze({
        pack,
        index: i,
        x: LANE_X,
        y: laneY,
        width: laneWidth,
        height: contentHeight
      })
    );
    cursorY = laneY + contentHeight + LANE_GAP_Y;
  }

  // 6. Place derived nodes in depth columns strictly to the right of all source lanes
  const byDepth = new Map<number, (BundleRelationLike & { id: string })[]>();
  let maxDepth = 0;
  for (const r of derivedRelations) {
    const d = depthMap.get(r.id) ?? 1;
    if (d > maxDepth) maxDepth = d;
    const bucket = byDepth.get(d);
    if (bucket) bucket.push(r);
    else byDepth.set(d, [r]);
  }

  const derivedStartX = LANE_X + laneWidth + COL_GAP_X;
  let maxBottomY = cursorY;

  for (let d = 1; d <= maxDepth; d++) {
    const bucket = byDepth.get(d) ?? [];
    const colX = derivedStartX + (d - 1) * (CARD_W + COL_GAP_X);
    let rowY = DERIVED_COL_TOP_Y;
    for (const r of bucket) {
      const sortedPremises = [...(premiseSets.get(r.id) ?? [])].sort(cmpStr);
      const rowState = resolveManifestRowState(roleMap, packId, activeManifest, r.id);
      if (rowState.served) servedAtManifest.add(r.id);
      const sign: ProofMapSignId = rowState.state === 'unknown' ? 'unknown' : 'derived';
      nodes.push(
        Object.freeze({
          id: r.id,
          kind: 'derived',
          className: typeof r.calc === 'string' && r.calc.length > 0 ? r.calc : r.id,
          lane: packId,
          qualifiedName: r.id,
          depth: d,
          premises: Object.freeze(sortedPremises),
          sign,
          state: rowState.state,
          ...(rowState.reason ? { reason: rowState.reason } : {}),
          proofRef: `${manifestId}/${r.id}`,
          x: colX,
          y: rowY,
          w: CARD_W,
          h: CARD_H
        })
      );
      rowY += CARD_H + CARD_GAP_Y;
    }
    if (rowY > maxBottomY) maxBottomY = rowY;
  }

  // 6b. Optional published state samples (absent filtered out unless completeness_ref is published)
  const stateSamples = normalizeProofMapStateSamples(fixture.proof_map_state_samples);
  const sampleSvgParts: string[] = [];
  const drawnSignSet = new Set<ProofMapSignId>(nodes.map((n) => n.sign));
  if (stateSamples.length > 0) {
    let sampleY = maxBottomY + CARD_GAP_Y;
    for (const s of stateSamples) {
      drawnSignSet.add(s.sign);
      sampleSvgParts.push(
        renderProofMapNodeCardSvg({
          key: s.key,
          relation: s.relation,
          label: `${s.relation} (${s.key})`,
          sublabel: s.state,
          sign: s.sign,
          state: s.state,
          proofRef: s.proofRef,
          reason: s.reason,
          completenessRef: s.completenessRef,
          x: LANE_X + LANE_PAD_X,
          y: sampleY,
          w: CARD_W,
          h: CARD_H
        })
      );
      sampleY += CARD_H + CARD_GAP_Y;
    }
    maxBottomY = sampleY;
  }

  // 6c. When an explicit epoch / bitemporal control is requested, append served row nodes for that epoch
  const hasTimeControl = Boolean(options.manifest || options.validAt || options.knownAt);
  if (hasTimeControl) {
    const rowColDepth = maxDepth + 1;
    const rowColX = derivedStartX + (rowColDepth - 1) * (CARD_W + COL_GAP_X);
    const epochRows = extractEpochRowNodes(
      fixture,
      role,
      manifestId,
      rowColX,
      DERIVED_COL_TOP_Y,
      CARD_W,
      CARD_H,
      CARD_GAP_Y
    );
    if (epochRows.length > 0) {
      maxDepth = rowColDepth;
      for (const er of epochRows) {
        const erSign: ProofMapSignId = er.state === 'unknown' ? 'unknown' : 'derived';
        drawnSignSet.add(erSign);
        nodes.push(
          Object.freeze({
            id: er.id,
            kind: 'derived',
            className: er.relation,
            lane: packId,
            qualifiedName: er.relation,
            depth: rowColDepth,
            premises: Object.freeze(derivedIds.has(er.relation) ? [er.relation] : []),
            sign: erSign,
            state: er.state,
            ...(er.reason ? { reason: er.reason } : {}),
            proofRef: er.proofRef,
            x: er.x,
            y: er.y,
            w: er.w,
            h: er.h,
            relation: er.relation,
            key: er.key,
            slots: er.slots
          })
        );
        const bottom = er.y + er.h + CARD_GAP_Y;
        if (bottom > maxBottomY) maxBottomY = bottom;
      }
    }
  }

  // 7. Build premise -> conclusion edges with premise epistemic state
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges: ProofMapSemanticEdge[] = [];
  const hasManifest = Boolean(activeManifest);
  for (const n of nodes) {
    for (const premId of n.premises) {
      const prem = nodeById.get(premId);
      if (prem) {
        const edgeState = resolveProofMapEdgeState(prem.state, n.state, servedAtManifest.has(premId), hasManifest);
        edges.push(Object.freeze({ from: premId, to: n.id, state: edgeState }));
      }
    }
  }

  const svgWidth =
    maxDepth > 0
      ? derivedStartX + maxDepth * (CARD_W + COL_GAP_X) + 24
      : LANE_X + laneWidth + 24;
  const svgHeight = maxBottomY + 24;

  // 8. Emit deterministic SVG using exclusively frozen contracts/data-marks.json + standard ARIA
  const laneSvg = lanes
    .map(
      (lane) =>
        `<g role="region" aria-label="${escapeXml(lane.pack)}" data-key="${escapeXml(lane.pack)}">` +
        `<rect x="${lane.x}" y="${lane.y}" width="${lane.width}" height="${lane.height}" rx="6" fill="var(--c-paper-tint)" stroke="var(--c-rule)" stroke-width="1" />` +
        `<text x="${lane.x + 12}" y="${lane.y + 19}" fill="var(--c-ink-soft)" font-size="11">${escapeXml(lane.pack)}</text>` +
        `</g>`
    )
    .join('');

  const edgeSvg = edges
    .map((e) => {
      const from = nodeById.get(e.from)!;
      const to = nodeById.get(e.to)!;
      return renderProofMapEdgeGroupSvg({
        toRelation: to.relation ?? e.to,
        proofRef: to.proofRef,
        state: e.state,
        x1: from.x + from.w,
        y1: from.y + 22,
        x2: to.x,
        y2: to.y + 22
      });
    })
    .join('');

  const nodeSvg = nodes
    .map((n) =>
      renderProofMapNodeCardSvg({
        key: n.key ?? n.id,
        relation: n.relation ?? n.id,
        label: n.qualifiedName,
        sublabel: n.lane,
        sign: n.sign,
        state: n.state,
        proofRef: n.proofRef,
        reason: n.reason,
        completenessRef: n.completenessRef,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h
      })
    )
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" data-projection="2d" role="img" aria-label="${escapeXml(packId)}">` +
    renderProofMapHatchDefs() +
    laneSvg +
    edgeSvg +
    nodeSvg +
    sampleSvgParts.join('') +
    `</svg>`;

  const legend = collectProofMapLegendEntries([...drawnSignSet]);
  const usedSigns = Object.freeze(legend.map((entry) => entry.id));

  // 9. Emit CartoucheScene IR passing checkGeometricInvariants
  const sceneNodes: SceneNodeMark[] = nodes.map((n) =>
    Object.freeze({
      id: n.id,
      label: n.qualifiedName,
      sign: n.kind === 'source' ? 'origin_observation' : 'derived',
      state: n.state,
      proofRef: n.proofRef,
      cell: asOpaqueCell({
        state: n.state,
        display: n.state === 'unknown' || n.state === 'absent' || n.state === 'not_applicable' ? null : n.qualifiedName,
        ...(n.reason ? { reason: n.reason } : {}),
        proof_ref: n.proofRef
      }),
      box: Object.freeze({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })
    })
  );

  const horizon = findRoleHorizon(fixture, role);

  const scene: CartoucheScene = Object.freeze({
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'causal-ripple',
    projection: '2d',
    axes: Object.freeze([
      Object.freeze({ axis: 'x', dim: 'D2', kind: 'ordinal', label: 'derivation_depth' }),
      Object.freeze({ axis: 'y', dim: 'D1', kind: 'stratified', label: 'source_pack_lane' })
    ]),
    horizon,
    nodes: Object.freeze(sceneNodes),
    driftEdges: Object.freeze([]),
    unknownManifolds: Object.freeze([]),
    usedSigns,
    tableTwin: Object.freeze({
      headers: Object.freeze(['id', 'lane', 'depth', 'qualified_name']),
      rows: Object.freeze(nodes.map((n) => Object.freeze([n.id, n.lane, String(n.depth), n.qualifiedName])))
    }),
    seal: Object.freeze<CartoucheSeal>({
      manifestId,
      epoch,
      knowledgeTime,
      role,
      witnessCheck,
      trustTier,
      provisionalCount: 0,
      canPropose: trustTier !== 'provisional_engine' && witnessCheck === 'green'
    })
  });

  return Object.freeze({
    role,
    manifestId,
    validAt: epochSel.validAt,
    knownAt: epochSel.knownAt,
    lanes: Object.freeze(lanes),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    usedSigns,
    legend,
    svgWidth,
    svgHeight,
    svg,
    scene
  });
}
