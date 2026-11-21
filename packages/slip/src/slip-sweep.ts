/**
 * Stops-only sweep model for @rezono/slip. Every status, turn, check and fold
 * value is published by the reader; this module only validates shape and
 * decides whether a published fold may be drawn. It never derives a value.
 */

export type SweepStopStatus = 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
export type SweepStopTurn = 'turns' | 'same' | 'unknown';

export interface SweepStopCheckInput {
  readonly id: string;
  readonly status: 'green' | 'warning' | 'red';
}

export interface SweepStopInput {
  readonly index: number;
  readonly display: string;
  readonly status: SweepStopStatus;
  readonly turn: SweepStopTurn | null;
  readonly fold_display: string | null;
  readonly checks?: readonly SweepStopCheckInput[];
}

const STATUSES: readonly string[] = ['green', 'warning', 'red', 'not_computed', 'unavailable'];
const TURNS: readonly string[] = ['turns', 'same', 'unknown'];
const CHECK_STATUSES: readonly string[] = ['green', 'warning', 'red'];

/** Validates a published stop strip and returns it unchanged in published order. */
export function validateSweepStops(stops: readonly SweepStopInput[]): readonly SweepStopInput[] {
  const seen = new Set<number>();
  for (const stop of stops) {
    if (!Number.isInteger(stop.index) || stop.index < 0) throw new Error('sweep stop index must be a non-negative integer');
    if (seen.has(stop.index)) throw new Error(`duplicate sweep stop index: ${stop.index}`);
    seen.add(stop.index);
    if (!STATUSES.includes(stop.status)) throw new Error(`unknown sweep stop status: ${String(stop.status)}`);
    if (stop.turn !== null && !TURNS.includes(stop.turn)) throw new Error(`unknown sweep stop turn: ${String(stop.turn)}`);
    if (stop.status !== 'green' && stop.status !== 'warning' && stop.fold_display !== null) {
      throw new Error(`sweep stop ${stop.index} (${stop.status}) must not carry a fold`);
    }
    const checks = stop.checks ?? [];
    if (stop.status === 'red' && checks.length === 0) {
      throw new Error(`red sweep stop ${stop.index} must publish its failing checks`);
    }
    for (const check of checks) {
      if (!CHECK_STATUSES.includes(check.status)) throw new Error(`unknown sweep check status: ${String(check.status)}`);
    }
  }
  return stops;
}

/** A fold (<del>/<ins>) is drawn only when the reader published one for a computed stop. */
export function canFoldStop(stop: SweepStopInput | null): boolean {
  if (stop === null) return false;
  if (stop.status !== 'green' && stop.status !== 'warning') return false;
  return stop.fold_display !== null;
}