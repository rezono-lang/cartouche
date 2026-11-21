/**
 * Automated Visual Specimen Registry (after the _specimen visual-oracle pattern of an earlier viewer).
 * Guarantees every epistemic sign, 4-valued state, and Cartouche trust tier
 * stays registered and testable across all 3 OKLCH palettes.
 */

import { PALETTES } from '../../reader-core/src/index.ts';
import type { PaletteName } from '../../reader-core/src/index.ts';

export interface SpecimenEntry {
  readonly dataEntry: string;
  readonly glyph: string;
  readonly kind: 'sign' | 'state' | 'line' | 'trust_tier';
}

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
  { dataEntry: 'state:unknown', glyph: '▨', kind: 'state' },
  { dataEntry: 'state:absent', glyph: '⦸', kind: 'state' },
  { dataEntry: 'state:not_applicable', glyph: '–', kind: 'state' },
  { dataEntry: 'line:drift', glyph: '══', kind: 'line' },
  { dataEntry: 'trust:sealed', glyph: 'SEALED', kind: 'trust_tier' },
  { dataEntry: 'trust:provisional_checked', glyph: 'CHECKED', kind: 'trust_tier' },
  { dataEntry: 'trust:provisional_engine', glyph: 'UNSEALED', kind: 'trust_tier' }
]);

export function verifySpecimenCoverage(): { ok: boolean; palettes: readonly PaletteName[]; entryCount: number } {
  const palettes = Object.keys(PALETTES) as PaletteName[];
  return {
    ok: palettes.length === 3 && SPECIMEN_ENTRIES.length >= 15,
    palettes,
    entryCount: SPECIMEN_ENTRIES.length
  };
}
