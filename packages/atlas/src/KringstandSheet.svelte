<script lang="ts">
  import { DATA_MARKS, DeltaStore, SIGNS, STD_VERBS } from '../../reader-core/src/index.ts';
  import type { ManifestMeta, TrustTier, ZSetChange } from '../../reader-core/src/index.ts';
  import { formatAtlasMessage, formatReasonLabel, formatSignLabel, formatStateLabel, formatTrustTierLabel } from './i18n-mf2.ts';
  import type { AtlasLocale, Mf2MessageCatalog } from './i18n-mf2.ts';

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
      may_propose?: boolean;
      can_propose?: boolean;
      rights?: { readonly can_propose?: boolean };
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

  let {
    fixture,
    lang = 'en',
    messages = null
  }: {
    fixture: Fixture;
    lang?: AtlasLocale;
    messages?: Mf2MessageCatalog | null;
  } = $props();

  let t = $derived((key: string, params?: Readonly<Record<string, string>>): string =>
    formatAtlasMessage(lang, key, params, messages)
  );

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
      trust_tier: fixture.manifest.trust_tier as TrustTier,
      ...(fixture.manifest.may_propose !== undefined ? { may_propose: fixture.manifest.may_propose } : {}),
      ...(fixture.manifest.can_propose !== undefined ? { can_propose: fixture.manifest.can_propose } : {}),
      ...(fixture.manifest.rights !== undefined ? { rights: fixture.manifest.rights } : {})
    };
    const store = new DeltaStore<Row>(manifestMeta, fixture.sealed_rows);
    if (live) {
      store.applyProvisionalStep(live.trust_tier, live.changes as readonly ZSetChange<Row>[]);
    }
    return { entries: store.rows(), seal: store.seal() };
  });

  let entries = $derived(storeState.entries);
  let tier = $derived(live ? live.trust_tier : storeState.seal.trustTier);
  let canPropose = $derived(storeState.seal.canPropose && tier === 'sealed');
  let lockReason = $derived(
    canPropose
      ? null
      : tier === 'provisional_engine'
        ? 'propose_locked_unsealed_live_stream'
        : tier !== 'sealed'
          ? 'propose_locked_not_sealed'
          : 'propose_locked_no_reader_grant'
  );
  let liveProofRef = $derived(live?.cert_hash ?? live?.proof_ref ?? undefined);

  function isUnknown(r: Row): boolean {
    return r.state === 'unknown' || r.lane === 'unknown';
  }
  function signOf(r: Row): string {
    if (isUnknown(r)) return 'unknown';
    if (r.state === 'absent') return 'absent';
    if (r.state === 'invalid') return 'invalid';
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
        <span aria-hidden="true" {...{ [M.sign]: signOf(r) }}>{glyph(signOf(r))}</span> {r.label}{#if r.state === 'invalid'} <span>({formatReasonLabel(lang, rowReason(r) ?? 'incomplete', messages)})</span>{/if}
      </div>
    </td>
  </tr>
{/snippet}

{#snippet unknownRow(r, layer)}
  <tr {...{ [M.key]: r.key, [M.layer]: layer }}>
    <td {...{ [M.state]: 'unknown', [M.reason]: unknownReason(r), [M.proof_ref]: r.proof_ref }}>
      <div {...{ [M.trust_tier]: layer === 'sealed' ? 'sealed' : tier }}>
        <span aria-hidden="true" {...{ [M.sign]: 'unknown' }}>{glyph('unknown')}</span> <span>{formatReasonLabel(lang, r.reason ?? 'incomplete', messages)}</span>
      </div>
    </td>
  </tr>
{/snippet}

<section
  lang={lang}
  aria-labelledby="kring-title"
  {...{ [M.sheet]: 'kringstand', [M.trust_tier]: tier }}
>
  <h2 id="kring-title">{t('sheet.kringstand.title')}</h2>

  <div {...{ [M.part]: 'seal', [M.trust_tier]: tier }}>
    <span {...{ [M.part]: 'manifest-hash' }}>{fixture.manifest.id}</span>
    <span {...{ [M.check]: 'witness', [M.status]: fixture.manifest.witness_check }}>{fixture.manifest.witness_check}</span>
    <strong>{formatTrustTierLabel(lang, tier, messages)}</strong>
    {#if live}<span data-live-latency-ms={live.latency_ms}> live {live.latency_ms} ms</span>{/if}
  </div>

  <table aria-label={t('sheet.kringstand.chronometer')}>
    <thead><tr><th scope="col">{t('col.round')}</th><th scope="col">{t('col.certificate')}</th></tr></thead>
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
              {formatTrustTierLabel(lang, live.trust_tier, messages)}{#if liveProofRef} · {liveProofRef}{:else} · {t('sheet.common.no_proof')}{/if}
            </div>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>

  <table aria-label={t('sheet.kringstand.lanes')}>
    <thead><tr><th scope="col">{t('col.lane')}</th></tr></thead>
    {#each BOARD_LANES as lane}
      <tbody>
        <tr {...{ [M.key]: lane }}><th scope="rowgroup">{lane}</th></tr>
        {#each laneEntries(lane, 'sealed') as e (e.row.key)}{@render itemRow(e.row, 'sealed')}{/each}
        {#each laneEntries(lane, 'provisional') as e (e.row.key)}{@render itemRow(e.row, 'provisional')}{/each}
      </tbody>
    {/each}
  </table>

  <div class="hatched" {...{ [M.part]: 'unknown-band' }}>
    <table aria-label={formatStateLabel(lang, 'unknown', messages)}>
      <thead><tr><th scope="col">{formatStateLabel(lang, 'unknown', messages)}</th></tr></thead>
      <tbody>
        {#each unknownEntries as e (e.row.key)}{@render unknownRow(e.row, e.layer)}{/each}
      </tbody>
    </table>
  </div>

  <form aria-label={t('sheet.kringstand.drawer')} onsubmit={(e) => e.preventDefault()}>
    {#each STD_VERBS as v}
      {#if v.verb === 'propose'}
        <button
          type="button"
          disabled={!canPropose}
          {...{ [M.verb]: v.verb, [M.key]: v.key }}
          data-lock-reason={lockReason}
        >[{v.key.toUpperCase()}] Propose</button>
      {:else}
        <button type="button" {...{ [M.verb]: v.verb, [M.key]: v.key }}>[{v.key.toUpperCase()}] {v.verb}</button>
      {/if}
    {/each}
    <button type="submit" disabled={!canPropose} data-lock-reason={lockReason}>Approve</button>
  </form>

  <table {...{ [M.part]: 'legend' }}>
    <caption>{t('sheet.common.legend')}</caption>
    <thead><tr><th scope="col">{t('col.sign')}</th><th scope="col">{t('col.meaning')}</th></tr></thead>
    <tbody>
      {#each drawnSigns as s}
        <tr {...{ [M.sign]: s }}><th scope="row"><span aria-hidden="true">{glyph(s)}</span></th><td>{formatSignLabel(lang, s, messages)}</td></tr>
      {/each}
    </tbody>
  </table>

  <table {...{ [M.part]: 'twin' }}>
    <caption>{t('sheet.kringstand.twin_caption')}</caption>
    <thead><tr><th scope="col">{t('col.item')}</th><th scope="col">{t('col.lane')}</th><th scope="col">{t('col.state')}</th><th scope="col">{t('col.tier')}</th></tr></thead>
    <tbody>
      {#each entries as e (e.row.key)}
        <tr {...{ [M.key]: e.row.key }}>
          <th scope="row">{e.row.label}</th><td>{e.row.lane}</td><td>{formatStateLabel(lang, e.row.state, messages)}</td><td>{formatTrustTierLabel(lang, e.layer === 'sealed' ? 'sealed' : tier, messages)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
<style>
  section[data-sheet="kringstand"] { font-family: var(--font-sans); }
  [data-part="manifest-hash"], code { font-family: var(--font-mono); }
  .hatched { background: repeating-linear-gradient(45deg, transparent 0 5px, var(--c-hatch) 5px 6px); }
</style>