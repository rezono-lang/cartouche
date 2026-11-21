<script lang="ts">
  import { PALETTES, SIGNS, STD_VERBS, canonicalJson, paletteCss, signForState } from '../../reader-core/src/index.ts';
  import type { CartoucheSeal, PaletteName, RawCellInput, SignSpec, StdVerbSpec, TrustTier } from '../../reader-core/src/index.ts';
  import type { SlipModel, VerbKey } from './slip-controller.ts';
  import SlipSeal from './SlipSeal.svelte';
  import SlipUnserved from './SlipUnserved.svelte';
  import SlipSweep from './SlipSweep.svelte';
  import SlipValueCell from './SlipValueCell.svelte';
  import type { SweepStopInput } from './slip-sweep.ts';
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

  // A line of the slip: a premise row of a rule row, or a step of a calculated row (Rezono decisions/viewer-slip.md).
  interface SlipLine {
    readonly part?: 'total' | undefined;
    readonly relation?: string | undefined;
    readonly key?: readonly string[] | undefined;
    readonly polarity?: 'positive' | 'negative' | undefined;
    readonly depth: number;
    readonly path?: string | undefined;
    readonly label?: string | undefined;
    readonly sign?: string | undefined;
    readonly cell: RawCellInput;
    readonly answered_verbs?: readonly string[] | undefined;
    readonly kind?: 'step' | 'constant' | undefined;
  }

  // The sentence as the build filled it (Rezono's fill.ts): text, and the index of the line a variable links to.
  interface SentenceSegment {
    readonly text: string;
    readonly line?: number | undefined;
  }

  interface SlipConformanceRow {
    readonly kind: 'rule' | 'calc';
    readonly rule_id: string;
    readonly sentence?: readonly SentenceSegment[] | undefined;
    readonly grounds_distance_1?: readonly SlipLine[] | undefined;
    readonly result_cell?: RawCellInput | undefined;
    readonly steps?: readonly SlipLine[] | undefined;
  }

  interface AnswerCell {
    readonly text: string;
    readonly sign?: string | undefined;
  }

  interface AnswerTableRow {
    readonly cells: readonly (string | AnswerCell)[];
    readonly proof_ref?: string | undefined;
    readonly sign?: string | undefined;
    readonly depth?: number | undefined;
  }

  interface AnswerTableSpec {
    readonly question: string;
    readonly verb: string;
    readonly heading?: string | undefined;
    readonly headers: readonly string[];
    readonly rows: readonly AnswerTableRow[];
    readonly note?: string | undefined;
  }

  // The published stops of one sweep, on the line of the cell it moves (built from the reader's answers).
  interface LineSweep {
    readonly line: number;
    readonly name: string;
    readonly unavailable: boolean;
    readonly note?: string | undefined;
    readonly stops: readonly SweepStopInput[];
  }

  interface HorizonInfo {
    readonly complete: boolean;
    readonly reason: string | null;
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
    answers?: Readonly<Record<string, AnswerTableSpec>>;
    openAnswer?: string | null;
    manifestHash?: string | null;
    signsLeftOut?: readonly string[];
    sweeps?: readonly LineSweep[];
    openSweepLine?: number | null;
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
    answers = {},
    openAnswer = null,
    manifestHash = null,
    signsLeftOut = [],
    sweeps = [],
    openSweepLine = null,
    selectedStopIndex = null,
    onVerbSelect,
    onStopSelect
  }: Props = $props();

  let selectedVerb = $state<VerbKey | null>(null);
  let chosenStop = $state<number | null>(null);
  let toggledSweepLine = $state<number | null | undefined>(undefined);
  let toggledAnswer = $state<string | null | undefined>(undefined);

  let resolvedTheme = $derived<PaletteName>(theme in PALETTES ? theme : 'swisstopo');
  let themeCssText = $derived(paletteCss(resolvedTheme));
  let isUnserved = $derived(unserved !== null || httpStatus === 410);
  let currentVerb = $derived<VerbKey>(selectedVerb ?? activeVerb ?? model?.activeVerb ?? 'w');
  let activeStopIndex = $derived<number | null>(chosenStop ?? selectedStopIndex ?? null);
  // A click or key on the page wins over the start state the build asked for.
  let currentSweepLine = $derived<number | null>(toggledSweepLine === undefined ? openSweepLine : toggledSweepLine);
  let currentAnswerKey = $derived<string | null>(toggledAnswer === undefined ? openAnswer : toggledAnswer);
  let lineAnswer = $derived<AnswerTableSpec | null>(currentAnswerKey === null ? null : (answers[currentAnswerKey] ?? null));
  let shownAnswers = $derived<readonly AnswerTableSpec[]>(lineAnswer ? [...openAnswers, lineAnswer] : openAnswers);

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
    return STD_VERBS.filter((spec) => allowed.has(spec.verb) || (spec.question !== undefined && allowed.has(spec.question)));
  });

  let groundsList = $derived<readonly SlipLine[]>(conformanceRow?.grounds_distance_1 ?? []);
  let calcSteps = $derived<readonly SlipLine[]>(
    (conformanceRow?.steps ?? []).filter((step) => step.kind !== 'constant')
  );
  // Lines are numbered by their index from 0 in the slip (Rezono's marks, Decision 0009).
  let slipLines = $derived<readonly SlipLine[]>(conformanceRow?.kind === 'calc' ? calcSteps : groundsList);
  let sentence = $derived<readonly SentenceSegment[]>(conformanceRow?.sentence ?? []);

  function sweepForLine(lineIdx: number): LineSweep | null {
    return sweeps.find((sw) => sw.line === lineIdx) ?? null;
  }

  // The fold of a line: the cell the selected stop's variant gives it, as built from the published difference.
  // A stop without a variant (red, not computed, unavailable) has no fold.
  function foldForLine(lineIdx: number): RawCellInput | null {
    if (currentSweepLine === null || activeStopIndex === null) return null;
    const sweep = sweepForLine(currentSweepLine);
    const stop = sweep?.stops.find((st) => st.index === activeStopIndex);
    if (!stop || (stop.status !== 'green' && stop.status !== 'warning')) return null;
    return stop.folds?.find((fold) => fold.line === lineIdx)?.cell ?? null;
  }

  function verbsForLine(line: SlipLine): readonly StdVerbSpec[] {
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
      if (conformanceRow.kind === 'calc' && conformanceRow.result_cell && conformanceRow.result_cell.state !== 'known') {
        addSign(signForState(conformanceRow.result_cell.state));
      }
      for (const [idx, line] of slipLines.entries()) {
        addSign(line.sign);
        if (line.cell.state !== 'known') {
          addSign(signForState(line.cell.state));
        }
        const fold = foldForLine(idx);
        if (fold !== null) {
          addSign('supposed');
          if (fold.state !== 'known') addSign(signForState(fold.state));
        }
      }
    } else if (model) {
      addSign('derived');
    }

    if (model && currentVerb === 's' && model.adjacentWorlds.length > 0) {
      addSign('supposed');
    }

    for (const ans of shownAnswers) {
      for (const row of ans.rows) {
        if (row.sign) addSign(row.sign);
        for (const cell of row.cells) {
          if (typeof cell !== 'string') addSign(cell.sign);
        }
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

  // A verb on a line: suppose opens that line's sweep control; another verb opens the answer the build
  // prepared for that line, if the reader answered it.
  function activateLineVerb(lineIdx: number, spec: StdVerbSpec): void {
    if (isLineVerbDisabled(spec, proposeAllowed)) return;
    if (spec.verb === 'suppose' && sweepForLine(lineIdx) !== null) {
      toggledSweepLine = currentSweepLine === lineIdx ? null : lineIdx;
      chosenStop = null;
      return;
    }
    const answerKey = `${lineIdx}:${spec.verb}`;
    if (answers[answerKey]) toggledAnswer = currentAnswerKey === answerKey ? null : answerKey;
    activateVerb(spec);
  }

  function stepStop(direction: 'next' | 'previous'): boolean {
    const sweep = currentSweepLine === null ? null : sweepForLine(currentSweepLine);
    if (sweep === null || sweep.stops.length === 0) return false;
    const stops = sweep.stops;
    const at = activeStopIndex === null ? -1 : stops.findIndex((st) => st.index === activeStopIndex);
    const lastPos = stops.length - 1;
    let nextPos: number;
    if (direction === 'next') nextPos = at < 0 ? 0 : at === lastPos ? lastPos : at + 1;
    else nextPos = at < 0 ? lastPos : at === 0 ? 0 : at - 1;
    const stop = stops[nextPos];
    if (stop) selectStop(stop.index);
    return true;
  }

  function handleLineKeydown(event: KeyboardEvent, lineIdx: number, line: SlipLine): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && currentSweepLine === lineIdx) {
      if (stepStop(event.key === 'ArrowRight' ? 'next' : 'previous')) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const spec = verbsForLine(line).find((v) => v.key === event.key.toLowerCase());
    if (!spec) return;
    event.preventDefault();
    event.stopPropagation();
    activateLineVerb(lineIdx, spec);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (isUnserved) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && stepStop(event.key === 'ArrowRight' ? 'next' : 'previous')) {
      event.preventDefault();
      return;
    }
    const pressed = event.key.toLowerCase();
    const firstSweep = sweeps[0];
    if (firstSweep && STD_VERBS.some((v) => v.verb === 'suppose' && v.key === pressed)) {
      event.preventDefault();
      toggledSweepLine = currentSweepLine === null ? firstSweep.line : null;
      chosenStop = null;
      return;
    }
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
      <SlipSeal {seal} checks={effectiveSealChecks} {manifestHash} />
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

    {#if conformanceRow}
      {#if sentence.length > 0}
        <div class="slip-sentence" data-part="sentence">
          {#each sentence as seg, segIdx (segIdx)}
            {#if seg.line !== undefined && slipLines[seg.line]}
              <a
                href={`#slip-line-${seg.line}`}
                data-line={String(seg.line)}
                data-proof-ref={slipLines[seg.line]?.cell.proof_ref}
              >{seg.text}</a>
            {:else}
              <span>{seg.text}</span>
            {/if}
          {/each}
        </div>
      {/if}

      <table
        class="slip-table"
        data-sheet="slip"
        aria-label={conformanceRow.kind === 'calc' ? 'Calculation proof slip' : 'Rule proof slip'}
      >
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Sign</th>
            <th scope="col">{conformanceRow.kind === 'calc' ? 'Step' : 'Relation'}</th>
            <th scope="col">Value</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if conformanceRow.kind === 'calc' && conformanceRow.result_cell}
            <tr data-proof-ref={conformanceRow.result_cell.proof_ref}>
              <td></td>
              <td></td>
              <td>{conformanceRow.rule_id}</td>
              <SlipValueCell cell={conformanceRow.result_cell} />
              <td></td>
            </tr>
          {/if}
          {#each slipLines as line, idx (idx)}
            {@const lineVerbs = verbsForLine(line)}
            {@const lineSweep = sweepForLine(idx)}
            {@const sweepOpen = lineSweep !== null && currentSweepLine === idx}
            <tr
              id={`slip-line-${idx}`}
              tabindex="0"
              data-line={String(idx)}
              data-part={line.part}
              data-relation={line.relation}
              data-key={line.key ? canonicalJson(line.key) : undefined}
              data-polarity={line.polarity}
              data-depth={String(line.depth)}
              data-path={line.path}
              data-proof-ref={line.cell.proof_ref}
              onkeydown={(event) => handleLineKeydown(event, idx, line)}
            >
              <td>{idx}</td>
              <td>
                {#if line.sign}
                  <span class="cartouche-sign" role="img" aria-label={line.sign} data-sign={line.sign} data-proof-ref={line.cell.proof_ref}>
                    <span aria-hidden="true">{glyphForSign(line.sign)}</span>
                  </span>
                {/if}
              </td>
              <td>{line.label ?? line.relation ?? line.path}</td>
              <SlipValueCell cell={line.cell} fold={foldForLine(idx)} />
              <td>
                {#each lineVerbs as spec (spec.verb)}
                  {@const lineLocked = isLineVerbDisabled(spec, proposeAllowed)}
                  <button
                    type="button"
                    data-verb={spec.verb}
                    data-key={spec.key}
                    data-proof-ref={line.cell.proof_ref}
                    aria-disabled={lineLocked ? 'true' : undefined}
                    aria-expanded={spec.verb === 'suppose' && lineSweep !== null ? (sweepOpen ? 'true' : 'false') : undefined}
                    disabled={lineLocked}
                    onclick={() => activateLineVerb(idx, spec)}
                  >
                    <kbd>{spec.key.toUpperCase()}</kbd>
                    <span>{spec.verb}</span>
                  </button>
                {/each}
                {#if sweepOpen && lineSweep}
                  <SlipSweep
                    stops={lineSweep.stops}
                    name={lineSweep.name}
                    note={lineSweep.unavailable ? (lineSweep.note ?? 'Unavailable: this role does not read every relation in full.') : null}
                    activeIndex={activeStopIndex}
                    onSelect={selectStop}
                  />
                {/if}
              </td>
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
            id="slip-line-0"
            data-line="0"
            data-relation="subject"
            data-key={canonicalJson([model.subjectId])}
            data-polarity="positive"
            data-depth="0"
            data-proof-ref={model.proofRef}
          >
            <td>0</td>
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
        <h2>Adjacent Worlds (Δ = 1)</h2>
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

    {#each shownAnswers as answer, answerIdx (answerIdx)}
      <table class="slip-answer-table" data-answer={answer.question} aria-label={answer.heading ?? `Answer ${answer.question}`}>
        {#if answer.heading}<caption>{answer.heading}</caption>{/if}
        <thead>
          <tr>
            {#each answer.headers as heading, hIdx (hIdx)}
              <th scope="col">{heading}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each answer.rows as ansRow, rowIdx (rowIdx)}
            <tr data-proof-ref={ansRow.proof_ref} data-depth={ansRow.depth === undefined ? undefined : String(ansRow.depth)}>
              {#each ansRow.cells as cell, colIdx (colIdx)}
                <td>
                  {#if colIdx === 0 && ansRow.sign && ansRow.proof_ref}
                    <span class="cartouche-sign" role="img" aria-label={ansRow.sign} data-sign={ansRow.sign} data-proof-ref={ansRow.proof_ref}>
                      <span aria-hidden="true">{glyphForSign(ansRow.sign)}</span>
                    </span>
                  {/if}
                  {#if typeof cell === 'string'}
                    {cell}
                  {:else}
                    {#if cell.sign}
                      <span class="cartouche-sign" role="img" aria-label={cell.sign} data-sign={cell.sign}>
                        <span aria-hidden="true">{glyphForSign(cell.sign)}</span>
                      </span>
                    {/if}
                    {cell.text}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if answer.note}<p class="slip-answer-note">{answer.note}</p>{/if}
    {/each}

    {#if signsLeftOut.length > 0}
      <p class="slip-signs-left-out">Signs not in this key, not drawn: {signsLeftOut.join(', ')}</p>
    {/if}

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
  td del {
    margin-right: 0.35rem;
  }
  td ins {
    text-decoration: none;
    font-weight: 600;
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
