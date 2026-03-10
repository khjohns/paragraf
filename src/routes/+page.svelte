<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import LeftPanel from '$lib/components/LeftPanel.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import NodeList from '$lib/components/NodeList.svelte';
	import GraphView from '$lib/components/GraphView.svelte';
	import NodeDetail from '$lib/components/NodeDetail.svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import { onMount, untrack } from 'svelte';
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

	// Sync query results to store (untrack prevents cascading state updates)
	$effect(() => {
		const data = traversal.data;
		if (data) {
			untrack(() => {
				analysisState.setResults(data.nodes, data.edges, data.gaps, data.suggestedProvisions);
			});
		}
	});

	// Load persisted state on mount (saves are handled by touch() in store)
	onMount(() => analysisState.load());
</script>

<KeyboardShortcuts />

<AppShell>
	{#snippet leftPanel()}
		<LeftPanel />
	{/snippet}

	{#snippet middlePanel()}
		<Toolbar />
		{#if uiState.viewMode === 'graph'}
			<GraphView />
		{:else}
			<NodeList />
		{/if}
	{/snippet}

	{#snippet rightPanel()}
		<NodeDetail />
	{/snippet}
</AppShell>
