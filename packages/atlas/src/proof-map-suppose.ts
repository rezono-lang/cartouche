/**
 * Decision 0012 §3a (Requirement 8): Proof Map Suppose & Turning-Point Projection.
 * - Reads only reader-published `/ask/sweep` recordings (zero client recomputation or fabrication).
 * - Renders suppose toggle (`button[data-verb="suppose"][data-key="s"]`), turning-point stops
 *   (`[data-stop][data-status][data-turn]`), and active variant `<del>` / `<ins>` + `data-sign="supposed"` (`◇`).
 * - Red and `not_computed` stops never emit `<ins>`.
 * - Pure & stateless: toggling `supposeVariant` off restores exact byte-identical SVG and CartoucheScene IR.
 */

import { SIGNS } from '../../reader-core/src/index.ts';
import { escapeXml } from './flow-split-svg.ts';

export type SweepStopStatus = 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
export type SweepStopTurn = 'turns' | 'same' | 'unknown';

export interface ProofMapSweepStop {
  readonly index: number;
  readonly display: string;
  readonly status: SweepStopStatus;
  readonly manifest?: string | undefined;
  readonly turn?: SweepStopTurn | undefined;
  readonly rowDisplay?: string | undefined;
  readonly diagnosis?: string | undefined;
}

export interface ProofMapSupposeView {
  readonly sweepId: string;
  readonly manifestId: string;
  readonly startRelation: string;
  readonly startKey: string;
  readonly activeVariant?: string | undefined;
  readonly activeStop?: ProofMapSweepStop | undefined;
  readonly stops: readonly ProofMapSweepStop[];
}

const VALID_STATUSES = new Set<string>(['green', 'warning', 'red', 'not_computed', 'unavailable']);
const VALID_TURNS = new Set<string>(['turns', 'same', 'unknown']);

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function findSweepBody(
  recording: unknown,
  store?: string,
  role?: string
): Record<string, unknown> | null {
  if (!recording || typeof recording !== 'object') return null;
  const rec = recording as Record<string, unknown>;
  const answers = rec.reader_answers;
  if (!answers || typeof answers !== 'object') return null;
  const answersMap = answers as Record<string, unknown>;

  let roleMap: Record<string, unknown> | null = null;
  if (store && role) {
    const storeObj = answersMap[store];
    if (storeObj && typeof storeObj === 'object') {
      const candidate = (storeObj as Record<string, unknown>)[role];
      if (candidate && typeof candidate === 'object') {
        roleMap = candidate as Record<string, unknown>;
      }
    }
  } else if (role) {
    const candidate = answersMap[role];
    if (candidate && typeof candidate === 'object') {
      roleMap = candidate as Record<string, unknown>;
    }
  }

  if (!roleMap) return null;
  const sweepPath = Object.keys(roleMap)
    .sort(cmpStr)
    .find((k) => k.includes('/ask/sweep'));
  if (!sweepPath) return null;
  const entry = roleMap[sweepPath] as { readonly status?: unknown; readonly body?: unknown } | undefined;
  if (!entry || entry.status !== 200 || !entry.body || typeof entry.body !== 'object') return null;
  return entry.body as Record<string, unknown>;
}

/**
 * Extracts a reader-published sweep view from a recorded fixture.
 * Returns `null` when no published `/ask/sweep` answer is present.
 */
