/**
 * Public barrel for @rezono/cartouche-atlas.
 * Svelte 5 sheet components are imported directly by Vite/Svelte bundlers (listed in ATLAS_SHEETS)
 * so this TypeScript barrel stays compatible with Node 22 native ESM and `tsc --noEmit`.
 */

export * from './specimen.ts';
export * from './relief-model.ts';
export * from './flow-split-svg.ts';
export * from './ripple-layout.ts';
export * from './ripple-pixi.ts';
export * from './bitemporal-model.ts';
export * from './bitemporal-gate.ts';
export * from './coverage-sheet.ts';
export * from './question-desk.ts';
export * from './try-kits.ts';
export * from './monge-model.ts';
export * from './key-page-model.ts';
export * from './proof-map-model.ts';
export * from './proof-map-layout.ts';
export * from './proof-map-share.ts';
export * from './proof-map-signs.ts';
export * from './i18n-mf2.ts';
export { escapeXml } from './flow-split-svg.ts';

export const ATLAS_SHEETS = Object.freeze({
  Relief3DSheet: './Relief3DSheet.svelte',
  FlowSplitSheet: './FlowSplitSheet.svelte',
  KringstandSheet: './KringstandSheet.svelte',
  CausalRippleSheet: './CausalRippleSheet.svelte',
  BitemporalStairSheet: './BitemporalStairSheet.svelte',
  MongeFoldingSheet: './MongeFoldingSheet.svelte',
  KeyPageSheet: './KeyPageSheet.svelte',
  ProofMapSheet: './ProofMapSheet.svelte'
} as const);
