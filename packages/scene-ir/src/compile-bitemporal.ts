/**
 * Zero-Compute Pure Compiler for Sheet 05 (Bitemporal Staircase) -> CartoucheScene v2 IR.
 * Decision 0002: Orthographic Valid-Time x Knowledge-Time matrix with synchronized Table Twin,
 * hollow not_applicable upper triangle, and hatched uncertainty_curtain manifolds for unknown cells.
 */

import { asOpaqueCell, DeltaStore, renderOpaqueText, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicState, ManifestMeta, OpaqueDisplayCell } from '../../reader-core/src/index.ts';
import { CARTOUCHE_SCENE_SCHEMA_VERSION } from './types.ts';
import type { CartoucheScene, SceneNodeMark, Unknown3DManifold } from './types.ts';
import { assertXDDiscipline } from './xd-guard.ts';

export interface BitemporalCellInput {
  readonly state: EpistemicState;
  readonly display?: string | null;
  readonly previous_display?: string | null;
  readonly revised?: boolean;
  readonly z_norm?: number;
  readonly reason?: string | null;
  readonly proof_ref: string;
  readonly completeness_witness_ref?: string | null;
}

export interface BitemporalGridInput {
  readonly projection: 'orthographic' | 'perspective';
  readonly valid_times: readonly string[];
  readonly epochs: readonly string[];
  readonly matrix: readonly (readonly BitemporalCellInput[])[];
  /** True when the gate served opaque display values without a normalized Z-height channel. */
  readonly flat_known_tiles?: boolean;
}

export interface BitemporalEpochDiffEntry {
  readonly key: string;
  readonly change: 'removed' | 'added' | 'changed';
  readonly old_display?: string | null;
  readonly old_proof_iri?: string | null;
  readonly new_display?: string | null;
  readonly new_proof_iri?: string | null;
}

export interface BitemporalEpochDiffInput {
  readonly from_manifest: string;
  readonly to_manifest: string;
  readonly entries: readonly BitemporalEpochDiffEntry[];
}

export interface BitemporalFixtureInput {
  readonly manifest: ManifestMeta;
  readonly horizon?: { readonly complete: boolean; readonly reason: string | null };
  readonly bitemporal_grid: BitemporalGridInput;
  readonly epoch_diff?: BitemporalEpochDiffInput;
}

const CELL_W = 170;
const CELL_H = 72;
const COL_STEP = 200;
const ROW_STEP = 96;

export function compileBitemporalScene(fixture: BitemporalFixtureInput): CartoucheScene {
  const store = new DeltaStore(fixture.manifest);
  const grid = fixture.bitemporal_grid;

  const nodes: SceneNodeMark[] = [];
  const unknownManifolds: Unknown3DManifold[] = [];
  const tableRows: string[][] = [];
  const signSet = new Set<string>(['derived']);

  for (let epochIdx = 0; epochIdx < grid.epochs.length; epochIdx++) {
    const epochLabel = grid.epochs[epochIdx]!;
    const matrixRow = grid.matrix[epochIdx] ?? [];
    const twinRow: string[] = [epochLabel];

    for (let validIdx = 0; validIdx < grid.valid_times.length; validIdx++) {
      const validTime = grid.valid_times[validIdx]!;
      const raw = matrixRow[validIdx];
      if (!raw) {
        throw new Error(`Contract violation: missing bitemporal matrix cell at (${epochLabel}, ${validTime}).`);
      }

      const cell: OpaqueDisplayCell = asOpaqueCell({
        state: raw.state,
        display: raw.display ?? null,
        previous_display: raw.previous_display ?? null,
        reason: raw.reason ?? null,
        proof_ref: raw.proof_ref,
        completeness_witness_ref: raw.completeness_witness_ref ?? null
      });

      const nodeId = `${epochLabel}@${validTime}`;
      const rendered = renderOpaqueText(cell);
      twinRow.push(rendered);

      const label =
        cell.state === 'not_applicable'
          ? rendered
          : cell.state === 'unknown'
            ? rendered
            : `${epochLabel} · ${validTime} · ${rendered}`;

      nodes.push({
        id: nodeId,
        label,
        sign: 'derived',
        state: cell.state,
        proofRef: cell.proofRef,
        completenessWitnessRef: cell.completenessWitnessRef,
        cell,
        box: {
          id: nodeId,
          x: validIdx * COL_STEP,
          y: epochIdx * ROW_STEP,
          w: CELL_W,
          h: CELL_H
        }
      });

      if (cell.state === 'unknown') {
        unknownManifolds.push({
          subjectId: nodeId,
          kind: 'uncertainty_curtain',
          reason: cell.reason!,
          proofRef: cell.proofRef,
          zFloorZeroForbidden: true
        });
      }

      if (Object.prototype.hasOwnProperty.call(SIGNS, cell.state)) {
        signSet.add(cell.state);
      }
      if (raw.revised) {
        signSet.add('changed');
      } else if (cell.state === 'known') {
        signSet.add('valid');
      }
    }

    tableRows.push(twinRow);
  }

  const scene: CartoucheScene = {
    schemaVersion: CARTOUCHE_SCENE_SCHEMA_VERSION,
    archetype: 'bitemporal-stair',
    projection: grid.projection,
    axes: [
      { axis: 'x', dim: 'D4', kind: 'bitemporal', label: 'Valid Time' },
      { axis: 'y', dim: 'D5', kind: 'bitemporal', label: 'Knowledge Time' },
      { axis: 'z', dim: 'D7', kind: 'metric', label: 'Projected Metric' }
    ],
    horizon: fixture.horizon ?? { complete: true, reason: null },
    nodes,
    driftEdges: [],
    unknownManifolds,
    usedSigns: [...signSet].sort(),
    tableTwin: {
      headers: ['Knowledge Epoch', ...grid.valid_times],
      rows: tableRows
    },
    seal: store.seal()
  };

  assertXDDiscipline(scene);
  return scene;
}
