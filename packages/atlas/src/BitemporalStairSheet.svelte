<script lang="ts">
  import { DATA_MARKS, PALETTES, SIGNS, paletteCss, signForState } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import type { BitemporalFixtureInput } from '../../scene-ir/src/compile-bitemporal.ts';
  import {
    TILE_HALF_H,
    TILE_HALF_W,
    Z_FULL,
    buildBitemporalModel
  } from './bitemporal-model.ts';
  import type { BitemporalCellModel } from './bitemporal-model.ts';

  interface Props {
    fixture: BitemporalFixtureInput;
    theme?: PaletteName;
    view?: '2d' | 'orthographic';
  }

  let { fixture, theme = 'swisstopo', view = '2d' }: Props = $props();

  const M = DATA_MARKS;
  let current = $state<'2d' | 'orthographic' | null>(null);
  let shown = $derived(current ?? view);
  let resolvedTheme = $derived<PaletteName>(theme in PALETTES ? theme : 'swisstopo');
  let themeCss = $derived(paletteCss(resolvedTheme));
  let model = $derived(buildBitemporalModel(fixture));
  let byId = $derived(new Map(model.cells.map((c) => [c.id, c])));
  let matrix = $derived(
    model.epochs.map((_, row) => model.cells.filter((c) => c.row === row))
  );
  let axisLabel = $derived((axis: string): string => model.scene.axes.find((a) => a.axis === axis)?.label ?? axis);

  function glyph(sign: string): string {
    const spec = SIGNS[signForState(sign)];
    if (!spec) throw new Error('no std-view sign: ' + sign);
    return spec.glyph;
  }
  function cellOf(id: string): BitemporalCellModel {
    const c = byId.get(id);
    if (!c) throw new Error('unknown paint id: ' + id);
    return c;
  }
</script>

<section
  class="bt-sheet"
  aria-labelledby="bt-title"
  {...{
    [M.sheet]: 'bitemporal-stair',
    [M.projection]: shown,
    [M.theme]: resolvedTheme,
    [M.trust_tier]: model.scene.seal.trustTier
  }}
