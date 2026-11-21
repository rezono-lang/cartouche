<script lang="ts">
  import { DATA_MARKS, SIGNS, paletteCss } from '../../reader-core/src/index.ts';
  import type { PaletteName, SignSpec } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel, formatSignLabel, formatStateLabel, formatTrustTierLabel } from './i18n-mf2.ts';
  import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';
  import {
    buildReliefModel,
    renderRelief2DProfileSvg,
    renderReliefOrthographicSvg
  } from './relief-model.ts';
  import type { ReliefFixtureInput, ReliefProjection } from './relief-model.ts';

  interface SealCheckItem {
    readonly id: string;
    readonly status: 'green' | 'warning' | 'red';
    readonly label?: string;
  }

  interface Props {
    fixture: ReliefFixtureInput;
    theme?: PaletteName;
    lang?: AtlasLocale;
    messages?: Mf2MessageCatalog | null;
    projection?: ReliefProjection;
    sliceYIndex?: number;
    sealChecks?: readonly SealCheckItem[];
    title?: string;
  }

  let {
    fixture,
    theme = 'swisstopo',
    lang = 'en',
    messages = null,
    projection = 'orthographic',
    sliceYIndex = 1,
    sealChecks = [],
    title
  }: Props = $props();

  const M = DATA_MARKS;
  let t = $derived((key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(lang, key, params, messages)
  );
  let resolvedTitle = $derived(title ?? t('sheet.relief.title'));
  let projectionOverride = $state<ReliefProjection | null>(null);
  let activeProjection = $derived<ReliefProjection>(projectionOverride ?? projection);

  let model = $derived(
    buildReliefModel(fixture, {
      theme,
      projection: activeProjection,
      sliceYIndex
    })
  );

  let themeCssText = $derived(paletteCss(model.theme));

  let svgMarkup = $derived(
    activeProjection === '2d'
      ? renderRelief2DProfileSvg(model, t('sheet.relief.profile_suffix', { title: resolvedTitle }))
      : renderReliefOrthographicSvg(model, t('sheet.relief.terrain_suffix', { title: resolvedTitle }), lang, messages)
  );

  let effectiveSealChecks = $derived.by((): readonly SealCheckItem[] => {
    if (sealChecks.length > 0) return sealChecks;
    const status: 'green' | 'red' = model.scene.seal.witnessCheck === 'green' ? 'green' : 'red';
    return [{ id: 'witness', status, label: 'witness' }];
  });

  function resolveSignSpec(signName: string): SignSpec {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, signName)) {
      throw new Error(`Unknown std-view sign: "${signName}".`);
    }
    const spec = SIGNS[signName];
    if (!spec) {
      throw new Error(`Unknown std-view sign: "${signName}".`);
    }
    return spec;
  }

  function toggleProjection(): void {
    projectionOverride = activeProjection === 'orthographic' ? '2d' : 'orthographic';
  }
</script>

<section
  class="cartouche-relief-sheet"
  lang={lang}
  aria-labelledby="relief-3d-title"
  {...{
    [M.sheet]: 'relief-3d',
    [M.projection]: activeProjection,
    [M.theme]: model.theme,
    [M.trust_tier]: model.scene.seal.trustTier
  }}
