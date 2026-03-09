<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import LeftPanel from '$lib/components/LeftPanel.svelte';
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
		<LeftPanel />
	{/snippet}

	{#snippet middlePanel()}
		<NodeList />
	{/snippet}

	{#snippet rightPanel()}
		<NodeDetail />
	{/snippet}
</AppShell>
