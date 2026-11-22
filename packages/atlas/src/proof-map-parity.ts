/**
 * Decision 0012 §3a (Requirement 10): Proof Map Engine-Agreement / Parity Projection.
 * - Reads only the reader-published `rezono.parity/1` (`/<pack>/<manifest>/parity`) response.
 * - Never compares engine outputs on the client; projects `agree`, `disagree` (`≠`, `data-sign="engine_disagreement"`),
 *   and `unknown` (`no_parity_record`) verbatim with links to the published parity record.
 * - Keeps `engine_disagreement` (`≠`) strictly distinct from `invalid` (`!`).
 */

import { SIGNS } from '../../reader-core/src/index.ts';
import { escapeXml } from './flow-split-svg.ts';

export type ParityAgreement = 'agree' | 'disagree' | 'unknown';

export interface ProofMapRelationParity {
  readonly relation: string;
  readonly agreement: ParityAgreement;
  readonly reason?: string | undefined;
}

export interface ProofMapParityRecord {
  readonly path: string;
  readonly manifestId: string;
  readonly byRelation: ReadonlyMap<string, ProofMapRelationParity>;
}

const VALID_AGREEMENTS = new Set<string>(['agree', 'disagree', 'unknown']);

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Extracts the published `rezono.parity/1` record from a role's recorded reader answers.
 * Returns `null` when no 200 `/parity` record is present.
 */
export function extractProofMapParityRecord(
  roleMap: Readonly<Record<string, { readonly status?: unknown; readonly body?: unknown }>> | undefined
): ProofMapParityRecord | null {
  if (!roleMap) return null;
  const parityPath = Object.keys(roleMap)
    .sort(cmpStr)
    .find((p) => p.endsWith('/parity') && roleMap[p]?.status === 200);
  if (!parityPath) return null;

  const body = roleMap[parityPath]?.body;
  if (!body || typeof body !== 'object') return null;
  const rec = body as { readonly format?: unknown; readonly manifest_id?: unknown; readonly relations?: unknown };
  if (rec.format !== 'rezono.parity/1') return null;

  const manifestId = typeof rec.manifest_id === 'string' ? rec.manifest_id : 'm-0';
  const byRelation = new Map<string, ProofMapRelationParity>();
  if (Array.isArray(rec.relations)) {
    for (const item of rec.relations) {
      if (!item || typeof item !== 'object') continue;
      const r = item as { readonly relation?: unknown; readonly agreement?: unknown; readonly reason?: unknown };
      if (typeof r.relation !== 'string' || r.relation.length === 0) continue;
      const agreement: ParityAgreement =
        typeof r.agreement === 'string' && VALID_AGREEMENTS.has(r.agreement)
          ? (r.agreement as ParityAgreement)
          : 'unknown';
      const reason = typeof r.reason === 'string' && r.reason.length > 0 ? r.reason : undefined;
      byRelation.set(
        r.relation,
        Object.freeze({
          relation: r.relation,
          agreement,
          ...(reason ? { reason } : {})
        })
      );
    }
  }

  return Object.freeze({
    path: parityPath,
    manifestId,
    byRelation
  });
}

/**
 * Renders the SVG edge parity overlay for a derived edge using only frozen `contracts/data-marks.json` targets (`<g>`).
 */
export function renderProofMapEdgeParityOverlaySvg(params: {
  readonly relation: string;
  readonly proofRef: string;
  readonly parity: ProofMapRelationParity | undefined;
  readonly parityPath: string;
  readonly mx: number;
  readonly my: number;
}): string {
  const { relation, proofRef, parity, parityPath, mx, my } = params;
  if (!parity) return '';

  const href = `${parityPath}#${encodeURIComponent(relation)}`;
  if (parity.agreement === 'disagree') {
    const glyph = SIGNS.engine_disagreement?.glyph ?? '≠';
    const reasonAttr = parity.reason ? ` data-reason="${escapeXml(parity.reason)}"` : '';
    return (
      `<g data-relation="${escapeXml(relation)}" data-sign="engine_disagreement"${reasonAttr} data-proof-ref="${escapeXml(proofRef)}">` +
      `<a href="${escapeXml(href)}">` +
      `<text x="${mx}" y="${my}" fill="var(--c-violated)" font-size="11">${escapeXml(glyph)}</text>` +
      `</a>` +
      `</g>`
    );
  }

  if (parity.agreement === 'unknown') {
    const reason = parity.reason ?? 'no_parity_record';
    const glyph = SIGNS.unknown?.glyph ?? '▨';
    return (
      `<g data-relation="${escapeXml(relation)}" data-reason="${escapeXml(reason)}" data-proof-ref="${escapeXml(proofRef)}">` +
      `<a href="${escapeXml(href)}">` +
      `<text x="${mx}" y="${my}" fill="var(--c-ink-soft)" font-size="10">${escapeXml(glyph)}</text>` +
      `</a>` +
      `</g>`
    );
  }

  // Quiet agreement link to parity record
  return (
    `<g data-relation="${escapeXml(relation)}" data-proof-ref="${escapeXml(proofRef)}">` +
    `<a href="${escapeXml(href)}">` +
    `<text x="${mx}" y="${my}" fill="var(--c-ink-faint)" font-size="10">·</text>` +
    `</a>` +
    `</g>`
  );
}

