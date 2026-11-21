<script lang="ts">
  import { PALETTES, paletteCss } from '../../../packages/reader-core/src/palette.ts';
  import type { PaletteName } from '../../../packages/reader-core/src/palette.ts';
  import { formatAtlasMessage } from '../../../packages/atlas/src/i18n-mf2.ts';
  import type { AtlasLocale } from '../../../packages/atlas/src/i18n-mf2.ts';

  import viewerData from '../../../fixtures/viewer/prerendered.json' with { type: 'json' };

  export type ViewerTab =
    | 'relief'
    | 'flow'
    | 'kringstand'
    | 'ripple'
    | 'bitemporal'
    | 'monge'
    | 'slip'
    | 'typst';

  export type TypstSheetKey = 'relief' | 'flow' | 'kringstand' | 'ripple' | 'bitemporal' | 'monge';

  interface Props {
    initialTab?: ViewerTab;
    initialTheme?: PaletteName;
    initialLocale?: AtlasLocale;
    initialFlowRole?: 'full' | 'restricted';
    initialSlipRow?: string;
    initialSlipUnserved?: boolean;
    initialTypstSheet?: TypstSheetKey;
    initialValidAt?: string;
    initialKnownAt?: string;
  }

  let {
    initialTab = 'relief',
    initialTheme = 'swisstopo',
    initialLocale = 'en',
    initialFlowRole = 'full',
    initialSlipRow = 'flagged::item-a::12',
    initialSlipUnserved = false,
    initialTypstSheet = 'relief',
    initialValidAt,
    initialKnownAt
  }: Props = $props();

  const TABS: readonly { readonly id: ViewerTab; readonly label: string }[] = [
    { id: 'relief', label: '01 · Relief' },
    { id: 'flow', label: '02 · Flow Split' },
    { id: 'kringstand', label: '03 · Kringstand' },
    { id: 'ripple', label: '04 · Causal Ripple' },
    { id: 'bitemporal', label: '05 · Bitemporal' },
    { id: 'monge', label: '06 · Monge Fold' },
    { id: 'slip', label: '@rezono/slip' },
    { id: 'typst', label: 'Typst Export' }
  ];

  const PALETTE_LIST: readonly PaletteName[] = ['swisstopo', 'obsidian', 'forced'];
  const LOCALE_LIST: readonly AtlasLocale[] = ['en', 'nl'];
  const TYPST_SHEETS: readonly TypstSheetKey[] = ['relief', 'flow', 'kringstand', 'ripple', 'bitemporal', 'monge'];
  const SLIP_ROW_KEYS: readonly string[] = viewerData.slip.rowKeys;
  const VALID_TIMES: readonly string[] = viewerData.timeControl.validTimes;
  const SERVED_EPOCHS: readonly string[] = viewerData.timeControl.servedEpochs;

  let activeTab = $state<ViewerTab>(initialTab);
  let theme = $state<PaletteName>(initialTheme in PALETTES ? initialTheme : 'swisstopo');
  let locale = $state<AtlasLocale>(initialLocale);
  let flowRole = $state<'full' | 'restricted'>(initialFlowRole);
  let slipRowKey = $state<string>(
    SLIP_ROW_KEYS.includes(initialSlipRow) ? initialSlipRow : SLIP_ROW_KEYS[0] ?? 'flagged::item-a::12'
  );
  let slipUnserved = $state<boolean>(initialSlipUnserved);
  let typstSheet = $state<TypstSheetKey>(initialTypstSheet);
  let validAt = $state<string>(initialValidAt ?? VALID_TIMES[0] ?? '2026-01-01');
  let knownAt = $state<string>(initialKnownAt ?? SERVED_EPOCHS[SERVED_EPOCHS.length - 1] ?? 'm-4');
  let epochServed = $derived(SERVED_EPOCHS.includes(knownAt));
  let permalinkHref = $derived(
    `?tab=${encodeURIComponent(activeTab)}&valid_at=${encodeURIComponent(validAt)}&known_at=${encodeURIComponent(knownAt)}`
  );

  let themeCss = $derived(paletteCss(theme));

  // Build-time prerendered Atlas sheets (zero browser scene compilers, layout models, or fixtures).
  let activeSheetHtml = $derived.by((): string => {
    if (!epochServed) {
      const byTheme = viewerData.slip.unservedHtml as Record<string, string>;
      return byTheme[theme] ?? byTheme.swisstopo ?? '';
    }
    const sheets = viewerData.sheetsHtml;
    if (activeTab === 'relief') {
      const byTheme = sheets.relief as Record<string, Record<string, string>>;
      const byLoc = byTheme[theme] ?? byTheme.swisstopo ?? {};
      return byLoc[locale] ?? byLoc.en ?? '';
    }
    if (activeTab === 'flow') {
      const byTheme = (flowRole === 'full' ? sheets.flowFull : sheets.flowRestricted) as Record<string, string>;
      return byTheme[theme] ?? byTheme.swisstopo ?? '';
    }
    if (activeTab === 'kringstand') {
      return sheets.kringstand as string;
    }
    if (activeTab === 'ripple') {
      const byTheme = sheets.ripple as Record<string, Record<string, string>>;
      const byLoc = byTheme[theme] ?? byTheme.swisstopo ?? {};
      return byLoc[locale] ?? byLoc.en ?? '';
    }
    if (activeTab === 'bitemporal') {
      const byTheme = viewerData.timeControl.bitemporalByTime as Record<string, Record<string, Record<string, string>>>;
      const byEpoch = byTheme[theme] ?? byTheme.swisstopo ?? {};
      const byValid = byEpoch[knownAt] ?? {};
      return byValid[validAt] ?? (sheets.bitemporal as Record<string, string>)[theme] ?? '';
    }
    if (activeTab === 'monge') {
      const byTheme = sheets.monge as Record<string, string>;
      return byTheme[theme] ?? byTheme.swisstopo ?? '';
    }
    return '';
  });

  // Build-time prerendered @rezono/slip HTML (from fixtures/10-slip-reader-answers.json & 07-unserved-410.json).
  // Zero browser sealing, zero scene compilation, zero build-time model imports.
  let activeSlipHtml = $derived.by((): string => {
    if (slipUnserved) {
      const byTheme = viewerData.slip.unservedHtml as Record<string, string>;
      return byTheme[theme] ?? byTheme.swisstopo ?? '';
    }
    const byTheme = viewerData.slip.servedHtml as Record<string, Record<string, string>>;
    const rows = byTheme[theme] ?? byTheme.swisstopo ?? {};
    return rows[slipRowKey] ?? rows[SLIP_ROW_KEYS[0] ?? ''] ?? '';
  });

  // Build-time prerendered deterministic Typst source per sheet.
  let typstSource = $derived.by((): string => {
    if (typstSheet === 'flow') {
      return flowRole === 'full' ? viewerData.typst.flowFull : viewerData.typst.flowRestricted;
    }
    return viewerData.typst[typstSheet];
  });

  function selectTab(id: ViewerTab): void {
    activeTab = id;
    if (id !== 'slip' && id !== 'typst') {
      typstSheet = id;
    }
  }
