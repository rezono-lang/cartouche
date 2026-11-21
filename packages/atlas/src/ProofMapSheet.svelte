<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage } from './i18n-mf2.ts';
  import type { AtlasLocale } from './i18n-mf2.ts';
  import { buildProofMapModel } from './proof-map-model.ts';
  import type { ProofMapExpansion } from './proof-map-model.ts';

  let {
    fixture,
    focusKey,
    expansions = undefined,
    groupThreshold = undefined,
    publishedGroupCounts = undefined,
    validAt = undefined,
    knownAt = undefined,
    lang = 'en'
  }: {
    fixture: Record<string, unknown>;
    focusKey: string;
    expansions?: readonly ProofMapExpansion[] | undefined;
    groupThreshold?: number | undefined;
    publishedGroupCounts?: Readonly<Record<string, string>> | undefined;
    validAt?: string | undefined;
    knownAt?: string | undefined;
    lang?: AtlasLocale;
  } = $props();

  const M = DATA_MARKS;
  const t = (id: string, args?: Readonly<Record<string, string | number>>) => formatAtlasMessage(lang, id, args);

  let model = $derived(
    buildProofMapModel(fixture, {
      focusKey,
      expansions,
      groupThreshold,
      publishedGroupCounts,
      validAt,
      knownAt
    })
  );
</script>

<section
  class="proof-map-sheet"
  aria-labelledby="proof-map-title"
  {...{ ...(model.trustTier ? { [M.trust_tier]: model.trustTier } : {}) }}
  {lang}
>
  <header>
    <h2 id="proof-map-title">{model.focusKey}</h2>
    <div {...{ [M.part]: 'seal', ...(model.trustTier ? { [M.trust_tier]: model.trustTier } : {}) }}>
      <span class="mono" {...{ [M.part]: 'manifest-hash' }}>{model.manifestId}</span>
    </div>
  </header>

  {#if model.groups.length > 0}
    <ul class="proof-map-groups" aria-label={t('col.kind')}>
      {#each model.groups as chip (chip.kind)}
        <li>
          <span>{chip.kind}</span>: <span class="mono">{chip.countDisplay}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <table aria-label={t('sheet.common.twin')} {...{ [M.part]: 'twin' }}>
    <thead>
      <tr>
        <th scope="col">{t('col.hop')}</th>
        <th scope="col">{t('col.kind')}</th>
        <th scope="col">{t('col.label')}</th>
        <th scope="col">{t('col.proof')}</th>
      </tr>
    </thead>
    <tbody>
      {#each model.nodes as node (node.id)}
        <tr
          {...{
            [M.key]: node.key,
            [M.relation]: node.relation,
            [M.depth]: node.distance,
            [M.proof_ref]: node.proofRef
          }}
        >
          <td class="mono">{node.distance}</td>
          <td>{node.relation}</td>
          <td><a href={node.focusHref}>{node.label}</a></td>
          <td><a class="mono" href={node.slipHref} {...{ [M.proof_ref]: node.proofRef }}>{node.proofRef}</a></td>
        </tr>
      {/each}
    </tbody>
  </table>

  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${model.svgWidth} ${model.svgHeight}`}
    width={model.svgWidth}
    height={model.svgHeight}
    role="img"
    aria-label={model.focusKey}
    {...{ [M.projection]: '2d' }}
  >
    {#each model.nodes as node (node.id)}
      <g
        {...{
          [M.key]: node.key,
          [M.relation]: node.relation,
          [M.depth]: node.distance,
          [M.proof_ref]: node.proofRef
        }}
      >
        <rect x={node.x} y={node.boxY} width="220" height="42" rx="4" fill="var(--c-paper-elev)" stroke="var(--c-rule-strong)" stroke-width="1" />
        <a href={node.focusHref}>
          <text x={node.textX} y={node.textY} fill="var(--c-ink)" font-size="11">{node.label}</text>
        </a>
        <a href={node.slipHref}>
          <text x={node.textX} y={node.proofTextY} fill="var(--c-proof)" font-size="10">{node.proofRef}</text>
        </a>
      </g>
    {/each}
  </svg>
</section>

<style>
  .proof-map-sheet {
    font-family: var(--font-sans);
  }
  .mono {
    font-family: var(--font-mono);
  }
</style>
