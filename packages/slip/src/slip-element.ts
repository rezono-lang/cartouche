/**
 * Embeddable <rezono-slip> Custom Element wrapper (Decisions 0003, 0004, 0006).
 * Emits canonical data-* marks from contracts/data-marks.json, handles W/D/M/S/C/P
 * keyboard shortcuts, locks [P] Propose on unsealed streams, and renders HTTP 410 unserved states.
 * Zero client compute: all displayed values are server-projected opaque strings.
 */

import {
  DATA_MARKS,
  PALETTES,
  SIGNS,
  STD_VERBS,
  canonicalJson,
  paletteCss
} from '../../reader-core/src/index.ts';
import type { CartoucheSeal, PaletteName, StdVerbSpec } from '../../reader-core/src/index.ts';
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

export interface SlipElementState {
  readonly theme?: PaletteName | undefined;
  readonly model?: SlipModel | null | undefined;
  readonly seal?: CartoucheSeal | null | undefined;
  readonly sealChecks?: readonly SealCheckItem[] | undefined;
  readonly unserved?: UnservedInfo | null | undefined;
  readonly httpStatus?: number | null | undefined;
  readonly activeVerb?: VerbKey | undefined;
  readonly availableVerbs?: readonly string[] | null | undefined;
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
  if (allowedSet !== null && !allowedSet.has(spec.verb) && !allowedSet.has(spec.question)) {
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

function renderSignSpan(signName: string, proofRef: string): string {
  const spec = SIGNS[signName] ?? SIGNS.derived;
  const glyph = spec?.glyph ?? '○';
  return (
    `<span class="cartouche-sign" role="img" ${DATA_MARKS.sign}="${escapeHtml(signName)}" ` +
    `${DATA_MARKS.proof_ref}="${escapeHtml(proofRef)}" aria-label="${escapeHtml(signName)}">` +
    `<span aria-hidden="true">${escapeHtml(glyph)}</span></span>`
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
  const isUnserved = unserved !== null || state.httpStatus === 410;
  const trustTier = seal?.trustTier ?? 'sealed';
  const currentVerb: VerbKey = state.activeVerb ?? model?.activeVerb ?? 'w';
  const proposeAllowed = model !== null ? model.proposeAllowed : seal !== null ? seal.canPropose : false;
  const proposeBlockedReason =
    model !== null
      ? model.proposeBlockedReason
      : proposeAllowed
        ? null
        : trustTier === 'provisional_engine'
          ? 'propose_locked_unsealed_live_stream'
          : 'propose_locked_witness_failed';

  const parts: string[] = [
    `<div class="cartouche-slip-root" ${DATA_MARKS.theme}="${escapeHtml(theme)}" ` +
      `${DATA_MARKS.trust_tier}="${escapeHtml(trustTier)}" role="region" aria-label="Proof slip" tabindex="-1">`,
    `<style>${paletteCss(theme)}</style>`
  ];

  if (isUnserved) {
    const code = unserved?.code ?? 'publication_withdrawn';
    parts.push(
      `<div class="slip-unserved" ${DATA_MARKS.part}="unserved" ${DATA_MARKS.state}="invalid" ` +
        `${DATA_MARKS.reason}="${escapeHtml(code)}" role="alert">`,
      `<h2>Publication Unserved</h2>`,
      `<p>${escapeHtml(code)}</p>`
    );
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
    if (!seenSigns.has(signName)) {
      seenSigns.add(signName);
      drawnSigns.push(signName);
    }
  };

  if (seal) {
    const checks: readonly SealCheckItem[] =
      state.sealChecks && state.sealChecks.length > 0
        ? state.sealChecks
        : [
            { id: 'reader-hashes', status: seal.witnessCheck === 'green' ? 'green' : 'red' },
            { id: 'publisher-record', status: seal.witnessCheck === 'green' ? 'green' : 'red' }
          ];
    parts.push(
      `<section class="slip-seal" ${DATA_MARKS.part}="seal" ${DATA_MARKS.trust_tier}="${escapeHtml(seal.trustTier)}" aria-label="Verification seal">`,
      `<div><span ${DATA_MARKS.part}="manifest-hash">${escapeHtml(seal.manifestId)}</span> `,
      `<span>${escapeHtml(seal.trustTier)}</span> <span>${escapeHtml(seal.role)}</span></div>`,
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
      const reasonAttr =
        spectrum.state !== 'valid' && spectrum.state !== 'known'
          ? ` ${DATA_MARKS.reason}="${escapeHtml(spectrum.state)}"`
          : '';
      parts.push(
        `<tr ${DATA_MARKS.key}="${escapeHtml(spectrum.key)}" ${DATA_MARKS.state}="${escapeHtml(spectrum.state)}" ` +
          `${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}">` +
          `<td>${escapeHtml(spectrum.label)}</td>` +
          `<td><span aria-hidden="true" style="width: ${spectrum.bar_units}%"></span></td>` +
          `<td${reasonAttr} ${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}">${escapeHtml(spectrum.ratio_display)}</td>` +
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
        : STD_VERBS.filter((v) => allowedSet.has(v.verb) || allowedSet.has(v.question));

    parts.push(`<nav class="slip-verb-bar" aria-label="Slip verbs">`);
    for (const spec of verbs) {
      const locked = spec.verb === 'propose' && !proposeAllowed;
      const pressed = currentVerb === spec.key ? 'true' : 'false';
      const disabledAttrs = locked ? ' disabled aria-disabled="true"' : '';
      const lockedBadge = locked
        ? `<span ${DATA_MARKS.reason}="${escapeHtml(proposeBlockedReason ?? 'propose_locked')}">locked</span>`
        : '';
      parts.push(
        `<button type="button" ${DATA_MARKS.verb}="${escapeHtml(spec.verb)}" ` +
          `${DATA_MARKS.key}="${escapeHtml(spec.key)}" ${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}" ` +
          `aria-pressed="${pressed}"${disabledAttrs}>` +
          `<kbd>${escapeHtml(spec.key.toUpperCase())}</kbd><span>${escapeHtml(spec.verb)}</span>${lockedBadge}</button>`
      );
    }
    parts.push('</nav>');

    trackSign('derived');
    parts.push(
      `<table class="slip-table" ${DATA_MARKS.sheet}="slip" aria-label="Subject proof slip">`,
      `<thead><tr><th scope="col">Line</th><th scope="col">Sign</th><th scope="col">Subject</th><th scope="col">Proof</th></tr></thead>`,
      `<tbody><tr id="slip-line-1" ${DATA_MARKS.line}="1" ${DATA_MARKS.relation}="subject" ` +
        `${DATA_MARKS.key}="${escapeHtml(canonicalJson([model.subjectId]))}" ${DATA_MARKS.polarity}="positive" ` +
        `${DATA_MARKS.depth}="0" ${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}">` +
        `<td>1</td><td>${renderSignSpan('derived', model.proofRef)}</td>` +
        `<td>${escapeHtml(model.subjectId)}</td>` +
        `<td ${DATA_MARKS.part}="value" ${DATA_MARKS.state}="known" ${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}">${escapeHtml(model.proofRef)}</td>` +
        `</tr></tbody></table>`
    );

    if (currentVerb === 'm' && model.missingLevers.length > 0) {
      parts.push(
        `<section class="slip-levers" ${DATA_MARKS.part}="levers" aria-label="Certainty levers">`,
        `<h2>Certainty Levers</h2>`,
        `<table><thead><tr><th scope="col">Lever</th><th scope="col">Unblocks</th><th scope="col">Load Bearing</th></tr></thead><tbody>`
      );
      for (const lever of model.missingLevers) {
        parts.push(
          `<tr ${DATA_MARKS.key}="${escapeHtml(lever.id)}" ${DATA_MARKS.load_bearing}="${lever.redundant ? 'false' : 'true'}" ` +
            `${DATA_MARKS.proof_ref}="${escapeHtml(model.proofRef)}">` +
            `<td>${escapeHtml(lever.label)}</td>` +
            `<td>${escapeHtml(lever.unblocks.join(', '))}</td>` +
            `<td>${lever.redundant ? 'redundant' : 'load-bearing'}</td></tr>`
        );
      }
      parts.push('</tbody></table></section>');
    }

    if (currentVerb === 's' && model.adjacentWorlds.length > 0) {
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
  }

  if (drawnSigns.length > 0) {
    parts.push(
      `<table class="slip-legend" ${DATA_MARKS.part}="legend" aria-label="Sign legend">`,
      `<thead><tr><th scope="col">Glyph</th><th scope="col">Sign</th><th scope="col">Kind</th><th scope="col">Pattern</th></tr></thead><tbody>`
    );
    for (const signName of drawnSigns) {
      const spec = SIGNS[signName] ?? SIGNS.derived;
      parts.push(
        `<tr ${DATA_MARKS.sign}="${escapeHtml(signName)}">` +
          `<td><span aria-hidden="true">${escapeHtml(spec?.glyph ?? '○')}</span></td>` +
          `<td>${escapeHtml(signName)}</td>` +
          `<td>${escapeHtml(spec?.kind ?? 'origin')}</td>` +
          `<td>${escapeHtml(spec?.pattern ?? 'solid-circle')}</td></tr>`
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
