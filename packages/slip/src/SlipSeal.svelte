<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import type { CartoucheSeal } from '../../reader-core/src/index.ts';

  interface SealCheck { readonly id: string; readonly status: string; readonly label?: string }

  // Renders exactly the checks it is given; it never derives or invents a check result.
  // `manifestHash`: the manifest's sha256 as the reader's head gives it (Rezono's seal); else the manifest id.
  let {
    seal,
    checks = [],
    manifestHash = null,
    dataset = null
  }: { seal: CartoucheSeal; checks?: readonly SealCheck[]; manifestHash?: string | null; dataset?: string | null } = $props();
  const M = DATA_MARKS;
</script>

<section class="slip-seal" aria-label="Verification seal" {...{ [M.part]: 'seal', [M.trust_tier]: seal.trustTier }}>
  <div class="slip-seal-meta">
    <span class="slip-manifest-hash" {...{ [M.part]: 'manifest-hash' }}>{manifestHash ?? seal.manifestId}</span>
    <span class="slip-seal-manifest">{seal.manifestId}</span>
    {#if dataset}
      <span class="slip-seal-dataset">{dataset}</span>
    {/if}
    <span class="slip-seal-tier">{seal.trustTier}</span>
    <span class="slip-seal-role">{seal.role}</span>
  </div>
  <ul class="slip-seal-checks" aria-label="Seal checks">
    {#each checks as chk (chk.id)}
      <li {...{ [M.check]: chk.id, [M.status]: chk.status }}>{chk.label ?? chk.id}: {chk.status}</li>
    {/each}
  </ul>
</section>