/**
 * Renders only the synchronized `table[data-part="twin"]` carrying parity marks
 * (`engine_disagreement` ≠, `no_parity_record`, and `/parity` links) for composition inside a sheet HTML shell.
 */
export function renderProofMapParityTwinTableHtml(params: {
  readonly nodes: readonly {
    readonly id: string;
    readonly lane: string;
    readonly qualifiedName: string;
    readonly depth: number;
    readonly proofRef: string;
  }[];
  readonly parityRecord: ProofMapParityRecord;
}): string {
  const { nodes, parityRecord } = params;
  const disagreeGlyph = SIGNS.engine_disagreement?.glyph ?? '≠';
  const unknownGlyph = SIGNS.unknown?.glyph ?? '▨';

  const rowsHtml = nodes
    .map((n) => {
      const parity = parityRecord.byRelation.get(n.id);
      const href = `${parityRecord.path}#${encodeURIComponent(n.id)}`;
      let parityCell = '';
      if (parity?.agreement === 'disagree') {
        const reasonAttr = parity.reason ? ` data-reason="${escapeXml(parity.reason)}"` : '';
        parityCell =
          `<a href="${escapeXml(href)}">` +
          `<span data-sign="engine_disagreement"${reasonAttr}>${escapeXml(disagreeGlyph)}</span>` +
          `</a>`;
      } else if (parity?.agreement === 'unknown') {
        const reason = parity.reason ?? 'no_parity_record';
        parityCell =
          `<a href="${escapeXml(href)}">` +
          `<span data-reason="${escapeXml(reason)}">${escapeXml(unknownGlyph)} ${escapeXml(reason)}</span>` +
          `</a>`;
      } else if (parity?.agreement === 'agree') {
        parityCell = `<a href="${escapeXml(href)}">·</a>`;
      }

      return (
        `<tr data-relation="${escapeXml(n.id)}" data-key="${escapeXml(n.id)}" data-depth="${n.depth}" data-proof-ref="${escapeXml(n.proofRef)}">` +
        `<td>${n.depth}</td>` +
        `<td>${escapeXml(n.lane)}</td>` +
        `<td>${escapeXml(n.qualifiedName)}</td>` +
        `<td>${parityCell}</td>` +
        `</tr>`
      );
    })
    .join('');

  return (
    `<table data-part="twin">` +
    `<thead><tr>` +
    `<th scope="col">depth</th>` +
    `<th scope="col">lane</th>` +
    `<th scope="col">relation</th>` +
    `<th scope="col">parity</th>` +
    `</tr></thead>` +
    `<tbody>${rowsHtml}</tbody>` +
    `</table>`
  );
}

/**
 * Renders the proof map HTML shell with SVG and synchronized `table[data-part="twin"]`
 * carrying parity marks (`engine_disagreement` ≠, `no_parity_record`, and `/parity` links).
 */
export function renderProofMapParityHtml(params: {
  readonly svg: string;
  readonly nodes: readonly {
    readonly id: string;
    readonly lane: string;
    readonly qualifiedName: string;
    readonly depth: number;
    readonly proofRef: string;
  }[];
  readonly parityRecord: ProofMapParityRecord;
}): string {
  return `<section>${params.svg}${renderProofMapParityTwinTableHtml(params)}</section>`;
}
