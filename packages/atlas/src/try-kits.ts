/**
 * Decision 0012 §3 (12): Data-driven, browser-safe, domain-neutral Try Kits renderer.
 * Reads recorded Rezono publication descriptors from fixtures/kits/catalog.json and
 * renders deterministic HTML with <del>/<ins> diffs and published turning points using
 * exclusively frozen contracts/data-marks.json attributes and standard HTML/ARIA.
 */

import catalogData from '../../../fixtures/kits/catalog.json' with { type: 'json' };
import type { PaletteName } from '../../reader-core/src/palette.ts';
import { escapeXml } from './flow-split-svg.ts';
import { formatAtlasMessage } from './i18n-mf2.ts';
import type { AtlasLocale } from './i18n-mf2.ts';

export interface TryKitSourceMeta {
  readonly repository: string;
  readonly commit: string;
  readonly pack: string;
}

export interface TryKitDescriptor {
  readonly id: string;
  readonly title: Readonly<Record<AtlasLocale, string>>;
  readonly fixturePath: string;
  readonly source: TryKitSourceMeta;
  readonly hasPublishedTurningPoint: boolean;
}

export interface RenderTryKitOptions {
  readonly suppose?: boolean;
  readonly locale?: AtlasLocale;
  readonly theme?: PaletteName;
}

interface CatalogKitEntry {
  readonly id: string;
  readonly title: Readonly<Record<AtlasLocale, string>>;
  readonly fixturePath: string;
  readonly source: TryKitSourceMeta;
  readonly baseDisplay: string;
  readonly supposeDisplay: string;
  readonly turnStatus: 'turns' | 'same' | 'unknown' | null;
  readonly baseProofRef: string;
  readonly supposeProofRef: string;
  readonly baseSlipHref: string;
  readonly supposeSlipHref: string;
  readonly hasPublishedTurningPoint: boolean;
}

const CATALOG_KITS: readonly CatalogKitEntry[] = catalogData.kits as readonly CatalogKitEntry[];

/**
 * Lists all recorded Try Kits declared in fixtures/kits/catalog.json,
 * citing each recorded fixture's Rezono repository and pinned commit.
 */
export function listTryKits(): readonly TryKitDescriptor[] {
  return Object.freeze(
    CATALOG_KITS.map((entry) =>
      Object.freeze({
        id: entry.id,
        title: Object.freeze({ en: entry.title.en, nl: entry.title.nl }),
        fixturePath: entry.fixturePath,
        source: Object.freeze({
          repository: entry.source.repository,
          commit: entry.source.commit,
          pack: entry.source.pack
        }),
        hasPublishedTurningPoint: entry.hasPublishedTurningPoint
      })
    )
  );
}

/**
 * Deterministically renders a recorded Try Kit in either base or suppose-variant mode.
 * Toggling suppose on shows the published <del>/<ins> difference and any published
 * turning point ([data-turn="turns"]); toggling back off reproduces the exact base bytes.
 */
export function renderTryKit(kitId: string, options: RenderTryKitOptions = {}): string {
  const locale: AtlasLocale = options.locale ?? 'en';
  const theme: PaletteName = options.theme ?? 'swisstopo';
  const suppose = Boolean(options.suppose);

  const entry = CATALOG_KITS.find((k) => k.id === kitId);
  if (!entry) {
    throw new Error(`Unknown try kit: "${kitId}".`);
  }

  const msg = (key: string): string => formatAtlasMessage(locale, key);
  const title = entry.title[locale] ?? entry.title.en;

  const valueCellHtml = suppose
    ? `<td data-part="value" data-state="changed"><del>${escapeXml(entry.baseDisplay)}</del> <ins>${escapeXml(entry.supposeDisplay)}</ins></td>`
    : `<td data-part="value" data-state="known">${escapeXml(entry.baseDisplay)}</td>`;

  const turnHtml =
    suppose && entry.turnStatus === 'turns'
      ? `<span data-turn="turns">${escapeXml(msg('kits.turning_point'))}</span>`
      : '';

  const proofRef = suppose ? entry.supposeProofRef : entry.baseProofRef;
  const slipHref = suppose ? entry.supposeSlipHref : entry.baseSlipHref;

  return [
    `<section data-cartouche-theme="${escapeXml(theme)}" aria-label="${escapeXml(title)}">`,
    `<h2>${escapeXml(title)}</h2>`,
    `<button type="button" data-verb="suppose" data-key="s" aria-pressed="${suppose ? 'true' : 'false'}">${escapeXml(msg('kits.suppose_toggle'))}</button>`,
    turnHtml,
    `<table>`,
    `<thead><tr>`,
    `<th>${escapeXml(msg('kits.col_conclusion'))}</th>`,
    `<th>${escapeXml(msg('kits.col_value'))}</th>`,
    `<th>${escapeXml(msg('kits.col_slip'))}</th>`,
    `</tr></thead>`,
    `<tbody><tr data-key="${escapeXml(entry.id)}">`,
    `<td>${escapeXml(title)}</td>`,
    valueCellHtml,
    `<td><a href="${escapeXml(slipHref)}" data-proof-ref="${escapeXml(proofRef)}">${escapeXml(msg('kits.open_slip'))}</a></td>`,
    `</tr></tbody>`,
    `</table>`,
    `</section>`
  ].join('');
}
