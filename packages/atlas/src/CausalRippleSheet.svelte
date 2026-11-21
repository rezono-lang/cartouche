<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import type { CausalRippleFixtureInput } from '../../scene-ir/src/compile-causal-ripple.ts';
  import { buildCausalRippleModel, renderCausalRippleSvg } from './ripple-layout.ts';
  import { mountCausalRipplePixi } from './ripple-pixi.ts';

  interface Props {
    fixture: CausalRippleFixtureInput;
    theme?: PaletteName;
    title?: string;
  }

  let {
    fixture,
    theme = 'swisstopo',
    title = 'Causal Ripple & Distance Columns'
  }: Props = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let model = $derived(buildCausalRippleModel(fixture, { theme }));
  let svgMarkup = $derived(renderCausalRippleSvg(model, `${title} — ${model.mode} diagram`));

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
  data-sheet="causal-ripple"
  data-projection="2d"
  data-cartouche-theme={model.theme}
  data-trust-tier={model.scene.seal.trustTier}
  aria-labelledby="causal-ripple-title"
>
  <header>
    <h1 id="causal-ripple-title">{title}</h1>
    <p>{model.mode} · dependents={model.dependentTotal}</p>

    {#if !model.scene.horizon.complete}
      <div
        data-part="horizon"
        data-status="warning"
        data-reason={model.scene.horizon.reason ?? 'incomplete'}
      >
        incomplete: {model.scene.horizon.reason ?? 'incomplete'}
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
      <span>{model.scene.seal.trustTier}</span>
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

  <aside aria-label="Sheet legend">
    <h2>Legend</h2>
    <table data-part="legend">
      <caption>Drawn epistemic signs on this sheet</caption>
      <thead>
        <tr>
          <th scope="col">Sign</th>
          <th scope="col">Glyph</th>
          <th scope="col">Kind</th>
        </tr>
      </thead>
      <tbody>
        {#each model.legendItems as item (item.key)}
          <tr data-sign={item.key}>
            <td>{item.key}</td>
            <td>{item.glyph}</td>
            <td>{item.kind}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </aside>

  <section aria-label="Accessible table twin">
    <h2>Accessible Table Twin</h2>
    <table data-part="twin">
      <caption>Causal ripple nodes with cut-set gates and proof witnesses</caption>
      <thead>
        <tr>
          <th scope="col">Entity</th>
          <th scope="col">Hop</th>
          <th scope="col">Gate</th>
          <th scope="col">Load-Bearing</th>
          <th scope="col">Sign</th>
          <th scope="col">Value</th>
          <th scope="col">Proof</th>
        </tr>
      </thead>
      <tbody>
        {#each model.nodes as n (n.id)}
          <tr
            data-key={n.id}
            data-sign={n.sign}
            data-state={n.state}
            data-gate={n.gate}
            data-load-bearing={n.loadBearing ? 'true' : 'false'}
            data-proof-ref={n.proofRef}
            data-completeness-ref={n.completenessWitnessRef ?? undefined}
          >
            <td>{n.label}</td>
            <td>{n.hop}</td>
            <td>{n.gate}</td>
            <td>{n.loadBearing ? 'true' : 'false'}</td>
            <td>{n.signGlyph} {n.sign}</td>
            <td
              data-part="value"
              data-state={n.state}
              data-reason={n.reason ?? undefined}
              data-completeness-ref={n.completenessWitnessRef ?? undefined}
              data-proof-ref={n.proofRef}
            >
              {#if n.state === 'unknown'}
                <span data-sign="unknown" data-reason={n.reason ?? undefined}>
                  {SIGNS.unknown?.glyph ?? '▨'} unknown · {n.reason}
                </span>
              {:else if n.state === 'absent'}
                <span data-sign="absent">
                  {SIGNS.absent?.glyph ?? '⦸'} absent
                </span>
              {:else if n.previousDisplay && n.display}
                <del>{n.previousDisplay}</del> <ins>{n.display}</ins>
              {:else}
                {n.stateGlyph} {n.display ?? n.state}
              {/if}
            </td>
            <td>{n.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</section>
