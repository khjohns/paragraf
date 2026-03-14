<script lang="ts">
  import { uiState } from '$lib/stores/ui.svelte';
  import type { ListSort } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { NODE_TYPE_ACCENT, nodeMatchesSearch } from '$lib/types/graph';

  let graphMatchCount = $derived.by(() => {
    const q = uiState.graphSearch.toLowerCase().trim();
    if (!q) return 0;
    return analysisState.nodes.filter((n) => nodeMatchesSearch(n, q)).length;
  });

  const typeLabels: Record<string, string> = {
    provision: 'Best.',
    kofa_case: 'KOFA',
    eu_case: 'EU',
    court_case: 'Rett',
    prep_work: 'Forarb.',
  };

  // Single pass for both type and category counts (regulation-aware)
  let graphFilterCounts = $derived.by(() => {
    const types: Record<string, number> = {};
    const cats = { A: 0, B: 0, C: 0 };
    for (const n of analysisState.nodes) {
      if (uiState.regulationFilter && n.regulation === 'old') continue;
      types[n.type] = (types[n.type] || 0) + 1;
      if (n.category === 'A') cats.A++;
      else if (n.category === 'B') cats.B++;
      else if (n.category === 'C') cats.C++;
    }
    return { types, cats };
  });
</script>

<div class="toolbar">
  <div class="toolbar-left">
    <!-- Panel toggle -->
    <button
      class="panel-toggle"
      onclick={() => uiState.toggleLeftPanel()}
      title={uiState.leftPanelOpen ? 'Skjul panel' : 'Vis panel'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="1"
          y="2"
          width="14"
          height="12"
          rx="1.5"
          stroke="currentColor"
          stroke-width="1.2"
        />
        <line x1="5.5" y1="2" x2="5.5" y2="14" stroke="currentColor" stroke-width="1.2" />
      </svg>
    </button>

    <!-- View switcher (segmented control) -->
    <div class="view-switcher">
      <button
        class="view-btn"
        class:active={uiState.viewMode === 'list'}
        onclick={() => uiState.setViewMode('list')}>Liste</button
      >
      <button
        class="view-btn"
        class:active={uiState.viewMode === 'graph'}
        onclick={() => uiState.setViewMode('graph')}>Graf</button
      >
      <button
        class="view-btn"
        class:active={uiState.viewMode === 'propositions'}
        onclick={() => uiState.setViewMode('propositions')}>Rettssetninger</button
      >
    </div>

    {#if uiState.viewMode === 'propositions'}
      <span class="toolbar-sep"></span>
      <span class="prop-count">{analysisState.propositions.length} rettssetninger</span>
      {@const tensionCount = analysisState.propositions.filter(p => p.tension).length}
      {#if tensionCount > 0}
        <span class="toolbar-sep-dot">·</span>
        <span class="prop-tension-count">{tensionCount} {tensionCount === 1 ? 'spenning' : 'spenninger'}</span>
      {/if}
    {:else if uiState.viewMode === 'list'}
      <span class="toolbar-sep"></span>

      <!-- Filters -->
      <div class="filters">
        <button
          class="filter-btn"
          class:active={uiState.listFilter === 'all'}
          onclick={() => uiState.setListFilter('all')}>Alle</button
        >
        <button
          class="filter-btn filter-delim"
          class:active={uiState.listFilter === 'delimitation'}
          onclick={() => uiState.setListFilter('delimitation')}>Avgrensning</button
        >
        <button
          class="filter-btn"
          class:active={uiState.listFilter === 'unread'}
          onclick={() => uiState.setListFilter('unread')}>Ulest</button
        >
      </div>
    {:else if uiState.viewMode === 'graph'}
      <span class="toolbar-sep"></span>

      <!-- Graph search -->
      <div class="graph-search">
        <svg class="search-icon" width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4" />
          <line
            x1="11"
            y1="11"
            x2="14"
            y2="14"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="Søk saksnr, bestemmelse…"
          bind:value={uiState.graphSearch}
        />
        {#if uiState.graphSearch}
          <span class="search-count">{graphMatchCount}</span>
          <button class="search-clear" onclick={() => (uiState.graphSearch = '')}>×</button>
        {/if}
      </div>

      <!-- Type filter pills -->
      {#each Object.entries(graphFilterCounts.types) as [type, count]}
        <button
          class="cat-pill"
          class:active={uiState.graphTypeFilter.has(type)}
          onclick={() => uiState.toggleGraphType(type)}
        >
          <span
            class="cat-dot"
            style:background={NODE_TYPE_ACCENT[type as import('$lib/types/graph').NodeType]}
          ></span>
          {typeLabels[type] ?? type}
          {count}
        </button>
      {/each}

      <span class="toolbar-sep"></span>

      <!-- Category filter pills -->
      {#each ['A', 'B', 'C'] as cat}
        {@const count = graphFilterCounts.cats[cat as keyof typeof graphFilterCounts.cats]}
        {#if count > 0}
          <button
            class="cat-pill"
            class:active={uiState.graphCategoryFilter.has(cat)}
            class:cat-a={cat === 'A'}
            class:cat-b={cat === 'B'}
            class:cat-c={cat === 'C'}
            onclick={() => uiState.toggleGraphCategory(cat)}
          >
            <span class="cat-dot"></span>
            {cat}
            {count}
          </button>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="toolbar-right">
    {#if uiState.viewMode === 'propositions'}
      <!-- Evolution legend -->
      <div class="evolution-legend">
        {#each [{ key: 'established', label: 'Etablert', color: 'var(--p-ink)' }, { key: 'confirmed', label: 'Bekreftet', color: 'var(--p-success)' }, { key: 'qualified', label: 'Presisert', color: 'var(--p-warn)' }, { key: 'consolidating', label: 'Konsoliderende', color: 'var(--p-provision-accent)' }] as ev}
          <div class="evolution-item">
            <div class="evolution-dot" style:border-color={ev.color}></div>
            <span>{ev.label}</span>
          </div>
        {/each}
      </div>
    {:else if uiState.viewMode === 'list'}
      <!-- Sort -->
      <div class="sort">
        <label class="sort-label" for="sort-select">Sorter:</label>
        <select
          id="sort-select"
          onchange={(e) => uiState.setListSort(e.currentTarget.value as ListSort)}
        >
          <option value="category" selected={uiState.listSort === 'category'}>Kategori</option>
          <option value="citations" selected={uiState.listSort === 'citations'}>Siteringer</option>
          <option value="date" selected={uiState.listSort === 'date'}>Dato</option>
        </select>
      </div>
    {/if}

    <!-- AI toggle -->
    <button
      class="ai-toggle"
      class:active={uiState.aiEnabled}
      onclick={() => uiState.toggleAi()}
      title={uiState.aiEnabled
        ? 'KI-kuratering er på (vektorsøk brukes uansett)'
        : 'KI-kuratering er av'}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
      </svg>
      KI
    </button>

    <!-- Regulation filter -->
    <button
      class="reg-filter"
      class:active={uiState.regulationFilter}
      onclick={() => uiState.toggleRegulationFilter()}
      title={uiState.regulationFilter ? 'Viser kun FOA 2017+' : 'Viser alle FOA-versjoner'}
    >
      {uiState.regulationFilter ? 'FOA 2017–' : 'Alle FOA'}
    </button>

    <!-- Node type legend (compact, from mock) -->
    <div class="legend">
      <span class="legend-item">
        <span class="legend-dot" style:background="var(--p-provision-accent)"></span>
        <span>Best.</span>
      </span>
      <span class="legend-item">
        <span class="legend-dot" style:background="var(--p-kofa-accent)"></span>
        <span>KOFA</span>
      </span>
      <span class="legend-item">
        <span class="legend-dot" style:background="var(--p-eu-accent)"></span>
        <span>EU</span>
      </span>
    </div>
  </div>
</div>

{#if uiState.listSort === 'citations'}
  <div class="sort-warning">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14.5 13H1.5L8 1Z" stroke="currentColor" stroke-width="1.5" fill="none" />
      <path d="M8 6V9M8 11V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <span>Eldre saker dominerer — kombiner med dato</span>
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 16px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    position: sticky;
    top: 0;
    z-index: 1;
    flex-shrink: 0;
  }
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    row-gap: 4px;
  }
  .panel-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--p-ink3);
  }
  .panel-toggle:hover {
    background: var(--p-hover);
    color: var(--p-ink);
  }

  /* Segmented control — matches mock exactly */
  .view-switcher {
    display: flex;
    border-radius: 5px;
    border: 1px solid var(--p-border);
    overflow: hidden;
  }
  .view-btn {
    all: unset;
    cursor: pointer;
    padding: 4px 11px;
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    background: transparent;
  }
  .view-btn:hover:not(:disabled) {
    background: var(--p-hover);
  }
  .view-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
  }
  .view-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--p-border);
  }

  .filters {
    display: flex;
    gap: var(--spacing-1);
  }
  .filter-btn {
    all: unset;
    cursor: pointer;
    padding: var(--spacing-1) var(--spacing-2);
    font-size: 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--p-ink3);
  }
  .filter-btn:hover {
    background: var(--p-hover);
  }
  .filter-btn.active {
    background: var(--p-active);
    color: var(--p-ink);
    font-weight: 500;
  }
  .filter-delim.active {
    background: var(--p-delim-bg);
    color: var(--p-delim);
  }

  .sort {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }
  .sort-label {
    font-size: 0.6875rem;
    color: var(--p-ink4);
  }
  .sort select {
    font-size: 0.75rem;
    color: var(--p-ink2);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--p-ink4);
  }
  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .ai-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 500;
    border-radius: 4px;
    color: var(--p-ink4);
    border: 1px solid var(--p-border);
  }
  .ai-toggle:hover {
    background: var(--p-hover);
  }
  .ai-toggle.active {
    background: var(--p-provision-accent);
    color: white;
    border-color: var(--p-provision-accent);
  }

  .reg-filter {
    all: unset;
    cursor: pointer;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 500;
    border-radius: 4px;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
  }
  .reg-filter:hover {
    background: var(--p-hover);
  }
  .reg-filter.active {
    background: var(--p-warn-bg);
    color: var(--p-warn);
    border-color: rgba(166, 123, 46, 0.15);
  }

  /* Category filter pills */
  .cat-pill {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-data);
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
    border-radius: 12px;
    transition: all 0.12s ease;
  }
  .cat-pill:hover {
    border-color: var(--p-ink4);
  }
  .cat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--p-ink4);
  }
  .cat-pill.cat-a .cat-dot {
    background: var(--p-ink);
  }
  .cat-pill.cat-b .cat-dot {
    background: var(--p-ink2);
  }
  .cat-pill.cat-c .cat-dot {
    background: var(--p-ink3);
  }
  .cat-pill.active {
    background: var(--p-active);
    color: var(--p-ink);
    border-color: var(--p-ink3);
  }

  /* Graph search */
  .graph-search {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--p-border);
    border-radius: 5px;
    background: var(--p-bg);
    min-width: 180px;
  }
  .graph-search:focus-within {
    border-color: var(--p-ink3);
  }
  .search-icon {
    color: var(--p-ink4);
    flex-shrink: 0;
  }
  .search-input {
    all: unset;
    font-size: 11px;
    font-family: var(--font-ui);
    color: var(--p-ink);
    flex: 1;
    min-width: 0;
  }
  .search-input::placeholder {
    color: var(--p-ink4);
  }
  .search-count {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    background: var(--p-surface);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .search-clear {
    all: unset;
    cursor: pointer;
    color: var(--p-ink4);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
  }
  .search-clear:hover {
    color: var(--p-ink2);
  }

  /* Propositions toolbar */
  .prop-count {
    font-size: 11px;
    color: var(--p-ink3);
  }
  .toolbar-sep-dot {
    color: var(--p-border-s);
    font-size: 11px;
  }
  .prop-tension-count {
    font-size: 11px;
    font-weight: 500;
    color: var(--p-tension, #a63d3d);
  }
  .evolution-legend {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .evolution-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--p-ink4);
  }
  .evolution-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 2px solid currentColor;
    background: var(--p-surface);
  }

  .sort-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 16px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--p-warn);
    background: var(--p-warn-bg);
    border-bottom: 1px solid rgba(166, 123, 46, 0.12);
  }
</style>
