<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import SeedInput from '$lib/components/SeedInput.svelte';
	import NodeList from '$lib/components/NodeList.svelte';
	import NodeDetail from '$lib/components/NodeDetail.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import { createTraversalQuery } from '$lib/queries/traversal';

	const traversal = createTraversalQuery(() => ({
		provisions: analysisState.analysis.seeds.provisions,
		ftsTerms: analysisState.analysis.seeds.ftsTerms,
		vectorQuery: analysisState.analysis.seeds.vectorQuery,
		cases: analysisState.analysis.seeds.cases,
		regulationFilter: uiState.regulationFilter ? 'new' : 'all',
	}));

	// Sync query results to store
	$effect(() => {
		const data = traversal.data;
		if (data) {
			analysisState.setResults(data.nodes, data.edges, data.gaps);
		}
	});

	// Load persisted state on mount
	$effect(() => {
		analysisState.load();
	});

	// Save on changes (debounced)
	$effect(() => {
		// Touch all reactive fields to track them
		analysisState.analysis;
		analysisState.nodes;
		analysisState.debouncedSave();
	});
</script>

<AppShell>
	{#snippet leftPanel()}
		<SeedInput />

		{#if traversal.data}
			<div class="stats-box">
				<h3 class="stats-title">Resultater</h3>
				<div class="stat-row">
					<span class="stat-label">Totalt</span>
					<span class="stat-value">{traversal.data.stats.total}</span>
				</div>
				<div class="stat-row">
					<span class="stat-badge badge-a">A</span>
					<span class="stat-desc">Ref + FTS + Vektor</span>
					<span class="stat-value">{traversal.data.stats.categoryA}</span>
				</div>
				<div class="stat-row">
					<span class="stat-badge badge-b">B</span>
					<span class="stat-desc">To av tre signaler</span>
					<span class="stat-value">{traversal.data.stats.categoryB}</span>
				</div>
				<div class="stat-row">
					<span class="stat-badge badge-c">C</span>
					<span class="stat-desc">Ett signal</span>
					<span class="stat-value">{traversal.data.stats.categoryC}</span>
				</div>
			</div>
		{/if}

		{#if traversal.isFetching}
			<p class="loading">Søker...</p>
		{/if}
	{/snippet}

	{#snippet middlePanel()}
		<NodeList />
	{/snippet}

	{#snippet rightPanel()}
		<NodeDetail />
	{/snippet}
</AppShell>

<style>
	.stats-box {
		margin-top: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
	}
	.stats-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--p-ink2);
		margin-bottom: var(--spacing-2);
	}
	.stat-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: 2px 0;
		font-size: 0.8125rem;
	}
	.stat-label {
		color: var(--p-ink2);
		flex: 1;
	}
	.stat-desc {
		font-size: 0.6875rem;
		color: var(--p-ink4);
		flex: 1;
	}
	.stat-value {
		font-family: var(--font-data);
		font-weight: 600;
		color: var(--p-ink);
	}
	.stat-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-sm);
		font-size: 0.6875rem;
		font-weight: 700;
		font-family: var(--font-data);
	}
	.badge-a { background: var(--p-success-bg); color: var(--p-success); }
	.badge-b { background: var(--p-warn-bg); color: var(--p-warn); }
	.badge-c { background: var(--p-hover); color: var(--p-ink3); }
	.loading {
		font-size: 0.8125rem;
		color: var(--p-ink3);
		margin-top: var(--spacing-2);
	}
</style>