export function buildProofMapSupposeView(params: {
  readonly sweepRecording?: unknown;
  readonly sweepStore?: string | undefined;
  readonly sweepRole?: string | undefined;
  readonly supposeVariant?: string | undefined;
}): ProofMapSupposeView | null {
  const body = findSweepBody(params.sweepRecording, params.sweepStore, params.sweepRole);
  if (!body) return null;

  const delta = body.delta as { readonly id?: unknown } | undefined;
  const start = body.start as { readonly relation?: unknown; readonly key?: unknown } | undefined;
  const sweepId = typeof delta?.id === 'string' && delta.id.length > 0 ? delta.id : 'sweep';
  const manifestId = typeof body.manifest_id === 'string' ? body.manifest_id : 'm-0';
  const startRelation = typeof start?.relation === 'string' ? start.relation : '';
  const startKey = typeof start?.key === 'string' ? start.key : '';

  const rawSeries = Array.isArray(body.series) ? body.series : [];
  const stops: ProofMapSweepStop[] = [];
  for (let i = 0; i < rawSeries.length; i++) {
    const raw = rawSeries[i];
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const index = typeof rec.index === 'number' && Number.isInteger(rec.index) ? rec.index : i;
    const stopDisplay = typeof rec.value === 'string' ? rec.value : '';
    const status: SweepStopStatus =
      typeof rec.status === 'string' && VALID_STATUSES.has(rec.status)
        ? (rec.status as SweepStopStatus)
        : 'unavailable';
    const manifest = typeof rec.manifest === 'string' && rec.manifest.length > 0 ? rec.manifest : undefined;
    const turn: SweepStopTurn | undefined =
      typeof rec.turn === 'string' && VALID_TURNS.has(rec.turn) ? (rec.turn as SweepStopTurn) : undefined;
    const rowObj = rec.row as { readonly relation?: unknown; readonly key?: unknown } | undefined;
    const rowDisplay =
      typeof rowObj?.key === 'string' && rowObj.key.length > 0
        ? rowObj.key
        : status === 'green' && Boolean(stopDisplay)
          ? stopDisplay
          : undefined;
    const diagnosis = typeof rec.diagnosis === 'string' && rec.diagnosis.length > 0 ? rec.diagnosis : undefined;

    stops.push(
      Object.freeze({
        index,
        display: stopDisplay,
        status,
        ...(manifest ? { manifest } : {}),
        ...(turn ? { turn } : {}),
        ...(rowDisplay ? { rowDisplay } : {}),
        ...(diagnosis ? { diagnosis } : {})
      })
    );
  }

  const activeVariant =
    typeof params.supposeVariant === 'string' && params.supposeVariant.length > 0
      ? params.supposeVariant
      : undefined;
  const activeStop = activeVariant
    ? stops.find((s) => s.manifest === activeVariant && s.status !== 'red' && s.status !== 'not_computed')
    : undefined;

  return Object.freeze({
    sweepId,
    manifestId,
    startRelation,
    startKey,
    ...(activeVariant ? { activeVariant } : {}),
    ...(activeStop ? { activeStop } : {}),
    stops: Object.freeze(stops)
  });
}

/**
 * Renders the proof map HTML shell with suppose controls, turning-point stop list,
 * and active variant `<del>` / `<ins>` + `data-sign="supposed"` (`◇`) using exclusively
 * frozen `contracts/data-marks.json` attributes and standard HTML/ARIA.
 */
export function renderProofMapSupposeHtml(svg: string, view: ProofMapSupposeView): string {
  const supposedGlyph = SIGNS.supposed?.glyph ?? '◇';
  const isPressed = view.activeStop ? 'true' : 'false';

  const stopItems = view.stops
    .map((stop) => {
      const turnAttr = stop.turn ? ` data-turn="${escapeXml(stop.turn)}"` : '';
      const isActive = Boolean(view.activeStop && stop.manifest === view.activeStop.manifest);
      const isComputed = stop.status !== 'red' && stop.status !== 'not_computed' && stop.status !== 'unavailable';
      const foldMarkup =
        isActive && isComputed && stop.rowDisplay
          ? [
              ` <span data-sign="supposed">${escapeXml(supposedGlyph)}</span>`,
              ` <del>${escapeXml(view.startKey || view.manifestId)}</del>`,
              ` <ins>${escapeXml(stop.rowDisplay)}</ins>`
            ].join('')
          : '';
      return `<li data-stop="${stop.index}" data-status="${escapeXml(stop.status)}"${turnAttr}><span>${escapeXml(stop.display)}</span>${foldMarkup}</li>`;
    })
    .join('');

  const activeSummary =
    view.activeStop && view.activeStop.rowDisplay
      ? `<div data-part="adjacent-worlds">` +
        `<span data-sign="supposed">${escapeXml(supposedGlyph)}</span> ` +
        `<del>${escapeXml(view.startKey || view.manifestId)}</del> ` +
        `<ins>${escapeXml(view.activeStop.rowDisplay)}</ins>` +
        `</div>`
      : '';

  return (
    `<section aria-label="${escapeXml(view.sweepId)}">` +
    `<div data-part="levers">` +
    `<button type="button" data-verb="suppose" data-key="s" aria-pressed="${isPressed}">${escapeXml(supposedGlyph)} ${escapeXml(view.sweepId)}</button>` +
    `<ul>${stopItems}</ul>` +
    activeSummary +
    `</div>` +
    svg +
    `</section>`
  );
}
