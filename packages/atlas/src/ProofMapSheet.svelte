<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage } from './i18n-mf2.ts';
  import type { AtlasLocale } from './i18n-mf2.ts';
  import { compileProofMapLayout } from './proof-map-layout.ts';
  import { buildProofMapModel } from './proof-map-model.ts';
  import type { ProofMapExpansion } from './proof-map-model.ts';
  import { resolveProofMapShareState } from './proof-map-share.ts';

  let {
    fixture,
    focusKey = undefined,
    expansions = undefined,
    groupThreshold = undefined,
    publishedGroupCounts = undefined,
    validAt = undefined,
    knownAt = undefined,
    shareUrl = undefined,
    role = 'checker',
    allowedRoleLenses = undefined,
    readerStatus = 200,
    lang = 'en'
  }: {
    fixture: Record<string, unknown>;
    focusKey?: string | undefined;
    expansions?: readonly ProofMapExpansion[] | undefined;
    groupThreshold?: number | undefined;
    publishedGroupCounts?: Readonly<Record<string, string>> | undefined;
    validAt?: string | undefined;
    knownAt?: string | undefined;
    shareUrl?: string | undefined;
    role?: string;
    allowedRoleLenses?: readonly string[] | undefined;
    readerStatus?: number;
    lang?: AtlasLocale;
  } = $props();

  const M = DATA_MARKS;
  const t = (id: string, args?: Readonly<Record<string, string | number>>) => formatAtlasMessage(lang, id, args);

  let shareState = $derived(
    shareUrl
      ? resolveProofMapShareState(shareUrl, {
          recipientRole: role,
          allowedRoleLenses: allowedRoleLenses ?? [role],
          readerStatus
        })
      : null
  );

  let isUnserved = $derived(readerStatus === 410 || shareState?.status === 'withdrawn');
  let isGateRecording = $derived(
    !isUnserved && Boolean(shareUrl) && typeof fixture === 'object' && fixture !== null && 'reader_answers' in fixture
  );

  let semanticLayout = $derived(
    isGateRecording
      ? compileProofMapLayout(fixture, {
          role: shareState?.effectiveRole ?? role,
          focusKey: shareState?.parsed.at ?? focusKey,
          selection: shareState?.parsed.selection,
          validAt: shareState?.parsed.validAt ?? validAt,
          knownAt: shareState?.parsed.knownAt ?? knownAt,
          epoch: shareState?.parsed.epoch,
          expansions: shareState?.parsed.expansions
        })
      : null
  );

  let model = $derived(
    !isUnserved && !isGateRecording
      ? buildProofMapModel(fixture, {
          focusKey: focusKey ?? shareState?.parsed.at ?? '',
          expansions,
          groupThreshold,
          publishedGroupCounts,
          validAt: shareState?.parsed.validAt ?? validAt,
          knownAt: shareState?.parsed.knownAt ?? knownAt
        })
      : null
  );
</script>

{#if isUnserved}
  <section class="proof-map-sheet" aria-labelledby="proof-map-unserved-title" {lang}>
    <div {...{ [M.part]: 'unserved' }}>
      <h2 id="proof-map-unserved-title">{t('sheet.common.unserved')}</h2>
      <p>{t('reason.withdrawn')}</p>
    </div>
  </section>
{:else if semanticLayout}
  <section
    class="proof-map-sheet"
    aria-labelledby="proof-map-title"
    {...{ [M.trust_tier]: semanticLayout.scene.seal.trustTier }}
    {lang}
  >
    <header>
      <h2 id="proof-map-title">{shareState?.parsed.at ?? focusKey ?? semanticLayout.manifestId}</h2>
      <div {...{ [M.part]: 'seal', [M.trust_tier]: semanticLayout.scene.seal.trustTier }}>
        <span class="mono" {...{ [M.part]: 'manifest-hash' }}>{semanticLayout.manifestId}</span>
      </div>
    </header>

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
        {#each semanticLayout.nodes as node (node.id)}
          <tr
            {...{
              [M.key]: node.id,
              [M.relation]: node.id,
              [M.depth]: node.depth,
              [M.proof_ref]: node.proofRef
            }}
          >
            <td class="mono">{node.depth}</td>
            <td>{node.lane}</td>
            <td>{node.qualifiedName}</td>
            <td class="mono">{node.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {@html semanticLayout.svg}
  </section>
{:else if model}
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
{/if}

<style>
  .proof-map-sheet {
    font-family: var(--font-sans);
  }
  .mono {
    font-family: var(--font-mono);
  }
</style>
