<script lang="ts">
  import { DATA_MARKS, PALETTES, SIGNS, paletteCss } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel, formatSignLabel, formatStateLabel, formatTrustTierLabel } from './i18n-mf2.ts';
  import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';
  import { buildMongeFoldingModel } from './monge-model.ts';
  import type { MongeFixtureInput, MongeRoundState, Point2D } from './monge-model.ts';

  interface Props {
    fixture: MongeFixtureInput;
    theme?: PaletteName;
    lang?: AtlasLocale;
    messages?: Mf2MessageCatalog | null;
    foldAngleDeg?: number;
  }

  let { fixture, theme = 'swisstopo', lang = 'en', messages = null, foldAngleDeg }: Props = $props();

  const M = DATA_MARKS;
  let t = $derived((key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(lang, key, params, messages)
  );
  let userAngle = $state<number | null>(null);
  let activeAngle = $derived(userAngle ?? foldAngleDeg ?? fixture.fold_angle_deg ?? 0);
  let resolvedTheme = $derived<PaletteName>(theme in PALETTES ? theme : 'swisstopo');
  let themeCss = $derived(paletteCss(resolvedTheme));
  let model = $derived(buildMongeFoldingModel(fixture, activeAngle));

  function signSpec(sign: string) {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, sign)) {
      throw new Error(`Unknown std-view sign: ${sign}`);
    }
    return SIGNS[sign]!;
  }

  function glyph(sign: string): string {
    return signSpec(sign).glyph;
  }

  function polyline(pts: readonly Point2D[]): string {
    return pts.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');
  }

  function fx(pt: Point2D, dx = 0): string {
    const pos: Point2D = { x: pt.x + dx, y: pt.y };
    return pos.x.toFixed(2);
  }

  function fy(pt: Point2D, dy = 0): string {
    const pos: Point2D = { x: pt.x, y: pt.y + dy };
    return pos.y.toFixed(2);
  }

  function roundDotFill(state: MongeRoundState): string {
    if (state === 'unknown') return 'url(#monge-hatch)';
    if (state === 'absent' || state === 'not_applicable') return 'none';
    if (state === 'changed') return 'var(--c-caution)';
    if (state === 'violated') return 'var(--c-violated)';
    if (state === 'invalid') return 'var(--c-paper-elev)';
    if (state === 'valid') return 'var(--c-valid)';
    return 'none';
  }

  function roundDotStroke(state: MongeRoundState): string {
    if (state === 'absent') return 'var(--c-ink-soft)';
    if (state === 'not_applicable') return 'var(--c-ink-faint)';
    if (state === 'changed') return 'var(--c-caution)';
    if (state === 'invalid' || state === 'violated') return 'var(--c-violated)';
    if (state === 'unknown') return 'var(--c-hatch)';
    return 'var(--c-ink)';
  }

  function roundDotDash(state: MongeRoundState): string | undefined {
    if (state === 'absent' || state === 'not_applicable') return '2 1.5';
    if (state === 'invalid') return '2 1';
    return undefined;
  }
</script>

<section
  class="monge-sheet"
  lang={lang}
  aria-labelledby="monge-title"
  {...{
    [M.sheet]: 'monge-fold',
    [M.projection]: model.projection,
    [M.fold_angle]: String(model.foldAngleDeg),
    [M.theme]: resolvedTheme,
    [M.trust_tier]: model.scene.seal.trustTier
  }}
