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
  let spec = $derived(SIGNS[sign] ?? SIGNS.derived);
</script>

<span
  class="cartouche-sign"
  data-sign={sign}
  data-proof-ref={proofRef}
  data-state={state}
  data-reason={reason}
  aria-label={label || sign}
>
  <span aria-hidden="true">{spec?.glyph ?? '○'}</span>{#if label}<span>{label}</span>{/if}
</span>
