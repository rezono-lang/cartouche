/**
 * Decision 0012 §3 (9): Table-first Question Coverage Sheet.
 * Renders declared questions with published coverage status (answered, unknown, untested),
 * unused kinds/slots from the reader catalogue, and opaque published counts verbatim
 * (Decision 0001: zero client counting). Uses exclusively frozen contracts/data-marks.json
 * attributes and standard HTML/ARIA.
 */

import { renderOpaqueText } from '../../reader-core/src/opaque.ts';
import type { OpaqueDisplayCell } from '../../reader-core/src/opaque.ts';
import { SIGNS } from '../../reader-core/src/palette.ts';
import type { PaletteName } from '../../reader-core/src/palette.ts';
import { escapeXml } from './flow-split-svg.ts';
import { formatAtlasMessage, formatReasonLabel, formatStateLabel } from './i18n-mf2.ts';
import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';

export type CoverageStatus = 'answered' | 'unknown' | 'untested';

export interface CoveragePublishedCounts {
  readonly answered?: OpaqueDisplayCell | null;
  readonly unknown?: OpaqueDisplayCell | null;
  readonly untested?: OpaqueDisplayCell | null;
  readonly unusedKinds?: OpaqueDisplayCell | null;
  readonly unusedSlots?: OpaqueDisplayCell | null;
}

export interface CoverageQuestionRow {
  readonly id: string;
  readonly label?: string;
  readonly coverageState: CoverageStatus;
  readonly reason?: string | null;
  readonly exampleAnswerHref?: string | null;
  readonly proofRef?: string | null;
  readonly publishedRowCount?: OpaqueDisplayCell | null;
}

export interface CoverageUnusedKind {
  readonly id: string;
  readonly label?: string;
}

export interface CoverageUnusedSlot {
  readonly id: string;
  readonly kind?: string;
  readonly label?: string;
}

export interface CoverageManifestMeta {
  readonly id?: string;
  readonly epoch?: string;
  readonly knowledge_time?: string;
  readonly role?: string;
  readonly witness_check?: string;
  readonly trust_tier?: 'sealed' | 'provisional_checked' | 'provisional_engine';
}

export interface CoverageSheetInput {
  readonly locale?: AtlasLocale;
  readonly theme?: PaletteName;
  readonly messages?: Mf2MessageCatalog | null;
  readonly manifest?: CoverageManifestMeta | null;
  readonly publishedCounts?: CoveragePublishedCounts | null;
  readonly questions: readonly CoverageQuestionRow[];
  readonly unusedKinds: readonly CoverageUnusedKind[];
  readonly unusedSlots: readonly CoverageUnusedSlot[];
}

function mapCoverageDataState(status: CoverageStatus): 'known' | 'unknown' | 'absent' {
  if (status === 'answered') return 'known';
  if (status === 'unknown') return 'unknown';
  return 'absent';
}

function mapCoverageSign(status: CoverageStatus): 'valid' | 'unknown' | 'absent' {
  if (status === 'answered') return 'valid';
  if (status === 'unknown') return 'unknown';
  return 'absent';
}

function renderSummaryItem(label: string, cell: OpaqueDisplayCell | null | undefined): string {
  if (!cell) return '';
  const text = renderOpaqueText(cell);
  return `<div class="cov-metric"><dt>${escapeXml(label)}</dt><dd data-part="value" data-state="${escapeXml(cell.state)}">${escapeXml(text)}</dd></div>`;
}

/**
 * Deterministically renders the table-first Question Coverage Sheet as HTML.
 * Zero client counting: all summary and row counts are rendered directly from
 * reader-published OpaqueDisplayCell values.
 */
