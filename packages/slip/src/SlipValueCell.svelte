<script lang="ts">
  import { DATA_MARKS, SIGNS, asOpaqueCell } from '../../reader-core/src/index.ts';
  import type { OpaqueDisplayCell, RawCellInput } from '../../reader-core/src/index.ts';

  // `fold` is the line's cell in the variant of a selected sweep stop, built from that variant's published
  // difference (Decision 0009). The cell then shows the variant: the old value struck, the new one beside it.
  let { cell, fold = null }: { cell: RawCellInput; fold?: RawCellInput | null } = $props();

  const M = DATA_MARKS;
  const DIGIT = /[0-9]/;

  // Validation lives in the reader-core boundary: throws on unknown without reason,
  // absent without witness, known without display. Nothing here invents a reason.
  let opaque = $derived(asOpaqueCell(cell));
  // A fold to unknown would strike a digit inside an unknown cell; it is refused rather than drawn.
  let folded = $derived.by((): OpaqueDisplayCell | null => {
    if (fold === null) return null;
    const c = asOpaqueCell(fold);
    if (c.state === 'unknown') {
      throw new Error('a fold to unknown cannot strike a digit inside an unknown cell: ' + c.proofRef);
    }
    return c;
  });

  function reasonOf(c: OpaqueDisplayCell): string | null {
    const raw = c.reason?.trim() ?? '';
    const r = raw.length > 0 ? raw : null;
    if (c.state === 'known') return null;
    // Unknown, invalid, and not_applicable require a published epistemic reason.
    // Absent cells carry completeness_witness_ref (and emit data-reason whenever published,
    // without fabricating one or breaking frozen fixtures whose absent rows omit reason).
    if (c.state === 'unknown' || c.state === 'invalid' || c.state === 'not_applicable') {
      if (!r) throw new Error('non-known cell without published reason: ' + c.proofRef);
      if (c.state === 'unknown' && DIGIT.test(r)) {
        throw new Error('unknown cell reason must not contain digits: ' + c.proofRef);
      }
    }
    return r;
  }

  function glyphOf(state: string): string {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, state)) {
      throw new Error('no std-view sign for state: ' + state);
    }
    return SIGNS[state]!.glyph;
  }

  let reason = $derived(reasonOf(opaque));
  let glyph = $derived(glyphOf(opaque.state));
  let foldReason = $derived(folded === null ? null : reasonOf(folded));
</script>

{#if folded !== null}
  <td
    {...{
      [M.part]: 'value',
      [M.state]: folded.state,
      [M.reason]: foldReason ?? undefined,
      [M.proof_ref]: folded.proofRef,
      [M.completeness_ref]: folded.state === 'absent' ? (folded.completenessWitnessRef ?? undefined) : undefined
    }}
  >
    <span class="cartouche-sign" role="img" aria-label="supposed" {...{ [M.sign]: 'supposed', [M.proof_ref]: folded.proofRef }}>
      <span aria-hidden="true">{glyphOf('supposed')}</span>
    </span>
    <del>
      {#if opaque.state === 'known'}
        {opaque.display}
      {:else}
        <span class="cartouche-sign" role="img" aria-label={opaque.state} {...{ [M.sign]: opaque.state, [M.proof_ref]: opaque.proofRef }}>
          <span aria-hidden="true">{glyph}</span>
        </span>
        {#if reason}<span>{reason}</span>{/if}
      {/if}
    </del>
    <ins>
      {#if folded.state === 'known'}
        {folded.display}
      {:else}
        <span class="cartouche-sign" role="img" aria-label={folded.state} {...{ [M.sign]: folded.state, [M.proof_ref]: folded.proofRef }}>
          <span aria-hidden="true">{glyphOf(folded.state)}</span>
        </span>
        {#if foldReason}<span>{foldReason}</span>{/if}
      {/if}
    </ins>
  </td>
{:else if opaque.state === 'known'}
  <td {...{ [M.part]: 'value', [M.state]: 'known', [M.proof_ref]: opaque.proofRef }}>
    {opaque.display}
  </td>
{:else}
  <td
    {...{
      [M.part]: 'value',
      [M.state]: opaque.state,
      [M.reason]: reason ?? undefined,
      [M.proof_ref]: opaque.proofRef,
      [M.completeness_ref]: opaque.state === 'absent' ? (opaque.completenessWitnessRef ?? undefined) : undefined
    }}
  >
    <span
      class="cartouche-sign"
      role="img"
      aria-label={opaque.state}
      {...{ [M.sign]: opaque.state, [M.proof_ref]: opaque.proofRef, [M.reason]: reason ?? undefined }}
    >
      <span aria-hidden="true">{glyph}</span>
    </span>
    {#if reason}<span>{reason}</span>{/if}
  </td>
{/if}
