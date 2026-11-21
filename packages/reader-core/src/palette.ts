/**
 * std-view v2 Perceptual OKLCH Palettes (Decision 0004).
 * Default identity: Swisstopo Matte Archival Relief.
 * Secondary: Obsidian Night Cartography + High-Contrast Forced Colors.
 */

export type PaletteName = 'swisstopo' | 'obsidian' | 'forced';

export interface PaletteTokens {
  readonly desk: string;
  readonly paper: string;
  readonly paperElev: string;
  readonly paperTint: string;
  readonly limestone: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly inkFaint: string;
  readonly rule: string;
  readonly ruleStrong: string;
  readonly proof: string;
  readonly valid: string;
  readonly caution: string;
  readonly violated: string;
  readonly hatchStroke: string;
}

export const PALETTES: Readonly<Record<PaletteName, PaletteTokens>> = Object.freeze({
  swisstopo: Object.freeze({
    desk: 'oklch(0.922 0.011 82)',
    paper: 'oklch(0.982 0.007 85)',
    paperElev: 'oklch(0.996 0.004 85)',
    paperTint: 'oklch(0.956 0.009 84)',
    limestone: 'oklch(0.875 0.022 82)',
    ink: 'oklch(0.180 0.008 75)',
    inkSoft: 'oklch(0.410 0.009 75)',
    inkFaint: 'oklch(0.575 0.008 75)',
    rule: 'oklch(0.840 0.011 82)',
    ruleStrong: 'oklch(0.235 0.008 75)',
    proof: 'oklch(0.450 0.165 258)',
    valid: 'oklch(0.455 0.115 148)',
    caution: 'oklch(0.545 0.135 68)',
    violated: 'oklch(0.495 0.175 24)',
    hatchStroke: 'oklch(0.600 0.012 80)'
  }),
  obsidian: Object.freeze({
    desk: 'oklch(0.150 0.012 252)',
    paper: 'oklch(0.195 0.013 252)',
    paperElev: 'oklch(0.232 0.014 252)',
    paperTint: 'oklch(0.215 0.013 252)',
    limestone: 'oklch(0.265 0.016 250)',
    ink: 'oklch(0.935 0.008 85)',
    inkSoft: 'oklch(0.730 0.012 248)',
    inkFaint: 'oklch(0.555 0.012 248)',
    rule: 'oklch(0.310 0.016 252)',
    ruleStrong: 'oklch(0.785 0.010 85)',
    proof: 'oklch(0.755 0.135 254)',
    valid: 'oklch(0.760 0.120 148)',
    caution: 'oklch(0.785 0.135 76)',
    violated: 'oklch(0.740 0.155 22)',
    hatchStroke: 'oklch(0.460 0.016 250)'
  }),
  forced: Object.freeze({
    desk: '#000000',
    paper: '#000000',
    paperElev: '#000000',
    paperTint: '#0d0d0d',
    limestone: '#1c1c1c',
    ink: '#ffffff',
    inkSoft: '#e6e6e6',
    inkFaint: '#cccccc',
    rule: '#ffffff',
    ruleStrong: '#ffffff',
    proof: '#5ce1ff',
    valid: '#7dff8a',
    caution: '#ffe047',
    violated: '#ff7a7a',
    hatchStroke: '#ffffff'
  })
});

export function paletteCss(name: PaletteName): string {
  const p = PALETTES[name];
  return [
    `[data-cartouche-theme="${name}"] {`,
    `  --c-desk: ${p.desk};`,
    `  --c-paper: ${p.paper};`,
    `  --c-paper-elev: ${p.paperElev};`,
    `  --c-paper-tint: ${p.paperTint};`,
    `  --c-limestone: ${p.limestone};`,
    `  --c-ink: ${p.ink};`,
    `  --c-ink-soft: ${p.inkSoft};`,
    `  --c-ink-faint: ${p.inkFaint};`,
    `  --c-rule: ${p.rule};`,
    `  --c-rule-strong: ${p.ruleStrong};`,
    `  --c-proof: ${p.proof};`,
    `  --c-valid: ${p.valid};`,
    `  --c-caution: ${p.caution};`,
    `  --c-violated: ${p.violated};`,
    `  --c-hatch: ${p.hatchStroke};`,
    `}`
  ].join('\n');
}
