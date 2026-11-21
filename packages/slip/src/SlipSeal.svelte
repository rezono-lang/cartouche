<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import type { CartoucheSeal } from '../../reader-core/src/index.ts';

  interface SealCheck { readonly id: string; readonly status: string; readonly label?: string }

  // Renders exactly the checks it is given; it never derives or invents a check result.
  let { seal, checks = [] }: { seal: CartoucheSeal; checks?: readonly SealCheck[] } = $props();
  const M = DATA_MARKS;
</script>

<section class="slip-seal" aria-label="Verification seal" {...{ [M.part]: 'seal', [M.trust_tier]: seal.trustTier }}>
  <div class="slip-seal-meta">
    <span class="slip-manifest-hash" {...{ [M.part]: 'manifest-hash' }}>{seal.manifestId}</span>
    <span class="slip-seal-tier">{seal.trustTier}</span>
    <span class="slip-seal-role">{seal.role}</span>
  </div>
  <ul class="slip-seal-checks" aria-label="Seal checks">
    {#each checks as chk (chk.id)}
      <li {...{ [M.check]: chk.id, [M.status]: chk.status }}>{chk.label ?? chk.id}: {chk.status}</li>
    {/each}
  </ul>
</section>