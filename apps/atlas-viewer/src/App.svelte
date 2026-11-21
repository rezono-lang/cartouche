<script lang="ts">
  import { PALETTES, paletteCss } from '../../../packages/reader-core/src/palette.ts';
  import type { PaletteName } from '../../../packages/reader-core/src/palette.ts';
  import { DeltaStore } from '../../../packages/reader-core/src/delta-store.ts';
  import type { ManifestMeta } from '../../../packages/reader-core/src/delta-store.ts';
  import type { AtlasLocale } from '../../../packages/atlas/src/i18n-mf2.ts';

  import StatutoryRelief3D from '../../../packages/atlas/src/StatutoryRelief3D.svelte';
  import FlowSplitSheet from '../../../packages/atlas/src/FlowSplitSheet.svelte';
  import KringstandSheet from '../../../packages/atlas/src/KringstandSheet.svelte';
  import CausalRippleSheet from '../../../packages/atlas/src/CausalRippleSheet.svelte';
  import BitemporalStairSheet from '../../../packages/atlas/src/BitemporalStairSheet.svelte';
  import MongeFoldingSheet from '../../../packages/atlas/src/MongeFoldingSheet.svelte';
  import Slip from '../../../packages/slip/src/Slip.svelte';

  import {
    compileFlowSplitScene,
    compileMongeScene,
    compileReliefScene
  } from '../../../packages/scene-ir/src/compilers.ts';
  import { compileKringstandScene } from '../../../packages/scene-ir/src/compile-kringstand.ts';
  import { compileCausalRippleScene } from '../../../packages/scene-ir/src/compile-causal-ripple.ts';
  import { compileBitemporalScene } from '../../../packages/scene-ir/src/compile-bitemporal.ts';
  import { exportTypst } from '../../../packages/scene-ir/src/typst-export.ts';

  import fx01 from '../../../fixtures/01-platform-drift.json' with { type: 'json' };
  import fx02 from '../../../fixtures/02-platform-tenant-a.json' with { type: 'json' };
  import fx03 from '../../../fixtures/03-kring-m1-to-m5-live.json' with { type: 'json' };
  import fx04 from '../../../fixtures/04-subsidy-a001-a003.json' with { type: 'json' };
  import fx05 from '../../../fixtures/05-subsidy-bitemporal.json' with { type: 'json' };
  import fx06 from '../../../fixtures/06-keycloak-dense-28.json' with { type: 'json' };
  import fx07 from '../../../fixtures/07-unserved-410.json' with { type: 'json' };
  import fx08 from '../../../fixtures/08-monge-4d-audit.json' with { type: 'json' };
  import fx09 from '../../../fixtures/09-slip-conformance.json' with { type: 'json' };

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
  }

  let {
    initialTab = 'relief',
    initialTheme = 'swisstopo',
    initialLocale = 'en',
    initialFlowRole = 'full',
    initialSlipRow = 'flagged::item-a::12',
    initialSlipUnserved = false,
    initialTypstSheet = 'relief'
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
  const SLIP_ROW_KEYS = Object.keys(fx09.slip_conformance.rows);

  const reliefFixture = fx04 as Parameters<typeof compileReliefScene>[0] & Record<string, unknown>;
  const kringFixture = fx03 as unknown;
  const rippleFixture = fx06 as unknown;
  const bitemporalFixture = fx05 as unknown;
  const mongeFixture = fx08 as unknown;

  let activeTab = $state<ViewerTab>(initialTab);
  let theme = $state<PaletteName>(initialTheme in PALETTES ? initialTheme : 'swisstopo');
  let locale = $state<AtlasLocale>(initialLocale);
  let flowRole = $state<'full' | 'restricted'>(initialFlowRole);
  let slipRowKey = $state<string>(
    SLIP_ROW_KEYS.includes(initialSlipRow) ? initialSlipRow : SLIP_ROW_KEYS[0] ?? 'flagged::item-a::12'
  );
  let slipUnserved = $state<boolean>(initialSlipUnserved);
  let typstSheet = $state<TypstSheetKey>(initialTypstSheet);

  let themeCss = $derived(paletteCss(theme));
  let activeFlowFixture = $derived(flowRole === 'full' ? fx01 : fx02);

  let slipSeal = $derived(new DeltaStore(fx09.manifest as ManifestMeta).seal());

  let activeSlipRow = $derived.by(() => {
    const rows = fx09.slip_conformance.rows as Record<string, Record<string, unknown>>;
    const raw = rows[slipRowKey];
    if (!raw) return null;
    const msgs =
      (fx09.slip_conformance.messages as Record<string, Record<string, string>>)[locale] ??
      fx09.slip_conformance.messages.en;
    const ruleId = String(raw.rule_id ?? '');
    return {
      ...raw,
      sentence_template: msgs[ruleId] ?? ruleId
    };
  });

  function collectReasons(items: readonly { readonly id?: string; readonly key?: string; readonly reason?: string | null }[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const item of items) {
      const id = item.id ?? item.key;
      if (id && item.reason) out[id] = item.reason;
    }
    return out;
  }

  let typstSource = $derived.by((): string => {
    if (typstSheet === 'relief') {
      const scene = compileReliefScene(fx04 as Parameters<typeof compileReliefScene>[0]);
      return exportTypst(scene, { title: 'Sheet 01 — Orthographic Relief' });
    }
    if (typstSheet === 'flow') {
      const fx = activeFlowFixture as Parameters<typeof compileFlowSplitScene>[0];
      const scene = compileFlowSplitScene(fx);
      return exportTypst(scene, {
        title: 'Sheet 02 — Flow & Reality-Split',
        reasonByNodeId: collectReasons(fx.nodes)
      });
    }
    if (typstSheet === 'kringstand') {
      const scene = compileKringstandScene(fx03 as Parameters<typeof compileKringstandScene>[0]);
      return exportTypst(scene, { title: 'Sheet 03 — Kringstand' });
    }
    if (typstSheet === 'ripple') {
      const scene = compileCausalRippleScene(fx06 as Parameters<typeof compileCausalRippleScene>[0]);
      return exportTypst(scene, { title: 'Sheet 04 — Causal Ripple' });
    }
    if (typstSheet === 'bitemporal') {
      const scene = compileBitemporalScene(fx05 as Parameters<typeof compileBitemporalScene>[0]);
      return exportTypst(scene, { title: 'Sheet 05 — Bitemporal Staircase' });
    }
    const fx = fx08 as Parameters<typeof compileMongeScene>[0] & {
      readonly services: readonly { readonly id: string; readonly reason?: string | null }[];
    };
    const scene = compileMongeScene(fx);
    return exportTypst(scene, {
      title: 'Sheet 06 — Monge Folding Atlas',
      reasonByNodeId: collectReasons(fx.services)
    });
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
    {#if activeTab === 'relief'}
      <StatutoryRelief3D fixture={reliefFixture} {theme} lang={locale} />
    {:else if activeTab === 'flow'}
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
      <FlowSplitSheet fixture={activeFlowFixture} {theme} />
    {:else if activeTab === 'kringstand'}
      <KringstandSheet fixture={kringFixture} />
    {:else if activeTab === 'ripple'}
      <CausalRippleSheet fixture={rippleFixture} {theme} lang={locale} />
    {:else if activeTab === 'bitemporal'}
      <BitemporalStairSheet fixture={bitemporalFixture} {theme} />
    {:else if activeTab === 'monge'}
      <MongeFoldingSheet fixture={mongeFixture} {theme} />
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
      {#if slipUnserved}
        <Slip {theme} unserved={fx07.unserved} httpStatus={fx07.http_status} />
      {:else}
        <Slip
          {theme}
          seal={slipSeal}
          horizon={fx09.horizon}
          conformanceRow={activeSlipRow}
        />
      {/if}
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
