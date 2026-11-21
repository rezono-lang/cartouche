<script lang="ts">
  import { PALETTES, SIGNS, STD_VERBS, canonicalJson, paletteCss } from '../../reader-core/src/index.ts';
  import type { CartoucheSeal, PaletteName, RawCellInput, SignSpec, StdVerbSpec, TrustTier } from '../../reader-core/src/index.ts';
  import type { SlipModel, VerbKey } from './slip-controller.ts';
  import SlipSeal from './SlipSeal.svelte';
  import SlipUnserved from './SlipUnserved.svelte';
  import SlipSweep from './SlipSweep.svelte';
  import SlipValueCell from './SlipValueCell.svelte';
  import { canFoldStop } from './slip-sweep.ts';
  import { isLineVerbDisabled, resolveLineVerbs } from './slip-verbs.ts';

  interface UnservedInfo {
    readonly code: string;
    readonly superseded_by?: string | null;
    readonly reason_message_id: string;
    readonly withdrawn_by_decision_ref?: string | null;
  }

  interface SealCheckItem {
    readonly id: string;
    readonly status: 'green' | 'warning' | 'red';
    readonly label?: string;
  }

  interface SentenceBinding {
    readonly name: string;
    readonly display: string;
    readonly premise_position?: number;
    readonly aggregate?: boolean;
  }

  interface SlipGroundLine {
    readonly part?: 'total';
    readonly relation: string;
    readonly key: readonly string[];
    readonly polarity: 'positive' | 'negative';
    readonly depth: number;
    readonly premise_position?: number;
    readonly sign: string;
    readonly cell: RawCellInput;
    readonly answered_verbs?: readonly string[];
    readonly sweep_name?: string;
  }

  interface CalcStepLine {
    readonly path: string;
    readonly depth: number;
    readonly sign: string;
    readonly cell: RawCellInput;
    readonly kind?: 'step' | 'constant';
  }

  interface SlipConformanceRow {
    readonly kind: 'rule' | 'calc';
    readonly rule_id: string;
    readonly sentence_template?: string;
    readonly bindings?: readonly SentenceBinding[];
    readonly grounds_distance_1?: readonly SlipGroundLine[];
    readonly result_cell?: RawCellInput;
    readonly steps?: readonly CalcStepLine[];
  }

  interface AnswerTableRow {
    readonly cells: readonly string[];
    readonly proof_ref?: string;
    readonly sign?: string;
  }

  interface AnswerTableSpec {
    readonly question: string;
    readonly verb: string;
    readonly headers: readonly string[];
    readonly rows: readonly AnswerTableRow[];
  }

  interface SweepStopCheck {
    readonly id: string;
    readonly status: 'green' | 'warning' | 'red';
  }

  interface SweepStop {
    readonly index: number;
    readonly display: string;
    readonly status: 'green' | 'warning' | 'red' | 'not_computed' | 'unavailable';
    readonly turn: 'turns' | 'same' | 'unknown' | null;
    readonly fold_display: string | null;
    readonly checks?: readonly SweepStopCheck[];
  }

  interface HorizonInfo {
    readonly complete: boolean;
    readonly reason: string | null;
  }

  interface SentenceSegment {
    readonly kind: 'text' | 'link';
    readonly text: string;
    readonly lineNum?: number;
    readonly proofRef?: string;
  }

  interface Props {
    theme?: PaletteName;
    model?: SlipModel | null;
    seal?: CartoucheSeal | null;
    sealChecks?: readonly SealCheckItem[];
    unserved?: UnservedInfo | null;
    httpStatus?: number | null;
    horizon?: HorizonInfo | null;
    activeVerb?: VerbKey;
    availableVerbs?: readonly string[] | null;
    conformanceRow?: SlipConformanceRow | null;
    openAnswers?: readonly AnswerTableSpec[];
    sweepStops?: readonly SweepStop[];
    selectedStopIndex?: number | null;
    onVerbSelect?: (verb: VerbKey, spec: StdVerbSpec) => void;
    onStopSelect?: (stopIndex: number) => void;
  }

  let {
    theme = 'swisstopo',
    model = null,
    seal = null,
    sealChecks = [],
    unserved = null,
    httpStatus = null,
    horizon = null,
    activeVerb,
    availableVerbs = null,
    conformanceRow = null,
    openAnswers = [],
    sweepStops = [],
    selectedStopIndex = null,
    onVerbSelect,
    onStopSelect
  }: Props = $props();

  let selectedVerb = $state<VerbKey | null>(null);
  let chosenStop = $state<number | null>(null);

  let resolvedTheme = $derived<PaletteName>(theme in PALETTES ? theme : 'swisstopo');
  let themeCssText = $derived(paletteCss(resolvedTheme));
  let isUnserved = $derived(unserved !== null || httpStatus === 410);
  let currentVerb = $derived<VerbKey>(selectedVerb ?? activeVerb ?? model?.activeVerb ?? 'w');
  let activeStopIndex = $derived<number | null>(chosenStop ?? selectedStopIndex ?? null);

  let trustTier = $derived<TrustTier | undefined>(seal?.trustTier);
  let proposeAllowed = $derived(
    model !== null ? model.proposeAllowed : seal !== null ? seal.canPropose : false
  );
  let proposeBlockedReason = $derived(
    model !== null
      ? model.proposeBlockedReason
      : proposeAllowed
        ? null
        : trustTier === 'provisional_engine'
          ? 'propose_locked_unsealed_live_stream'
          : 'propose_locked_witness_failed'
  );

  let effectiveSealChecks = $derived.by((): readonly SealCheckItem[] => {
    if (sealChecks.length > 0) return sealChecks;
    if (!seal) return [];
    const checkStatus: 'green' | 'red' = seal.witnessCheck === 'green' ? 'green' : 'red';
    return [{ id: 'witness', status: checkStatus, label: 'witness' }];
  });

  let visibleVerbs = $derived.by((): readonly StdVerbSpec[] => {
    if (availableVerbs === null) return STD_VERBS;
    const allowed = new Set(availableVerbs);
    return STD_VERBS.filter((spec) => allowed.has(spec.verb) || allowed.has(spec.question));
  });

  let groundsList = $derived<readonly SlipGroundLine[]>(conformanceRow?.grounds_distance_1 ?? []);
  let calcSteps = $derived<readonly CalcStepLine[]>(
    (conformanceRow?.steps ?? []).filter((step) => step.kind !== 'constant')
  );

  let activeSweepStop = $derived.by((): SweepStop | null => {
    if (activeStopIndex === null) return null;
    return sweepStops.find((st) => st.index === activeStopIndex) ?? null;
  });

  function resolveBindingTarget(binding: SentenceBinding, grounds: readonly SlipGroundLine[]): { lineNum: number; proofRef: string } | null {
    if (grounds.length === 0) return null;
    if (binding.aggregate === true) {
      const aggIdx = grounds.findIndex((g) => g.part === 'total');
      if (aggIdx >= 0) {
        const match = grounds[aggIdx];
        if (match) return { lineNum: aggIdx + 1, proofRef: match.cell.proof_ref };
      }
    }
    if (binding.premise_position !== undefined) {
      const explicitIdx = grounds.findIndex((g) => g.premise_position === binding.premise_position);
      if (explicitIdx >= 0) {
        const match = grounds[explicitIdx];
        if (match) return { lineNum: explicitIdx + 1, proofRef: match.cell.proof_ref };
      }
    }
    return null;
  }

  let sentenceSegments = $derived.by((): readonly SentenceSegment[] => {
    if (!conformanceRow || conformanceRow.kind !== 'rule') return [];
    const template = conformanceRow.sentence_template ?? conformanceRow.rule_id;
    const bindings = conformanceRow.bindings ?? [];
    const parts = template.split(/(\{\$[a-zA-Z0-9_]+\})/g);
    const out: SentenceSegment[] = [];
    for (const part of parts) {
      if (!part) continue;
      const match = /^\{\$([a-zA-Z0-9_]+)\}$/.exec(part);
      if (match) {
        const bindingName = match[1];
        const binding = bindings.find((b) => b.name === bindingName);
        if (binding) {
          const target = resolveBindingTarget(binding, groundsList);
          if (target) {
            out.push({
              kind: 'link',
              text: binding.display,
              lineNum: target.lineNum,
              proofRef: target.proofRef
            });
            continue;
          }
          out.push({ kind: 'text', text: binding.display });
          continue;
        }
      }
      out.push({ kind: 'text', text: part });
    }
    return out;
  });

  function verbsForLine(line: SlipGroundLine): readonly StdVerbSpec[] {
    return resolveLineVerbs(line.answered_verbs);
  }

  function resolveSignSpec(signName: string): SignSpec {
    const spec = SIGNS[signName];
    if (!spec) {
      throw new Error(`Unknown std-view sign: "${signName}".`);
    }
    return spec;
  }

  let drawnSigns = $derived.by((): readonly string[] => {
    if (isUnserved) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    const addSign = (signName: string | undefined | null) => {
      if (!signName || seen.has(signName)) return;
      resolveSignSpec(signName);
      seen.add(signName);
      ordered.push(signName);
    };

    if (conformanceRow) {
      if (conformanceRow.kind === 'rule') {
        for (const line of groundsList) {
          addSign(line.sign);
          if (line.cell.state !== 'known') {
            addSign(line.cell.state);
          }
        }
      } else {
        if (conformanceRow.result_cell && conformanceRow.result_cell.state !== 'known') {
          addSign(conformanceRow.result_cell.state);
        }
        for (const step of calcSteps) {
          addSign(step.sign);
          if (step.cell.state !== 'known') {
            addSign(step.cell.state);
          }
        }
      }
    } else if (model) {
      addSign('derived');
    }

    if (model && currentVerb === 's' && model.adjacentWorlds.length > 0) {
      addSign('supposed');
    }

    for (const ans of openAnswers) {
      for (const row of ans.rows) {
        if (row.sign) addSign(row.sign);
      }
    }

    return ordered;
  });

  function isVerbDisabled(spec: StdVerbSpec): boolean {
    return spec.verb === 'propose' && !proposeAllowed;
  }

  function activateVerb(spec: StdVerbSpec): void {
    if (isVerbDisabled(spec)) return;
    selectedVerb = spec.key;
    if (onVerbSelect) onVerbSelect(spec.key, spec);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (isUnserved) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const pressed = event.key.toLowerCase();
    const spec = visibleVerbs.find((v) => v.key === pressed);
    if (!spec) return;
    event.preventDefault();
    activateVerb(spec);
  }

  function glyphForSign(signName: string): string {
    return resolveSignSpec(signName).glyph;
  }

  function selectStop(index: number): void {
    chosenStop = index;
    if (onStopSelect) onStopSelect(index);
  }
