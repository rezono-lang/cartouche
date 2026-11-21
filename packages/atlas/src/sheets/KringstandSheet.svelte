<script lang="ts">
  import { DATA_MARKS, SIGNS, STD_VERBS } from '../../../reader-core/src/index.ts';

  interface Row {
    key: string;
    lane: string;
    label: string;
    sign: string;
    state: string;
    reason?: string;
    proof_ref: string;
    completeness_witness_ref?: string;
  }
  interface Round { id: string; time: string; cert_hash: string; sealed: boolean }
  interface Fixture {
    fixture_id: string;
    manifest: { id: string; epoch: number; witness_check: string; trust_tier: string };
    rounds: Round[];
    sealed_rows: Row[];
    live_provisional_delta?: {
      round_id: string;
      latency_ms: number;
      trust_tier: string;
      changes: { weight: number; row: Row }[];
    } | null;
  }

  let { fixture }: { fixture: Fixture } = $props();

  const BOARD_LANES = ['needed', 'waiting', 'ready', 'done', 'absent'];
  const M = DATA_MARKS;

  let live = $derived(fixture.live_provisional_delta ?? null);
  let tier = $derived(live ? live.trust_tier : fixture.manifest.trust_tier);
  let sealedOk = $derived(tier === 'sealed' && fixture.manifest.witness_check === 'green');
  let lockReason = $derived(
    sealedOk ? null : tier === 'provisional_engine' ? 'propose_locked_unsealed_live_stream' : 'propose_locked_not_sealed'
  );
  let liveRows = $derived(live ? live.changes.map((c) => c.row) : []);
  let unknownRows = $derived(fixture.sealed_rows.filter((r) => r.state === 'unknown'));
  let allRows = $derived([...fixture.sealed_rows, ...liveRows]);
  let drawnSigns = $derived(
    [...new Set([...allRows.map((r) => (r.state === 'unknown' || r.state === 'absent' ? r.state : r.sign))])]
  );
  function laneRows(lane: string): Row[] {
    return fixture.sealed_rows.filter((r) => r.lane === lane && r.state !== 'unknown');
  }
  function liveLane(lane: string): Row[] {
    return liveRows.filter((r) => r.lane === lane);
  }
  function glyph(s: string): string {
    return SIGNS[s]?.glyph ?? SIGNS.derived.glyph;
  }
</script>

<section
  class="kring"
  aria-labelledby="kring-title"
  {...{ [M.sheet]: 'kringstand', [M.trust_tier]: tier }}
>
  <h2 id="kring-title">Kringstand and round timeline</h2>

  <p class="seal" {...{ [M.trust_tier]: tier }} data-witness-check={fixture.manifest.witness_check}>
    Seal: <strong>{tier}</strong>
    {#if live}<span data-live-latency-ms={live.latency_ms}> live {live.latency_ms} ms</span>{/if}
  </p>

  <ol class="chronometer" aria-label="Rounds">
    {#each fixture.rounds as r}
      <li {...{ [M.part]: 'round', [M.key]: r.id, [M.status]: r.sealed ? 'sealed' : 'unsealed', [M.proof_ref]: r.cert_hash }}>
        <span>{r.id}</span> <span>{r.cert_hash}</span>
      </li>
    {/each}
    {#if live}
      <li
        {...{ [M.part]: 'round', [M.key]: live.round_id, [M.status]: 'unsealed', [M.trust_tier]: live.trust_tier, [M.proof_ref]: liveRows[0]?.proof_ref ?? live.round_id }}
      >
        <span>{live.round_id}</span> <span>unsealed</span>
      </li>
    {/if}
  </ol>

  <div class="lanes">
    {#each BOARD_LANES as lane}
      <section class="lane" aria-label={lane} {...{ [M.part]: 'lane', [M.key]: lane }}>
        <h3>{lane}</h3>
        <ul>
          {#each laneRows(lane) as r}
            <li
              {...{ [M.part]: 'card', [M.key]: r.key, [M.sign]: r.state === 'absent' ? 'absent' : r.sign, [M.state]: r.state, [M.reason]: r.reason, [M.proof_ref]: r.proof_ref, [M.completeness_ref]: r.completeness_witness_ref, [M.trust_tier]: 'sealed' }}
            >
              <span aria-hidden="true">{glyph(r.state === 'absent' ? 'absent' : r.sign)}</span> {r.label}
            </li>
          {/each}
          {#each liveLane(lane) as r}
            <li
              class="provisional"
              {...{ [M.part]: 'card', [M.key]: r.key, [M.sign]: r.sign, [M.state]: r.state, [M.proof_ref]: r.proof_ref, [M.trust_tier]: tier }}
            >
              <span aria-hidden="true">{glyph(r.sign)}</span> {r.label}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <section class="unknown-band" aria-label="unknown" {...{ [M.part]: 'unknown-strip' }}>
    <h3>unknown</h3>
    <ul>
      {#each unknownRows as r}
        <li
          class="hatched"
          {...{ [M.part]: 'unknown', [M.key]: r.key, [M.sign]: 'unknown', [M.state]: 'unknown', [M.reason]: r.reason, [M.proof_ref]: r.proof_ref }}
        >
          <span aria-hidden="true">{glyph('unknown')}</span> <span>{r.reason}</span>
        </li>
      {/each}
    </ul>
  </section>

  <div class="slip" aria-label="Proof drawer" {...{ [M.part]: 'slip' }}>
    {#each STD_VERBS as v}
      {#if v.verb === 'propose'}
        <button
          type="button"
          disabled={!sealedOk}
          aria-disabled={!sealedOk}
          {...{ [M.verb]: v.verb, [M.gate]: sealedOk ? 'open' : 'locked' }}
          data-lock-reason={lockReason}
        >[{v.key.toUpperCase()}] Propose</button>
      {:else}
        <button type="button" {...{ [M.verb]: v.verb }}>[{v.key.toUpperCase()}] {v.verb}</button>
      {/if}
    {/each}
    <button type="button" disabled={!sealedOk} aria-disabled={!sealedOk} data-action="approve" {...{ [M.gate]: sealedOk ? 'open' : 'locked' }} data-lock-reason={lockReason}>Approve</button>
  </div>

  <ul class="legend" aria-label="Legend">
    {#each drawnSigns as s}
      <li {...{ [M.sign]: s }}><span aria-hidden="true">{glyph(s)}</span> {s}</li>
    {/each}
  </ul>

  <table class="twin" {...{ [M.part]: 'table-twin' }}>
    <caption>Kringstand table twin</caption>
    <thead><tr><th scope="col">Item</th><th scope="col">Lane</th><th scope="col">State</th><th scope="col">Tier</th></tr></thead>
    <tbody>
      {#each fixture.sealed_rows as r}
        <tr {...{ [M.key]: r.key }}>
          <th scope="row">{r.label}</th><td>{r.lane}</td><td>{r.state}</td><td>sealed</td>
        </tr>
      {/each}
      {#each liveRows as r}
        <tr {...{ [M.key]: r.key }}>
          <th scope="row">{r.label}</th><td>{r.lane}</td><td>{r.state}</td><td>{tier}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .hatched { background: repeating-linear-gradient(45deg, transparent 0 4px, currentColor 4px 5px); }
  .provisional { border-style: dashed; }
  .lanes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
</style>
