/**
 * Headless model for Sheet 05 (Bitemporal Staircase). No DOM, no WebGL.
 * It reuses the compiled scene (axes, seal, table twin) and reads the published
 * `z_norm` / `revised` flags straight from the fixture as opaque pass-through values:
 * heights are scaled by CSS (`calc(var(--z) * ...)`), never by script.
 * Only integer grid indices take part in layout arithmetic.
 *
 * Decision 0011 (§1):
 *  - `unknown` encodes NO height/magnitude (`zToken: null`) and renders as a flat hatched band.
 *  - `invalid` (`!`) is supported without throwing, mapped to contract sign `'violated'` and `zToken: null`.
 */

import { compileBitemporalScene } from '../../scene-ir/src/compile-bitemporal.ts';
import type {
  BitemporalEpochDiffInput,
  BitemporalFixtureInput
} from '../../scene-ir/src/compile-bitemporal.ts';
import type { CartoucheScene } from '../../scene-ir/src/types.ts';

// Orthographic axonometric tile geometry (fixed 2:1 projection, no perspective).
export const TILE_HALF_W = 54;
export const TILE_HALF_H = 27;
export const STEP_X = 60;
export const STEP_Y = 30;
export const Z_FULL = 90;

export type BitemporalSign = 'valid' | 'changed' | 'unknown' | 'not_applicable' | 'violated' | 'invalid';

export interface BitemporalCellModel {
  readonly id: string;
  readonly col: number;
  readonly row: number;
  readonly epoch: string;
  readonly validTime: string;
  readonly state: 'known' | 'changed' | 'unknown' | 'not_applicable' | 'invalid';
  readonly sign: BitemporalSign;
  readonly reason: string | null;
  readonly proofRef: string;
  readonly display: string | null;
  readonly previousDisplay: string | null;
  /** Opaque published height token for known/changed prisms, or null for non-magnitude cells (unknown, N/A, invalid). */
  readonly zToken: string | null;
  readonly screenX: number;
  readonly screenY: number;
}

export interface BitemporalModel {
  readonly scene: CartoucheScene;
  readonly epochs: readonly string[];
  readonly validTimes: readonly string[];
  readonly cells: readonly BitemporalCellModel[];
  /** Back-to-front painter order (cell ids) for the axonometric view. */
  readonly paintOrder: readonly string[];
  readonly drawnSigns: readonly BitemporalSign[];
  readonly viewBox: { readonly minX: number; readonly minY: number; readonly width: number; readonly height: number };
  readonly epochDiff: BitemporalEpochDiffInput | null;
}

const DIGIT = /[0-9]/;

export function buildBitemporalModel(fixture: BitemporalFixtureInput): BitemporalModel {
  const scene = compileBitemporalScene(fixture);
  const grid = fixture.bitemporal_grid;
  const cols = grid.valid_times.length;
  const rows = grid.epochs.length;
  const originX = rows * STEP_X;
  const originY = Z_FULL + TILE_HALF_H;

  const cells: BitemporalCellModel[] = [];
  const signs = new Set<BitemporalSign>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const raw = grid.matrix[row]![col]!;
      const epoch = grid.epochs[row]!;
      const validTime = grid.valid_times[col]!;
      let state: BitemporalCellModel['state'];
      let sign: BitemporalSign;
      let zToken: string | null = null;

      if (raw.state === 'unknown') {
        if (!raw.reason) throw new Error(`unknown cell without published reason: ${raw.proof_ref}`);
        if (DIGIT.test(raw.reason)) throw new Error(`unknown cell reason must not contain digits: ${raw.proof_ref}`);
        state = 'unknown';
        sign = 'unknown';
        // Decision 0011 §1: unknown never encodes a height/magnitude.
        zToken = null;
      } else if (raw.state === 'not_applicable') {
        if (!raw.reason) throw new Error(`not_applicable cell without published reason: ${raw.proof_ref}`);
        state = 'not_applicable';
        sign = 'not_applicable';
      } else if (raw.state === 'invalid') {
        if (!raw.reason) throw new Error(`invalid cell without published reason: ${raw.proof_ref}`);
        state = 'invalid';
        sign = 'invalid';
        zToken = null;
      } else if (raw.state === 'known') {
        if (raw.z_norm === undefined || raw.z_norm === null) {
          throw new Error(`known cell without published z_norm: ${raw.proof_ref}`);
        }
        state = raw.revised ? 'changed' : 'known';
        sign = raw.revised ? 'changed' : 'valid';
        zToken = String(raw.z_norm);
      } else {
        throw new Error(`unsupported bitemporal state "${raw.state}": ${raw.proof_ref}`);
      }
      signs.add(sign);

      cells.push({
        id: `${epoch}@${validTime}`,
        col,
        row,
        epoch,
        validTime,
        state,
        sign,
        reason: raw.reason ?? null,
        proofRef: raw.proof_ref,
        display: raw.display ?? null,
        previousDisplay: raw.previous_display ?? null,
        zToken,
        screenX: originX + (col - row) * STEP_X,
        screenY: originY + (col + row) * STEP_Y
      });
    }
  }

  const paintOrder: string[] = [];
  const diagonals = cols + rows - 1;
  for (let diag = 0; diag < diagonals; diag++) {
    for (const c of cells) {
      if (c.col + c.row === diag) paintOrder.push(c.id);
    }
  }

  const width = (cols + rows) * STEP_X + TILE_HALF_W;
  const height = (cols + rows) * STEP_Y + Z_FULL + 2 * TILE_HALF_H;

  return Object.freeze({
    scene,
    epochs: grid.epochs,
    validTimes: grid.valid_times,
    cells: Object.freeze(cells),
    paintOrder: Object.freeze(paintOrder),
    drawnSigns: Object.freeze([...signs]),
    viewBox: Object.freeze({ minX: 0, minY: 0, width, height }),
    epochDiff: fixture.epoch_diff ?? null
  });
}
