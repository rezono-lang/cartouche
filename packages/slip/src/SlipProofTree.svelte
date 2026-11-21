<script lang="ts">
  import { DATA_MARKS, SIGNS } from '../../reader-core/src/index.ts';

  export interface ProofTreeSentenceSegment {
    readonly text: string;
    readonly line?: number | undefined;
  }

  export interface ProofTreeBinding {
    readonly variable: string;
    readonly value: string;
    readonly line?: number | undefined;
  }

  export interface ProofTreePremiseLink {
    readonly line: number;
    readonly label: string;
  }

  export interface ProofTreeCell {
    readonly text: string;
    readonly sign?: string | undefined;
  }

  export interface ProofTreeWitnessGroup {
    readonly iri: string;
    readonly sentence?: readonly ProofTreeSentenceSegment[] | undefined;
    readonly bindings?: readonly ProofTreeBinding[] | undefined;
  }

  export interface ProofTreeRow {
    readonly line?: number | undefined;
    readonly relation?: string | undefined;
    readonly key?: string | undefined;
    readonly depth?: number | undefined;
    readonly polarity?: 'positive' | 'negative' | undefined;
    readonly sentence?: readonly ProofTreeSentenceSegment[] | undefined;
    readonly bindings?: readonly ProofTreeBinding[] | undefined;
    readonly witnessGroups?: readonly ProofTreeWitnessGroup[] | undefined;
    readonly premiseLinks?: readonly ProofTreePremiseLink[] | undefined;
    readonly source?: string | undefined;
    readonly state?: 'known' | 'unknown' | 'not_applicable' | 'invalid' | 'absent' | undefined;
    readonly reason?: string | undefined;
    readonly proof_ref?: string | undefined;
    readonly load_bearing?: boolean | undefined;
    readonly cells: readonly (string | ProofTreeCell)[];
  }

  export interface ProofTreeAnswer {
    readonly question: string;
    readonly verb: string;
    readonly heading?: string | undefined;
    readonly headers: readonly string[];
    readonly rows: readonly ProofTreeRow[];
    readonly note?: string | undefined;
    readonly hiddenCount?: number | undefined;
  }

  let { answer }: { answer: ProofTreeAnswer } = $props();

  const M = DATA_MARKS;
  const DIGIT = /[0-9]/;

  function glyph(signName: string): string {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, signName)) {
      throw new Error(`Unknown std-view sign: ${signName}`);
    }
    return SIGNS[signName]!.glyph;
  }

  function cellText(cell: string | ProofTreeCell): string {
    return typeof cell === 'string' ? cell : cell.text;
  }

  function cellSign(cell: string | ProofTreeCell): string | undefined {
    return typeof cell === 'string' ? undefined : cell.sign;
  }

  function safeUnknownText(row: ProofTreeRow, text: string): string {
    if (row.state === 'unknown' && DIGIT.test(text)) {
      throw new Error(`Unknown proof-tree cell must not contain digits: ${row.proof_ref ?? row.relation ?? ''}`);
    }
    return text;
  }
</script>

<table
  class="slip-answer-table"
  aria-label={answer.heading ?? `Answer ${answer.question}`}
  {...{ [M.answer]: answer.question }}
