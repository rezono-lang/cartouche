<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel, formatSignLabel, formatStateLabel, formatTrustTierLabel } from './i18n-mf2.ts';
  import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';
  import { buildCausalRippleModel, renderCausalRippleSvg } from './ripple-layout.ts';
  import type { RippleFixtureWithEdges } from './ripple-layout.ts';
  import { mountCausalRipplePixi } from './ripple-pixi.ts';

  interface Props {
    fixture: RippleFixtureWithEdges;
    theme?: PaletteName;
    lang?: AtlasLocale;
    messages?: Mf2MessageCatalog | null;
    title?: string;
  }

  let {
    fixture,
    theme = 'swisstopo',
    lang = 'en',
    messages = null,
    title
  }: Props = $props();

  let t = $derived((key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(lang, key, params, messages)
  );
  let resolvedTitle = $derived(title ?? t('sheet.ripple.title'));
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let model = $derived(buildCausalRippleModel(fixture, { theme }));
  let svgMarkup = $derived(
    renderCausalRippleSvg(model, t('sheet.ripple.diagram_label', { title: resolvedTitle, mode: model.mode }))
  );

  $effect(() => {
    if (typeof window === 'undefined' || !canvasEl) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void mountCausalRipplePixi(canvasEl, model).then((cleanup) => {
      if (!active) cleanup();
      else dispose = cleanup;
    });
    return () => {
      active = false;
      dispose?.();
    };
  });
</script>

<section
  lang={lang}
  data-sheet="causal-ripple"
  data-projection="2d"
  data-cartouche-theme={model.theme}
  data-trust-tier={model.scene.seal.trustTier}
  aria-labelledby="causal-ripple-title"
>
  <header>
    <h1 id="causal-ripple-title">{resolvedTitle}</h1>
    <p>{t('sheet.ripple.summary', { mode: model.mode, count: String(model.dependentTotal) })}</p>

    {#if !model.scene.horizon.complete}
      <div
        data-part="horizon"
        data-status="warning"
        data-reason={model.scene.horizon.reason ?? 'incomplete'}
      >
        {t('sheet.common.horizon_incomplete', {
          reason: formatReasonLabel(lang, model.scene.horizon.reason ?? 'incomplete', messages)
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
    <canvas
      bind:this={canvasEl}
      data-projection="2d"
      width={model.width}
      height={model.height}
      aria-hidden="true"
    ></canvas>
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
      <caption>{t('sheet.common.twin_caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('col.entity')}</th>
          <th scope="col">{t('col.hop')}</th>
          <th scope="col">{t('col.gate')}</th>
          <th scope="col">{t('col.load_bearing')}</th>
          <th scope="col">{t('col.sign')}</th>
          <th scope="col">{t('col.value')}</th>
          <th scope="col">{t('col.proof')}</th>
        </tr>
      </thead>
      <tbody>
        {#each model.nodes as n (n.id)}
          <tr
            data-key={n.id}
            data-sign={n.sign}
            data-state={n.state === 'invalid' ? undefined : n.state}
            data-gate={n.gate ?? undefined}
            data-load-bearing={n.loadBearing === null ? undefined : n.loadBearing ? 'true' : 'false'}
            data-proof-ref={n.proofRef}
            data-completeness-ref={n.completenessWitnessRef ?? undefined}
          >
            <td>{n.label}</td>
            <td>{n.hop}</td>
            <td>{n.gate ?? ''}</td>
            <td>{n.loadBearing === null ? '' : n.loadBearing ? 'true' : 'false'}</td>
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
                  {SIGNS.unknown?.glyph ?? '▨'} {n.reason ? formatReasonLabel(lang, n.reason, messages) : ''}
                </span>
              {:else if n.state === 'absent'}
                <span data-sign="absent">
                  {SIGNS.absent?.glyph ?? '⦸'} {formatStateLabel(lang, 'absent', messages)}
                </span>
              {:else if n.state === 'invalid'}
                <span data-sign="invalid" data-reason={n.reason ?? undefined}>
                  {SIGNS.invalid?.glyph ?? '!'} {formatStateLabel(lang, 'invalid', messages)}{#if n.reason} · {formatReasonLabel(lang, n.reason, messages)}{/if}
                </span>
              {:else if n.previousDisplay && n.display}
                <del>{n.previousDisplay}</del> <ins>{n.display}</ins>
              {:else}
                {n.stateGlyph} {n.display ?? formatStateLabel(lang, n.state, messages)}
              {/if}
            </td>
            <td>{n.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</section>