>
  <style>{themeCss}</style>
  <h2 id="bt-title">{axisLabel('x')} × {axisLabel('y')}</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: model.scene.seal.trustTier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{model.scene.seal.manifestId}</span>
    <span {...{ [M.check]: 'witness', [M.status]: model.scene.seal.witnessCheck === 'green' ? 'green' : 'red' }}>
      {model.scene.seal.witnessCheck}
    </span>
    <span>{model.scene.seal.trustTier}</span>
  </div>

  <div role="group" aria-label="Projection">
    <button type="button" aria-pressed={shown === '2d'} onclick={() => (current = '2d')}>2D</button>
    <button type="button" aria-pressed={shown === 'orthographic'} onclick={() => (current = 'orthographic')}>3D</button>
  </div>

  {#if shown === '2d'}
    <table class="bt-matrix" {...{ [M.sheet]: 'bitemporal-stair' }}>
      <caption>{axisLabel('x')} (columns) × {axisLabel('y')} (rows)</caption>
      <thead>
        <tr>
          <th scope="col">{axisLabel('y')}</th>
          {#each model.validTimes as vt}<th scope="col">{vt}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each matrix as line, r}
          <tr>
            <th scope="row">{model.epochs[r]}</th>
            {#each line as c (c.id)}
              <td
                class={c.state === 'not_applicable' ? 'hollow' : c.state === 'unknown' ? 'hatched' : c.state === 'changed' ? 'revised' : 'known'}
                {...{
                  [M.part]: 'value',
                  [M.state]: c.state,
                  [M.reason]: c.reason ?? undefined,
                  [M.proof_ref]: c.proofRef
                }}
              >
                <span class="cartouche-sign" role="img" aria-label={c.sign} {...{ [M.sign]: c.sign }}>
                  <span aria-hidden="true">{glyph(c.sign)}</span>
                </span>
                {#if c.state === 'unknown' || c.state === 'not_applicable'}
                  <span>{c.reason}</span>
                {:else if c.previousDisplay}
                  <del>{c.previousDisplay}</del> <ins>{c.display}</ins>
                {:else}
                  <span>{c.display}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <svg
      class="bt-stair"
      role="img"
      aria-label={`${axisLabel('x')} by ${axisLabel('y')} orthographic staircase, height ${axisLabel('z')}`}
      viewBox={`${model.viewBox.minX} ${model.viewBox.minY} ${model.viewBox.width} ${model.viewBox.height}`}
      {...{ [M.sheet]: 'bitemporal-stair', [M.projection]: 'orthographic' }}
    >
      <defs>
        <pattern id="bt-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-hatch)" stroke-width="2" />
        </pattern>
      </defs>
      {#each model.paintOrder as id (id)}
        {@const c = cellOf(id)}
        <g
          transform={`translate(${c.screenX} ${c.screenY})`}
          {...{
            [M.state]: c.state,
            [M.sign]: c.sign,
            [M.reason]: c.reason ?? undefined,
            [M.proof_ref]: c.proofRef
          }}
        >
          {#if c.zToken === null}
            <path
              class="hollow"
              d={`M0 ${-TILE_HALF_H} L${TILE_HALF_W} 0 L0 ${TILE_HALF_H} L${-TILE_HALF_W} 0 Z`}
              fill="none"
              stroke="var(--c-ink-faint)"
              stroke-dasharray="4 3"
            />
          {:else}
            <g style={`--z: ${c.zToken}`}>
              <g transform={`translate(${-TILE_HALF_W} 0) skewY(26.56505)`}>
                <rect class="zs" x="0" y={-Z_FULL} width={TILE_HALF_W} height={Z_FULL}
                  fill={c.state === 'unknown' ? 'url(#bt-hatch)' : 'var(--c-paper-tint)'} stroke="var(--c-ink)" />
              </g>
              <g transform={`translate(0 ${TILE_HALF_H}) skewY(-26.56505)`}>
                <rect class="zs" x="0" y={-Z_FULL} width={TILE_HALF_W} height={Z_FULL}
                  fill={c.state === 'unknown' ? 'url(#bt-hatch)' : 'var(--c-limestone)'} stroke="var(--c-ink)" />
              </g>
              <g class="zlift">
                <path
                  d={`M0 ${-TILE_HALF_H} L${TILE_HALF_W} 0 L0 ${TILE_HALF_H} L${-TILE_HALF_W} 0 Z`}
                  fill={c.state === 'unknown' ? 'url(#bt-hatch)' : c.state === 'changed' ? 'var(--c-caution)' : 'var(--c-paper-elev)'}
                  stroke="var(--c-ink)"
                  stroke-dasharray={c.state === 'changed' ? '6 2' : undefined}
                />
                <text x="0" y="4" text-anchor="middle" font-size="11" fill="var(--c-ink)">
                  {c.state === 'unknown' ? glyph('unknown') : c.display}
                </text>
              </g>
            </g>
          {/if}
        </g>
      {/each}
    </svg>
  {/if}

  <table class="bt-twin" {...{ [M.part]: 'twin' }}>
    <caption>Table twin</caption>
    <thead>
      <tr>{#each model.scene.tableTwin.headers as h}<th scope="col">{h}</th>{/each}</tr>
    </thead>
    <tbody>
      {#each model.scene.tableTwin.rows as line}
        <tr>
          <th scope="row">{line[0]}</th>
          {#each line.slice(1) as text}<td>{text}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>

  <table {...{ [M.part]: 'legend' }}>
    <caption>Legend</caption>
    <thead><tr><th scope="col">Sign</th><th scope="col">Meaning</th></tr></thead>
    <tbody>
      {#each model.drawnSigns as s}
        <tr {...{ [M.sign]: s }}><th scope="row"><span aria-hidden="true">{glyph(s)}</span></th><td>{s}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .zs { transform: scaleY(var(--z)); }
  .zlift { transform: translateY(calc(var(--z) * -90px)); }
  .hollow { background: transparent; border: 1px dashed currentColor; }
  .hatched { background: repeating-linear-gradient(45deg, transparent 0 4px, var(--c-hatch) 4px 5px); }
</style>