export function renderCoverageSheet(input: CoverageSheetInput): string {
  const locale: AtlasLocale = input.locale ?? 'en';
  const theme: PaletteName = input.theme ?? 'swisstopo';
  const trustTier = input.manifest?.trust_tier ?? 'sealed';
  const msg = (key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(locale, key, params ?? {}, input.messages);

  const summaryItems = [
    renderSummaryItem(msg('sheet.coverage.summary_answered'), input.publishedCounts?.answered),
    renderSummaryItem(msg('sheet.coverage.summary_unknown'), input.publishedCounts?.unknown),
    renderSummaryItem(msg('sheet.coverage.summary_untested'), input.publishedCounts?.untested),
    renderSummaryItem(msg('sheet.coverage.summary_unused_kinds'), input.publishedCounts?.unusedKinds),
    renderSummaryItem(msg('sheet.coverage.summary_unused_slots'), input.publishedCounts?.unusedSlots)
  ].filter((s) => s.length > 0);

  const summaryHtml =
    summaryItems.length > 0 ? `<dl class="cov-summary">${summaryItems.join('')}</dl>` : '';

  const questionRowsHtml = input.questions
    .map((q) => {
      const dataState = mapCoverageDataState(q.coverageState);
      const signName = mapCoverageSign(q.coverageState);
      const glyph = SIGNS[signName]?.glyph ?? '';
      const reasonAttr =
        q.coverageState !== 'answered' && q.reason ? ` data-reason="${escapeXml(q.reason)}"` : '';
      const stateLabel = formatStateLabel(locale, dataState, input.messages);
      const reasonText =
        q.coverageState !== 'answered' && q.reason
          ? ` — ${escapeXml(formatReasonLabel(locale, q.reason, input.messages))}`
          : '';

      const rowCountText = q.publishedRowCount ? renderOpaqueText(q.publishedRowCount) : '–';
      const rowCountState = q.publishedRowCount ? q.publishedRowCount.state : 'not_applicable';

      let exampleHtml = '–';
      if (q.coverageState === 'answered' && q.exampleAnswerHref && q.proofRef) {
        exampleHtml = `<a href="${escapeXml(q.exampleAnswerHref)}" data-proof-ref="${escapeXml(q.proofRef)}">${escapeXml(msg('sheet.coverage.open_slip'))}</a>`;
      }

      const displayLabel = q.label ? escapeXml(q.label) : escapeXml(q.id);
      return [
        `<tr data-key="${escapeXml(q.id)}" data-state="${escapeXml(dataState)}"${reasonAttr}>`,
        `<td>${displayLabel}</td>`,
        `<td data-state="${escapeXml(dataState)}"${reasonAttr}><span data-sign="${escapeXml(signName)}">${escapeXml(glyph)}</span> ${escapeXml(stateLabel)}${reasonText}</td>`,
        `<td data-part="value" data-state="${escapeXml(rowCountState)}">${escapeXml(rowCountText)}</td>`,
        `<td>${exampleHtml}</td>`,
        `</tr>`
      ].join('');
    })
    .join('');

  const unusedKindRows = input.unusedKinds.map((k) => {
    const label = k.label ? `${escapeXml(k.label)} (${escapeXml(k.id)})` : escapeXml(k.id);
    return `<tr data-key="${escapeXml(k.id)}"><td>${escapeXml(msg('sheet.coverage.cat_kind'))}</td><td>${label}</td></tr>`;
  });

  const unusedSlotRows = input.unusedSlots.map((s) => {
    const label = s.label ? `${escapeXml(s.label)} (${escapeXml(s.id)})` : escapeXml(s.id);
    return `<tr data-key="${escapeXml(s.id)}"><td>${escapeXml(msg('sheet.coverage.cat_slot'))}</td><td>${label}</td></tr>`;
  });

  const unusedRowsHtml = [...unusedKindRows, ...unusedSlotRows].join('');

  const manifestId = input.manifest?.id ?? input.manifest?.epoch ?? '';
  const sealHtml = manifestId
    ? `<footer data-part="seal"><span data-part="manifest-hash">${escapeXml(manifestId)}</span></footer>`
    : '';

  return [
    `<section data-cartouche-theme="${escapeXml(theme)}" data-trust-tier="${escapeXml(trustTier)}" aria-label="${escapeXml(msg('sheet.coverage.title'))}">`,
    `<h2>${escapeXml(msg('sheet.coverage.title'))}</h2>`,
    summaryHtml,
    `<table>`,
    `<caption>${escapeXml(msg('sheet.coverage.questions_caption'))}</caption>`,
    `<thead><tr>`,
    `<th>${escapeXml(msg('sheet.coverage.col_question'))}</th>`,
    `<th>${escapeXml(msg('col.state'))}</th>`,
    `<th>${escapeXml(msg('sheet.coverage.col_rows'))}</th>`,
    `<th>${escapeXml(msg('sheet.coverage.col_example'))}</th>`,
    `</tr></thead>`,
    `<tbody>${questionRowsHtml}</tbody>`,
    `</table>`,
    `<table>`,
    `<caption>${escapeXml(msg('sheet.coverage.unused_caption'))}</caption>`,
    `<thead><tr>`,
    `<th>${escapeXml(msg('sheet.coverage.col_category'))}</th>`,
    `<th>${escapeXml(msg('sheet.coverage.col_element'))}</th>`,
    `</tr></thead>`,
    `<tbody>${unusedRowsHtml}</tbody>`,
    `</table>`,
    sealHtml,
    `</section>`
  ].join('');
}