>
  {#if answer.heading}<caption>{answer.heading}</caption>{/if}
  <thead>
    <tr>
      {#each answer.headers as heading, hIdx (hIdx)}
        <th scope="col">{heading}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each answer.rows as row, rowIdx (rowIdx)}
      <tr
        id={`proof-line-${row.line ?? rowIdx}`}
        {...{
          [M.line]: String(row.line ?? rowIdx),
          [M.relation]: row.relation,
          [M.key]: row.key,
          [M.depth]: row.depth === undefined ? undefined : String(row.depth),
          [M.polarity]: row.polarity,
          [M.proof_ref]: row.proof_ref,
          [M.load_bearing]: row.load_bearing === undefined ? undefined : String(row.load_bearing)
        }}
      >
        {#each row.cells as cell, colIdx (colIdx)}
          {@const sign = cellSign(cell)}
          {@const text = cellText(cell)}
          {#if colIdx === 1 && ((row.witnessGroups && row.witnessGroups.length > 1) || (row.sentence && row.sentence.length > 0) || (row.bindings && row.bindings.length > 0) || (row.premiseLinks && row.premiseLinks.length > 0))}
            <td>
              {#if row.witnessGroups && row.witnessGroups.length > 1}
                <ol class="proof-witness-groups">
                  {#each row.witnessGroups as wg, wgIdx (wg.iri)}
                    <li {...{ [M.proof_ref]: wg.iri }}>
                      {#if wg.sentence && wg.sentence.length > 0}
                        <span {...{ [M.part]: 'sentence' }}>
                          {#each wg.sentence as seg, segIdx (segIdx)}
                            {#if seg.line !== undefined}
                              <a
                                href={`#proof-line-${seg.line}`}
                                {...{ [M.line]: String(seg.line), [M.proof_ref]: wg.iri }}
                              >{seg.text}</a>
                            {:else}
                              {seg.text}
                            {/if}
                          {/each}
                        </span>
                      {:else if wgIdx === 0}
                        {text}
                      {/if}
                      {#if wg.bindings && wg.bindings.length > 0}
                        <ul class="proof-bindings">
                          {#each wg.bindings as binding, bIdx (bIdx)}
                            <li>
                              {#if binding.line !== undefined}
                                <a
                                  href={`#proof-line-${binding.line}`}
                                  {...{ [M.line]: String(binding.line), [M.proof_ref]: wg.iri }}
                                >{binding.variable}</a>
                              {:else}
                                <span>{binding.variable}</span>
                              {/if}
                              <span> = </span>
                              <span>{binding.value}</span>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    </li>
                  {/each}
                </ol>
              {:else}
              {#if row.sentence && row.sentence.length > 0}
                <span {...{ [M.part]: 'sentence' }}>
                  {#each row.sentence as seg, segIdx (segIdx)}
                    {#if seg.line !== undefined}
                      <a
                        href={`#proof-line-${seg.line}`}
                        {...{ [M.line]: String(seg.line), [M.proof_ref]: row.proof_ref }}
                      >{seg.text}</a>
                    {:else}
                      {seg.text}
                    {/if}
                  {/each}
                </span>
              {:else}
                {text}
              {/if}
              {#if row.bindings && row.bindings.length > 0}
                <ul class="proof-bindings">
                  {#each row.bindings as binding, bIdx (bIdx)}
                    <li>
                      {#if binding.line !== undefined}
                        <a
                          href={`#proof-line-${binding.line}`}
                          {...{ [M.line]: String(binding.line), [M.proof_ref]: row.proof_ref }}
                        >{binding.variable}</a>
                      {:else}
                        <span>{binding.variable}</span>
                      {/if}
                      <span> = </span>
                      <span>{binding.value}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              {/if}
              {#if row.premiseLinks && row.premiseLinks.length > 0}
                <span class="proof-premise-links">
                  {#each row.premiseLinks as link, lIdx (lIdx)}
                    {#if lIdx > 0}<span>, </span>{/if}
                    <a
                      href={`#proof-line-${link.line}`}
                      {...{ [M.line]: String(link.line), [M.proof_ref]: row.proof_ref }}
                    >{link.label}</a>
                  {/each}
                </span>
              {/if}
            </td>
          {:else if colIdx === 2 && row.state && row.state !== 'known'}
            <td
              {...{
                [M.part]: 'value',
                [M.state]: row.state,
                [M.reason]: row.reason || undefined,
                [M.proof_ref]: row.proof_ref
              }}
            >
              {#if sign}
                <span
                  class="cartouche-sign"
                  role="img"
                  aria-label={sign}
                  {...{ [M.sign]: sign, [M.proof_ref]: row.proof_ref }}
                >
                  <span aria-hidden="true">{glyph(sign)}</span>
                </span>
              {/if}
              {safeUnknownText(row, text)}
            </td>
          {:else}
            <td>
              {#if sign}
                <span
                  class="cartouche-sign"
                  role="img"
                  aria-label={sign}
                  {...{ [M.sign]: sign, [M.proof_ref]: row.proof_ref }}
                >
                  <span aria-hidden="true">{glyph(sign)}</span>
                </span>
              {/if}
              {text}
            </td>
          {/if}
        {/each}
      </tr>
    {/each}
  </tbody>
  {#if answer.hiddenCount !== undefined && answer.hiddenCount !== 0}
    <tfoot>
      <tr>
        <td colspan={answer.headers.length} {...{ [M.reason]: 'hidden_premises' }}>
          {answer.hiddenCount} hidden
        </td>
      </tr>
    </tfoot>
  {/if}
</table>
{#if answer.note}
  <p class="slip-answer-note">{answer.note}</p>
{/if}
