import type { CartoucheSeal, EpistemicSign, EpistemicState, OpaqueDisplayCell } from '../../reader-core/src/index.ts';

export type SheetArchetype =
  | 'relief-3d'
  | 'flow-split'
  | 'kringstand'
  | 'causal-ripple'
  | 'bitemporal-stair'
  | 'monge-fold';

export type DimensionKind = 'nominal' | 'ordinal' | 'stratified' | 'metric' | 'bitemporal' | 'polar';

export interface AxisSpec {
  readonly axis: 'x' | 'y' | 'z';
  readonly dim: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';
  readonly kind: DimensionKind;
  readonly label: string;
}

export interface BoundingBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SceneNodeMark {
  readonly id: string;
  readonly label: string;
  readonly sign: EpistemicSign;
  readonly state: EpistemicState | 'valid' | 'changed' | 'violated';
  readonly proofRef: string;
  readonly completenessWitnessRef?: string | null;
  readonly cell?: OpaqueDisplayCell;
  readonly box: BoundingBox;
  readonly mongeCoords?: { readonly x: number; readonly y: number };
}

export interface SceneDriftEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly statedProofRef: string;
  readonly observedProofRef: string;
}

export interface Unknown3DManifold {
  readonly subjectId: string;
  readonly kind: 'uncertainty_curtain' | 'uncertainty_prism';
  readonly reason: string;
  readonly proofRef: string;
  readonly zFloorZeroForbidden: true;
}

export interface TableTwin {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export const CARTOUCHE_SCENE_SCHEMA_VERSION = 'cartouche.scene/2' as const;

export interface CartoucheScene {
  readonly schemaVersion: typeof CARTOUCHE_SCENE_SCHEMA_VERSION;
  readonly archetype: SheetArchetype;
  readonly projection: '2d' | 'orthographic' | 'perspective';
  readonly axes: readonly AxisSpec[];
  readonly horizon: { readonly complete: boolean; readonly reason: string | null };
  readonly nodes: readonly SceneNodeMark[];
  readonly driftEdges: readonly SceneDriftEdge[];
  readonly unknownManifolds: readonly Unknown3DManifold[];
  readonly usedSigns: readonly string[];
  readonly tableTwin: TableTwin;
  readonly seal: CartoucheSeal;
}
