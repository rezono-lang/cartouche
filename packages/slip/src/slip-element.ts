/**
 * Embeddable <rezono-slip> Custom Element wrapper (Decisions 0003, 0004, 0006).
 * Emits canonical data-* marks from contracts/data-marks.json, handles W/D/M/S/C/P
 * keyboard shortcuts, locks [P] Propose on unsealed streams, and renders HTTP 410 unserved states.
 * Zero client compute: all displayed values are server-projected opaque strings validated via asOpaqueCell.
 */

import {
  DATA_MARKS,
  PALETTES,
  SIGNS,
  STD_VERBS,
  asOpaqueCell,
  canonicalJson,
  paletteCss,
  renderOpaqueText
} from '../../reader-core/src/index.ts';
import type {
  CartoucheSeal,
  OpaqueDisplayCell,
  PaletteName,
  RawCellInput,
  SignSpec,
  StdVerbSpec
} from '../../reader-core/src/index.ts';
import { selectSlipVerb } from './slip-controller.ts';
import type { SlipModel, VerbKey } from './slip-controller.ts';

export const SLIP_ELEMENT_TAG = 'rezono-slip' as const;

export interface UnservedInfo {
  readonly code: string;
  readonly superseded_by?: string | null | undefined;
  readonly reason_message_id: string;
  readonly withdrawn_by_decision_ref?: string | null | undefined;
}

export interface SealCheckItem {
  readonly id: string;
  readonly status: 'green' | 'warning' | 'red';
  readonly label?: string | undefined;
}

export interface ElementSentenceBinding {
  readonly name: string;
  readonly display: string;
  readonly premise_position?: number | undefined;
  readonly aggregate?: boolean | undefined;
}

export interface ElementGroundLine {
  readonly part?: 'total' | undefined;
  readonly relation: string;
  readonly key: readonly string[];
  readonly polarity: 'positive' | 'negative';
  readonly depth: number;
  readonly premise_position?: number | undefined;
  readonly sign?: string | undefined;
  readonly label?: string | undefined;
  readonly cell: RawCellInput;
  readonly answered_verbs?: readonly string[] | undefined;
  readonly sweep_name?: string | undefined;
}

export interface ElementCalcStep {
  readonly path: string;
  readonly depth: number;
  readonly sign?: string | undefined;
  readonly cell: RawCellInput;
  readonly kind?: 'step' | 'constant' | undefined;
  readonly relation?: string | undefined;
  readonly key?: readonly string[] | undefined;
  readonly polarity?: 'positive' | 'negative' | undefined;
  readonly label?: string | undefined;
  readonly answered_verbs?: readonly string[] | undefined;
}

/** The sentence as the build filled it with Rezono's fill.ts (Decision 0009): text, and the line a variable links to. */
export interface ElementSentenceSegment {
  readonly text: string;
  readonly line?: number | undefined;
}

export interface ElementConformanceRow {
  readonly kind: 'rule' | 'calc';
  readonly rule_id: string;
  readonly sentence?: readonly ElementSentenceSegment[] | undefined;
  readonly sentence_template?: string | undefined;
  readonly bindings?: readonly ElementSentenceBinding[] | undefined;
  readonly grounds_distance_1?: readonly ElementGroundLine[] | undefined;
  readonly result_cell?: RawCellInput | undefined;
  readonly steps?: readonly ElementCalcStep[] | undefined;
}

export interface SlipSealInput {
  readonly manifestId: string;
  readonly epoch: number;
  readonly knowledgeTime: string;
  readonly role: string;
  readonly witnessCheck: 'green' | 'failed';
  readonly trustTier?: CartoucheSeal['trustTier'] | undefined;
  readonly provisionalCount: number;
  readonly canPropose: boolean;
}

export interface SlipElementState {
  readonly theme?: PaletteName | undefined;
  readonly model?: SlipModel | null | undefined;
  readonly seal?: SlipSealInput | null | undefined;
  readonly sealChecks?: readonly SealCheckItem[] | undefined;
  readonly unserved?: UnservedInfo | null | undefined;
  readonly httpStatus?: number | null | undefined;
  readonly activeVerb?: VerbKey | undefined;
  readonly availableVerbs?: readonly string[] | null | undefined;
  readonly conformanceRow?: ElementConformanceRow | null | undefined;
}

export interface SlipMountHandle {
  readonly unmount: () => void;
}

