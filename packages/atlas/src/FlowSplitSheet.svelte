<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';
  import type { PaletteName } from '../../reader-core/src/index.ts';
  import { buildFlowSplitModel, renderFlowSplitSvg } from './flow-split-svg.ts';
  import type { FlowSplitFixtureInput } from './flow-split-svg.ts';

  interface Props {
    fixture: FlowSplitFixtureInput;
    theme?: PaletteName;
    curtainSplit?: number;
    title?: string;
  }

  let {
    fixture,
    theme = 'swisstopo',
    curtainSplit = 50,
    title = 'Flow & Reality-Split Curtain'
  }: Props = $props();

  let model = $derived(buildFlowSplitModel(fixture, { theme, curtainSplit }));
  let svgMarkup = $derived(renderFlowSplitSvg(model, `${title} — stated parallel observed flow diagram`));
</script>

<section
  data-sheet="flow-split"
  data-projection="2d"
  data-cartouche-theme={model.theme}
  data-trust-tier={model.scene.seal.trustTier}
  aria-labelledby="flow-split-title"
>
  <header>
    <h1 id="flow-split-title">{title}</h1>
    <p>stated ∥ observed</p>

    {#if !model.scene.horizon.complete}
      <div
        data-part="horizon"
        data-status="warning"
        data-reason={model.scene.horizon.reason ?? 'not_read_in_full'}
      >
        incomplete: {model.scene.horizon.reason ?? 'not_read_in_full'}
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
      <caption>Entities projected across stated and observed layers</caption>
      <thead>
        <tr>
          <th scope="col">Entity</th>
          <th scope="col">Zone</th>
          <th scope="col">Layer</th>
          <th scope="col">Sign</th>
          <th scope="col">State</th>
          <th scope="col">Proof</th>
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
              {:else if n.state === 'invalid'}
                <span data-sign="invalid" data-reason={n.reason ?? undefined}>
                  ! invalid{#if n.reason} · {n.reason}{/if}
                </span>
              {:else}
                {n.stateGlyph} {n.state}
              {/if}
            </td>
            <td>{n.proofRef}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if model.driftEdges.length > 0}
      <table data-part="twin">
        <caption>Reality-split drift edges (stated parallel observed)</caption>
        <thead>
          <tr>
            <th scope="col">Edge</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Label</th>
            <th scope="col">Stated Proof</th>
            <th scope="col">Observed Proof</th>
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
