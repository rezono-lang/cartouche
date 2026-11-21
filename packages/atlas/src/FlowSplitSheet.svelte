<script lang="ts">
  import { SIGNS } from '../../reader-core/src/index.ts';
  import type { PaletteName, PaletteTokens } from '../../reader-core/src/index.ts';
  import { buildFlowSplitModel, edgePathFor } from './flow-split-svg.ts';
  import type { FlowNodeState, FlowSplitFixtureInput } from './flow-split-svg.ts';

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

  function nodeStroke(state: FlowNodeState, palette: PaletteTokens): string {
    if (state === 'violated') return palette.violated;
    if (state === 'changed') return palette.caution;
    if (state === 'valid') return palette.valid;
    if (state === 'unknown') return palette.hatchStroke;
    return palette.inkSoft;
  }
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
    <svg
      role="img"
      aria-label={`${title} — stated parallel observed flow diagram`}
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={model.width}
      height={model.height}
      data-sheet="flow-split"
      data-projection="2d"
      data-trust-tier={model.scene.seal.trustTier}
    >
      <defs>
        <pattern
          id="cartouche-hatch-45"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke={model.palette.hatchStroke} stroke-width="2" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={model.width} height={model.height} fill={model.palette.paper} />

      <g data-part="curtain">
        <g data-layer="stated">
          <rect
            x="0"
            y="56"
            width={model.curtainX}
            height={model.height - 120}
            fill={model.palette.paperTint}
            opacity="0.45"
          />
        </g>
        <g data-layer="observed">
          <rect
            x={model.curtainX}
            y="56"
            width={model.width - model.curtainX}
            height={model.height - 120}
            fill={model.palette.paper}
            opacity="0.45"
          />
        </g>
        <line
          x1={model.curtainX}
          y1="56"
          x2={model.curtainX}
          y2={model.height - 64}
          stroke={model.palette.proof}
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
      </g>

      <g>
        {#each model.zones as z (z.name)}
          <g data-key={z.name}>
            <rect
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx="4"
              fill={model.palette.paperElev}
              stroke={model.palette.rule}
              stroke-width="1"
            />
            <text x={z.x + 12} y={z.y + 19} fill={model.palette.inkSoft} font-size="11" font-weight="600">
              {z.name}
            </text>
          </g>
        {/each}
      </g>

      <g>
        {#each model.edges as e (e.id)}
          {#if e.kind === 'drift'}
            <g
              data-key={e.id}
              data-relation="drift"
              data-sign="drift"
              data-state="violated"
              data-layer="both"
              data-proof-ref={e.statedProofRef ?? ''}
              data-stated-proof-ref={e.statedProofRef ?? ''}
              data-observed-proof-ref={e.observedProofRef ?? ''}
            >
              <g
                data-layer="stated"
                data-proof-ref={e.statedProofRef ?? ''}
                data-stated-proof-ref={e.statedProofRef ?? ''}
              >
                <path
                  d={edgePathFor(e, -5)}
                  fill="none"
                  stroke={model.palette.proof}
                  stroke-width="2"
                  stroke-dasharray="6 3"
                  data-proof-ref={e.statedProofRef ?? ''}
                  data-stated-proof-ref={e.statedProofRef ?? ''}
                />
              </g>
              <g
                data-layer="observed"
                data-proof-ref={e.observedProofRef ?? ''}
                data-observed-proof-ref={e.observedProofRef ?? ''}
              >
                <path
                  d={edgePathFor(e, 5)}
                  fill="none"
                  stroke={model.palette.violated}
                  stroke-width="2.5"
                  data-proof-ref={e.observedProofRef ?? ''}
                  data-observed-proof-ref={e.observedProofRef ?? ''}
                />
              </g>
              <rect
                x={e.midX - 46}
                y={e.midY - 12}
                width="92"
                height="24"
                rx="3"
                fill={model.palette.paperElev}
                stroke={model.palette.violated}
                stroke-width="1.5"
              />
              <text
                x={e.midX}
                y={e.midY + 4}
                text-anchor="middle"
                fill={model.palette.violated}
                font-size="10"
                font-weight="700"
              >
                {SIGNS.drift.glyph} {e.label}
              </text>
            </g>
          {:else if e.kind === 'absent'}
            <g
              data-key={e.id}
              data-relation="absent"
              data-sign="absent"
              data-state="absent"
              data-layer={e.layer}
              data-proof-ref={e.proofRef}
              data-completeness-ref={e.completenessWitnessRef ?? undefined}
            >
              <path
                d={edgePathFor(e, 0)}
                fill="none"
                stroke={model.palette.inkSoft}
                stroke-width="1.5"
                stroke-dasharray="5 5"
              />
              <text x={e.midX} y={e.midY - 4} text-anchor="middle" fill={model.palette.inkSoft} font-size="11">
                {SIGNS.absent.glyph}
              </text>
            </g>
          {:else}
            <g data-key={e.id} data-relation="standard" data-layer={e.layer} data-proof-ref={e.proofRef}>
              <path
                d={edgePathFor(e, 0)}
                fill="none"
                stroke={model.palette.ruleStrong}
                stroke-width="1.5"
              />
            </g>
          {/if}
        {/each}
      </g>

      <g>
        {#each model.nodes as n (n.id)}
          <g
            data-key={n.id}
            data-sign={n.sign}
            data-state={n.state}
            data-layer={n.layer}
            data-proof-ref={n.proofRef}
            data-completeness-ref={n.completenessWitnessRef ?? undefined}
            data-reason={n.reason ?? undefined}
          >
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              rx="4"
              fill={model.palette.paper}
              stroke={nodeStroke(n.state, model.palette)}
              stroke-width="1.5"
              stroke-dasharray={n.state === 'absent' ? '5 4' : undefined}
            />
            {#if n.state === 'unknown'}
              <rect
                x={n.x + 2}
                y={n.y + 42}
                width={n.w - 4}
                height={n.h - 44}
                rx="2"
                fill="url(#cartouche-hatch-45)"
              />
              <g
                data-sign="unknown"
                data-state="unknown"
                data-proof-ref={n.proofRef}
                data-reason={n.reason ?? undefined}
              >
                <text x={n.x + 10} y={n.y + 62} fill={model.palette.ink} font-size="10">
                  {SIGNS.unknown.glyph} unknown{#if n.reason} · {n.reason}{/if}
                </text>
              </g>
            {:else if n.state === 'absent'}
              <g
                data-sign="absent"
                data-state="absent"
                data-proof-ref={n.proofRef}
                data-completeness-ref={n.completenessWitnessRef ?? undefined}
              >
                <text x={n.x + 10} y={n.y + 56} fill={model.palette.inkSoft} font-size="10">
                  {SIGNS.absent.glyph} absent
                </text>
              </g>
            {:else}
              <text x={n.x + 10} y={n.y + 56} fill={nodeStroke(n.state, model.palette)} font-size="10">
                {n.stateGlyph} {n.state}
              </text>
            {/if}
            <text x={n.x + 10} y={n.y + 24} fill={model.palette.ink} font-size="12" font-weight="600">
              {n.signGlyph} {n.label}
            </text>
          </g>
        {/each}
      </g>
    </svg>
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
            data-state={n.state}
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
                  {SIGNS.unknown.glyph} unknown{#if n.reason} · {n.reason}{/if}
                </span>
              {:else if n.state === 'absent'}
                <span data-sign="absent">
                  {SIGNS.absent.glyph} absent
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
              data-proof-ref={e.statedProofRef ?? ''}
              data-stated-proof-ref={e.statedProofRef ?? ''}
              data-observed-proof-ref={e.observedProofRef ?? ''}
            >
              <td>{e.id}</td>
              <td>{e.from}</td>
              <td>{e.to}</td>
              <td>{SIGNS.drift.glyph} {e.label}</td>
              <td>{e.statedProofRef ?? ''}</td>
              <td>{e.observedProofRef ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</section>
