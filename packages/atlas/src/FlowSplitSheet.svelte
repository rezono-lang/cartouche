<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel, formatSignLabel, formatStateLabel, formatTrustTierLabel } from './i18n-mf2.ts';
  import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';
  import { buildFlowSplitModel, renderFlowSplitSvg } from './flow-split-svg.ts';
  import type { FlowSplitFixtureInput } from './flow-split-svg.ts';

  interface Props {
    fixture: FlowSplitFixtureInput;
    theme?: PaletteName;
    lang?: AtlasLocale;
    messages?: Mf2MessageCatalog | null;
    curtainSplit?: number;
    title?: string;
  }

  let {
    fixture,
    theme = 'swisstopo',
    lang = 'en',
    messages = null,
    curtainSplit = 50,
    title
  }: Props = $props();

  let t = $derived((key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(lang, key, params, messages)
  );
  let resolvedTitle = $derived(title ?? t('sheet.flow.title'));
  let model = $derived(buildFlowSplitModel(fixture, { theme, curtainSplit }));
  let svgMarkup = $derived(renderFlowSplitSvg(model, t('sheet.flow.diagram_label', { title: resolvedTitle })));
</script>

<section
  lang={lang}
  data-sheet="flow-split"
  data-projection="2d"
  data-cartouche-theme={model.theme}
  data-trust-tier={model.scene.seal.trustTier}
  aria-labelledby="flow-split-title"
>
  <header>
    <h1 id="flow-split-title">{resolvedTitle}</h1>
    <p>{t('sheet.flow.subtitle')}</p>

    {#if !model.scene.horizon.complete}
      <div
        data-part="horizon"
        data-status="warning"
        data-reason={model.scene.horizon.reason ?? 'not_read_in_full'}
      >
        {t('sheet.common.horizon_incomplete', {
          reason: formatReasonLabel(lang, model.scene.horizon.reason ?? 'not_read_in_full', messages)
        })}
      </div>
    {/if}

    <div
      data-part="seal"
      data-trust-tier={model.scene.seal.trustTier}
    >
      <span data-part="manifest-hash">{model.scene.seal.manifestId}</span>
      <span
        data-check="page-witnesses"
        data-status={model.scene.seal.witnessCheck === 'green' ? 'green' : 'red'}
      >
        {model.scene.seal.witnessCheck}
      </span>
      <span>{formatTrustTierLabel(lang, model.scene.seal.trustTier, messages)}</span>
      <span>role={model.scene.seal.role}</span>
      <span>epoch={model.scene.seal.epoch}</span>
      <span>{model.scene.seal.knowledgeTime}</span>
    </div>
  </header>

  <figure>
    {@html svgMarkup}
  </figure>

  <aside aria-label={t('sheet.common.legend')}>
    <h2>{t('sheet.common.legend')}</h2>
    <table data-part="legend">
      <caption>{t('sheet.common.legend_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('col.sign')}</th>
          <th scope="col">{t('col.glyph')}</th>
          <th scope="col">{t('col.kind')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.legendItems as item (item.key)}
          <tr data-sign={item.key}>
            <td>{formatSignLabel(lang, item.key, messages)}</td>
            <td>{item.glyph}</td>
            <td>{item.kind}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </aside>

  <section aria-label={t('sheet.common.twin')}>
    <h2>{t('sheet.common.twin')}</h2>
    <table data-part="twin">
      <caption>{t('sheet.flow.entities_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('col.entity')}</th>
          <th scope="col">{t('col.zone')}</th>
          <th scope="col">{t('col.layer')}</th>
          <th scope="col">{t('col.sign')}</th>
          <th scope="col">{t('col.state')}</th>
          <th scope="col">{t('col.proof')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.nodes as n (n.id)}
          <tr
            data-key={n.id}
            data-sign={n.sign}
            data-state={n.state === 'invalid' ? undefined : n.state}
            data-layer={n.layer}
            data-proof-ref={n.proofRef}
            data-completeness-ref={n.completenessWitnessRef ?? undefined}
          >
            <td>{n.label}</td>
            <td>{n.zone}</td>
            <td>{n.layer}</td>
            <td>{n.signGlyph} {formatSignLabel(lang, n.sign, messages)}</td>
            <td
              data-part="value"
              data-state={n.state}
              data-reason={n.reason ?? undefined}
              data-completeness-ref={n.completenessWitnessRef ?? undefined}
              data-proof-ref={n.proofRef}
            >
              {#if n.state === 'unknown'}
                <span data-sign="unknown" data-reason={n.reason ?? undefined}>
                  {SIGNS.unknown?.glyph ?? '▨'} {formatStateLabel(lang, 'unknown', messages)} · {formatReasonLabel(lang, n.reason ?? 'incomplete', messages)}
                </span>
              {:else if n.state === 'absent'}
                <span data-sign="absent">
                  {SIGNS.absent?.glyph ?? '⦸'} {formatStateLabel(lang, 'absent', messages)}
                </span>
              {:else if n.state === 'invalid'}
                <span data-sign="invalid" data-reason={n.reason ?? undefined}>
                  ! {formatStateLabel(lang, 'invalid', messages)}{#if n.reason} · {formatReasonLabel(lang, n.reason, messages)}{/if}
                </span>
              {:else}
                {n.stateGlyph} {formatStateLabel(lang, n.state, messages)}
              {/if}
            </td>
            <td>{n.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if model.driftEdges.length > 0}
      <table data-part="twin">
        <caption>{t('sheet.flow.drift_caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('col.edge')}</th>
            <th scope="col">{t('col.from')}</th>
            <th scope="col">{t('col.to')}</th>
            <th scope="col">{t('col.label')}</th>
            <th scope="col">{t('col.stated_proof')}</th>
            <th scope="col">{t('col.observed_proof')}</th>
          </tr>
        </thead>
        <tbody>
          {#each model.driftEdges as e (e.id)}
            <tr
              data-key={e.id}
              data-relation="drift"
              data-sign="drift"
              data-state="violated"
              data-layer="both"
              data-proof-ref={e.proofRef ?? undefined}
              data-stated-proof-ref={e.statedProofRef ?? undefined}
              data-observed-proof-ref={e.observedProofRef ?? undefined}
            >
              <td>{e.id}</td>
              <td>{e.from}</td>
              <td>{e.to}</td>
              <td>{SIGNS.drift?.glyph ?? '══'} {e.label}</td>
              <td>{e.statedProofRef}</td>
              <td>{e.observedProofRef}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</section>
