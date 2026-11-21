/**
 * Deterministic MF2 Message Formatting for @rezono/cartouche-atlas (Decision 0011 / Issue #23 §5).
 * Zero Intl, zero domain words, supports Rezono-published MF2 message packs with built-in en/nl defaults.
 */

export type AtlasLocale = 'en' | 'nl';

export type Mf2MessageCatalog = Readonly<Record<string, Readonly<Record<string, string>>>>;

export const ATLAS_MF2_MESSAGES: Mf2MessageCatalog = Object.freeze({
  en: Object.freeze({
    'sheet.relief.title': 'Orthographic Relief',
    'sheet.relief.switch_to_2d': 'Switch to 2D profile',
    'sheet.relief.switch_to_3d': 'Switch to 3D orthographic',
    'sheet.relief.curtains': 'Uncertainty Curtains',
    'sheet.relief.profile_suffix': '{$title} — 2D profile slice',
    'sheet.relief.terrain_suffix': '{$title} — orthographic terrain',
    'sheet.ripple.title': 'Causal Ripple & Distance Columns',
    'sheet.ripple.diagram_label': '{$title} — {$mode} diagram',
    'sheet.ripple.summary': '{$mode} · dependents: {$count}',
    'sheet.common.seal': 'Verification seal',
    'sheet.common.seal_checks': 'Seal checks',
    'sheet.common.legend': 'Legend',
    'sheet.common.legend_caption': 'Drawn epistemic signs on this sheet',
    'sheet.common.twin': 'Accessible Table Twin',
    'sheet.common.twin_caption': 'Synchronized accessible table twin',
    'sheet.common.horizon_incomplete': 'Incomplete horizon: {$reason}',
    'control.valid_at': 'Valid at',
    'control.known_at': 'Known at',
    'control.permalink': 'Permalink',
    'col.entity': 'Entity',
    'col.hop': 'Hop',
    'col.gate': 'Gate',
    'col.load_bearing': 'Load-Bearing',
    'col.sign': 'Sign',
    'col.glyph': 'Glyph',
    'col.kind': 'Kind',
    'col.value': 'Value',
    'col.proof': 'Proof',
    'reason.not_read_in_full': 'Not read in full for this role',
    'reason.depth_limit_hop_2': 'Traversal stopped at hop limit',
    'reason.telemetry_timeout': 'Observation timed out',
    'reason.probe_unreachable': 'Observation probe unreachable',
    'reason.review_pending': 'Review pending',
    'reason.valid_after_knowledge': 'Not applicable before knowledge time',
    'reason.awaiting_probe': 'Awaiting observation probe',
    'reason.incomplete': 'Incomplete horizon'
  }),
  nl: Object.freeze({
    'sheet.relief.title': 'Orthografisch Reliëf',
    'sheet.relief.switch_to_2d': 'Schakel naar 2D-profiel',
    'sheet.relief.switch_to_3d': 'Schakel naar 3D-orthografisch',
    'sheet.relief.curtains': 'Onzekerheidsgordijnen',
    'sheet.relief.profile_suffix': '{$title} — 2D-profielsnede',
    'sheet.relief.terrain_suffix': '{$title} — orthografisch terrein',
    'sheet.ripple.title': 'Causale Rimpeleffecten & Afstandskolommen',
    'sheet.ripple.diagram_label': '{$title} — {$mode}-diagram',
    'sheet.ripple.summary': '{$mode} · afhankelijken: {$count}',
    'sheet.common.seal': 'Verificatiezegel',
    'sheet.common.seal_checks': 'Zegelcontroles',
    'sheet.common.legend': 'Legenda',
    'sheet.common.legend_caption': 'Getekende epistemische tekens op dit blad',
    'sheet.common.twin': 'Toegankelijke Tabeltweeling',
    'sheet.common.twin_caption': 'Gesynchroniseerde toegankelijke tabeltweeling',
    'sheet.common.horizon_incomplete': 'Onvolledige horizon: {$reason}',
    'control.valid_at': 'Geldig op',
    'control.known_at': 'Bekend op',
    'control.permalink': 'Permanente link',
    'col.entity': 'Entiteit',
    'col.hop': 'Stap',
    'col.gate': 'Poort',
    'col.load_bearing': 'Dragend',
    'col.sign': 'Teken',
    'col.glyph': 'Symbool',
    'col.kind': 'Soort',
    'col.value': 'Waarde',
    'col.proof': 'Bewijs',
    'reason.not_read_in_full': 'Niet volledig leesbaar voor deze rol',
    'reason.depth_limit_hop_2': 'Doorzoeking gestopt bij staplimiet',
    'reason.telemetry_timeout': 'Waarneming verlopen',
    'reason.probe_unreachable': 'Meetpunt onbereikbaar',
    'reason.review_pending': 'Beoordeling in behandeling',
    'reason.valid_after_knowledge': 'Niet van toepassing vóór kennismoment',
    'reason.awaiting_probe': 'Wacht op meetpunt',
    'reason.incomplete': 'Onvolledige horizon'
  })
});

const PLACEHOLDER_RE = /\{\$([a-zA-Z0-9_]+)\}/g;

/**
 * Deterministic MF2 placeholder interpolation (`{$var}`), zero Intl.
 */
export function fillMf2Message(
  template: string,
  params: Readonly<Record<string, string>> = {}
): string {
  return template.replace(PLACEHOLDER_RE, (_match: string, name: string) => {
    return Object.prototype.hasOwnProperty.call(params, name) ? params[name]! : `{$${name}}`;
  });
}

/**
 * Resolves an MF2 message key from optional Rezono-published overrides first,
 * then built-in locale catalog, then English fallback.
 */
export function formatAtlasMessage(
  locale: AtlasLocale,
  key: string,
  params: Readonly<Record<string, string>> = {},
  overrides?: Mf2MessageCatalog | null
): string {
  const fromOverride = overrides?.[locale]?.[key] ?? overrides?.en?.[key];
  const fromDefault = ATLAS_MF2_MESSAGES[locale]?.[key] ?? ATLAS_MF2_MESSAGES.en?.[key];
  const template = fromOverride ?? fromDefault ?? key;
  return fillMf2Message(template, params);
}

/**
 * Formats a published epistemic reason code for human display without exposing raw snake_case.
 * Preserves machine codes in `data-reason` separately. Never introduces digits.
 */
export function formatReasonLabel(
  locale: AtlasLocale,
  reasonCode: string,
  overrides?: Mf2MessageCatalog | null
): string {
  const msgKey = `reason.${reasonCode}`;
  const fromOverride = overrides?.[locale]?.[msgKey] ?? overrides?.en?.[msgKey];
  if (fromOverride) return fromOverride;
  const fromDefault = ATLAS_MF2_MESSAGES[locale]?.[msgKey] ?? ATLAS_MF2_MESSAGES.en?.[msgKey];
  if (fromDefault) return fromDefault;
  const words = reasonCode.replace(/_/g, ' ').trim();
  if (words.length === 0) return reasonCode;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
