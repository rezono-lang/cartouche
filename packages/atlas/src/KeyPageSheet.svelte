<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel } from './i18n-mf2.ts';
  import type { AtlasLocale } from './i18n-mf2.ts';
  import { buildKeyPageModel } from './key-page-model.ts';
  import type { KeyPageFixtureInput, KeyPagePathStepInput } from './key-page-model.ts';

  let {
    fixture,
    store = 'main',
    role = 'reader',
    entityKey,
    validAt = undefined,
    knownAt = undefined,
    pathSteps = undefined,
    lang = 'en'
  }: {
    fixture: KeyPageFixtureInput;
    store?: string;
    role?: string;
    entityKey: string;
    validAt?: string | undefined;
    knownAt?: string | undefined;
    pathSteps?: readonly KeyPagePathStepInput[] | undefined;
    lang?: AtlasLocale;
  } = $props();

  const M = DATA_MARKS;
  const t = (id: string, args?: Readonly<Record<string, string | number>>) => formatAtlasMessage(lang, id, args);

  let model = $derived(
    buildKeyPageModel({
      fixture,
      store,
      role,
      entityKey,
      validAt,
      knownAt,
      pathSteps
    })
  );

  let horizonText = $derived(
    t('sheet.common.horizon_incomplete', { reason: formatReasonLabel(lang, 'not_read_in_full') })
  );
</script>

<section
  aria-labelledby="key-page-title"
  {...{
    ...(model.trustTier ? { [M.trust_tier]: model.trustTier } : {})
  }}
  {lang}
>
  <header>
    <h2 id="key-page-title">{model.entityKey}</h2>
    <div {...{ [M.part]: 'seal', ...(model.trustTier ? { [M.trust_tier]: model.trustTier } : {}) }}>
      <span {...{ [M.part]: 'manifest-hash' }}>{model.manifestId}</span>
      <span>{model.role}</span>
      {#if model.validAt}
        <span>{t('control.valid_at')}: {model.validAt}</span>
      {/if}
      {#if model.knownAt}
        <span>{t('control.known_at')}: {model.knownAt}</span>
      {/if}
    </div>
  </header>

  {#if model.notReadInFull}
    <p role="status" {...{ [M.part]: 'horizon', [M.reason]: 'not_read_in_full' }}>{horizonText}</p>
  {/if}

  <table aria-label={model.entityKey}>
    <thead>
      <tr>
        <th scope="col">{t('col.kind')}</th>
        <th scope="col">{t('col.value')}</th>
        <th scope="col">{t('col.proof')}</th>
      </tr>
    </thead>
    {#each model.groups as group (group.relation)}
      <tbody>
        <tr {...{ [M.relation]: group.relation }}>
          <th scope="rowgroup" colspan="3">{group.relation}</th>
        </tr>
        {#each group.items as item (item.relation + ':' + item.key)}
          <tr {...{ [M.relation]: item.relation, [M.key]: item.key, [M.proof_ref]: item.proofRef }}>
            <td>{item.relation}</td>
            <td>{item.display}</td>
            <td><a href={item.slipHref} {...{ [M.proof_ref]: item.proofRef }}>{item.proofRef}</a></td>
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>

  {#if model.pathSteps.length > 0}
    <table aria-label={t('col.proof')} {...{ [M.answer]: 'grounds' }}>
      <thead>
        <tr>
          <th scope="col">{t('col.hop')}</th>
          <th scope="col">{t('col.kind')}</th>
          <th scope="col">{t('col.value')}</th>
          <th scope="col">{t('col.proof')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.pathSteps as step (step.proof_ref + ':' + step.depth)}
          <tr {...{ [M.depth]: step.depth, [M.relation]: step.relation, [M.key]: step.key, [M.proof_ref]: step.proof_ref }}>
            <td>{step.depth}</td>
            <td>{step.relation}</td>
            <td>{step.display}</td>
            <td>{step.proof_ref}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if model.neighbours.length > 0}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${model.svgWidth} ${model.svgHeight}`}
      width={model.svgWidth}
      height={model.svgHeight}
      role="img"
      aria-label={model.entityKey}
      {...{ [M.projection]: '2d' }}
    >
      <g {...{ [M.key]: model.entityKey, [M.depth]: 0, [M.proof_ref]: model.manifestId }}>
        <rect x="24" y={model.centerBoxY} width="160" height="32" rx="4" fill="var(--c-paper-elev)" stroke="var(--c-ink)" stroke-width="1.5" />
        <text x="36" y={model.centerTextY} fill="var(--c-ink)" font-size="12">{model.entityKey}</text>
      </g>
      {#each model.neighbours as nb (nb.relation + ':' + nb.key)}
        <line x1="184" y1={model.centerY} x2={nb.x} y2={nb.y} stroke="var(--c-rule-strong)" stroke-width="1" />
        <g {...{ [M.relation]: nb.relation, [M.key]: nb.key, [M.depth]: nb.depth, [M.proof_ref]: nb.proofRef }}>
          <rect x={nb.x} y={nb.boxY} width="260" height="28" rx="4" fill="var(--c-paper-elev)" stroke="var(--c-rule-strong)" stroke-width="1" />
          <text x={nb.textX} y={nb.textY} fill="var(--c-ink)" font-size="11">{nb.label}</text>
        </g>
      {/each}
    </svg>
  {/if}
</section>

<style>
  section { font-family: var(--font-sans); }
  [data-part="manifest-hash"], code { font-family: var(--font-mono); }
</style>
