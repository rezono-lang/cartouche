/**
 * Deterministic ICU-free Figure view helper (Decision 0001 & 0004).
 * Never calls Intl.NumberFormat and never reformats numeric values client-side.
 * Emits exact canonical data-* attributes for tests and screen readers.
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
  if (cell.state === 'unknown') attrs['data-sign'] = 'hatch';
  if (cell.state === 'absent') attrs['data-sign'] = 'absent';
  if (folded) attrs['data-sign'] = 'replaced';

  return Object.freeze({
    text,
    previousText: folded ? cell.previousDisplay : null,
    folded,
    attrs: Object.freeze(attrs)
  });
}
