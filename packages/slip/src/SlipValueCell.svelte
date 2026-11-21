<script lang="ts">
  import { DATA_MARKS, SIGNS, asOpaqueCell } from '../../reader-core/src/index.ts';
  import type { RawCellInput } from '../../reader-core/src/index.ts';

  let { cell, fold = null }: { cell: RawCellInput; fold?: string | null } = $props();

  const M = DATA_MARKS;
  const DIGIT = /[0-9]/;

  // Validation lives in the reader-core boundary: throws on unknown without reason,
  // absent without witness, known without display. Nothing here invents a reason.
  let opaque = $derived(asOpaqueCell(cell));
  let reason = $derived.by((): string | null => {
    const raw = opaque.reason?.trim() ?? '';
    const r = raw.length > 0 ? raw : null;
    if (opaque.state === 'known') return null;
    // Unknown, invalid, and not_applicable require a published epistemic reason.
    // Absent cells carry completeness_witness_ref (and emit data-reason whenever published,
    // without fabricating one or breaking frozen fixtures whose absent rows omit reason).
    if (opaque.state === 'unknown' || opaque.state === 'invalid' || opaque.state === 'not_applicable') {
      if (!r) throw new Error('non-known cell without published reason: ' + opaque.proofRef);
      if (opaque.state === 'unknown' && DIGIT.test(r)) {
        throw new Error('unknown cell reason must not contain digits: ' + opaque.proofRef);
      }
    }
    return r;
  });
  let glyph = $derived.by((): string => {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, opaque.state)) {
      throw new Error('no std-view sign for state: ' + opaque.state);
    }
    return SIGNS[opaque.state]!.glyph;
  });
</script>

{#if opaque.state === 'known'}
  <td {...{ [M.part]: 'value', [M.state]: 'known', [M.proof_ref]: opaque.proofRef }}>
    {#if fold !== null}
      <del>{opaque.display}</del>
      <ins>{fold}</ins>
    {:else}
      {opaque.display}
    {/if}
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