>
  <style>{themeCss}</style>
  <h2 id="monge-title">{t('sheet.monge.title', { angle: String(model.foldAngleDeg) })}</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: model.scene.seal.trustTier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{model.scene.seal.manifestId}</span>
    <span {...{ [M.check]: 'witness', [M.status]: model.scene.seal.witnessCheck === 'green' ? 'green' : 'red' }}>
      {model.scene.seal.witnessCheck}
    </span>
    <span>{formatTrustTierLabel(lang, model.scene.seal.trustTier, messages)}</span>
  </div>

  <div role="group" aria-label={t('sheet.monge.fold_angle')}>
    <button type="button" aria-pressed={model.foldAngleDeg === 0} onclick={() => (userAngle = 0)}>{t('sheet.monge.flat')}</button>
    <button type="button" aria-pressed={model.foldAngleDeg === 40} onclick={() => (userAngle = 40)}>{t('sheet.monge.fold')}</button>
    <button type="button" aria-pressed={model.foldAngleDeg === 90} onclick={() => (userAngle = 90)}>{t('sheet.monge.prism')}</button>
  </div>

  <svg
    class="monge-svg"
    role="img"
    aria-label={t('sheet.monge.diagram_label', { angle: String(model.foldAngleDeg) })}
    viewBox={`${model.viewBox.minX} ${model.viewBox.minY} ${model.viewBox.width} ${model.viewBox.height}`}
    {...{
      [M.sheet]: 'monge-fold',
      [M.projection]: model.projection,
      [M.fold_angle]: String(model.foldAngleDeg)
    }}
  >
    <defs>
      <pattern id="monge-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-hatch)" stroke-width="1" />
      </pattern>
    </defs>

    {#each model.planes as plane (plane.id)}
      <g>
        <polygon
          points={plane.points}
          fill="var(--c-paper-tint)"
          stroke="var(--c-rule-strong)"
          stroke-width="1.2"
        />
        <text x={fx(plane.labelPos)} y={fy(plane.labelPos)} fill="var(--c-ink-soft)" font-size="10">
          {plane.label}
        </text>
      </g>
    {/each}

    {#each model.services as svc (svc.id)}
      <g>
        <polyline
          points={polyline(svc.rayToPlane2)}
          fill="none"
          stroke="var(--c-proof)"
          stroke-width="1.1"
          stroke-dasharray="4 3"
        />
        <polyline
          points={polyline(svc.rayToPlane3)}
          fill="none"
          stroke="var(--c-proof)"
          stroke-width="1.1"
          stroke-dasharray="4 3"
        />
      </g>
    {/each}

    {#each model.driftArcs as arc (arc.id)}
      <g
        {...{
          [M.key]: arc.id,
          [M.sign]: 'drift',
          [M.stated_proof_ref]: arc.statedProofRef,
          [M.observed_proof_ref]: arc.observedProofRef,
          [M.proof_ref]: arc.proofRef ?? undefined
        }}
      >
        <!-- Unified convention with Sheet 02: stated = dashed (6 3), observed = solid -->
        <path
          d={arc.statedPath}
          fill="none"
          stroke="var(--c-proof)"
          stroke-width="2"
          stroke-dasharray="6 3"
          {...{ [M.stated_proof_ref]: arc.statedProofRef }}
        />
        <path
          d={arc.observedPath}
          fill="none"
          stroke="var(--c-violated)"
          stroke-width="2.5"
          {...{ [M.observed_proof_ref]: arc.observedProofRef }}
        />
        <text x={fx(arc.midpoint)} y={fy(arc.midpoint, -8)} fill="var(--c-violated)" font-size="10">
          {arc.label}
        </text>
      </g>
    {/each}

    {#each model.services as svc (svc.id)}
      <g
        {...{
          [M.key]: svc.id,
          [M.sign]: svc.state === 'invalid' ? 'invalid' : svc.sign,
          [M.state]: svc.state,
          [M.reason]: svc.reason ?? undefined,
          [M.proof_ref]: svc.proofRef,
          [M.completeness_ref]: svc.state === 'absent' ? (svc.completenessWitnessRef ?? undefined) : undefined
        }}
      >
        {#if svc.unknownCurtain}
          <polygon
            points={polyline(svc.unknownCurtain)}
            fill="url(#monge-hatch)"
            stroke="var(--c-hatch)"
            stroke-width="1.4"
            {...{ [M.sign]: 'unknown' }}
          />
        {/if}

        <circle
          cx={fx(svc.plane1)}
          cy={fy(svc.plane1)}
          r="9"
          fill={svc.state === 'unknown' ? 'url(#monge-hatch)' : svc.state === 'absent' ? 'none' : 'var(--c-paper-elev)'}
          stroke={svc.state === 'violated' || svc.state === 'invalid' ? 'var(--c-violated)' : svc.state === 'absent' ? 'var(--c-ink-soft)' : 'var(--c-ink)'}
          stroke-width="1.6"
          stroke-dasharray={svc.state === 'absent' || svc.state === 'invalid' ? '3 2' : undefined}
        />
        <text
          x={fx(svc.plane1, 12)}
          y={fy(svc.plane1, 4)}
          fill={svc.state === 'invalid' ? 'var(--c-violated)' : 'var(--c-ink)'}
          font-size="10"
        >
          {svc.state === 'unknown' ? `${glyph('unknown')} ${formatReasonLabel(lang, svc.reason ?? 'incomplete', messages)}` : svc.state === 'invalid' ? `! ${svc.short}` : `${glyph(svc.sign)} ${svc.short}`}
        </text>
      </g>

      {#if svc.rounds.length > 0}
        <g>
          {#each svc.rounds as rm (rm.roundId)}
            <circle
              cx={fx(rm.plane2)}
              cy={fy(rm.plane2)}
              r="4.5"
              fill={roundDotFill(rm.state)}
              stroke={roundDotStroke(rm.state)}
              stroke-width="0.9"
              stroke-dasharray={roundDotDash(rm.state)}
              {...{ [M.sign]: rm.sign, [M.state]: rm.state, [M.proof_ref]: rm.proofRef ?? undefined }}
            >{#if rm.proofRef === null}<title>{t('sheet.common.no_proof')}</title>{/if}</circle>
            <circle
              cx={fx(rm.plane3)}
              cy={fy(rm.plane3)}
              r="4.5"
              fill={roundDotFill(rm.state)}
              stroke={roundDotStroke(rm.state)}
              stroke-width="0.9"
              stroke-dasharray={roundDotDash(rm.state)}
              {...{ [M.sign]: rm.sign, [M.state]: rm.state, [M.proof_ref]: rm.proofRef ?? undefined }}
            >{#if rm.proofRef === null}<title>{t('sheet.common.no_proof')}</title>{/if}</circle>
          {/each}
        </g>
      {/if}
    {/each}
  </svg>

  <table {...{ [M.part]: 'twin' }}>
    <caption>{t('sheet.common.twin')}</caption>
    <thead>
      <tr>
        <th scope="col">{t('col.entity')}</th>
        <th scope="col">{t('col.sign')}</th>
        <th scope="col">{t('col.state')}</th>
        <th scope="col">{t('col.proof')}</th>
      </tr>
    </thead>
    <tbody>
      {#each model.services as svc (svc.id)}
        <tr {...{ [M.key]: svc.id, [M.state]: svc.state === 'invalid' ? undefined : svc.state, [M.proof_ref]: svc.proofRef }}>
          <td>{svc.label}</td>
          <td>{formatSignLabel(lang, svc.sign, messages)}</td>
          <td
            {...{
              [M.part]: 'value',
              [M.state]: svc.state,
              [M.reason]: svc.reason ?? undefined,
              [M.proof_ref]: svc.proofRef,
              [M.completeness_ref]: svc.state === 'absent' ? (svc.completenessWitnessRef ?? undefined) : undefined
            }}
          >
            {#if svc.state === 'unknown'}
              {glyph('unknown')} {formatReasonLabel(lang, svc.reason ?? 'incomplete', messages)}
            {:else if svc.state === 'absent'}
              {glyph('absent')} {formatStateLabel(lang, 'absent', messages)}
            {:else if svc.state === 'invalid'}
              <span {...{ [M.sign]: 'invalid' }}>! {formatStateLabel(lang, 'invalid', messages)}{#if svc.reason} · {formatReasonLabel(lang, svc.reason, messages)}{/if}</span>
            {:else}
              {formatStateLabel(lang, svc.state, messages)}
            {/if}
          </td>
          <td>{svc.proofRef}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <table {...{ [M.part]: 'legend' }}>
    <caption>{t('sheet.common.legend')}</caption>
    <thead>
      <tr>
        <th scope="col">{t('col.glyph')}</th>
        <th scope="col">{t('col.sign')}</th>
        <th scope="col">{t('col.kind')}</th>
        <th scope="col">{t('col.pattern')}</th>
      </tr>
    </thead>
    <tbody>
      {#each model.usedSigns as signName (signName)}
        {@const spec = signSpec(signName)}
        <tr {...{ [M.sign]: signName }}>
          <td><span aria-hidden="true">{spec.glyph}</span></td>
          <td>{formatSignLabel(lang, signName, messages)}</td>
          <td>{spec.kind}</td>
          <td>{spec.pattern}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .monge-sheet { font-family: var(--font-sans); }
  [data-part="manifest-hash"], code { font-family: var(--font-mono); }
</style>
