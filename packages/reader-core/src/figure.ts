/**
 * Deterministic ICU-free Figure view helper (Decision 0001 & 0004).
 * Never calls Intl.NumberFormat and never reformats numeric values client-side.
 * Emits exact canonical data-* attributes aligned with contracts/data-marks.json & SIGNS.
 */

import type { OpaqueDisplayCell } from './opaque.ts';
import { renderOpaqueText } from './opaque.ts';

export interface RenderedFigure {
  readonly text: string;
  readonly previousText: string | null;
  readonly folded: boolean;
  readonly attrs: Readonly<Record<string, string>>;
}

export function renderFigure(cell: OpaqueDisplayCell): RenderedFigure {
  const text = renderOpaqueText(cell);
  const folded = cell.state === 'known' && cell.previousDisplay !== null && cell.previousDisplay !== cell.display;
  const attrs: Record<string, string> = {
    'data-part': 'value',
    'data-state': cell.state,
    'data-proof-ref': cell.proofRef
  };
  if (cell.reason) attrs['data-reason'] = cell.reason;
  if (cell.completenessWitnessRef) attrs['data-completeness-ref'] = cell.completenessWitnessRef;
  if (cell.state === 'unknown') attrs['data-sign'] = 'unknown';
  else if (cell.state === 'absent') attrs['data-sign'] = 'absent';
  else if (cell.state === 'not_applicable') attrs['data-sign'] = 'not_applicable';
  else if (cell.state === 'invalid') attrs['data-sign'] = 'violated';
  else if (folded) attrs['data-sign'] = 'changed';

  return Object.freeze({
    text,
    previousText: folded ? cell.previousDisplay : null,
    folded,
    attrs: Object.freeze(attrs)
  });
}
