/**
 * Decision 0012 §3a (Requirement 12): Accessible Proof Map Table Twin,
 * Deterministic Arrow-Key Edge Walking, and Localized MF2 Screen-Reader Sentences.
 * - Zero client compute, zero domain words, zero Intl, deterministic ordering.
 * - Strictly honors frozen contracts/data-marks.json targets and WCAG 2.1 AA.
 */

import { DATA_MARKS } from '../../reader-core/src/index.ts';
import { escapeXml } from './flow-split-svg.ts';
import {
  formatAtlasMessage,
  formatSignLabel,
  formatStateLabel
} from './i18n-mf2.ts';
import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';
import type { ProofMapSemanticEdge, ProofMapSemanticNode } from './proof-map-layout.ts';
import type { ProofMapLegendEntry } from './proof-map-signs.ts';

const M = DATA_MARKS;

export type ProofMapFocusKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export type BundleLabelCatalog = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface ProofMapAccessibleHtmlInput {
  readonly lang: AtlasLocale;
  readonly svg: string;
  readonly nodes: readonly ProofMapSemanticNode[];
  readonly edges: readonly ProofMapSemanticEdge[];
  readonly legend: readonly ProofMapLegendEntry[];
  readonly bundleLabels?: unknown;
  readonly bundleMessages?: unknown;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Parses Rezono-published `bundle.messages` resources (`key = value` or `key = {{...}}`)
 * into an MF2 message override catalog keyed by locale.
 */
export function parseBundleMf2Messages(rawMessages: unknown): Mf2MessageCatalog {
  if (!Array.isArray(rawMessages)) return Object.freeze({});
  const catalog: Record<string, Record<string, string>> = {};
  for (const entry of rawMessages) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as { readonly lang?: unknown; readonly resource?: unknown };
    if (typeof rec.lang !== 'string' || typeof rec.resource !== 'string') continue;
    const lang = rec.lang.trim();
    if (!lang) continue;
    const bucket = catalog[lang] ?? (catalog[lang] = {});
    for (const rawLine of rec.resource.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('@') || line === '---' || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (val.startsWith('{{') && val.endsWith('}}')) {
        val = val.slice(2, -2).trim();
      }
      if (key && val) {
        bucket[key] = val;
      }
    }
  }
  const frozen: Record<string, Readonly<Record<string, string>>> = {};
  for (const lang of Object.keys(catalog).sort(cmpStr)) {
    frozen[lang] = Object.freeze(catalog[lang]!);
  }
  return Object.freeze(frozen);
}

/**
 * Indexes Rezono-published `bundle.labels` entries (`{ element, lang, text }`) by locale.
 */
export function buildBundleLabelMap(rawLabels: unknown): BundleLabelCatalog {
  if (!Array.isArray(rawLabels)) return Object.freeze({});
  const byLang: Record<string, Record<string, string>> = {};
  for (const entry of rawLabels) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as { readonly element?: unknown; readonly lang?: unknown; readonly text?: unknown };
    if (typeof rec.element !== 'string' || typeof rec.lang !== 'string' || typeof rec.text !== 'string') continue;
    const lang = rec.lang.trim();
    const element = rec.element.trim();
    const text = rec.text.trim();
    if (!lang || !element || !text) continue;
    const bucket = byLang[lang] ?? (byLang[lang] = {});
    bucket[element] = text;
  }
  const frozen: Record<string, Readonly<Record<string, string>>> = {};
  for (const lang of Object.keys(byLang).sort(cmpStr)) {
    frozen[lang] = Object.freeze(byLang[lang]!);
  }
  return Object.freeze(frozen);
}

/**
 * Converts a fallback technical identifier into spaced prose so screen readers
 * never speak raw snake_case code when a bundle omits a localized label.
 */
