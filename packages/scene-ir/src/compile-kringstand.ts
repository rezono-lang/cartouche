/**
 * Zero-Compute Pure Compiler for Sheet 03 (Kringstand / Round Lanes) -> CartoucheScene v2 IR.
 * Decision 0002: Pure projection from server rows + optional live provisional delta via DeltaStore.
 */

import { asOpaqueCell, DeltaStore, renderOpaqueText, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicSign, EpistemicState, ManifestMeta, OpaqueDisplayCell, ZSetChange } from '../../reader-core/src/index.ts';
import { CARTOUCHE_SCENE_SCHEMA_VERSION } from './types.ts';
import type { CartoucheScene, SceneDriftEdge, SceneNodeMark } from './types.ts';
import { assertXDDiscipline } from './xd-guard.ts';

export interface KringstandRowInput {
  readonly key: string;
  readonly lane: string;
  readonly label: string;
  readonly sign: EpistemicSign;
  readonly state: EpistemicState | 'valid' | 'changed' | 'violated';
  readonly reason?: string | null;
  readonly display?: string | null;
  readonly previous_display?: string | null;
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string | null;
}

export interface KringstandProvisionalDelta {
  readonly round_id: string;
  readonly latency_ms: number;
  readonly trust_tier: 'provisional_checked' | 'provisional_engine';
  readonly changes: readonly ZSetChange<KringstandRowInput>[];
}

export interface KringstandDriftEdgeInput {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly stated_proof_ref: string;
  readonly observed_proof_ref: string;
}

export interface KringstandFixtureInput {
  readonly manifest: ManifestMeta;
  readonly horizon?: { readonly complete: boolean; readonly reason: string | null };
  readonly sealed_rows: readonly KringstandRowInput[];
  readonly live_provisional_delta?: KringstandProvisionalDelta | null;
  readonly drift_edges?: readonly KringstandDriftEdgeInput[];
}

export interface CompileKringstandOptions {
  /** When true (default), applies live_provisional_delta if present in the fixture. */
  readonly includeProvisional?: boolean;
}

const CANONICAL_LANES = Object.freeze(['needed', 'waiting', 'ready', 'done', 'absent', 'unknown'] as const);
const CARD_W = 190;
const CARD_H = 72;
const COL_STEP = 220;
const ROW_STEP = 96;

function buildRowCell(row: KringstandRowInput): OpaqueDisplayCell | undefined {
  if (row.state === 'unknown') {
    return asOpaqueCell({
      state: 'unknown',
      display: row.display ?? null,
      reason: row.reason ?? null,
      proof_ref: row.proof_ref
    });
  }
  if (row.state === 'absent') {
    return asOpaqueCell({
      state: 'absent',
      display: null,
      proof_ref: row.proof_ref,
      completeness_witness_ref: row.completeness_witness_ref ?? null
    });
  }
  if (row.state === 'not_applicable') {
    return asOpaqueCell({
      state: 'not_applicable',
      display: null,
      reason: row.reason ?? null,
      proof_ref: row.proof_ref
    });
  }
  if (row.state === 'invalid') {
    return asOpaqueCell({
      state: 'invalid',
      display: row.display ?? null,
      reason: row.reason ?? 'check_failed',
      proof_ref: row.proof_ref
    });
  }
  if (row.display !== undefined && row.display !== null) {
    return asOpaqueCell({
      state: 'known',
      display: row.display,
      previous_display: row.previous_display ?? null,
      reason: row.reason ?? null,
      proof_ref: row.proof_ref
    });
  }
  return undefined;
}

export function compileKringstandScene(
  fixture: KringstandFixtureInput,
  options: CompileKringstandOptions = {}
): CartoucheScene {
  const store = new DeltaStore<KringstandRowInput>(fixture.manifest, fixture.sealed_rows);
  const includeProvisional = options.includeProvisional ?? true;

  if (includeProvisional && fixture.live_provisional_delta && fixture.live_provisional_delta.changes.length > 0) {
    store.applyProvisionalStep(
      fixture.live_provisional_delta.trust_tier,
      fixture.live_provisional_delta.changes
    );
  }

  const mergedEntries = store.rows();
  const laneIndex = new Map<string, number>();
  for (let i = 0; i < CANONICAL_LANES.length; i++) {
    laneIndex.set(CANONICAL_LANES[i]!, i);
  }
  const laneRowCount = new Map<string, number>();

  const nodes: SceneNodeMark[] = [];
  const tableRows: string[][] = [];

  for (const entry of mergedEntries) {
    const row = entry.row;
    let col = laneIndex.get(row.lane);
    if (col === undefined) {
      col = laneIndex.size;
      laneIndex.set(row.lane, col);
    }
    const rowIdx = laneRowCount.get(row.lane) ?? 0;
    laneRowCount.set(row.lane, rowIdx + 1);

    const cell = buildRowCell(row);
    const mark: SceneNodeMark = {
      id: row.key,
      label: row.label,
      sign: row.sign,
      state: row.state,
      proofRef: row.proof_ref,
      completenessWitnessRef: row.completeness_witness_ref ?? null,
      ...(cell ? { cell } : {}),
      box: {
        id: row.key,
        x: col * COL_STEP,
        y: rowIdx * ROW_STEP,
        w: CARD_W,
        h: CARD_H
      }
    };
    nodes.push(mark);

    tableRows.push([
      row.key,
      row.lane,
      row.label,
      row.sign,
      row.state,
      entry.layer,
      cell ? renderOpaqueText(cell) : '',
      row.proof_ref
    ]);
  }

  const driftEdges: SceneDriftEdge[] = (fixture.drift_edges ?? []).map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: e.label ?? 'DRIFT',
    statedProofRef: e.stated_proof_ref,
    observedProofRef: e.observed_proof_ref
  }));

  const signSet = new Set<string>();
  for (const n of nodes) {
    if (Object.prototype.hasOwnProperty.call(SIGNS, n.sign)) signSet.add(n.sign);
    if (Object.prototype.hasOwnProperty.call(SIGNS, n.state)) signSet.add(n.state);
  }
  if (driftEdges.length > 0) signSet.add('drift');

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'kringstand',
    projection: '2d',
    axes: [
      { axis: 'x', dim: 'D5', kind: 'ordinal', label: 'Lane' },
      { axis: 'y', dim: 'D4', kind: 'ordinal', label: 'Round Step' }
    ],
    horizon: fixture.horizon ?? { complete: true, reason: null },
    nodes,
    driftEdges,
    unknownManifolds: [],
    usedSigns: [...signSet].sort(),
    tableTwin: {
      headers: ['Key', 'Lane', 'Label', 'Sign', 'State', 'Layer', 'Value', 'Proof'],
      rows: tableRows
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}
