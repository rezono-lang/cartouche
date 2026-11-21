/**
 * Automated Visual Specimen Registry (after the _specimen visual-oracle pattern of an earlier viewer).
 * Guarantees every epistemic sign, 4-valued state, and Cartouche trust tier
 * stays registered, rendered, and testable across every published OKLCH palette.
 */

import { DATA_MARKS, PALETTES, SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicState, PaletteName, PaletteTokens } from '../../reader-core/src/index.ts';

export interface SpecimenEntry {
  readonly dataEntry: string;
  readonly glyph: string;
  readonly kind: 'sign' | 'state' | 'line' | 'trust_tier';
}

export const REQUIRED_PALETTES: readonly PaletteName[] = Object.freeze([
  'swisstopo',
  'obsidian',
  'forced'
]);

export const REQUIRED_EPISTEMIC_STATES: readonly EpistemicState[] = Object.freeze([
  'known',
  'unknown',
  'absent',
  'invalid',
  'not_applicable'
]);

export const SPECIMEN_ENTRIES: readonly SpecimenEntry[] = Object.freeze([
  { dataEntry: 'sign:origin_decision', glyph: '◆', kind: 'sign' },
  { dataEntry: 'sign:origin_vendor', glyph: '▲', kind: 'sign' },
  { dataEntry: 'sign:origin_design', glyph: '■', kind: 'sign' },
  { dataEntry: 'sign:origin_observation', glyph: '●', kind: 'sign' },
  { dataEntry: 'sign:derived', glyph: '○', kind: 'sign' },
  { dataEntry: 'sign:assumption', glyph: '╌', kind: 'sign' },
  { dataEntry: 'sign:screened', glyph: '▬', kind: 'sign' },
  { dataEntry: 'sign:proposal', glyph: '✎', kind: 'sign' },
  { dataEntry: 'sign:sealed', glyph: '◉', kind: 'sign' },
  { dataEntry: 'state:supposed', glyph: '◇', kind: 'state' },
  { dataEntry: 'state:valid', glyph: '✓', kind: 'state' },
  { dataEntry: 'state:changed', glyph: '◐', kind: 'state' },
  { dataEntry: 'state:violated', glyph: '✕', kind: 'state' },
  { dataEntry: 'state:known', glyph: 'Aa', kind: 'state' },
  { dataEntry: 'state:unknown', glyph: '▨', kind: 'state' },
  { dataEntry: 'state:absent', glyph: '⦸', kind: 'state' },
  { dataEntry: 'state:invalid', glyph: '!', kind: 'state' },
  { dataEntry: 'state:not_applicable', glyph: '–', kind: 'state' },
  { dataEntry: 'line:drift', glyph: '══', kind: 'line' },
  { dataEntry: 'trust:sealed', glyph: 'SEALED', kind: 'trust_tier' },
  { dataEntry: 'trust:provisional_checked', glyph: 'CHECKED', kind: 'trust_tier' },
  { dataEntry: 'trust:provisional_engine', glyph: 'UNSEALED', kind: 'trust_tier' }
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSpecimenHtml(theme: PaletteName = 'swisstopo'): string {
  const palette: PaletteTokens = PALETTES[theme];
  const rows = SPECIMEN_ENTRIES.map((entry) => {
    const [prefix, name = ''] = entry.dataEntry.split(':');
    const signSpec = Object.prototype.hasOwnProperty.call(SIGNS, name)
      ? SIGNS[name as keyof typeof SIGNS]
      : undefined;
    const tokenName = signSpec?.token ?? 'ink';
    const color = palette[tokenName] ?? palette.ink;
    const markAttr =
      prefix === 'trust'
        ? `${DATA_MARKS.trust_tier}="${escapeHtml(name)}"`
        : `${DATA_MARKS.sign}="${escapeHtml(name)}"`;
    return `<tr data-entry="${escapeHtml(entry.dataEntry)}" ${markAttr}><th scope="row" style="color:${escapeHtml(color)}">${escapeHtml(entry.glyph)}</th><td>${escapeHtml(entry.dataEntry)}</td></tr>`;
  }).join('');
  return `<section data-specimen-theme="${escapeHtml(theme)}" style="background-color:${escapeHtml(palette.paper)};color:${escapeHtml(palette.ink)}"><table><thead><tr><th scope="col">Glyph</th><th scope="col">Entry</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

export function verifySpecimenCoverage(): {
  ok: boolean;
  palettes: readonly PaletteName[];
  entryCount: number;
  missingPalettes: readonly PaletteName[];
  missingTokens: readonly string[];
  missingSigns: readonly string[];
  missingStates: readonly EpistemicState[];
  missingRenderedEntries: readonly string[];
} {
  const palettes = Object.keys(PALETTES) as PaletteName[];
  const missingPalettes = REQUIRED_PALETTES.filter((p) => !Object.prototype.hasOwnProperty.call(PALETTES, p));

  const requiredTokens = new Set<keyof PaletteTokens>(['paper', 'ink']);
  for (const spec of Object.values(SIGNS)) {
    requiredTokens.add(spec.token);
  }
  const missingTokens: string[] = [];
  for (const p of REQUIRED_PALETTES) {
    const pal = PALETTES[p];
    if (!pal) continue;
    for (const tok of requiredTokens) {
      if (typeof pal[tok] !== 'string' || pal[tok].trim().length === 0) {
        missingTokens.push(`${p}.${tok}`);
      }
    }
  }

  const bySignName = new Map(
    SPECIMEN_ENTRIES.filter((e) => e.kind !== 'trust_tier').map((e) => [e.dataEntry.split(':')[1] ?? '', e])
  );
  const coveredStates = new Set(
    SPECIMEN_ENTRIES.filter((e) => e.kind === 'state').map((e) => e.dataEntry.split(':')[1] ?? '')
  );
  const missingSigns = Object.keys(SIGNS).filter((sign) => {
    const entry = bySignName.get(sign);
    const spec = SIGNS[sign as keyof typeof SIGNS];
    return !entry || !spec || entry.glyph !== spec.glyph;
  });
  const missingStates = REQUIRED_EPISTEMIC_STATES.filter((st) => !coveredStates.has(st));

  const missingRenderedEntries: string[] = [];
  for (const p of REQUIRED_PALETTES) {
    if (!PALETTES[p]) continue;
    const html = renderSpecimenHtml(p);
    for (const entry of SPECIMEN_ENTRIES) {
      if (!html.includes(`data-entry="${entry.dataEntry}"`) || !html.includes(entry.glyph)) {
        missingRenderedEntries.push(`${p}:${entry.dataEntry}`);
      }
    }
  }

  return {
    ok:
      missingPalettes.length === 0 &&
      missingTokens.length === 0 &&
      missingSigns.length === 0 &&
      missingStates.length === 0 &&
      missingRenderedEntries.length === 0,
    palettes,
    entryCount: SPECIMEN_ENTRIES.length,
    missingPalettes,
    missingTokens,
    missingSigns,
    missingStates,
    missingRenderedEntries
  };
}
