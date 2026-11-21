/**
 * Decision 0012 §3 (8): Question Desk entry page & strict LLM-front mediator.
 * Starts from declared Rezono questions (or a citizen's own case with zero cross-key leakage).
 * An optional front may ONLY choose a declared question and its parameters; free text without
 * a Rezono row is strictly refused as data-state="unknown" with a published/MF2 data-reason.
 */

import { renderOpaqueText } from '../../reader-core/src/opaque.ts';
import type { OpaqueDisplayCell } from '../../reader-core/src/opaque.ts';
import { SIGNS } from '../../reader-core/src/palette.ts';
import type { PaletteName } from '../../reader-core/src/palette.ts';
import { escapeXml } from './flow-split-svg.ts';
import { formatAtlasMessage, formatReasonLabel } from './i18n-mf2.ts';
import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';

export interface DeclaredQuestionSpec {
  readonly id: string;
  readonly roles: readonly string[];
  readonly params: readonly string[];
  readonly labelKey: string;
}

export interface QuestionCatalogue {
  readonly questions: readonly DeclaredQuestionSpec[];
  readonly messages?: Mf2MessageCatalog | null;
}

export interface QuestionAnswerRow {
  readonly key: string;
  readonly display: OpaqueDisplayCell;
  readonly proofRef: string;
  readonly slipHref: string;
}

export interface QuestionAnswerPayload {
  readonly status: 'known' | 'unknown';
  readonly reason?: string | null;
  readonly rows: readonly QuestionAnswerRow[];
}

export type QuestionAnswersMap = Readonly<
  Record<string, Readonly<Record<string, QuestionAnswerPayload>>>
>;

export interface ActiveQuestionQuery {
  readonly question: string;
  readonly params?: Readonly<Record<string, string>>;
}

export interface QuestionDeskInput {
  readonly catalogue: QuestionCatalogue;
  readonly role: string;
  readonly locale?: AtlasLocale;
  readonly theme?: PaletteName;
  readonly subjectKey?: string;
  readonly activeQuery?: ActiveQuestionQuery | null;
  readonly answers?: QuestionAnswersMap | null;
}

export interface QuestionFrontChoice {
  readonly question?: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly reason?: string;
  readonly freeText?: string;
}

export type QuestionFrontFn = (context: {
  readonly prompt: string;
  readonly allowedQuestions: readonly DeclaredQuestionSpec[];
  readonly locale: AtlasLocale;
}) => QuestionFrontChoice | null | undefined;

export interface AskViaQuestionFrontInput extends Omit<QuestionDeskInput, 'activeQuery'> {
  readonly prompt: string;
  readonly front: QuestionFrontFn;
}

export interface QuestionFrontResult {
  readonly accepted: boolean;
  readonly question: string | null;
  readonly params: Readonly<Record<string, string>>;
  readonly reason: string | null;
  readonly html: string;
}

