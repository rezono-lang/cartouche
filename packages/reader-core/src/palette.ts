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

export interface SignSpec {
  readonly kind: 'origin' | 'state' | 'line';
  readonly glyph: string;
  readonly pattern: string;
  readonly token: keyof PaletteTokens;
}

// Rezono's key of signs (packs/std-view/key.yaml: signs, then statuses), with Cartouche's non-colour glyphs where
// Rezono draws a form instead (assumption, screened, sealed). An `invalid` value is drawn with `violated`, as Rezono does.
export const SIGNS: Readonly<Record<string, SignSpec>> = Object.freeze({
  origin_decision: Object.freeze({ kind: 'origin', glyph: '◆', pattern: 'solid-diamond', token: 'proof' }),
  origin_vendor: Object.freeze({ kind: 'origin', glyph: '▲', pattern: 'solid-triangle', token: 'proof' }),
  origin_design: Object.freeze({ kind: 'origin', glyph: '■', pattern: 'solid-square', token: 'ink' }),
  origin_observation: Object.freeze({ kind: 'origin', glyph: '●', pattern: 'solid-circle', token: 'inkSoft' }),
  derived: Object.freeze({ kind: 'origin', glyph: '○', pattern: 'hollow-circle', token: 'proof' }),
  assumption: Object.freeze({ kind: 'line', glyph: '‗', pattern: 'dashed-underline', token: 'caution' }),
  drift: Object.freeze({ kind: 'line', glyph: '══', pattern: 'double-rail', token: 'violated' }),
  screened: Object.freeze({ kind: 'state', glyph: '▬', pattern: 'fixed-bar', token: 'inkFaint' }),
  proposal: Object.freeze({ kind: 'state', glyph: '✎', pattern: 'dashed-frame', token: 'proof' }),
  sealed: Object.freeze({ kind: 'state', glyph: '⊛', pattern: 'stamp-frame', token: 'proof' }),
  supposed: Object.freeze({ kind: 'state', glyph: '◇', pattern: 'dashed-diamond', token: 'caution' }),
  valid: Object.freeze({ kind: 'state', glyph: '✓', pattern: 'solid-line', token: 'valid' }),
  changed: Object.freeze({ kind: 'state', glyph: '◐', pattern: 'half-fill', token: 'caution' }),
  violated: Object.freeze({ kind: 'state', glyph: '✕', pattern: 'cross-stroke', token: 'violated' }),
  unknown: Object.freeze({ kind: 'state', glyph: '▨', pattern: 'diagonal-hatch-45', token: 'hatchStroke' }),
  not_applicable: Object.freeze({ kind: 'state', glyph: '–', pattern: 'hollow-void', token: 'inkFaint' }),
  absent: Object.freeze({ kind: 'state', glyph: '⦸', pattern: 'dashed-hollow-strike', token: 'inkSoft' })
});

/** The sign a value's state is drawn with (Rezono's slip: `invalid` is drawn with `violated`). */
export function signForState(state: string): string {
  return state === 'invalid' ? 'violated' : state;
}

export interface StdVerbSpec {
  readonly verb: 'why' | 'depends' | 'missing' | 'suppose' | 'compare' | 'propose';
  readonly key: 'w' | 'd' | 'm' | 's' | 'c' | 'p';
  /** The std-explain question that answers the verb; a verb without one is an action of the viewer (Rezono Sheets.verbs). */
  readonly question?: 'grounds' | 'reach' | 'gap';
}

export const STD_VERBS: readonly StdVerbSpec[] = Object.freeze([
  Object.freeze({ verb: 'why', key: 'w', question: 'grounds' }),
  Object.freeze({ verb: 'depends', key: 'd', question: 'reach' }),
  Object.freeze({ verb: 'missing', key: 'm', question: 'gap' }),
  Object.freeze({ verb: 'suppose', key: 's' }),
  Object.freeze({ verb: 'compare', key: 'c' }),
  Object.freeze({ verb: 'propose', key: 'p' })
] satisfies StdVerbSpec[]);

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