</script>

<div
  class="cartouche-slip-root"
  data-cartouche-theme={resolvedTheme}
  data-trust-tier={trustTier}
  role="region"
  aria-label="Proof slip"
  tabindex="-1"
  onkeydown={handleKeydown}
>
  <style>{themeCssText}</style>

  {#if isUnserved}
    <SlipUnserved {unserved} {httpStatus} />
  {:else}
    {#if seal}
      <SlipSeal {seal} checks={effectiveSealChecks} />
    {/if}

    {#if horizon && !horizon.complete}
      <div
        class="slip-horizon"
        data-part="horizon"
        data-reason={horizon.reason ?? undefined}
      >
        Horizon incomplete{#if horizon.reason}: {horizon.reason}{/if}
      </div>
    {/if}

    {#if model && model.prism5.length === 5}
      <section class="slip-prism" data-part="prism" aria-label="Epistemic prism">
        <h2>Epistemic Prism</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Spectrum</th>
              <th scope="col">Meter</th>
              <th scope="col">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {#each model.prism5 as spectrum (spectrum.key)}
              <tr
                data-key={spectrum.key}
                data-state={spectrum.state}
                data-proof-ref={model.proofRef}
              >
                <td>{spectrum.label}</td>
                <td>
                  <span class="slip-prism-track" aria-hidden="true">
                    <span class="slip-prism-fill" style="width: {spectrum.bar_units}%"></span>
                  </span>
                </td>
                <td data-proof-ref={model.proofRef}>{spectrum.ratio_display}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if model && visibleVerbs.length > 0}
      <nav class="slip-verb-bar" aria-label="Slip verbs">
        {#each visibleVerbs as spec (spec.verb)}
          {@const locked = isVerbDisabled(spec)}
          <button
            type="button"
            class="slip-verb-btn"
            data-verb={spec.verb}
            data-key={spec.key}
            data-proof-ref={model.proofRef}
            aria-pressed={currentVerb === spec.key}
            aria-disabled={locked ? 'true' : undefined}
            disabled={locked}
            onclick={() => activateVerb(spec)}
          >
            <kbd>{spec.key.toUpperCase()}</kbd>
            <span>{spec.verb}</span>
            {#if locked && proposeBlockedReason}
              <span data-reason={proposeBlockedReason}>locked</span>
            {/if}
          </button>
        {/each}
      </nav>
    {/if}

    {#if conformanceRow && conformanceRow.kind === 'rule'}
      <div class="slip-sentence" data-part="sentence">
        {#each sentenceSegments as seg, segIdx (segIdx)}
          {#if seg.kind === 'link' && seg.lineNum !== undefined}
            <a
              href={`#slip-line-${seg.lineNum}`}
              data-line={String(seg.lineNum)}
              data-proof-ref={seg.proofRef}
            >{seg.text}</a>
          {:else}
            <span>{seg.text}</span>
          {/if}
        {/each}
      </div>

      <table class="slip-table" data-sheet="slip" aria-label="Rule proof slip">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Sign</th>
            <th scope="col">Relation</th>
            <th scope="col">Value</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each groundsList as line, idx (idx)}
            {@const lineNum = idx + 1}
            {@const lineVerbs = verbsForLine(line)}
            {@const folded = line.sweep_name !== undefined && canFoldStop(activeSweepStop)}
            <tr
              id={`slip-line-${lineNum}`}
              data-line={String(lineNum)}
              data-part={line.part}
              data-relation={line.relation}
              data-key={canonicalJson(line.key)}
              data-polarity={line.polarity}
              data-depth={String(line.depth)}
              data-proof-ref={line.cell.proof_ref}
            >
              <td>{lineNum}</td>
              <td>
                <span class="cartouche-sign" role="img" aria-label={line.sign} data-sign={line.sign} data-proof-ref={line.cell.proof_ref}>
                  <span aria-hidden="true">{glyphForSign(line.sign)}</span>
                </span>
              </td>
              <td>{line.relation}</td>
              <SlipValueCell cell={line.cell} fold={folded ? (activeSweepStop?.fold_display ?? null) : null} />
              <td>
                {#each lineVerbs as spec (spec.verb)}
                  {@const lineLocked = isLineVerbDisabled(spec, proposeAllowed)}
                  <button
                    type="button"
                    data-verb={spec.verb}
                    data-key={spec.key}
                    data-proof-ref={line.cell.proof_ref}
                    aria-disabled={lineLocked ? 'true' : undefined}
                    disabled={lineLocked}
                    onclick={() => activateVerb(spec)}
                  >
                    <kbd>{spec.key.toUpperCase()}</kbd>
                    <span>{spec.verb}</span>
                  </button>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if conformanceRow && conformanceRow.kind === 'calc'}
      <table class="slip-table" data-sheet="slip" aria-label="Calculation proof slip">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Sign</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {#if conformanceRow.result_cell}
            <tr data-proof-ref={conformanceRow.result_cell.proof_ref}>
              <td>{conformanceRow.sentence_template ?? conformanceRow.rule_id}</td>
              <td></td>
              <SlipValueCell cell={conformanceRow.result_cell} />
            </tr>
          {/if}
          {#each calcSteps as step (step.path)}
            <tr
              data-path={step.path}
              data-depth={String(step.depth)}
              data-proof-ref={step.cell.proof_ref}
            >
              <td>{step.path}</td>
              <td>
                <span class="cartouche-sign" role="img" aria-label={step.sign} data-sign={step.sign} data-proof-ref={step.cell.proof_ref}>
                  <span aria-hidden="true">{glyphForSign(step.sign)}</span>
                </span>
              </td>
              <SlipValueCell cell={step.cell} />
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if model}
      <table class="slip-table" data-sheet="slip" aria-label="Subject proof slip">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Sign</th>
            <th scope="col">Subject</th>
            <th scope="col">Proof</th>
          </tr>
        </thead>
        <tbody>
          <tr
            id="slip-line-1"
            data-line="1"
            data-relation="subject"
            data-key={canonicalJson([model.subjectId])}
            data-polarity="positive"
            data-depth="0"
            data-proof-ref={model.proofRef}
          >
            <td>1</td>
            <td>
              <span class="cartouche-sign" role="img" aria-label="derived" data-sign="derived" data-proof-ref={model.proofRef}>
                <span aria-hidden="true">{glyphForSign('derived')}</span>
              </span>
            </td>
            <td>{model.subjectId}</td>
            <td data-part="value" data-state="known" data-proof-ref={model.proofRef}>{model.proofRef}</td>
          </tr>
        </tbody>
      </table>
    {/if}

    {#if model && currentVerb === 'm' && model.missingLevers.length > 0}
      <section class="slip-levers" data-part="levers" aria-label="Certainty levers">
        <h2>Certainty Levers</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Lever</th>
              <th scope="col">Unblocks</th>
              <th scope="col">Load Bearing</th>
            </tr>
          </thead>
          <tbody>
            {#each model.missingLevers as lever (lever.id)}
              <tr
                data-key={lever.id}
                data-load-bearing={lever.redundant ? 'false' : 'true'}
                data-proof-ref={model.proofRef}
              >
                <td>{lever.label}</td>
                <td>{lever.unblocks.join(', ')}</td>
                <td>{lever.redundant ? 'redundant' : 'load-bearing'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if model && currentVerb === 's' && model.adjacentWorlds.length > 0}
      <section class="slip-adjacent-worlds" data-part="adjacent-worlds" aria-label="Adjacent worlds">
        <h2>Adjacent Worlds (Î” = 1)</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Sign</th>
              <th scope="col">Sector</th>
              <th scope="col">Change</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {#each model.adjacentWorlds as hop (hop.id)}
              <tr data-key={hop.id} data-proof-ref={hop.proof_ref}>
                <td>
                  <span class="cartouche-sign" role="img" aria-label="supposed" data-sign="supposed" data-proof-ref={hop.proof_ref}>
                    <span aria-hidden="true">{glyphForSign('supposed')}</span>
                  </span>
                </td>
                <td>{hop.sector}</td>
                <td>{hop.label}</td>
                <td data-part="value" data-state="known" data-proof-ref={hop.proof_ref}>
                  {hop.outcome_display}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    <SlipSweep stops={sweepStops} activeIndex={activeStopIndex} onSelect={selectStop} />

    {#each openAnswers as answer (answer.question)}
      <table class="slip-answer-table" data-answer={answer.question} aria-label={`Answer ${answer.question}`}>
        <thead>
          <tr>
            {#each answer.headers as heading (heading)}
              <th scope="col">{heading}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each answer.rows as ansRow, rowIdx (rowIdx)}
            <tr data-proof-ref={ansRow.proof_ref}>
              {#each ansRow.cells as cellText, colIdx (colIdx)}
                <td>
                  {#if colIdx === 0 && ansRow.sign && ansRow.proof_ref}
                    <span class="cartouche-sign" role="img" aria-label={ansRow.sign} data-sign={ansRow.sign} data-proof-ref={ansRow.proof_ref}>
                      <span aria-hidden="true">{glyphForSign(ansRow.sign)}</span>
                    </span>
                  {/if}
                  {cellText}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}

    {#if drawnSigns.length > 0}
      <table class="slip-legend" data-part="legend" aria-label="Sign legend">
        <thead>
          <tr>
            <th scope="col">Glyph</th>
            <th scope="col">Sign</th>
            <th scope="col">Kind</th>
            <th scope="col">Pattern</th>
          </tr>
        </thead>
        <tbody>
          {#each drawnSigns as signName (signName)}
            {@const spec = resolveSignSpec(signName)}
            <tr data-sign={signName}>
              <td><span aria-hidden="true">{spec.glyph}</span></td>
              <td>{signName}</td>
              <td>{spec.kind}</td>
              <td>{spec.pattern}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
</div>

<style>
  .cartouche-slip-root {
    background: var(--c-paper);
    color: var(--c-ink);
    border: 1px solid var(--c-rule);
    padding: 0.75rem;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .slip-verb-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.5rem 0;
  }
  .slip-verb-btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .slip-table,
  .slip-legend,
  .slip-answer-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.5rem;
  }
  th,
  td {
    border-bottom: 1px solid var(--c-rule);
    padding: 0.25rem 0.5rem;
    text-align: left;
  }
</style>
