<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import { validateSweepStops } from './slip-sweep.ts';
  import type { SweepStopInput } from './slip-sweep.ts';

  let {
    stops,
    activeIndex = null,
    onSelect
  }: {
    stops: readonly SweepStopInput[];
    activeIndex?: number | null;
    onSelect?: (index: number) => void;
  } = $props();

  const M = DATA_MARKS;
  let valid = $derived(validateSweepStops(stops));
</script>

{#if valid.length > 0}
  <section class="slip-sweep" aria-label="Sweep stops">
    <h2>Sweep Stops</h2>
    <div class="slip-sweep-strip">
      {#each valid as stop (stop.index)}
        <button
          type="button"
          {...{
            [M.stop]: String(stop.index),
            [M.status]: stop.status,
            [M.turn]: stop.turn ?? undefined
          }}
          aria-pressed={activeIndex === stop.index}
          onclick={() => onSelect?.(stop.index)}
        >
          {#if stop.status === 'red'}
            {#each stop.checks ?? [] as chk (chk.id)}
              <span {...{ [M.check]: chk.id, [M.status]: chk.status }}>{chk.id}</span>
            {/each}
          {:else}
            <span>{stop.display}</span>
          {/if}
        </button>
      {/each}
    </div>
  </section>
{/if}