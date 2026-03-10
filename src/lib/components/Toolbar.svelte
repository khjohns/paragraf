<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';
	import type { ListSort } from '$lib/stores/ui.svelte';
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
				<rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
				<line x1="5.5" y1="2" x2="5.5" y2="14" stroke="currentColor" stroke-width="1.2"/>
			</svg>
		</button>

		<!-- View switcher (segmented control) -->
		<div class="view-switcher">
			<button
				class="view-btn"
				class:active={uiState.viewMode === 'list'}
				onclick={() => uiState.setViewMode('list')}
			>Liste</button>
			<button
				class="view-btn"
				class:active={uiState.viewMode === 'graph'}
				onclick={() => uiState.setViewMode('graph')}
			>Graf</button>
		</div>

		{#if uiState.viewMode === 'list'}
			<span class="toolbar-sep"></span>

			<!-- Filters -->
			<div class="filters">
				<button class="filter-btn" class:active={uiState.listFilter === 'all'} onclick={() => uiState.setListFilter('all')}>Alle</button>
				<button class="filter-btn filter-delim" class:active={uiState.listFilter === 'delimitation'} onclick={() => uiState.setListFilter('delimitation')}>Avgrensning</button>
				<button class="filter-btn" class:active={uiState.listFilter === 'unread'} onclick={() => uiState.setListFilter('unread')}>Ulest</button>
			</div>
		{/if}
	</div>

	<div class="toolbar-right">
		{#if uiState.viewMode === 'list'}
			<!-- Sort -->
			<div class="sort">
				<label class="sort-label" for="sort-select">Sorter:</label>
				<select id="sort-select" onchange={(e) => uiState.setListSort(e.currentTarget.value as ListSort)}>
					<option value="category" selected={uiState.listSort === 'category'}>Kategori</option>
					<option value="citations" selected={uiState.listSort === 'citations'}>Siteringer</option>
					<option value="date" selected={uiState.listSort === 'date'}>Dato</option>
				</select>
			</div>
		{/if}

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
			<path d="M8 1L14.5 13H1.5L8 1Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
			<path d="M8 6V9M8 11V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
	.toolbar-left, .toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
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
		border-color: rgba(166,123,46,0.15);
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
		border-bottom: 1px solid rgba(166,123,46,0.12);
	}
</style>
