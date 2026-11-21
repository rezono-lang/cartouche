<script lang="ts">
  import { DATA_MARKS, SIGNS, STD_VERBS } from '../../reader-core/src/index.ts';

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

  // Structural lane keys (contract lane enum, minus the separate unknown band).
  const BOARD_LANES = ['needed', 'waiting', 'ready', 'done', 'stuck', 'absent'];
  const M = DATA_MARKS;

  let live = $derived(fixture.live_provisional_delta ?? null);
  let tier = $derived(live ? live.trust_tier : fixture.manifest.trust_tier);
  let sealedOk = $derived(tier === 'sealed' && fixture.manifest.witness_check === 'green');
  let lockReason = $derived(
    sealedOk ? null : tier === 'provisional_engine' ? 'propose_locked_unsealed_live_stream' : 'propose_locked_not_sealed'
  );
  let liveRows = $derived(live ? live.changes.map((c) => c.row) : []);
  let allRows = $derived([...fixture.sealed_rows, ...liveRows]);
  function isUnknown(r: Row): boolean {
    return r.state === 'unknown' || r.lane === 'unknown';
  }
  function signOf(r: Row): string {
    return isUnknown(r) ? 'unknown' : r.state === 'absent' ? 'absent' : r.sign;
  }
  let unknownSealed = $derived(fixture.sealed_rows.filter(isUnknown));
  let unknownLive = $derived(liveRows.filter(isUnknown));
  let drawnSigns = $derived([...new Set(allRows.map(signOf))]);
  function sealedIn(lane: string): Row[] {
    return fixture.sealed_rows.filter((r) => r.lane === lane && !isUnknown(r));
  }
  function liveIn(lane: string): Row[] {
    return liveRows.filter((r) => r.lane === lane && !isUnknown(r));
  }
  function glyph(s: string): string {
    return SIGNS[s]?.glyph ?? SIGNS.derived.glyph;
  }
</script>

{#snippet cardInner(r)}
  <span aria-hidden="true" {...{ [M.sign]: signOf(r) }}>{glyph(signOf(r))}</span> {r.label}
{/snippet}

<section
  aria-labelledby="kring-title"
  {...{ [M.sheet]: 'kringstand', [M.trust_tier]: tier }}
>
  <h2 id="kring-title">Kringstand and round timeline</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: tier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{fixture.manifest.id}</span>
    <span {...{ [M.check]: 'witness', [M.reason]: fixture.manifest.witness_check }}>{fixture.manifest.witness_check}</span>
    <strong>{tier}</strong>
    {#if live}<span data-live-latency-ms={live.latency_ms}> live {live.latency_ms} ms</span>{/if}
  </div>

  <table aria-label="Round chronometer">
    <thead><tr><th scope="col">Round</th><th scope="col">Certificate</th></tr></thead>
    <tbody>
      {#each fixture.rounds as r}
        <tr {...{ [M.key]: r.id, [M.layer]: r.sealed ? 'sealed' : 'provisional', [M.proof_ref]: r.cert_hash }}>
          <th scope="row">{r.id}</th><td>{r.cert_hash}</td>
        </tr>
      {/each}
      {#if live}
        <!-- A live round has no certificate; its proof is the first stream change. -->
        <tr {...{ [M.key]: live.round_id, [M.layer]: 'provisional', [M.trust_tier]: live.trust_tier, [M.proof_ref]: liveRows[0]?.proof_ref ?? live.round_id }}>
          <th scope="row">{live.round_id}</th><td>{live.trust_tier}</td>
        </tr>
      {/if}
    </tbody>
  </table>

  <table aria-label="Board lanes">
    <thead><tr><th scope="col">Lane</th><th scope="col">Items</th></tr></thead>
    <tbody>
      {#each BOARD_LANES as lane}
        <tr {...{ [M.key]: lane }}>
          <th scope="row">{lane}</th>
          <td>
            <div {...{ [M.layer]: 'sealed' }}>
              {#each sealedIn(lane) as r}
                <div {...{ [M.state]: r.state, [M.reason]: r.reason, [M.proof_ref]: r.proof_ref, [M.completeness_ref]: r.completeness_witness_ref }}>
                  {@render cardInner(r)}
                </div>
              {/each}
            </div>
            <div {...{ [M.layer]: 'provisional', [M.trust_tier]: tier }}>
              {#each liveIn(lane) as r}
                <div {...{ [M.state]: r.state, [M.reason]: r.reason, [M.proof_ref]: r.proof_ref, [M.completeness_ref]: r.completeness_witness_ref }}>
                  {@render cardInner(r)}
                </div>
              {/each}
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="hatched" aria-label="unknown" role="group" {...{ [M.part]: 'unknown-band' }}>
    <div {...{ [M.layer]: 'sealed' }}>
      {#each unknownSealed as r}
        <div {...{ [M.state]: 'unknown', [M.reason]: r.reason ?? 'unspecified', [M.proof_ref]: r.proof_ref }}>
          <span aria-hidden="true" {...{ [M.sign]: 'unknown' }}>{glyph('unknown')}</span> <span>{r.reason ?? ''}</span>
        </div>
      {/each}
    </div>
    <div {...{ [M.layer]: 'provisional', [M.trust_tier]: tier }}>
      {#each unknownLive as r}
        <div {...{ [M.state]: 'unknown', [M.reason]: r.reason ?? 'unspecified', [M.proof_ref]: r.proof_ref }}>
          <span aria-hidden="true" {...{ [M.sign]: 'unknown' }}>{glyph('unknown')}</span> <span>{r.reason ?? ''}</span>
        </div>
      {/each}
    </div>
  </div>

  <form aria-label="Proof drawer" onsubmit={(e) => e.preventDefault()}>
    {#each STD_VERBS as v}
      {#if v.verb === 'propose'}
        <button
          type="button"
          disabled={!sealedOk}
          {...{ [M.verb]: v.verb, [M.key]: v.key }}
          data-lock-reason={lockReason}
        >[{v.key.toUpperCase()}] Propose</button>
      {:else}
        <button type="button" {...{ [M.verb]: v.verb, [M.key]: v.key }}>[{v.key.toUpperCase()}] {v.verb}</button>
      {/if}
    {/each}
    <button type="submit" disabled={!sealedOk} data-lock-reason={lockReason}>Approve</button>
  </form>

  <table {...{ [M.part]: 'legend' }}>
    <caption>Legend</caption>
    <thead><tr><th scope="col">Sign</th><th scope="col">Meaning</th></tr></thead>
    <tbody>
      {#each drawnSigns as s}
        <tr {...{ [M.sign]: s }}><th scope="row"><span aria-hidden="true">{glyph(s)}</span></th><td>{s}</td></tr>
      {/each}
    </tbody>
  </table>

  <table {...{ [M.part]: 'twin' }}>
    <caption>Kringstand table twin</caption>
    <thead><tr><th scope="col">Item</th><th scope="col">Lane</th><th scope="col">State</th><th scope="col">Tier</th></tr></thead>
    <tbody>
      {#each fixture.sealed_rows as r}
        <tr {...{ [M.key]: r.key, [M.layer]: 'sealed' }}>
          <th scope="row">{r.label}</th><td>{r.lane}</td><td>{r.state}</td><td>sealed</td>
        </tr>
      {/each}
      {#each liveRows as r}
        <tr {...{ [M.key]: r.key, [M.layer]: 'provisional' }}>
          <th scope="row">{r.label}</th><td>{r.lane}</td><td>{r.state}</td><td>{tier}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .hatched { background: repeating-linear-gradient(45deg, transparent 0 4px, currentColor 4px 5px); }
</style>