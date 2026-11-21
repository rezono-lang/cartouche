<script lang="ts">
  import { DATA_MARKS, DeltaStore, SIGNS, STD_VERBS } from '../../reader-core/src/index.ts';
  import type { ManifestMeta, TrustTier, ZSetChange } from '../../reader-core/src/index.ts';

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
    manifest: {
      id: string;
      epoch: number;
      knowledge_time?: string;
      role?: string;
      witness_check: string;
      trust_tier: string;
    };
    rounds: Round[];
    sealed_rows: Row[];
    live_provisional_delta?: {
      round_id: string;
      latency_ms: number;
      trust_tier: 'provisional_checked' | 'provisional_engine';
      cert_hash?: string | null;
      proof_ref?: string | null;
      changes: { weight: 1 | -1; row: Row }[];
    } | null;
  }

  let { fixture }: { fixture: Fixture } = $props();

  // Structural lane keys (contract lane enum, minus the separate unknown band).
  const BOARD_LANES = ['needed', 'waiting', 'ready', 'done', 'stuck', 'absent'];
  const M = DATA_MARKS;

  let live = $derived(fixture.live_provisional_delta ?? null);

  let storeState = $derived.by(() => {
    const manifestMeta: ManifestMeta = {
      id: fixture.manifest.id,
      epoch: fixture.manifest.epoch,
      knowledge_time: fixture.manifest.knowledge_time ?? '',
      role: fixture.manifest.role ?? '',
      witness_check: fixture.manifest.witness_check === 'green' ? 'green' : 'failed',
      trust_tier: fixture.manifest.trust_tier as TrustTier
    };
    const store = new DeltaStore<Row>(manifestMeta, fixture.sealed_rows);
    if (live) {
      store.applyProvisionalStep(live.trust_tier, live.changes as readonly ZSetChange<Row>[]);
    }
    return { entries: store.rows(), seal: store.seal() };
  });

  let entries = $derived(storeState.entries);
  let tier = $derived(live ? live.trust_tier : storeState.seal.trustTier);
  let sealedOk = $derived(tier === 'sealed' && fixture.manifest.witness_check === 'green');
  let lockReason = $derived(
    sealedOk ? null : tier === 'provisional_engine' ? 'propose_locked_unsealed_live_stream' : 'propose_locked_not_sealed'
  );
  let liveProofRef = $derived(live?.cert_hash ?? live?.proof_ref ?? undefined);

  function isUnknown(r: Row): boolean {
    return r.state === 'unknown' || r.lane === 'unknown';
  }
  function signOf(r: Row): string {
    if (isUnknown(r)) return 'unknown';
    if (r.state === 'absent') return 'absent';
    if (r.state === 'invalid') return 'violated';
    return r.sign;
  }
  function rowReason(r: Row): string | undefined {
    if (r.state === 'invalid') {
      if (!r.reason || r.reason.trim().length === 0) {
        throw new Error('invalid row without published reason: ' + r.key);
      }
      return r.reason;
    }
    return r.reason;
  }
  let unknownEntries = $derived(entries.filter((e) => isUnknown(e.row)));
  let drawnSigns = $derived([...new Set(entries.map((e) => signOf(e.row)))]);
  function laneEntries(lane: string, layer: 'sealed' | 'provisional') {
    return entries.filter((e) => e.layer === layer && e.row.lane === lane && !isUnknown(e.row));
  }
  function unknownReason(r: Row): string {
    if (!r.reason || r.reason.trim().length === 0) throw new Error('unknown row without published reason: ' + r.key);
    return r.reason;
  }
  function glyph(s: string): string {
    if (!Object.prototype.hasOwnProperty.call(SIGNS, s)) {
      throw new Error('no std-view sign: ' + s);
    }
    return SIGNS[s]!.glyph;
  }
</script>

{#snippet itemRow(r, layer)}
  <tr {...{ [M.key]: r.key, [M.relation]: r.lane, [M.layer]: layer }}>
    <td {...{ [M.state]: r.state, [M.reason]: rowReason(r), [M.proof_ref]: r.proof_ref, [M.completeness_ref]: r.completeness_witness_ref }}>
      <div {...{ [M.trust_tier]: layer === 'sealed' ? 'sealed' : tier }}>
        <span aria-hidden="true" {...{ [M.sign]: signOf(r) }}>{glyph(signOf(r))}</span>{#if r.state === 'invalid'} <span aria-hidden="true">!</span>{/if} {r.label}{#if r.state === 'invalid'} <span>({rowReason(r)})</span>{/if}
      </div>
    </td>
  </tr>
{/snippet}

{#snippet unknownRow(r, layer)}
  <tr {...{ [M.key]: r.key, [M.layer]: layer }}>
    <td {...{ [M.state]: 'unknown', [M.reason]: unknownReason(r), [M.proof_ref]: r.proof_ref }}>
      <div {...{ [M.trust_tier]: layer === 'sealed' ? 'sealed' : tier }}>
        <span aria-hidden="true" {...{ [M.sign]: 'unknown' }}>{glyph('unknown')}</span> <span>{r.reason}</span>
      </div>
    </td>
  </tr>
{/snippet}

<section
  aria-labelledby="kring-title"
  {...{ [M.sheet]: 'kringstand', [M.trust_tier]: tier }}
>
  <h2 id="kring-title">Kringstand and round timeline</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: tier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{fixture.manifest.id}</span>
    <span {...{ [M.check]: 'witness', [M.status]: fixture.manifest.witness_check }}>{fixture.manifest.witness_check}</span>
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
        <!-- A live round carries only its own published certificate/proof, never a borrowed change ref. -->
        <tr {...{ [M.key]: live.round_id, [M.layer]: 'provisional', ...(liveProofRef ? { [M.proof_ref]: liveProofRef } : {}) }}>
          <th scope="row">{live.round_id}</th>
          <td>
            <div {...{ [M.trust_tier]: live.trust_tier }}>
              {live.trust_tier}{#if liveProofRef} · {liveProofRef}{:else} · no proof{/if}
            </div>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>

  <table aria-label="Board lanes">
    <thead><tr><th scope="col">Lane</th></tr></thead>
    {#each BOARD_LANES as lane}
      <tbody>
        <tr {...{ [M.key]: lane }}><th scope="rowgroup">{lane}</th></tr>
        {#each laneEntries(lane, 'sealed') as e (e.row.key)}{@render itemRow(e.row, 'sealed')}{/each}
        {#each laneEntries(lane, 'provisional') as e (e.row.key)}{@render itemRow(e.row, 'provisional')}{/each}
      </tbody>
    {/each}
  </table>

  <div class="hatched" {...{ [M.part]: 'unknown-band' }}>
    <table aria-label="unknown">
      <thead><tr><th scope="col">unknown</th></tr></thead>
      <tbody>
        {#each unknownEntries as e (e.row.key)}{@render unknownRow(e.row, e.layer)}{/each}
      </tbody>
    </table>
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
      {#each entries as e (e.row.key)}
        <tr {...{ [M.key]: e.row.key }}>
          <th scope="row">{e.row.label}</th><td>{e.row.lane}</td><td>{e.row.state}</td><td>{e.layer === 'sealed' ? 'sealed' : tier}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
<style>
  .hatched { background: repeating-linear-gradient(45deg, transparent 0 4px, currentColor 4px 5px); }
</style>