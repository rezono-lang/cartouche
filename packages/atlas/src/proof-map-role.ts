/**
 * Proof Map Role Lens & Zero-Leak Horizon Projection (Decision 0012 §3a Requirement 6 / m2-proof-map-role-lens).
 * - Exposes only the roles present in the reader recording (never invents unserved roles).
 * - Renders a single localized MF2 `[data-part="horizon"][data-reason="not_read_in_full"]` notice
 *   for restricted roles without lock icons, placeholders, or client-counted hidden rows.
 * - Displays a hidden-premise count ONLY when explicitly published by the reader (`hidden_premises`).
 */

import { DATA_MARKS } from '../../reader-core/src/index.ts';
import type { AtlasLocale } from './i18n-mf2.ts';
import { formatAtlasMessage, formatReasonLabel } from './i18n-mf2.ts';
import { escapeXml } from './flow-split-svg.ts';

const M = DATA_MARKS;

export interface ProofMapHorizon {
  readonly complete: boolean;
  readonly reason: string | null;
}

/**
 * Extracts the sorted list of role names actually served in `fixture.reader_answers`.
 */
export function extractAvailableRoles(fixture: unknown): readonly string[] {
  if (!fixture || typeof fixture !== 'object') return Object.freeze([]);
  const ra = (fixture as Record<string, unknown>).reader_answers;
  if (!ra || typeof ra !== 'object') return Object.freeze([]);
  return Object.freeze(Object.keys(ra as Record<string, unknown>).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Reads an explicitly reader-published `hidden_premises` count from the active role's `/head`,
 * returning `null` when absent. Cartouche never counts hidden rows itself (AGENTS.md rule 6).
 */
export function extractPublishedHiddenPremises(fixture: unknown, role: string): number | null {
  if (!fixture || typeof fixture !== 'object') return null;
  const ra = (fixture as Record<string, unknown>).reader_answers;
  if (!ra || typeof ra !== 'object') return null;
  const roleAnswers = (ra as Record<string, unknown>)[role];
  if (!roleAnswers || typeof roleAnswers !== 'object') return null;
  const entries = Object.entries(roleAnswers as Record<string, unknown>);
  const headEntry = entries.find(([k]) => k.endsWith('/head'));
  const body = (headEntry?.[1] as { readonly body?: unknown } | undefined)?.body;
  if (!body || typeof body !== 'object') return null;
  const count = (body as { readonly hidden_premises?: unknown }).hidden_premises;
  if (typeof count === 'number' && Number.isInteger(count) && count >= 0) {
    return count;
  }
  return null;
}

/**
 * Renders the accessible HTML wrapper for a role-projected proof map, including the localized
 * MF2 `[data-part="horizon"][data-reason="not_read_in_full"]` notice when incomplete.
 */
export function renderProofMapRoleHtml(params: {
  readonly svg: string;
  readonly horizon: ProofMapHorizon;
  readonly hiddenPremises: number | null;
  readonly lang: AtlasLocale;
  readonly availableRoles: readonly string[];
  readonly activeRole: string;
}): string {
  const { svg, horizon, hiddenPremises, lang, availableRoles, activeRole } = params;
  const parts: string[] = [];

  if (availableRoles.length > 0) {
    const optionsHtml = availableRoles
      .map(
        (r) =>
          `<option value="${escapeXml(r)}"${r === activeRole ? ' selected' : ''}>${escapeXml(r)}</option>`
      )
      .join('');
    parts.push(
      `<label>${escapeXml(formatAtlasMessage(lang, 'col.role'))}<select name="role_lens">${optionsHtml}</select></label>`
    );
  }

  if (!horizon.complete) {
    const reason = horizon.reason ?? 'not_read_in_full';
    const baseText = formatReasonLabel(lang, reason);
    const countSuffix =
      hiddenPremises !== null
        ? lang === 'nl'
          ? ` (${hiddenPremises} ${hiddenPremises === 1 ? 'premisse' : 'premissen'})`
          : ` (${hiddenPremises} ${hiddenPremises === 1 ? 'premise' : 'premises'})`
        : '';
    parts.push(
      `<div ${M.part}="horizon" ${M.reason}="${escapeXml(reason)}">${escapeXml(baseText + countSuffix)}</div>`
    );
  }

  parts.push(svg);
  return `<section class="proof-map-role" lang="${escapeXml(lang)}">${parts.join('')}</section>`;
}