export function humanizeProofMapIdentifier(raw: string): string {
  const stripped = raw.startsWith('calc__') ? raw.slice(6) : raw;
  const spaced = stripped.replace(/[_./-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.length > 0 ? spaced : 'item';
}

function resolveNodeLabel(
  node: ProofMapSemanticNode,
  lang: AtlasLocale,
  labels: BundleLabelCatalog
): string {
  const direct =
    labels[lang]?.[node.id] ??
    labels[lang]?.[node.className] ??
    labels.en?.[node.id] ??
    labels.en?.[node.className];
  return direct && direct.trim().length > 0
    ? direct.replace(/_/g, ' ').trim()
    : humanizeProofMapIdentifier(node.className);
}

function resolveLaneLabel(
  lane: string,
  lang: AtlasLocale,
  labels: BundleLabelCatalog
): string {
  const direct = labels[lang]?.[lane] ?? labels.en?.[lane];
  return direct && direct.trim().length > 0
    ? direct.replace(/_/g, ' ').trim()
    : humanizeProofMapIdentifier(lane);
}

function resolveLocalizedStateLabel(
  state: string,
  lang: AtlasLocale,
  messages: Mf2MessageCatalog
): string {
  const fromBundle = messages[lang]?.[`status.${state}`] ?? messages.en?.[`status.${state}`];
  if (fromBundle && fromBundle.trim().length > 0) {
    return fromBundle.replace(/_/g, ' ').trim();
  }
  return formatStateLabel(lang, state, messages).replace(/_/g, ' ');
}

/**
 * Formats a localized MF2 accessible sentence for a Proof Map node.
 * Derived nodes use the `means` sentence template; source nodes use the `fact` template.
 */
export function formatProofMapNodeSentence(
  node: ProofMapSemanticNode,
  lang: AtlasLocale,
  labels: BundleLabelCatalog,
  messages: Mf2MessageCatalog
): string {
  const label = resolveNodeLabel(node, lang, labels);
  const lane = resolveLaneLabel(node.lane, lang, labels);
  const sign = formatSignLabel(lang, node.sign, messages).replace(/_/g, ' ');
  const state = resolveLocalizedStateLabel(node.state, lang, messages);
  const templateKey = node.kind === 'derived' ? 'proof_map.sentence_derived' : 'proof_map.sentence_source';
  return formatAtlasMessage(lang, templateKey, { label, sign, lane, state }, messages);
}

/**
 * Deterministic arrow-key edge & lane walker for Proof Map keyboard navigation.
 * - ArrowLeft: moves to the first direct premise present in the layout.
 * - ArrowRight: moves to the first direct conclusion present in the layout.
 * - ArrowUp / ArrowDown: moves within the current depth column / lane.
 */
export function stepProofMapFocus(
  layout: Readonly<{
    readonly nodes: readonly ProofMapSemanticNode[];
    readonly edges: readonly ProofMapSemanticEdge[];
  }>,
  currentId: string,
  key: ProofMapFocusKey
): string {
  if (layout.nodes.length === 0) return currentId;
  const nodeById = new Map<string, ProofMapSemanticNode>(layout.nodes.map((n) => [n.id, n]));
  const current = nodeById.get(currentId);
  if (!current) return layout.nodes[0]!.id;

  if (key === 'ArrowLeft') {
    const validPremises = current.premises
      .filter((p) => nodeById.has(p))
      .sort(cmpStr);
    return validPremises[0] ?? current.id;
  }

  if (key === 'ArrowRight') {
    const conclusions = layout.edges
      .filter((e) => e.from === current.id && nodeById.has(e.to))
      .map((e) => e.to)
      .sort(cmpStr);
    if (conclusions.length > 0) return conclusions[0]!;
    const fallback = layout.nodes
      .filter((n) => n.premises.includes(current.id))
      .map((n) => n.id)
      .sort(cmpStr);
    return fallback[0] ?? current.id;
  }

  const sameGroup = layout.nodes
    .filter((n) => n.depth === current.depth && (current.depth > 0 || n.lane === current.lane))
    .sort((a, b) => cmpStr(a.id, b.id));

  const idx = sameGroup.findIndex((n) => n.id === current.id);
  if (idx < 0) return current.id;
  if (key === 'ArrowUp') {
    return sameGroup[idx > 0 ? idx - 1 : 0]!.id;
  }
  return sameGroup[idx + 1 < sameGroup.length ? idx + 1 : sameGroup.length - 1]!.id;
}

/**
 * Renders the synchronized `table[data-part="twin"]` (every drawn node + edge)
 * and `table[data-part="legend"]` fragment for embedding inside a Proof Map section.
 */
export function renderProofMapAccessibleTablesHtml(
  input: Omit<ProofMapAccessibleHtmlInput, 'svg'>
): string {
  const { lang, nodes, edges, legend } = input;
  const labels = buildBundleLabelMap(input.bundleLabels);
  const messages = parseBundleMf2Messages(input.bundleMessages);

  const nodeById = new Map<string, ProofMapSemanticNode>(nodes.map((n) => [n.id, n]));
  const twinLabel = formatAtlasMessage(lang, 'sheet.common.twin', {}, messages);
  const twinCaption = formatAtlasMessage(lang, 'sheet.common.twin_caption', {}, messages);
  const legendLabel = formatAtlasMessage(lang, 'sheet.common.legend', {}, messages);
  const legendCaption = formatAtlasMessage(lang, 'sheet.common.legend_caption', {}, messages);
  const openSlipLabel = formatAtlasMessage(lang, 'proof_map.open_slip', {}, messages);
  const edgeWord = formatAtlasMessage(lang, 'col.edge', {}, messages);

  const colHop = formatAtlasMessage(lang, 'col.hop', {}, messages);
  const colLane = formatAtlasMessage(lang, 'col.lane', {}, messages);
  const colLabel = formatAtlasMessage(lang, 'col.label', {}, messages);
  const colState = formatAtlasMessage(lang, 'col.state', {}, messages);
  const colProof = formatAtlasMessage(lang, 'col.proof', {}, messages);
  const colGlyph = formatAtlasMessage(lang, 'col.glyph', {}, messages);
  const colSign = formatAtlasMessage(lang, 'col.sign', {}, messages);

  const nodeRowsHtml = nodes
    .map((node) => {
      const sentence = formatProofMapNodeSentence(node, lang, labels, messages);
      const laneDisplay = resolveLaneLabel(node.lane, lang, labels);
      const nodeDisplay = resolveNodeLabel(node, lang, labels);
      const stateDisplay = resolveLocalizedStateLabel(node.state, lang, messages);
      const needsReason = node.state !== 'known';
      const reasonAttr = needsReason
        ? ` ${M.reason}="${escapeXml(node.reason ?? 'premise_missing')}"`
        : '';
      const slipHref = `?at=${encodeURIComponent(node.id)}&amp;proof=${encodeURIComponent(node.proofRef)}`;

      return (
        `<tr tabindex="0" aria-label="${escapeXml(sentence)}" ` +
        `${M.key}="${escapeXml(node.id)}" ${M.relation}="${escapeXml(node.id)}" ` +
        `${M.depth}="${node.depth}" ${M.state}="${escapeXml(node.state)}" ` +
        `${M.sign}="${escapeXml(node.sign)}" ${M.proof_ref}="${escapeXml(node.proofRef)}">` +
        `<td class="mono">${node.depth}</td>` +
        `<td>${escapeXml(laneDisplay)}</td>` +
        `<td>${escapeXml(nodeDisplay)}</td>` +
        `<td ${M.state}="${escapeXml(node.state)}"${reasonAttr}>${escapeXml(stateDisplay)}</td>` +
        `<td><a href="${slipHref}" ${M.proof_ref}="${escapeXml(node.proofRef)}">${escapeXml(openSlipLabel)}: ${escapeXml(node.proofRef)}</a></td>` +
        `</tr>`
      );
    })
    .join('');

  const edgeRowsHtml = edges
    .map((edge) => {
      const fromNode = nodeById.get(edge.from);
      const toNode = nodeById.get(edge.to);
      const fromDisplay = fromNode ? resolveNodeLabel(fromNode, lang, labels) : humanizeProofMapIdentifier(edge.from);
      const toDisplay = toNode ? resolveNodeLabel(toNode, lang, labels) : humanizeProofMapIdentifier(edge.to);
      const stateDisplay = resolveLocalizedStateLabel(edge.state, lang, messages);
      const proofRef = toNode?.proofRef ?? edge.to;
      const needsReason = edge.state !== 'known';
      const reasonAttr = needsReason ? ` ${M.reason}="premise_missing"` : '';

      return (
        `<tr ${M.relation}="${escapeXml(edge.to)}" ${M.state}="${escapeXml(edge.state)}" ${M.proof_ref}="${escapeXml(proofRef)}">` +
        `<td>${escapeXml(edgeWord)}</td>` +
        `<td>${escapeXml(fromDisplay)}</td>` +
        `<td>${escapeXml(toDisplay)}</td>` +
        `<td ${M.state}="${escapeXml(edge.state)}"${reasonAttr}>${escapeXml(stateDisplay)}</td>` +
        `<td class="mono">${escapeXml(proofRef)}</td>` +
        `</tr>`
      );
    })
    .join('');

  const legendRowsHtml = legend
    .map((entry) => {
      const signLabel = formatSignLabel(lang, entry.id, messages);
      return (
        `<tr ${M.sign}="${escapeXml(entry.id)}">` +
        `<td class="mono">${escapeXml(entry.glyph)}</td>` +
        `<td>${escapeXml(signLabel)}</td>` +
        `</tr>`
      );
    })
    .join('');

  return (
    `<table ${M.part}="twin" aria-label="${escapeXml(twinLabel)}">` +
    `<caption>${escapeXml(twinCaption)}</caption>` +
    `<thead><tr>` +
    `<th scope="col">${escapeXml(colHop)}</th>` +
    `<th scope="col">${escapeXml(colLane)}</th>` +
    `<th scope="col">${escapeXml(colLabel)}</th>` +
    `<th scope="col">${escapeXml(colState)}</th>` +
    `<th scope="col">${escapeXml(colProof)}</th>` +
    `</tr></thead>` +
    `<tbody>${nodeRowsHtml}${edgeRowsHtml}</tbody>` +
    `</table>` +
    `<table ${M.part}="legend" aria-label="${escapeXml(legendLabel)}">` +
    `<caption>${escapeXml(legendCaption)}</caption>` +
    `<thead><tr>` +
    `<th scope="col">${escapeXml(colGlyph)}</th>` +
    `<th scope="col">${escapeXml(colSign)}</th>` +
    `</tr></thead>` +
    `<tbody>${legendRowsHtml}</tbody>` +
    `</table>`
  );
}

/**
 * Renders the synchronized accessible HTML wrapper for a Proof Map layout:
 * - SVG canvas
 * - `table[data-part="twin"]` listing every drawn node (with focusable row, localized MF2
 *   sentence `aria-label`, and slip `a[href*="at="]`) and every drawn edge
 * - `table[data-part="legend"]` covering every drawn `data-sign`
 */
export function renderProofMapAccessibleHtml(input: ProofMapAccessibleHtmlInput): string {
  const messages = parseBundleMf2Messages(input.bundleMessages);
  const sectionLabel = formatAtlasMessage(input.lang, 'proof_map.title', {}, messages);
  return (
    `<section class="proof-map-a11y" lang="${escapeXml(input.lang)}" aria-label="${escapeXml(sectionLabel)}">` +
    `<div class="proof-map-canvas">${input.svg}</div>` +
    renderProofMapAccessibleTablesHtml(input) +
    `</section>`
  );
}
