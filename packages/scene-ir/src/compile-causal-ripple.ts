/**
 * Zero-Compute Pure Compiler for Sheet 04 (Causal Ripple / Cut-Set Rings) -> CartoucheScene v2 IR.
 * Decision 0002: Preserves exact server node order, incomplete horizon honesty, and opaque display tokens.
 */

import { asOpaqueCell, DeltaStore, renderOpaqueText, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicSign, EpistemicState, ManifestMeta, OpaqueDisplayCell } from '../../reader-core/src/index.ts';
import { CARTOUCHE_SCENE_SCHEMA_VERSION } from './types.ts';
import type { CartoucheScene, SceneDriftEdge, SceneNodeMark } from './types.ts';
import { assertXDDiscipline } from './xd-guard.ts';

export interface CausalCutSetMeta {
  readonly load_bearing: boolean;
  readonly redundancy_margin: number;
  readonly gate: 'FACT' | 'AND' | 'OR';
}

export interface CausalRippleNodeInput {
  readonly id: string;
  readonly label: string;
  readonly hop: number;
  readonly sign: EpistemicSign;
  readonly state: EpistemicState | 'valid' | 'changed' | 'violated';
  readonly display?: string | null;
  readonly previous_display?: string | null;
  readonly reason?: string | null;
  readonly cut_set?: CausalCutSetMeta;
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string | null;
}

export interface CausalRippleEdgeInput {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly label?: string;
  readonly stated_proof_ref?: string;
  readonly observed_proof_ref?: string;
}

export interface CausalRippleFixtureInput {
  readonly manifest: ManifestMeta;
  readonly focal_id: string;
  readonly horizon: { readonly complete: boolean; readonly reason: string | null };
  readonly dependent_count?: number;
  readonly nodes: readonly CausalRippleNodeInput[];
  readonly edges?: readonly CausalRippleEdgeInput[];
}

const CARD_W = 200;
const CARD_H = 72;
const HOP_STEP = 240;
const SLOT_STEP = 100;

function buildNodeCell(node: CausalRippleNodeInput): OpaqueDisplayCell | undefined {
  if (node.state === 'unknown') {
    return asOpaqueCell({
      state: 'unknown',
      display: node.display ?? null,
      reason: node.reason ?? null,
      proof_ref: node.proof_ref
    });
  }
  if (node.state === 'absent') {
    return asOpaqueCell({
      state: 'absent',
      display: null,
      proof_ref: node.proof_ref,
      completeness_witness_ref: node.completeness_witness_ref ?? null
    });
  }
  if (node.state === 'not_applicable') {
    return asOpaqueCell({
      state: 'not_applicable',
      display: null,
      reason: node.reason ?? null,
      proof_ref: node.proof_ref
    });
  }
  if (node.state === 'invalid') {
    return asOpaqueCell({
      state: 'invalid',
      display: node.display ?? null,
      reason: node.reason ?? 'check_failed',
      proof_ref: node.proof_ref
    });
  }
  if (node.display !== undefined && node.display !== null) {
    return asOpaqueCell({
      state: 'known',
      display: node.display,
      previous_display: node.previous_display ?? null,
      reason: node.reason ?? null,
      proof_ref: node.proof_ref
    });
  }
  return undefined;
}

export function compileCausalRippleScene(fixture: CausalRippleFixtureInput): CartoucheScene {
  const store = new DeltaStore(fixture.manifest);
  const hopSlotCount = new Map<number, number>();

  const nodes: SceneNodeMark[] = [];
  const tableRows: string[][] = [];

  for (const n of fixture.nodes) {
    const slot = hopSlotCount.get(n.hop) ?? 0;
    hopSlotCount.set(n.hop, slot + 1);

    const cell = buildNodeCell(n);
    const mark: SceneNodeMark = {
      id: n.id,
      label: n.label,
      sign: n.sign,
      state: n.state,
      proofRef: n.proof_ref,
      completenessWitnessRef: n.completeness_witness_ref ?? null,
      ...(cell ? { cell } : {}),
      box: {
        id: n.id,
        x: n.hop * HOP_STEP,
        y: slot * SLOT_STEP,
        w: CARD_W,
        h: CARD_H
      }
    };
    nodes.push(mark);

    tableRows.push([
      n.id,
      n.label,
      String(n.hop),
      n.cut_set?.gate ?? '',
      n.sign,
      n.state,
      cell ? renderOpaqueText(cell) : '',
      cell?.previousDisplay ?? '',
      n.proof_ref
    ]);
  }

  const driftEdges: SceneDriftEdge[] = (fixture.edges ?? [])
    .filter((e) => e.kind === 'drift')
    .map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label ?? 'DRIFT',
      statedProofRef: e.stated_proof_ref ?? '',
      observedProofRef: e.observed_proof_ref ?? ''
    }));

  const signSet = new Set<string>();
  for (const n of nodes) {
    if (Object.prototype.hasOwnProperty.call(SIGNS, n.sign)) signSet.add(n.sign);
    if (Object.prototype.hasOwnProperty.call(SIGNS, n.state)) signSet.add(n.state);
  }
  if (driftEdges.length > 0) signSet.add('drift');

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'causal-ripple',
    projection: '2d',
    axes: [
      { axis: 'x', dim: 'D2', kind: 'polar', label: 'Causal Hop Ring' },
      { axis: 'y', dim: 'D1', kind: 'nominal', label: 'Cut-Set Slot' }
    ],
    horizon: fixture.horizon,
    nodes,
    driftEdges,
    unknownManifolds: [],
    usedSigns: [...signSet].sort(),
    tableTwin: {
      headers: ['ID', 'Label', 'Hop', 'Gate', 'Sign', 'State', 'Value', 'Previous', 'Proof'],
      rows: tableRows
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}
