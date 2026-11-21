<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';

  interface Props {
    sign: string;
    proofRef: string;
    label?: string;
    state?: string;
    reason?: string;
  }

  let { sign, proofRef, label = '', state, reason }: Props = $props();
  let spec = $derived.by(() => {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, sign)) {
      throw new Error(`Unknown std-view sign: ${sign}`);
    }
    return SIGNS[sign]!;
  });
</script>

<span
  class="cartouche-sign"
  role="img"
  data-sign={sign}
  data-proof-ref={proofRef}
  data-state={state}
  data-reason={reason}
  aria-label={label || sign}
>
  <span aria-hidden="true">{spec.glyph}</span>{#if label}<span>{label}</span>{/if}
</span>
