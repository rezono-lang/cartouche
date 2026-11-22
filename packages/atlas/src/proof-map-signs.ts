/**
 * Decision 0012 §3a (Requirement 3): Proof Map State Glyphs, Hatch, Dash & Legend Helpers.
 * - Every row carries `data-sign` and renders its canonical glyph from `SIGNS`.
 * - Unknown rows fill with the canonical 6x6 / rotate(45) / stroke-width=1 / `var(--c-hatch)` pattern.
 * - Absent rows are emitted ONLY when the reader publishes `completeness_ref` (`data-completeness-ref`);
 *   without a published complete sweep, an absent sample is never drawn as absent.
 * - Unknown-premise edges render dashed (`stroke-dasharray="4 3"`) with `data-state="unknown"`;
 *   known-premise edges render solid with `data-state="known"`.
 * - Every drawn `[data-sign]` is collected for `table[data-part="legend"]`.
 */

import { SIGNS } from '../../reader-core/src/index.ts';
import type { EpistemicState } from '../../reader-core/src/index.ts';
import { escapeXml } from './flow-split-svg.ts';

export type ProofMapSignId = string;

export const PROOF_MAP_HATCH_PATTERN_ID = 'proof-map-unknown-hatch';
export const PROOF_MAP_UNKNOWN_EDGE_DASH = '4 3';

export interface ProofMapStateSample {
  readonly id: string;
  readonly relation: string;
  readonly key: string;
  readonly sign: ProofMapSignId;
  readonly state: EpistemicState;
  readonly reason?: string | undefined;
  readonly proofRef: string;
  readonly completenessRef?: string | undefined;
}

export interface ProofMapLegendEntry {
  readonly id: ProofMapSignId;
  readonly glyph: string;
  readonly name: string;
}

export interface ManifestRowStateInfo {
  readonly state: EpistemicState;
  readonly reason?: string | undefined;
  readonly served: boolean;
}

const KNOWN_SIGN_IDS = new Set<string>(Object.keys(SIGNS));
const VALID_STATES = new Set<string>([
  'known',
  'unknown',
  'not_applicable',
  'invalid',
  'absent',
  'valid',
  'changed',
  'violated'
]);

export function isValidSignId(value: unknown): value is ProofMapSignId {
  return typeof value === 'string' && KNOWN_SIGN_IDS.has(value);
}

export function isValidEpistemicState(value: unknown): value is EpistemicState {
  return typeof value === 'string' && VALID_STATES.has(value);
}

export function getProofMapSignGlyph(sign: ProofMapSignId): string {
  return SIGNS[sign]?.glyph ?? '';
}

/**
 * Canonical 6x6 / rotate(45) / stroke-width=1 / var(--c-hatch) SVG pattern (`m2-hatch-signature`).
 */
export function renderProofMapHatchDefs(): string {
  return (
    `<defs>` +
    `<pattern id="${PROOF_MAP_HATCH_PATTERN_ID}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-hatch)" stroke-width="1" />` +
    `</pattern>` +
    `</defs>`
  );
}

/**
 * Normalizes optional published `proof_map_state_samples` from a fixture.
 * Enforces the completeness invariant: any sample with `sign === 'absent'` or `state === 'absent'`
 * is excluded unless it carries a non-empty `completeness_ref`.
 */
export function normalizeProofMapStateSamples(raw: unknown): readonly ProofMapStateSample[] {
  if (!Array.isArray(raw)) return Object.freeze([]);
  const out: ProofMapStateSample[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : '';
    const relation = typeof rec.relation === 'string' && rec.relation.length > 0 ? rec.relation : '';
    const key = typeof rec.key === 'string' && rec.key.length > 0 ? rec.key : '';
    const proofRef = typeof rec.proof_ref === 'string' && rec.proof_ref.length > 0 ? rec.proof_ref : '';
    const sign: ProofMapSignId = isValidSignId(rec.sign) ? rec.sign : 'derived';
    const state: EpistemicState = isValidEpistemicState(rec.state) ? rec.state : 'known';
    const reason = typeof rec.reason === 'string' && rec.reason.length > 0 ? rec.reason : undefined;
    const completenessRef =
      typeof rec.completeness_ref === 'string' && rec.completeness_ref.length > 0 ? rec.completeness_ref : undefined;

    if (!id || !relation || !key || !proofRef) continue;
    // Absent rows are ONLY drawn when backed by a published complete sweep (`completeness_ref`).
    if ((sign === 'absent' || state === 'absent') && !completenessRef) {
      continue;
    }

    out.push(
      Object.freeze({
        id,
        relation,
        key,
        sign,
        state,
        ...(reason ? { reason } : {}),
        proofRef,
        ...(completenessRef ? { completenessRef } : {})
      })
    );
  }
  return Object.freeze(out);
}

/**
 * Resolves the served epistemic state of a relation at a given manifest from recorded reader answers.
 * Never derives or computes values; reads only published row state markers.
 */
