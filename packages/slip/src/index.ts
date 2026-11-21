/**
 * Browser-safe public barrel for @rezono/slip.
 * Note: `./model.ts` is intentionally excluded (strictly build-time per Decision 0009 & 0011).
 * Svelte components are imported directly by Vite/Svelte bundlers (listed in SLIP_COMPONENTS)
 * so this TypeScript barrel stays compatible with Node 22 native ESM and `tsc --noEmit`.
 */

export * from './slip-controller.ts';
export * from './slip-element.ts';
export * from './slip-props.ts';
export * from './slip-sweep.ts';
export * from './slip-verbs.ts';
export * from './types.ts';
export type { SweepStopStatus } from './types.ts';

export const SLIP_COMPONENTS = Object.freeze({
  Slip: './Slip.svelte',
  SignMark: './SignMark.svelte',
  SlipValueCell: './SlipValueCell.svelte',
  SlipSeal: './SlipSeal.svelte',
  SlipUnserved: './SlipUnserved.svelte',
  SlipSweep: './SlipSweep.svelte'
} as const);