export type SlipMountAdapter = (target: HTMLElement, state: SlipElementState) => SlipMountHandle;

export type ShortcutResolution =
  | { readonly status: 'select'; readonly spec: StdVerbSpec }
  | { readonly status: 'locked'; readonly spec: StdVerbSpec; readonly reason: string }
  | { readonly status: 'ignored' };

export function resolveSlipShortcut(
  rawKey: string,
  options: {
    readonly proposeAllowed: boolean;
    readonly proposeBlockedReason?: string | null | undefined;
    readonly availableVerbs?: readonly string[] | null | undefined;
  }
): ShortcutResolution {
  const pressed = rawKey.toLowerCase();
  const allowedSet =
    options.availableVerbs !== undefined && options.availableVerbs !== null
      ? new Set(options.availableVerbs)
      : null;

  const spec = STD_VERBS.find((v) => v.key === pressed);
  if (!spec) return { status: 'ignored' };
  if (allowedSet !== null && !allowedSet.has(spec.verb) && !(spec.question !== undefined && allowedSet.has(spec.question))) {
    return { status: 'ignored' };
  }
  if (spec.verb === 'propose' && !options.proposeAllowed) {
    return {
      status: 'locked',
      spec,
      reason: options.proposeBlockedReason ?? 'propose_locked_unsealed_live_stream'
    };
  }
  return { status: 'select', spec };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveSignSpec(signName: string): SignSpec {
  const spec = SIGNS[signName];
  if (!spec) {
    throw new Error(`Unknown std-view sign: "${signName}".`);
  }
  return spec;
}

function proofRefAttr(proofRef: string | null | undefined): string {
  return proofRef ? ` ${DATA_MARKS.proof_ref}="${escapeHtml(proofRef)}"` : '';
}

function renderSignSpan(signName: string, proofRef: string | null | undefined, reason?: string | null): string {
  const spec = resolveSignSpec(signName);
  const reasonAttr = reason ? ` ${DATA_MARKS.reason}="${escapeHtml(reason)}"` : '';
  return (
    `<span class="cartouche-sign" role="img" ${DATA_MARKS.sign}="${escapeHtml(signName)}"` +
    `${proofRefAttr(proofRef)}${reasonAttr} aria-label="${escapeHtml(signName)}">` +
    `<span aria-hidden="true">${escapeHtml(spec.glyph)}</span></span>`
  );
}

const DIGIT_RE = /[0-9]/;

function stateSignName(state: string): string {
  return state;
}

function renderOpaqueCellTd(opaque: OpaqueDisplayCell): string {
  if (opaque.state === 'known') {
    return (
      `<td ${DATA_MARKS.part}="value" ${DATA_MARKS.state}="known" ` +
      `${DATA_MARKS.proof_ref}="${escapeHtml(opaque.proofRef)}">${escapeHtml(renderOpaqueText(opaque))}</td>`
    );
  }
  if (opaque.state === 'unknown' && opaque.reason && DIGIT_RE.test(opaque.reason)) {
    throw new Error(`unknown cell reason must not contain digits: ${opaque.proofRef}`);
  }
  const reasonAttr = opaque.reason ? ` ${DATA_MARKS.reason}="${escapeHtml(opaque.reason)}"` : '';
  const completenessAttr =
    opaque.state === 'absent' && opaque.completenessWitnessRef
      ? ` ${DATA_MARKS.completeness_ref}="${escapeHtml(opaque.completenessWitnessRef)}"`
      : '';
  return (
    `<td ${DATA_MARKS.part}="value" ${DATA_MARKS.state}="${escapeHtml(opaque.state)}"` +
    `${reasonAttr} ${DATA_MARKS.proof_ref}="${escapeHtml(opaque.proofRef)}"${completenessAttr}>` +
    `${renderSignSpan(stateSignName(opaque.state), opaque.proofRef, opaque.reason)}` +
    `${opaque.reason ? `<span>${escapeHtml(opaque.reason)}</span>` : ''}</td>`
  );
}

function resolveThemeName(raw: string | null | undefined): PaletteName {
  if (raw === 'swisstopo' || raw === 'obsidian' || raw === 'forced') return raw;
  return 'swisstopo';
}

export function renderSlipElementHtml(state: SlipElementState): string {
  const theme = resolveThemeName(state.theme);
  const seal = state.seal ?? null;
  const model = state.model ?? null;
  const unserved = state.unserved ?? null;
  const conformanceRow = state.conformanceRow ?? null;
  const isUnserved = unserved !== null || state.httpStatus === 410;
  const trustTier = seal?.trustTier ?? null;
  const trustTierAttr = trustTier ? ` ${DATA_MARKS.trust_tier}="${escapeHtml(trustTier)}"` : '';
  const currentVerb: VerbKey = state.activeVerb ?? model?.activeVerb ?? 'w';
  const proposeAllowed = model !== null ? model.proposeAllowed : seal !== null ? seal.canPropose : false;
  const proposeBlockedReason =
    model !== null
      ? model.proposeBlockedReason
      : proposeAllowed
        ? null
        : trustTier === 'provisional_engine'
          ? 'propose_locked_unsealed_live_stream'
          : seal && seal.witnessCheck !== 'green'
            ? 'propose_locked_witness_failed'
            : 'propose_locked_no_right';

  const parts: string[] = [
    `<div class="cartouche-slip-root" ${DATA_MARKS.theme}="${escapeHtml(theme)}"` +
      `${trustTierAttr} role="region" aria-label="Proof slip" tabindex="-1">`,
    `<style>${paletteCss(theme)}</style>`
  ];

  if (isUnserved) {
    const code = unserved ? unserved.code : state.httpStatus !== null && state.httpStatus !== undefined ? `http_status_${state.httpStatus}` : null;
    const reasonAttr = code ? ` ${DATA_MARKS.reason}="${escapeHtml(code)}"` : '';
    parts.push(
      `<div class="slip-unserved" ${DATA_MARKS.part}="unserved" ${DATA_MARKS.state}="invalid"` +
        `${reasonAttr} role="alert">`,
      `<h2>Publication Unserved</h2>`
    );
    if (code) {
      parts.push(`<p>${escapeHtml(code)}</p>`);
    }
    if (unserved?.reason_message_id) {
      parts.push(`<p>${escapeHtml(unserved.reason_message_id)}</p>`);
    }
    if (unserved?.superseded_by) {
      parts.push(`<p>Superseded by: <code>${escapeHtml(unserved.superseded_by)}</code></p>`);
    }
    if (unserved?.withdrawn_by_decision_ref) {
      const ref = escapeHtml(unserved.withdrawn_by_decision_ref);
      parts.push(`<p>Decision: <a href="#${ref}" ${DATA_MARKS.proof_ref}="${ref}">${ref}</a></p>`);
    }
    parts.push('</div></div>');
    return parts.join('');
  }

  const drawnSigns: string[] = [];
  const seenSigns = new Set<string>();
  const trackSign = (signName: string) => {
    resolveSignSpec(signName);
    if (!seenSigns.has(signName)) {
      seenSigns.add(signName);
      drawnSigns.push(signName);
    }
  };

  if (seal) {
    const checks: readonly SealCheckItem[] =
      state.sealChecks && state.sealChecks.length > 0
        ? state.sealChecks
        : [{ id: 'witness', status: seal.witnessCheck === 'green' ? 'green' : 'red', label: 'witness' }];
    const sealTierAttr = seal.trustTier ? ` ${DATA_MARKS.trust_tier}="${escapeHtml(seal.trustTier)}"` : '';
    const sealTierSpan = seal.trustTier ? `<span>${escapeHtml(seal.trustTier)}</span> ` : '';
    parts.push(
      `<section class="slip-seal" ${DATA_MARKS.part}="seal"${sealTierAttr} aria-label="Verification seal">`,
      `<div><span ${DATA_MARKS.part}="manifest-hash">${escapeHtml(seal.manifestId)}</span> `,
      `${sealTierSpan}<span>${escapeHtml(seal.role)}</span></div>`,
      `<ul aria-label="Seal checks">`
    );
    for (const chk of checks) {
      parts.push(
        `<li ${DATA_MARKS.check}="${escapeHtml(chk.id)}" ${DATA_MARKS.status}="${escapeHtml(chk.status)}">` +
          `${escapeHtml(chk.label ?? chk.id)}: ${escapeHtml(chk.status)}</li>`
      );
    }
    parts.push('</ul></section>');
  }

  if (model && model.prism5.length === 5) {
    parts.push(
      `<section class="slip-prism" ${DATA_MARKS.part}="prism" aria-label="Epistemic prism">`,
      `<h2>Epistemic Prism</h2>`,
      `<table><thead><tr><th scope="col">Spectrum</th><th scope="col">Meter</th><th scope="col">Ratio</th></tr></thead><tbody>`
    );
    for (const spectrum of model.prism5) {
      parts.push(
        `<tr ${DATA_MARKS.key}="${escapeHtml(spectrum.key)}" ${DATA_MARKS.state}="${escapeHtml(spectrum.state)}"` +
          `${proofRefAttr(model.proofRef)}>` +
          `<td>${escapeHtml(spectrum.label)}</td>` +
          `<td><span aria-hidden="true" style="width: ${spectrum.bar_units}%"></span></td>` +
          `<td${proofRefAttr(model.proofRef)}>${escapeHtml(spectrum.ratio_display)}</td>` +
          `</tr>`
      );
    }
    parts.push('</tbody></table></section>');
  }

  if (model) {
    const allowedSet =
      state.availableVerbs !== undefined && state.availableVerbs !== null
        ? new Set(state.availableVerbs)
        : null;
    const verbs =
      allowedSet === null
        ? STD_VERBS
        : STD_VERBS.filter((v) => allowedSet.has(v.verb) || (v.question !== undefined && allowedSet.has(v.question)));

    parts.push(`<nav class="slip-verb-bar" aria-label="Slip verbs">`);
    for (const spec of verbs) {
      const locked = spec.verb === 'propose' && !proposeAllowed;
      const pressed = currentVerb === spec.key ? 'true' : 'false';
      const disabledAttrs = locked ? ' disabled aria-disabled="true"' : '';
      const lockedBadge =
        locked && proposeBlockedReason
          ? `<span ${DATA_MARKS.reason}="${escapeHtml(proposeBlockedReason)}">locked</span>`
          : '';
      parts.push(
        `<button type="button" ${DATA_MARKS.verb}="${escapeHtml(spec.verb)}" ` +
          `${DATA_MARKS.key}="${escapeHtml(spec.key)}"${proofRefAttr(model.proofRef)} ` +
          `aria-pressed="${pressed}"${disabledAttrs}>` +
          `<kbd>${escapeHtml(spec.key.toUpperCase())}</kbd><span>${escapeHtml(spec.verb)}</span>${lockedBadge}</button>`
      );
    }
    parts.push('</nav>');
  }

  if (conformanceRow) {
    // One line renderer for the premises of a rule row and the steps of a calculated row; a line's index from 0
    // is its data-line (Rezono's marks, Decision 0009). The sentence comes filled from the build.
    const isCalc = conformanceRow.kind === 'calc';
    const resultOpaque = isCalc && conformanceRow.result_cell ? asOpaqueCell(conformanceRow.result_cell) : null;
    const lines: readonly (ElementGroundLine | ElementCalcStep)[] = isCalc
      ? (conformanceRow.steps ?? []).filter((s) => s.kind !== 'constant')
      : (conformanceRow.grounds_distance_1 ?? []);
    const validated = lines.map((line) => ({ line, opaque: asOpaqueCell(line.cell) }));

    const sentence = conformanceRow.sentence ?? [];
    if (sentence.length > 0) {
      parts.push(`<div class="slip-sentence" ${DATA_MARKS.part}="sentence">`);
      for (const seg of sentence) {
        const target = seg.line !== undefined ? validated[seg.line] : undefined;
        if (seg.line !== undefined && target) {
          parts.push(
            `<a href="#slip-line-${seg.line}" ${DATA_MARKS.line}="${seg.line}" ` +
              `${DATA_MARKS.proof_ref}="${escapeHtml(target.opaque.proofRef)}">${escapeHtml(seg.text)}</a>`
          );
        } else {
          parts.push(`<span>${escapeHtml(seg.text)}</span>`);
        }
      }
      parts.push('</div>');
    }

    parts.push(
      `<table class="slip-table" ${DATA_MARKS.sheet}="slip" aria-label="${isCalc ? 'Calculation proof slip' : 'Rule proof slip'}">`,
      `<thead><tr><th scope="col">Line</th><th scope="col">Sign</th><th scope="col">${isCalc ? 'Step' : 'Relation'}</th><th scope="col">Value</th><th scope="col">Actions</th></tr></thead><tbody>`
    );
    if (resultOpaque) {
      if (resultOpaque.state !== 'known') trackSign(stateSignName(resultOpaque.state));
      parts.push(
        `<tr ${DATA_MARKS.proof_ref}="${escapeHtml(resultOpaque.proofRef)}">` +
          `<td></td><td></td><td>${escapeHtml(conformanceRow.rule_id)}</td>` +
          `${renderOpaqueCellTd(resultOpaque)}<td></td></tr>`
      );
    }
    for (let idx = 0; idx < validated.length; idx++) {
      const entry = validated[idx]!;
      const line = entry.line;
      const opaque = entry.opaque;
      if (line.sign) trackSign(line.sign);
      if (opaque.state !== 'known') trackSign(stateSignName(opaque.state));
      const attr = (name: string, value: string | undefined): string =>
        value === undefined ? '' : ` ${name}="${escapeHtml(value)}"`;
      const allowedLine = new Set(line.answered_verbs ?? []);
      const lineVerbs = STD_VERBS.filter((v) => allowedLine.has(v.verb) || (v.question !== undefined && allowedLine.has(v.question)));
      const buttonsHtml = lineVerbs
        .map(
          (spec) =>
            `<button type="button" ${DATA_MARKS.verb}="${escapeHtml(spec.verb)}" ${DATA_MARKS.key}="${escapeHtml(spec.key)}" ${DATA_MARKS.proof_ref}="${escapeHtml(opaque.proofRef)}">` +
            `<kbd>${escapeHtml(spec.key.toUpperCase())}</kbd><span>${escapeHtml(spec.verb)}</span></button>`
        )
        .join('');
      const part = 'part' in line ? line.part : undefined;
      const path = 'path' in line ? line.path : undefined;
      parts.push(
        `<tr id="slip-line-${idx}" ${DATA_MARKS.line}="${idx}"` +
          attr(DATA_MARKS.part, part) +
          attr(DATA_MARKS.relation, line.relation) +
          attr(DATA_MARKS.key, line.key ? canonicalJson(line.key) : undefined) +
          attr(DATA_MARKS.polarity, line.polarity) +
          ` ${DATA_MARKS.depth}="${line.depth}"` +
          attr(DATA_MARKS.path, path) +
          ` ${DATA_MARKS.proof_ref}="${escapeHtml(opaque.proofRef)}">` +
          `<td>${idx}</td><td>${line.sign ? renderSignSpan(line.sign, opaque.proofRef) : ''}</td>` +
          `<td>${escapeHtml(line.label ?? line.relation ?? path ?? '')}</td>${renderOpaqueCellTd(opaque)}<td>${buttonsHtml}</td></tr>`
      );
    }
    parts.push('</tbody></table>');
  } else if (model) {
    trackSign('derived');
    parts.push(
      `<table class="slip-table" ${DATA_MARKS.sheet}="slip" aria-label="Subject proof slip">`,
      `<thead><tr><th scope="col">Line</th><th scope="col">Sign</th><th scope="col">Subject</th><th scope="col">Proof</th></tr></thead>`,
      `<tbody><tr id="slip-line-0" ${DATA_MARKS.line}="0" ${DATA_MARKS.relation}="subject" ` +
        `${DATA_MARKS.key}="${escapeHtml(canonicalJson([model.subjectId]))}" ${DATA_MARKS.polarity}="positive" ` +
        `${DATA_MARKS.depth}="0"${proofRefAttr(model.proofRef)}>` +
        `<td>0</td><td>${renderSignSpan('derived', model.proofRef)}</td>` +
        `<td>${escapeHtml(model.subjectId)}</td>` +
        `<td ${DATA_MARKS.part}="value" ${DATA_MARKS.state}="known"${proofRefAttr(model.proofRef)}>${escapeHtml(model.proofRef ?? 'no proof')}</td>` +
        `</tr></tbody></table>`
    );
  }

  if (model && currentVerb === 'm' && model.missingLevers.length > 0) {
    parts.push(
      `<section class="slip-levers" ${DATA_MARKS.part}="levers" aria-label="Certainty levers">`,
      `<h2>Certainty Levers</h2>`,
      `<table><thead><tr><th scope="col">Lever</th><th scope="col">Unblocks</th><th scope="col">Load Bearing</th></tr></thead><tbody>`
    );
    for (const lever of model.missingLevers) {
      parts.push(
        `<tr ${DATA_MARKS.key}="${escapeHtml(lever.id)}" ${DATA_MARKS.load_bearing}="${lever.redundant ? 'false' : 'true'}"` +
          `${proofRefAttr(model.proofRef)}>` +
          `<td>${escapeHtml(lever.label)}</td>` +
          `<td>${escapeHtml(lever.unblocks.join(', '))}</td>` +
          `<td>${lever.redundant ? 'redundant' : 'load-bearing'}</td></tr>`
      );
    }
    parts.push('</tbody></table></section>');
  }

  if (model && currentVerb === 's' && model.adjacentWorlds.length > 0) {
    trackSign('supposed');
    parts.push(
      `<section class="slip-adjacent-worlds" ${DATA_MARKS.part}="adjacent-worlds" aria-label="Adjacent worlds">`,
      `<h2>Adjacent Worlds (Δ = 1)</h2>`,
      `<table><thead><tr><th scope="col">Sign</th><th scope="col">Sector</th><th scope="col">Change</th><th scope="col">Outcome</th></tr></thead><tbody>`
    );
    for (const hop of model.adjacentWorlds) {
      parts.push(
        `<tr ${DATA_MARKS.key}="${escapeHtml(hop.id)}" ${DATA_MARKS.proof_ref}="${escapeHtml(hop.proof_ref)}">` +
          `<td>${renderSignSpan('supposed', hop.proof_ref)}</td>` +
          `<td>${escapeHtml(hop.sector)}</td>` +
          `<td>${escapeHtml(hop.label)}</td>` +
          `<td ${DATA_MARKS.part}="value" ${DATA_MARKS.state}="known" ${DATA_MARKS.proof_ref}="${escapeHtml(hop.proof_ref)}">${escapeHtml(hop.outcome_display)}</td></tr>`
      );
    }
    parts.push('</tbody></table></section>');
  }

  if (drawnSigns.length > 0) {
    parts.push(
      `<table class="slip-legend" ${DATA_MARKS.part}="legend" aria-label="Sign legend">`,
      `<thead><tr><th scope="col">Glyph</th><th scope="col">Sign</th><th scope="col">Kind</th><th scope="col">Pattern</th></tr></thead><tbody>`
    );
    for (const signName of drawnSigns) {
      const spec = resolveSignSpec(signName);
      parts.push(
        `<tr ${DATA_MARKS.sign}="${escapeHtml(signName)}">` +
          `<td><span aria-hidden="true">${escapeHtml(spec.glyph)}</span></td>` +
          `<td>${escapeHtml(signName)}</td>` +
          `<td>${escapeHtml(spec.kind)}</td>` +
          `<td>${escapeHtml(spec.pattern)}</td></tr>`
      );
    }
    parts.push('</tbody></table>');
  }

  parts.push('</div>');
  return parts.join('');
}

export interface SlipElementInstance extends HTMLElement {
  state: SlipElementState;
  mountAdapter: SlipMountAdapter | null;
  selectVerb(key: VerbKey): boolean;
  render(): void;
}

export interface SlipWindowLike {
  readonly HTMLElement?: typeof HTMLElement;
  readonly CustomEvent?: typeof CustomEvent;
  readonly customElements?: CustomElementRegistry;
}

export type SlipElementConstructor = new () => SlipElementInstance;

export function defineSlipElement(targetWindow?: SlipWindowLike): SlipElementConstructor | null {
  const win = targetWindow ?? (globalThis as unknown as SlipWindowLike);
  const BaseHTMLElement = win.HTMLElement;
  const registry = win.customElements;
  const EventCtor = win.CustomEvent ?? globalThis.CustomEvent;

  if (!BaseHTMLElement || !registry) return null;

  const existing = registry.get(SLIP_ELEMENT_TAG);
  if (existing) return existing as unknown as SlipElementConstructor;

  class RezonoSlipElement extends BaseHTMLElement implements SlipElementInstance {
    static readonly observedAttributes: readonly string[] = [
      DATA_MARKS.theme,
      'theme',
      'active-verb'
    ];

    #state: SlipElementState = { theme: 'swisstopo' };
    #mountAdapter: SlipMountAdapter | null = null;
    #mountedHandle: SlipMountHandle | null = null;
    #onKeydownBound: (ev: Event) => void;
    #onClickBound: (ev: Event) => void;

    constructor() {
      super();
      this.#onKeydownBound = (ev: Event) => this.#handleKeydown(ev as KeyboardEvent);
      this.#onClickBound = (ev: Event) => this.#handleClick(ev);
    }

    get state(): SlipElementState {
      return this.#state;
    }

    set state(next: SlipElementState) {
      this.#state = next;
      const theme = resolveThemeName(next.theme ?? this.getAttribute(DATA_MARKS.theme));
      if (this.getAttribute(DATA_MARKS.theme) !== theme) {
        this.setAttribute(DATA_MARKS.theme, theme);
      }
      this.render();
    }

    get mountAdapter(): SlipMountAdapter | null {
      return this.#mountAdapter;
    }

    set mountAdapter(adapter: SlipMountAdapter | null) {
      this.#unmountCurrent();
      this.#mountAdapter = adapter;
      this.render();
    }

    connectedCallback(): void {
      const themeAttr = this.getAttribute(DATA_MARKS.theme) ?? this.getAttribute('theme');
      const resolved = resolveThemeName(themeAttr ?? this.#state.theme);
      if (this.getAttribute(DATA_MARKS.theme) !== resolved) {
        this.setAttribute(DATA_MARKS.theme, resolved);
      }
      if (!(resolved in PALETTES)) return;
      this.#state = { ...this.#state, theme: resolved };
      this.addEventListener('keydown', this.#onKeydownBound);
      this.addEventListener('click', this.#onClickBound);
      this.render();
    }

    disconnectedCallback(): void {
      this.removeEventListener('keydown', this.#onKeydownBound);
      this.removeEventListener('click', this.#onClickBound);
      this.#unmountCurrent();
    }

    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
      if (name === DATA_MARKS.theme || name === 'theme') {
        const theme = resolveThemeName(newVal);
        if (this.#state.theme !== theme) {
          this.#state = { ...this.#state, theme };
          this.render();
        }
      } else if (name === 'active-verb' && newVal) {
        const key = newVal.toLowerCase();
        const found = STD_VERBS.find((v) => v.key === key || v.verb === key);
        if (found) {
          this.selectVerb(found.key);
        }
      }
    }

    selectVerb(key: VerbKey): boolean {
      const model = this.#state.model ?? null;
      const seal = this.#state.seal ?? null;
      const proposeAllowed =
        model !== null ? model.proposeAllowed : seal !== null ? seal.canPropose : false;
      const proposeBlockedReason = model?.proposeBlockedReason ?? null;

      const resolution = resolveSlipShortcut(key, {
        proposeAllowed,
        proposeBlockedReason,
        availableVerbs: this.#state.availableVerbs
      });

      if (resolution.status === 'ignored') return false;
      if (resolution.status === 'locked') {
        if (EventCtor) {
          this.dispatchEvent(
            new EventCtor('slip:verb-blocked', {
              bubbles: true,
              detail: {
                verb: resolution.spec.verb,
                key: resolution.spec.key,
                reason: resolution.reason
              }
            })
          );
        }
        return false;
      }

      const nextModel = model ? selectSlipVerb(model, resolution.spec.key) : model;
      this.#state = {
        ...this.#state,
        model: nextModel,
        activeVerb: resolution.spec.key
      };
      this.render();

      if (EventCtor) {
        this.dispatchEvent(
          new EventCtor('slip:verb-change', {
            bubbles: true,
            detail: {
              verb: resolution.spec.verb,
              key: resolution.spec.key,
              question: resolution.spec.question,
              proofRef: nextModel?.proofRef ?? null
            }
          })
        );
      }
      return true;
    }

    render(): void {
      this.#unmountCurrent();
      if (this.#mountAdapter) {
        this.innerHTML = '';
        this.#mountedHandle = this.#mountAdapter(this, this.#state);
        return;
      }
      this.innerHTML = renderSlipElementHtml(this.#state);
    }

    #unmountCurrent(): void {
      if (this.#mountedHandle) {
        this.#mountedHandle.unmount();
        this.#mountedHandle = null;
      }
    }

    #handleKeydown(event: KeyboardEvent): void {
      if (this.#state.unserved || this.#state.httpStatus === 410) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const handled = this.selectVerb(event.key.toLowerCase() as VerbKey);
      if (handled) {
        event.preventDefault();
      }
    }

    #handleClick(event: Event): void {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest?.(`button[${DATA_MARKS.verb}][${DATA_MARKS.key}]`) as HTMLElement | null;
      if (!btn) return;
      const key = btn.getAttribute(DATA_MARKS.key);
      if (!key) return;
      this.selectVerb(key.toLowerCase() as VerbKey);
    }
  }

  registry.define(SLIP_ELEMENT_TAG, RezonoSlipElement);
  return RezonoSlipElement as unknown as SlipElementConstructor;
}