function resolveLookupKey(
  params: Readonly<Record<string, string>> | undefined,
  subjectKey: string | undefined
): string {
  if (params) {
    if (typeof params.subject === 'string' && params.subject.length > 0) return params.subject;
    const keys = Object.keys(params).sort();
    for (const k of keys) {
      const v = params[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return subjectKey ?? '';
}

function renderParamsList(params: Readonly<Record<string, string>> | undefined): string {
  if (!params) return '';
  const entries = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`);
  return entries.join(', ');
}

function renderUnknownBlock(
  locale: AtlasLocale,
  reasonCode: string,
  messages: Mf2MessageCatalog | null | undefined
): string {
  const reasonLabel = formatReasonLabel(locale, reasonCode, messages);
  const text = formatAtlasMessage(locale, 'desk.unknown_because', { reason: reasonLabel }, messages);
  const glyph = SIGNS.unknown?.glyph ?? '▨';
  return `<div role="status" data-state="unknown" data-reason="${escapeXml(reasonCode)}"><span data-sign="unknown">${escapeXml(glyph)}</span> ${escapeXml(text)}</div>`;
}

function renderAnswerSection(
  question: DeclaredQuestionSpec,
  params: Readonly<Record<string, string>>,
  payload: QuestionAnswerPayload | undefined,
  locale: AtlasLocale,
  messages: Mf2MessageCatalog | null | undefined
): string {
  const qLabel = formatAtlasMessage(locale, question.labelKey, {}, messages);
  const paramsSummary = renderParamsList(params);
  const msg = (key: string): string => formatAtlasMessage(locale, key, {}, messages);

  if (!payload || payload.status === 'unknown') {
    const reasonCode = payload?.reason ?? 'premise_missing';
    return [
      `<section aria-label="${escapeXml(qLabel)}">`,
      `<h3>${escapeXml(qLabel)}</h3>`,
      paramsSummary ? `<p>${escapeXml(paramsSummary)}</p>` : '',
      renderUnknownBlock(locale, reasonCode, messages),
      `</section>`
    ].join('');
  }

  const rowsHtml = payload.rows
    .map((row) => {
      const displayText = renderOpaqueText(row.display);
      return [
        `<tr data-key="${escapeXml(row.key)}" data-state="${escapeXml(row.display.state)}">`,
        `<td>${escapeXml(row.key)}</td>`,
        `<td data-part="value" data-state="${escapeXml(row.display.state)}">${escapeXml(displayText)}</td>`,
        `<td><a href="${escapeXml(row.slipHref)}" data-proof-ref="${escapeXml(row.proofRef)}">${escapeXml(msg('desk.open_slip'))}</a></td>`,
        `</tr>`
      ].join('');
    })
    .join('');

  return [
    `<section aria-label="${escapeXml(qLabel)}">`,
    `<h3>${escapeXml(qLabel)}</h3>`,
    paramsSummary ? `<p>${escapeXml(paramsSummary)}</p>` : '',
    `<table data-answer="${escapeXml(question.id)}">`,
    `<caption>${escapeXml(qLabel)}${paramsSummary ? ` (${escapeXml(paramsSummary)})` : ''}</caption>`,
    `<thead><tr>`,
    `<th>${escapeXml(msg('desk.col_subject'))}</th>`,
    `<th>${escapeXml(msg('desk.col_value'))}</th>`,
    `<th>${escapeXml(msg('desk.col_slip'))}</th>`,
    `</tr></thead>`,
    `<tbody>${rowsHtml}</tbody>`,
    `</table>`,
    `</section>`
  ].join('');
}

/**
 * Deterministically renders the role-scoped Question Desk entry page as HTML.
 */
export function renderQuestionDesk(input: QuestionDeskInput): string {
  const locale: AtlasLocale = input.locale ?? 'en';
  const theme: PaletteName = input.theme ?? 'swisstopo';
  const messages = input.catalogue.messages;
  const msg = (key: string): string => formatAtlasMessage(locale, key, {}, messages);

  const allowedQuestions = input.catalogue.questions.filter((q) => q.roles.includes(input.role));
  const questionItemsHtml = allowedQuestions
    .map((q) => {
      const label = formatAtlasMessage(locale, q.labelKey, {}, messages);
      return `<li data-key="${escapeXml(q.id)}">${escapeXml(label)}</li>`;
    })
    .join('');

  let answerHtml = '';
  if (input.activeQuery) {
    const matched = allowedQuestions.find((q) => q.id === input.activeQuery?.question);
    if (!matched) {
      answerHtml = renderUnknownBlock(locale, 'question_not_allowed', messages);
    } else {
      const effectiveParams: Record<string, string> = { ...(input.activeQuery.params ?? {}) };
      if (input.role === 'citizen' && input.subjectKey) {
        effectiveParams.subject = input.subjectKey;
      }
      const lookupKey = resolveLookupKey(effectiveParams, input.subjectKey);
      const payload = input.answers?.[matched.id]?.[lookupKey];
      answerHtml = renderAnswerSection(matched, effectiveParams, payload, locale, messages);
    }
  } else if (input.role === 'citizen' && input.subjectKey && input.answers) {
    for (const q of allowedQuestions) {
      const payload = input.answers[q.id]?.[input.subjectKey];
      if (payload) {
        answerHtml = renderAnswerSection(q, { subject: input.subjectKey }, payload, locale, messages);
        break;
      }
    }
  }

  return [
    `<main data-cartouche-theme="${escapeXml(theme)}" aria-label="${escapeXml(msg('desk.title'))}">`,
    `<h1>${escapeXml(msg('desk.title'))}</h1>`,
    `<nav aria-label="${escapeXml(msg('desk.questions_heading'))}"><ul>${questionItemsHtml}</ul></nav>`,
    answerHtml,
    `</main>`
  ].join('');
}

/**
 * Mediates an optional LLM front: only declared questions allowed for the active role
 * and their parameters are accepted. Any free-text response is strictly refused and
 * never rendered into the page.
 */
export function askViaQuestionFront(input: AskViaQuestionFrontInput): QuestionFrontResult {
  const locale: AtlasLocale = input.locale ?? 'en';
  const theme: PaletteName = input.theme ?? 'swisstopo';
  const messages = input.catalogue.messages;
  const allowedQuestions = input.catalogue.questions.filter((q) => q.roles.includes(input.role));

  const choice = input.front({
    prompt: input.prompt,
    allowedQuestions,
    locale
  });

  const chosenId = typeof choice?.question === 'string' ? choice.question.trim() : '';
  const matched = allowedQuestions.find((q) => q.id === chosenId);

  if (!choice || !matched || typeof choice.freeText === 'string') {
    const reasonCode =
      choice && typeof choice.reason === 'string' && choice.reason.trim().length > 0
        ? choice.reason.trim()
        : 'unbacked_front_response';
    const msg = (key: string): string => formatAtlasMessage(locale, key, {}, messages);
    const html = [
      `<main data-cartouche-theme="${escapeXml(theme)}" aria-label="${escapeXml(msg('desk.title'))}">`,
      `<h1>${escapeXml(msg('desk.title'))}</h1>`,
      renderUnknownBlock(locale, reasonCode, messages),
      `</main>`
    ].join('');
    return Object.freeze({
      accepted: false,
      question: null,
      params: Object.freeze({}),
      reason: reasonCode,
      html
    });
  }

  const safeParams: Record<string, string> = {};
  if (choice.params) {
    for (const paramName of matched.params) {
      const val = choice.params[paramName];
      if (typeof val === 'string') safeParams[paramName] = val;
    }
  }
  if (input.role === 'citizen' && input.subjectKey) {
    safeParams.subject = input.subjectKey;
  }

  const html = renderQuestionDesk({
    ...input,
    activeQuery: { question: matched.id, params: safeParams }
  });

  const lookupKey = resolveLookupKey(safeParams, input.subjectKey);
  const payload = input.answers?.[matched.id]?.[lookupKey];
  const reason = payload?.status === 'unknown' ? (payload.reason ?? 'premise_missing') : null;

  return Object.freeze({
    accepted: true,
    question: matched.id,
    params: Object.freeze(safeParams),
    reason,
    html
  });
}
