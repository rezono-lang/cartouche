<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';
  import { validateSweepStops } from './slip-sweep.ts';
  import type { SweepStopInput } from './slip-sweep.ts';

  // The control of one sweep, inside the line of the cell it moves (Rezono's marks, Decision 0010): one stop per
  // published grid value and nothing in between. A red stop shows its checks and no value.
  let {
    stops,
    name = null,
    note = null,
    activeIndex = null,
    onSelect
  }: {
    stops: readonly SweepStopInput[];
    name?: string | null;
    note?: string | null;
    activeIndex?: number | null;
    onSelect?: (index: number) => void;
  } = $props();

  const M = DATA_MARKS;
  let valid = $derived(validateSweepStops(stops));
</script>

{#if valid.length > 0}
  <div class="slip-sweep" role="group" aria-label={name ? `Sweep ${name}: published stops` : 'Sweep stops'}>
    {#if note}<span class="slip-sweep-note">{note}</span>{/if}
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
  </div>
{/if}
