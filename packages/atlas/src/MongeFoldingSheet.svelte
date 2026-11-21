<script lang="ts">
  import { DATA_MARKS, PALETTES, SIGNS, paletteCss } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import { buildMongeFoldingModel } from './monge-model.ts';
  import type { MongeFixtureInput, Point2D } from './monge-model.ts';

  interface Props {
    fixture: MongeFixtureInput;
    theme?: PaletteName;
    foldAngleDeg?: number;
  }

  let { fixture, theme = 'swisstopo', foldAngleDeg }: Props = $props();

  const M = DATA_MARKS;
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
</script>

<section
  class="monge-sheet"
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
  <h2 id="monge-title">Orthographic Folding Atlas ({model.foldAngleDeg}°)</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: model.scene.seal.trustTier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{model.scene.seal.manifestId}</span>
    <span {...{ [M.check]: 'witness', [M.status]: model.scene.seal.witnessCheck === 'green' ? 'green' : 'red' }}>
      {model.scene.seal.witnessCheck}
    </span>
    <span>{model.scene.seal.trustTier}</span>
  </div>

  <div role="group" aria-label="Fold angle">
    <button type="button" aria-pressed={model.foldAngleDeg === 0} onclick={() => (userAngle = 0)}>0° Flat</button>
    <button type="button" aria-pressed={model.foldAngleDeg === 40} onclick={() => (userAngle = 40)}>40° Fold</button>
    <button type="button" aria-pressed={model.foldAngleDeg === 90} onclick={() => (userAngle = 90)}>90° Prism</button>
  </div>

  <svg
    class="monge-svg"
    role="img"
    aria-label={`Orthographic folding sheet at ${model.foldAngleDeg} degrees`}
    viewBox={`${model.viewBox.minX} ${model.viewBox.minY} ${model.viewBox.width} ${model.viewBox.height}`}
    {...{
      [M.sheet]: 'monge-fold',
      [M.projection]: model.projection,
      [M.fold_angle]: String(model.foldAngleDeg)
    }}
  >
    <defs>
      <pattern id="monge-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-hatch)" stroke-width="2" />
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
      <g {...{ [M.key]: svc.id, [M.proof_ref]: svc.proofRef }}>
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
          [M.proof_ref]: arc.statedProofRef
        }}
      >
        <path d={arc.statedPath} fill="none" stroke="var(--c-proof)" stroke-width="2" />
        <path d={arc.observedPath} fill="none" stroke="var(--c-violated)" stroke-width="2" stroke-dasharray="5 3" />
        <text x={fx(arc.midpoint)} y={fy(arc.midpoint, -8)} fill="var(--c-violated)" font-size="10">
          {arc.label}
        </text>
      </g>
    {/each}

    {#each model.services as svc (svc.id)}
      <g
        {...{
          [M.key]: svc.id,
          [M.sign]: svc.sign,
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
            {...{ [M.sign]: 'unknown', [M.proof_ref]: svc.proofRef }}
          />
        {/if}

        <circle
          cx={fx(svc.plane1)}
          cy={fy(svc.plane1)}
          r="9"
          fill={svc.state === 'unknown' ? 'url(#monge-hatch)' : 'var(--c-paper-elev)'}
          stroke={svc.state === 'violated' ? 'var(--c-violated)' : svc.state === 'absent' ? 'var(--c-ink-soft)' : 'var(--c-ink)'}
          stroke-width="1.6"
          stroke-dasharray={svc.state === 'absent' ? '3 2' : undefined}
        />
        <text
          x={fx(svc.plane1, 12)}
          y={fy(svc.plane1, 4)}
          fill="var(--c-ink)"
          font-size="10"
        >
          {svc.state === 'unknown' ? `${glyph('unknown')} ${svc.reason}` : `${glyph(svc.sign)} ${svc.short}`}
        </text>

        {#each svc.rounds as rm (rm.roundId)}
          <circle
            cx={fx(rm.plane2)}
            cy={fy(rm.plane2)}
            r="4.5"
            fill={rm.state === 'unknown' ? 'url(#monge-hatch)' : rm.state === 'violated' ? 'var(--c-violated)' : 'var(--c-valid)'}
            stroke="var(--c-ink)"
            stroke-width="0.9"
            {...{ [M.sign]: rm.state, [M.proof_ref]: svc.proofRef }}
          />
          <circle
            cx={fx(rm.plane3)}
            cy={fy(rm.plane3)}
            r="4.5"
            fill={rm.state === 'unknown' ? 'url(#monge-hatch)' : rm.state === 'violated' ? 'var(--c-violated)' : 'var(--c-valid)'}
            stroke="var(--c-ink)"
            stroke-width="0.9"
            {...{ [M.sign]: rm.state, [M.proof_ref]: svc.proofRef }}
          />
        {/each}
      </g>
    {/each}
  </svg>

  <table {...{ [M.part]: 'twin' }}>
    <caption>Accessible Table Twin</caption>
    <thead>
      <tr>
        <th scope="col">Entity</th>
        <th scope="col">Sign</th>
        <th scope="col">State</th>
        <th scope="col">Proof</th>
      </tr>
    </thead>
    <tbody>
      {#each model.services as svc (svc.id)}
        <tr {...{ [M.key]: svc.id, [M.state]: svc.state, [M.proof_ref]: svc.proofRef }}>
          <td>{svc.label}</td>
          <td>{svc.sign}</td>
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
              {glyph('unknown')} {svc.reason}
            {:else if svc.state === 'absent'}
              {glyph('absent')} absent
            {:else}
              {svc.state}
            {/if}
          </td>
          <td>{svc.proofRef}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <table {...{ [M.part]: 'legend' }}>
    <caption>Sign Legend</caption>
    <thead>
      <tr>
        <th scope="col">Glyph</th>
        <th scope="col">Sign</th>
        <th scope="col">Kind</th>
        <th scope="col">Pattern</th>
      </tr>
    </thead>
    <tbody>
      {#each model.usedSigns as signName (signName)}
        {@const spec = signSpec(signName)}
        <tr {...{ [M.sign]: signName }}>
          <td><span aria-hidden="true">{spec.glyph}</span></td>
          <td>{signName}</td>
          <td>{spec.kind}</td>
          <td>{spec.pattern}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