>
  <style>{themeCssText}</style>

  <header class="relief-header">
    <h2 id="relief-3d-title">{resolvedTitle}</h2>
    <p>{model.xAxis.label} × {model.yAxis.label} → {model.zAxis.label} ({model.zAxis.unit})</p>

    <div class="relief-controls">
      <button
        type="button"
        {...{ [M.key]: 'toggle-projection', [M.proof_ref]: model.scene.seal.manifestId }}
        aria-pressed={activeProjection === '2d'}
        onclick={toggleProjection}
      >
        {activeProjection === 'orthographic' ? t('sheet.relief.switch_to_2d') : t('sheet.relief.switch_to_3d')}
      </button>
    </div>

    <section
      class="relief-seal"
      aria-label={t('sheet.common.seal')}
      {...{ [M.part]: 'seal', [M.trust_tier]: model.scene.seal.trustTier }}
    >
      <div class="relief-seal-meta">
        <span {...{ [M.part]: 'manifest-hash' }}>{model.scene.seal.manifestId}</span>
        <span>{formatTrustTierLabel(lang, model.scene.seal.trustTier, messages)}</span>
        <span>{model.scene.seal.role}</span>
      </div>
      <ul aria-label={t('sheet.common.seal_checks')}>
        {#each effectiveSealChecks as chk (chk.id)}
          <li {...{ [M.check]: chk.id, [M.status]: chk.status }}>
            {chk.label ?? chk.id}: {chk.status}
          </li>
        {/each}
      </ul>
    </section>
  </header>

  <figure class="relief-figure">
    {@html svgMarkup}
  </figure>

  {#if model.curtains.length > 0}
    <section class="relief-curtains" aria-label={t('sheet.relief.curtains')}>
      <h3>{t('sheet.relief.curtains')}</h3>
      {#each model.curtains as curtain (curtain.subjectId)}
        <div
          class="relief-curtain-banner"
          {...{
            [M.part]: 'curtain',
            [M.state]: 'unknown',
            [M.reason]: curtain.reason
          }}
        >
          <span
            class="cartouche-sign"
            role="img"
            aria-label={formatStateLabel(lang, 'unknown', messages)}
            {...{
              [M.sign]: 'unknown',
              [M.reason]: curtain.reason
            }}
          >
            <span aria-hidden="true">{resolveSignSpec('unknown').glyph}</span>
          </span>
          <span>{formatReasonLabel(lang, curtain.reason, messages)}</span>
          <a href={`#${curtain.proofRef}`} {...{ [M.proof_ref]: curtain.proofRef }}>{t('sheet.common.witness')}</a>
        </div>
      {/each}
    </section>
  {/if}

  <section aria-label={t('sheet.common.twin')}>
    <h3>{t('sheet.common.twin')}</h3>
    <table {...{ [M.part]: 'twin' }}>
      <caption>{t('sheet.relief.subjects_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('col.subject')}</th>
          <th scope="col">{t('col.sign')}</th>
          <th scope="col">{t('col.state')}</th>
          <th scope="col">{model.zAxis.label}</th>
          <th scope="col">{t('col.cliff_distance')}</th>
          <th scope="col">{t('col.citation')}</th>
          <th scope="col">{t('col.proof')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.subjects as sub (sub.id)}
          <tr
            {...{
              [M.key]: sub.id,
              [M.state]: sub.state === 'invalid' ? undefined : sub.state,
              [M.proof_ref]: sub.amountCell.proofRef
            }}
          >
            <th scope="row">{sub.id}</th>
            <td>
              <span
                class="cartouche-sign"
                role="img"
                aria-label={formatSignLabel(lang, sub.sign, messages)}
                {...{ [M.sign]: sub.sign }}
              >
                <span aria-hidden="true">{resolveSignSpec(sub.sign).glyph}</span>
              </span>
            </td>
            <td>{formatStateLabel(lang, sub.state, messages)}</td>
            {#if sub.amountCell.state === 'known'}
              <td
                {...{
                  [M.part]: 'value',
                  [M.state]: 'known',
                  [M.proof_ref]: sub.amountCell.proofRef
                }}
              >
                {sub.amountCell.display}
              </td>
            {:else}
              <td
                {...{
                  [M.part]: 'value',
                  [M.state]: sub.amountCell.state,
                  [M.reason]: sub.amountCell.reason ?? undefined,
                  [M.proof_ref]: sub.amountCell.proofRef,
                  [M.completeness_ref]: sub.amountCell.completenessWitnessRef ?? undefined
                }}
              >
                <span
                  class="cartouche-sign"
                  role="img"
                  aria-label={formatStateLabel(lang, sub.amountCell.state, messages)}
                  {...{
                    [M.sign]: sub.amountCell.state,
                    [M.reason]: sub.amountCell.reason ?? undefined
                  }}
                >
                  <span aria-hidden="true">{resolveSignSpec(sub.amountCell.state).glyph}</span>
                </span>
                {#if sub.amountCell.reason}
                  <span>{formatReasonLabel(lang, sub.amountCell.reason, messages)}</span>
                {/if}
              </td>
            {/if}
            <td>{sub.cliffDistanceDisplay ?? '–'}</td>
            <td>{sub.citation}</td>
            <td>{sub.amountCell.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <table {...{ [M.part]: 'twin' }}>
      <caption>{t('sheet.relief.grid_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{model.xAxis.label}</th>
          <th scope="col">{model.yAxis.label}</th>
          <th scope="col">{model.zAxis.label}</th>
          <th scope="col">{t('col.state')}</th>
          <th scope="col">{t('col.proof')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.gridCells as cell (`${cell.ix}-${cell.iy}`)}
          <tr
            {...{
              [M.key]: `cell:${cell.ix}-${cell.iy}`,
              [M.state]: cell.opaque.state,
              [M.proof_ref]: cell.opaque.proofRef
            }}
          >
            <td>{cell.xStop}</td>
            <td>{cell.yStop}</td>
            {#if cell.opaque.state === 'known'}
              <td
                {...{
                  [M.part]: 'value',
                  [M.state]: 'known',
                  [M.proof_ref]: cell.opaque.proofRef
                }}
              >
                {cell.opaque.display}
              </td>
            {:else}
              <td
                {...{
                  [M.part]: 'value',
                  [M.state]: cell.opaque.state,
                  [M.reason]: cell.opaque.reason ?? undefined,
                  [M.proof_ref]: cell.opaque.proofRef,
                  [M.completeness_ref]: cell.opaque.completenessWitnessRef ?? undefined
                }}
              >
                <span
                  class="cartouche-sign"
                  role="img"
                  aria-label={formatStateLabel(lang, cell.opaque.state, messages)}
                  {...{
                    [M.sign]: cell.opaque.state,
                    [M.reason]: cell.opaque.reason ?? undefined
                  }}
                >
                  <span aria-hidden="true">{resolveSignSpec(cell.opaque.state).glyph}</span>
                </span>
                {#if cell.opaque.reason}
                  <span>{formatReasonLabel(lang, cell.opaque.reason, messages)}</span>
                {/if}
              </td>
            {/if}
            <td>{formatStateLabel(lang, cell.opaque.state, messages)}</td>
            <td>{cell.opaque.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section aria-label={t('sheet.common.legend')}>
    <h3>{t('sheet.common.legend')}</h3>
    <table {...{ [M.part]: 'legend' }}>
      <caption>{t('sheet.common.legend_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('col.glyph')}</th>
          <th scope="col">{t('col.sign')}</th>
          <th scope="col">{t('col.kind')}</th>
          <th scope="col">{t('col.pattern')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.legendItems as item (item.key)}
          <tr {...{ [M.sign]: item.key }}>
            <td><span aria-hidden="true">{item.glyph}</span></td>
            <td>{formatSignLabel(lang, item.key, messages)}</td>
            <td>{item.kind}</td>
            <td>{item.pattern}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</section>

<style>
  .cartouche-relief-sheet {
    background: var(--c-paper);
    color: var(--c-ink);
    border: 1px solid var(--c-rule);
    padding: 0.75rem;
    font-family: var(--font-sans);
  }
  [data-part="manifest-hash"],
  code {
    font-family: var(--font-mono);
  }
  .relief-curtain-banner {
    background: repeating-linear-gradient(45deg, transparent 0 5px, var(--c-hatch) 5px 6px);
    padding: 0.4rem 0.6rem;
    margin: 0.5rem 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.5rem;
  }
  th,
  td {
    border-bottom: 1px solid var(--c-rule);
    padding: 0.25rem 0.5rem;
    text-align: left;
  }
</style>