</script>

<div class="viewer-shell" data-cartouche-theme={theme} lang={locale}>
  <style>{themeCss}</style>

  <header class="viewer-bar">
    <div class="viewer-brand">
      <h1 class="viewer-title">Cartouche Atlas Viewer</h1>
    </div>

    <div class="viewer-controls">
      <div class="control-group time-controls">
        <label class="row-select-label" for="ctrl-valid-at">
          <span>{formatAtlasMessage(locale, 'control.valid_at')}</span>
          <select id="ctrl-valid-at" name="valid_at" bind:value={validAt}>
            {#each VALID_TIMES as vt (vt)}
              <option value={vt}>{vt}</option>
            {/each}
          </select>
        </label>

        <label class="row-select-label" for="ctrl-known-at">
          <span>{formatAtlasMessage(locale, 'control.known_at')}</span>
          <select id="ctrl-known-at" name="known_at" bind:value={knownAt}>
            {#each SERVED_EPOCHS as ep (ep)}
              <option value={ep}>{ep}</option>
            {/each}
          </select>
        </label>

        <a class="ctrl-btn" href={permalinkHref}>{formatAtlasMessage(locale, 'control.permalink')}</a>
      </div>

      <div class="control-group" role="group" aria-label="Color palette">
        {#each PALETTE_LIST as pal (pal)}
          <button
            type="button"
            class="ctrl-btn"
            aria-pressed={theme === pal}
            onclick={() => (theme = pal)}
          >
            {pal}
          </button>
        {/each}
      </div>

      <div class="control-group" role="group" aria-label="Locale">
        {#each LOCALE_LIST as loc (loc)}
          <button
            type="button"
            class="ctrl-btn"
            aria-pressed={locale === loc}
            onclick={() => (locale = loc)}
          >
            {loc.toUpperCase()}
          </button>
        {/each}
      </div>
    </div>
  </header>

  <nav class="viewer-nav" aria-label="Atlas sheets">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        class="tab-btn"
        aria-current={activeTab === tab.id ? 'page' : undefined}
        onclick={() => selectTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <section class="viewer-stage" aria-label="Active sheet">
    {#if activeTab === 'flow'}
      <div class="subbar" role="group" aria-label="Projection role">
        <button
          type="button"
          class="ctrl-btn"
          aria-pressed={flowRole === 'full'}
          onclick={() => (flowRole = 'full')}
        >
          Full Role
        </button>
        <button
          type="button"
          class="ctrl-btn"
          aria-pressed={flowRole === 'restricted'}
          onclick={() => (flowRole = 'restricted')}
        >
          Restricted Role (Zero-Leak)
        </button>
      </div>
      <div class="prerendered-sheet">
        {@html activeSheetHtml}
      </div>
    {:else if activeTab === 'relief' || activeTab === 'kringstand' || activeTab === 'ripple' || activeTab === 'bitemporal' || activeTab === 'monge'}
      <div class="prerendered-sheet">
        {@html activeSheetHtml}
      </div>
    {:else if activeTab === 'slip'}
      <div class="subbar">
        <div class="control-group" role="group" aria-label="Slip mode">
          <button
            type="button"
            class="ctrl-btn"
            aria-pressed={!slipUnserved}
            onclick={() => (slipUnserved = false)}
          >
            Served Rows
          </button>
          <button
            type="button"
            class="ctrl-btn"
            aria-pressed={slipUnserved}
            onclick={() => (slipUnserved = true)}
          >
            410 Unserved
          </button>
        </div>
        {#if !slipUnserved}
          <label class="row-select-label">
            <span>Row</span>
            <select bind:value={slipRowKey}>
              {#each SLIP_ROW_KEYS as rk (rk)}
                <option value={rk}>{rk}</option>
              {/each}
            </select>
          </label>
        {/if}
      </div>
      <div class="slip-prerendered">
        {@html activeSlipHtml}
      </div>
    {:else if activeTab === 'typst'}
      <div class="subbar" role="group" aria-label="Typst sheet source">
        {#each TYPST_SHEETS as key (key)}
          <button
            type="button"
            class="ctrl-btn"
            aria-pressed={typstSheet === key}
            onclick={() => (typstSheet = key)}
          >
            {key}
          </button>
        {/each}
      </div>
      <div class="typst-panel">
        <h2>Deterministic Typst Source ({typstSheet})</h2>
        <pre class="typst-code"><code>{typstSource}</code></pre>
      </div>
    {/if}
  </section>
</div>

<style>
  .viewer-shell {
    min-height: 100vh;
    background: var(--c-paper);
    color: var(--c-ink);
    padding: 1rem 1.25rem 2rem;
  }

  .viewer-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--c-rule-strong);
  }

  .viewer-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--c-ink);
  }

  .viewer-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .control-group {
    display: inline-flex;
    gap: 0.25rem;
  }

  .viewer-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.75rem 0 1rem;
  }

  .tab-btn,
  .ctrl-btn {
    background: var(--c-paper-elev);
    color: var(--c-ink);
    border: 1px solid var(--c-rule-strong);
    border-radius: 4px;
    padding: 0.35rem 0.65rem;
    cursor: pointer;
  }

  .tab-btn[aria-current='page'],
  .ctrl-btn[aria-pressed='true'] {
    background: var(--c-ink);
    color: var(--c-paper);
    border-color: var(--c-ink);
  }

  .subbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--c-paper-tint);
    border: 1px solid var(--c-rule);
    border-radius: 4px;
  }

  .row-select-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--c-ink);
  }

  .row-select-label select {
    background: var(--c-paper-elev);
    color: var(--c-ink);
    border: 1px solid var(--c-rule-strong);
    border-radius: 4px;
    padding: 0.25rem 0.45rem;
  }

  .viewer-stage {
    background: var(--c-paper);
    color: var(--c-ink);
  }

  .typst-panel {
    background: var(--c-paper-tint);
    border: 1px solid var(--c-rule-strong);
    border-radius: 4px;
    padding: 0.75rem 1rem;
  }

  .typst-code {
    margin: 0.5rem 0 0;
    padding: 0.75rem;
    background: var(--c-paper-elev);
    color: var(--c-ink);
    border: 1px solid var(--c-rule);
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
    white-space: pre;
  }
</style>