export function resolveManifestRowState(
  roleMap: Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>> | undefined,
  packId: string,
  manifest: string | undefined,
  relationId: string
): ManifestRowStateInfo {
  if (!roleMap || !manifest) {
    return Object.freeze({ state: 'known', served: false });
  }
  const rowsPath = `/${packId}/${manifest}/rows/${relationId}`;
  const entry = roleMap[rowsPath];
  if (!entry || entry.status !== 200 || !entry.body || typeof entry.body !== 'object') {
    return Object.freeze({ state: 'known', served: false });
  }
  const body = entry.body as { readonly rows?: readonly unknown[] };
  const rows = Array.isArray(body.rows) ? body.rows : Array.isArray(entry.body) ? (entry.body as readonly unknown[]) : [];
  if (rows.length === 0) {
    return Object.freeze({ state: 'known', served: true });
  }

  let unknownCount = 0;
  let firstReason: string | undefined;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as { readonly key?: readonly unknown[]; readonly state?: unknown; readonly reason?: unknown };
    const tupleState = Array.isArray(rec.key) && typeof rec.key[2] === 'string' ? rec.key[2] : undefined;
    const tupleReason = Array.isArray(rec.key) && typeof rec.key[3] === 'string' ? rec.key[3] : undefined;
    const rowState = typeof rec.state === 'string' ? rec.state : tupleState;
    if (rowState === 'unknown') {
      unknownCount += 1;
      if (!firstReason) {
        firstReason = typeof rec.reason === 'string' && rec.reason.length > 0 ? rec.reason : tupleReason;
      }
    }
  }

  if (unknownCount === rows.length) {
    return Object.freeze({
      state: 'unknown',
      ...(firstReason ? { reason: firstReason } : {}),
      served: true
    });
  }
  return Object.freeze({ state: 'known', served: true });
}

/**
 * Resolves the state of a premise -> conclusion edge.
 * An edge from an unknown premise (or into an unknown conclusion whose premise is not served at that manifest)
 * carries `data-state="unknown"` and renders dashed.
 */
export function resolveProofMapEdgeState(
  fromState: EpistemicState,
  toState: EpistemicState,
  fromServedAtManifest: boolean,
  hasManifestSelection: boolean
): EpistemicState {
  if (fromState === 'unknown') return 'unknown';
  if (hasManifestSelection && toState === 'unknown' && !fromServedAtManifest) return 'unknown';
  return fromState;
}

/**
 * Renders a premise -> conclusion edge group using only frozen `contracts/data-marks.json` targets (`<g>`).
 */
export function renderProofMapEdgeGroupSvg(params: {
  readonly toRelation: string;
  readonly proofRef: string;
  readonly state: EpistemicState;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}): string {
  const dashAttr = params.state === 'unknown' ? ` stroke-dasharray="${PROOF_MAP_UNKNOWN_EDGE_DASH}"` : '';
  return (
    `<g data-relation="${escapeXml(params.toRelation)}" data-state="${escapeXml(params.state)}" data-proof-ref="${escapeXml(params.proofRef)}">` +
    `<path d="M ${params.x1} ${params.y1} L ${params.x2} ${params.y2}" fill="none" stroke="var(--c-rule-strong)" stroke-width="1.2"${dashAttr} />` +
    `</g>`
  );
}

/**
 * Renders a proof map row card `<g>` with its canonical sign glyph, hatch fill for unknown,
 * optional `data-reason`, and optional `data-completeness-ref` for absent marks.
 */
export function renderProofMapNodeCardSvg(params: {
  readonly key: string;
  readonly relation: string;
  readonly label: string;
  readonly sublabel: string;
  readonly sign: ProofMapSignId;
  readonly state: EpistemicState;
  readonly proofRef: string;
  readonly reason?: string | undefined;
  readonly completenessRef?: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}): string {
  const glyph = getProofMapSignGlyph(params.sign);
  const fill = params.sign === 'unknown' || params.state === 'unknown'
    ? `url(#${PROOF_MAP_HATCH_PATTERN_ID})`
    : 'var(--c-paper-elev)';
  const reasonAttr = params.reason ? ` data-reason="${escapeXml(params.reason)}"` : '';
  const completenessAttr = params.completenessRef
    ? ` data-completeness-ref="${escapeXml(params.completenessRef)}"`
    : '';
  const titleText = glyph ? `${glyph} ${params.label}` : params.label;
  const secondLine = params.reason ?? params.sublabel;

  return (
    `<g data-key="${escapeXml(params.key)}" data-relation="${escapeXml(params.relation)}" data-state="${escapeXml(params.state)}" data-sign="${escapeXml(params.sign)}"${reasonAttr}${completenessAttr} data-proof-ref="${escapeXml(params.proofRef)}">` +
    `<rect x="${params.x}" y="${params.y}" width="${params.w}" height="${params.h}" rx="4" fill="${fill}" stroke="var(--c-rule-strong)" stroke-width="1" />` +
    `<text x="${params.x + 10}" y="${params.y + 18}" fill="var(--c-ink)" font-size="11">${escapeXml(titleText)}</text>` +
    `<text x="${params.x + 10}" y="${params.y + 34}" fill="var(--c-ink-soft)" font-size="10">${escapeXml(secondLine)}</text>` +
    `</g>`
  );
}

/**
 * Collects unique legend rows in canonical `SIGNS` key order for every drawn `data-sign`.
 */
export function collectProofMapLegendEntries(usedSigns: readonly ProofMapSignId[]): readonly ProofMapLegendEntry[] {
  const present = new Set<ProofMapSignId>(usedSigns);
  const entries: ProofMapLegendEntry[] = [];
  for (const key of Object.keys(SIGNS)) {
    if (!isValidSignId(key) || !present.has(key)) continue;
    const def = SIGNS[key];
    if (!def) continue;
    entries.push(
      Object.freeze({
        id: key,
        glyph: def.glyph,
        name: def.pattern
      })
    );
  }
  return Object.freeze(entries);
}
