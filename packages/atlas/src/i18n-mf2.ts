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
    'sheet.relief.subjects_caption': 'Subject outcomes, cliff distances, and citations',
    'sheet.relief.grid_caption': 'Orthographic sweep grid cells',
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
    'sheet.common.witness': 'witness',
    'sheet.common.no_proof': 'no proof',
    'sheet.flow.title': 'Flow & Reality-Split Curtain',
    'sheet.flow.subtitle': 'stated ∥ observed',
    'sheet.flow.diagram_label': '{$title} — stated parallel observed flow diagram',
    'sheet.flow.entities_caption': 'Entities projected across stated and observed layers',
    'sheet.flow.drift_caption': 'Reality-split drift edges (stated parallel observed)',
    'sheet.kringstand.title': 'Kringstand and round timeline',
    'sheet.kringstand.chronometer': 'Round chronometer',
    'sheet.kringstand.lanes': 'Board lanes',
    'sheet.kringstand.drawer': 'Proof drawer',
    'sheet.kringstand.twin_caption': 'Kringstand table twin',
    'sheet.bitemporal.title': 'Bitemporal Staircase',
    'sheet.bitemporal.projection': 'Projection',
    'sheet.bitemporal.matrix_caption': '{$x} (columns) × {$y} (rows)',
    'sheet.bitemporal.stair_label': '{$x} by {$y} orthographic staircase, height {$z}',
    'sheet.monge.title': 'Orthographic Folding Atlas ({$angle}°)',
    'sheet.monge.fold_angle': 'Fold angle',
    'sheet.monge.diagram_label': 'Orthographic folding sheet at {$angle} degrees',
    'sheet.monge.flat': '0° Flat',
    'sheet.monge.fold': '40° Fold',
    'sheet.monge.prism': '90° Prism',
    'control.valid_at': 'Valid at',
    'control.known_at': 'Known at',
    'control.permalink': 'Permalink',
    'col.entity': 'Entity',
    'col.subject': 'Subject',
    'col.cliff_distance': 'Cliff Distance',
    'col.hop': 'Hop',
    'col.gate': 'Gate',
    'col.load_bearing': 'Load-Bearing',
    'col.sign': 'Sign',
    'col.glyph': 'Glyph',
    'col.kind': 'Kind',
    'col.pattern': 'Pattern',
    'col.meaning': 'Meaning',
    'col.value': 'Value',
    'col.state': 'State',
    'col.zone': 'Zone',
    'col.layer': 'Layer',
    'col.edge': 'Edge',
    'col.from': 'From',
    'col.to': 'To',
    'col.label': 'Label',
    'col.stated_proof': 'Stated Proof',
    'col.observed_proof': 'Observed Proof',
    'col.round': 'Round',
    'col.certificate': 'Certificate',
    'col.lane': 'Lane',
    'col.item': 'Item',
    'col.tier': 'Tier',
    'col.knowledge_time': 'Knowledge Time',
    'col.knowledge_epoch': 'Knowledge Epoch',
    'col.citation': 'Citation',
    'col.proof': 'Proof',
    'sign.origin_decision': 'Decision origin',
    'sign.origin_vendor': 'Vendor origin',
    'sign.origin_design': 'Design origin',
    'sign.origin_observation': 'Observation origin',
    'sign.derived': 'Derived',
    'sign.unknown': 'Unknown',
    'sign.absent': 'Absent',
    'sign.not_applicable': 'Not applicable',
    'sign.invalid': 'Invalid',
    'sign.drift': 'Drift',
    'sign.valid': 'Valid',
    'sign.violated': 'Violated',
    'sign.supposed': 'Supposed',
    'sign.screened': 'Screened',
    'sign.sealed': 'Sealed',
    'state.known': 'Known',
    'state.unknown': 'Unknown',
    'state.absent': 'Absent',
    'state.not_applicable': 'Not applicable',
    'state.invalid': 'Invalid',
    'state.valid': 'Valid',
    'state.violated': 'Violated',
    'state.changed': 'Changed',
    'tier.sealed': 'Sealed',
    'tier.provisional_checked': 'Provisional (checked)',
    'tier.provisional_engine': 'Provisional (live stream)',
    'reason.fallback': 'Reason unavailable',
    'reason.not_read_in_full': 'Not read in full for this role',
    'reason.depth_limit_hop_2': 'Traversal stopped at hop limit',
    'reason.telemetry_timeout': 'Observation timed out',
    'reason.probe_unreachable': 'Observation probe unreachable',
    'reason.review_pending': 'Review pending',
    'reason.valid_after_knowledge': 'Not applicable before knowledge time',
    'reason.awaiting_probe': 'Awaiting observation probe',
    'reason.incomplete': 'Incomplete horizon',
    'reason.fact_missing': 'Required fact missing',
    'reason.no_recorded_answer': 'No recorded answer',
    'sheet.coverage.title': 'Question Coverage',
    'sheet.coverage.questions_caption': 'Declared questions and published coverage status',
    'sheet.coverage.unused_caption': 'Unused kinds and slots in the reader catalogue',
    'sheet.coverage.col_question': 'Question',
    'sheet.coverage.col_rows': 'Published rows',
    'sheet.coverage.col_example': 'Example slip',
    'sheet.coverage.col_element': 'Catalogue element',
    'sheet.coverage.col_category': 'Category',
    'sheet.coverage.cat_kind': 'Kind',
    'sheet.coverage.cat_slot': 'Slot',
    'sheet.coverage.summary_answered': 'Answered',
    'sheet.coverage.summary_unknown': 'Unknown',
    'sheet.coverage.summary_untested': 'Untested',
    'sheet.coverage.summary_unused_kinds': 'Unused kinds',
    'sheet.coverage.summary_unused_slots': 'Unused slots',
    'sheet.coverage.open_slip': 'Open slip'
  }),
  nl: Object.freeze({
    'sheet.relief.title': 'Orthografisch Reliëf',
    'sheet.relief.switch_to_2d': 'Schakel naar 2D-profiel',
    'sheet.relief.switch_to_3d': 'Schakel naar 3D-orthografisch',
    'sheet.relief.curtains': 'Onzekerheidsgordijnen',
    'sheet.relief.profile_suffix': '{$title} — 2D-profielsnede',
    'sheet.relief.terrain_suffix': '{$title} — orthografisch terrein',
    'sheet.relief.subjects_caption': 'Onderwerpuitkomsten, klifafstanden en bronverwijzingen',
    'sheet.relief.grid_caption': 'Orthografische rastercellen',
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
    'sheet.common.witness': 'getuige',
    'sheet.common.no_proof': 'geen bewijs',
    'sheet.flow.title': 'Stroom- & Werkelijkheidssplitsing',
    'sheet.flow.subtitle': 'opgegeven ∥ waargenomen',
    'sheet.flow.diagram_label': '{$title} — opgegeven parallel aan waargenomen stroomdiagram',
    'sheet.flow.entities_caption': 'Entiteiten geprojecteerd over opgegeven en waargenomen lagen',
    'sheet.flow.drift_caption': 'Werkelijkheidssplitsing-afwijkingen (opgegeven parallel aan waargenomen)',
    'sheet.kringstand.title': 'Kringstand en rondetijdlijn',
    'sheet.kringstand.chronometer': 'Rondechronometer',
    'sheet.kringstand.lanes': 'Bordbanen',
    'sheet.kringstand.drawer': 'Bewijslade',
    'sheet.kringstand.twin_caption': 'Kringstand-tabeltweeling',
    'sheet.bitemporal.title': 'Bitemporele Trap',
    'sheet.bitemporal.projection': 'Projectie',
    'sheet.bitemporal.matrix_caption': '{$x} (kolommen) × {$y} (rijen)',
    'sheet.bitemporal.stair_label': '{$x} bij {$y} orthografische trap, hoogte {$z}',
    'sheet.monge.title': 'Orthografische Vouw-atlas ({$angle}°)',
    'sheet.monge.fold_angle': 'Vouwhoek',
    'sheet.monge.diagram_label': 'Orthografisch vouwblad op {$angle} graden',
    'sheet.monge.flat': '0° Vlak',
    'sheet.monge.fold': '40° Vouw',
    'sheet.monge.prism': '90° Prisma',
    'control.valid_at': 'Geldig op',
    'control.known_at': 'Bekend op',
    'control.permalink': 'Permanente link',
    'col.entity': 'Entiteit',
    'col.subject': 'Onderwerp',
    'col.cliff_distance': 'Klifafstand',
    'col.hop': 'Stap',
    'col.gate': 'Poort',
    'col.load_bearing': 'Dragend',
    'col.sign': 'Teken',
    'col.glyph': 'Symbool',
    'col.kind': 'Soort',
    'col.pattern': 'Patroon',
    'col.meaning': 'Betekenis',
    'col.value': 'Waarde',
    'col.state': 'Status',
    'col.zone': 'Zone',
    'col.layer': 'Laag',
    'col.edge': 'Verbinding',
    'col.from': 'Van',
    'col.to': 'Naar',
    'col.label': 'Label',
    'col.stated_proof': 'Opgegeven bewijs',
    'col.observed_proof': 'Waargenomen bewijs',
    'col.round': 'Ronde',
    'col.certificate': 'Certificaat',
    'col.lane': 'Baan',
    'col.item': 'Item',
    'col.tier': 'Niveau',
    'col.knowledge_time': 'Kennistijd',
    'col.knowledge_epoch': 'Kennisepoche',
    'col.citation': 'Bronverwijzing',
    'col.proof': 'Bewijs',
    'sign.origin_decision': 'Besluitherkomst',
    'sign.origin_vendor': 'Leveranciersherkomst',
    'sign.origin_design': 'Ontwerpherkomst',
    'sign.origin_observation': 'Waarnemingsherkomst',
    'sign.derived': 'Afgeleid',
    'sign.unknown': 'Onbekend',
    'sign.absent': 'Afwezig',
    'sign.not_applicable': 'Niet van toepassing',
    'sign.invalid': 'Ongeldig',
    'sign.drift': 'Afwijking',
    'sign.valid': 'Geldig',
    'sign.violated': 'Geschonden',
    'sign.supposed': 'Verondersteld',
    'sign.screened': 'Afgeschermd',
    'sign.sealed': 'Verzegeld',
    'state.known': 'Bekend',
    'state.unknown': 'Onbekend',
    'state.absent': 'Afwezig',
    'state.not_applicable': 'Niet van toepassing',
    'state.invalid': 'Ongeldig',
    'state.valid': 'Geldig',
    'state.violated': 'Geschonden',
    'state.changed': 'Gewijzigd',
    'tier.sealed': 'Verzegeld',
    'tier.provisional_checked': 'Voorlopig (gecontroleerd)',
    'tier.provisional_engine': 'Voorlopig (live stroom)',
    'reason.fallback': 'Reden niet beschikbaar',
    'reason.not_read_in_full': 'Niet volledig leesbaar voor deze rol',
    'reason.depth_limit_hop_2': 'Doorzoeking gestopt bij staplimiet',
    'reason.telemetry_timeout': 'Waarneming verlopen',
    'reason.probe_unreachable': 'Meetpunt onbereikbaar',
    'reason.review_pending': 'Beoordeling in behandeling',
    'reason.valid_after_knowledge': 'Niet van toepassing vóór kennismoment',
    'reason.awaiting_probe': 'Wacht op meetpunt',
    'reason.incomplete': 'Onvolledige horizon',
    'reason.fact_missing': 'Vereist feit ontbreekt',
    'reason.no_recorded_answer': 'Geen vastgelegd antwoord',
    'sheet.coverage.title': 'Vraagdekking',
    'sheet.coverage.questions_caption': 'Verklaarde vragen en gepubliceerde dekkingsstatus',
    'sheet.coverage.unused_caption': 'Ongebruikte soorten en velden in de lezercatalogus',
    'sheet.coverage.col_question': 'Vraag',
    'sheet.coverage.col_rows': 'Gepubliceerde rijen',
    'sheet.coverage.col_example': 'Voorbeeldstrook',
    'sheet.coverage.col_element': 'Cataloguselement',
    'sheet.coverage.col_category': 'Categorie',
    'sheet.coverage.cat_kind': 'Soort',
    'sheet.coverage.cat_slot': 'Veld',
    'sheet.coverage.summary_answered': 'Beantwoord',
    'sheet.coverage.summary_unknown': 'Onbekend',
    'sheet.coverage.summary_untested': 'Ongetest',
    'sheet.coverage.summary_unused_kinds': 'Ongebruikte soorten',
    'sheet.coverage.summary_unused_slots': 'Ongebruikte velden',
    'sheet.coverage.open_slip': 'Open strook'
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
  return formatAtlasMessage(locale, 'reason.fallback', {}, overrides);
}

export function formatSignLabel(
  locale: AtlasLocale,
  signName: string,
  overrides?: Mf2MessageCatalog | null
): string {
  return formatAtlasMessage(locale, `sign.${signName}`, {}, overrides);
}

export function formatStateLabel(
  locale: AtlasLocale,
  stateName: string,
  overrides?: Mf2MessageCatalog | null
): string {
  return formatAtlasMessage(locale, `state.${stateName}`, {}, overrides);
}

export function formatTrustTierLabel(
  locale: AtlasLocale,
  tierName: string,
  overrides?: Mf2MessageCatalog | null
): string {
  return formatAtlasMessage(locale, `tier.${tierName}`, {}, overrides);
}
