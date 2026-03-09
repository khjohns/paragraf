<script lang="ts">
	import { analysisState } from '$lib/stores/analysis.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import { mockTraversalResponse } from '$lib/mocks/traversal';

	// Load mock data into store on mount
	$effect(() => {
		analysisState.setResults(
			mockTraversalResponse.nodes,
			mockTraversalResponse.edges,
			mockTraversalResponse.gaps,
		);
		analysisState.setProblemStatement(
			'Er ESPD fra st\u00f8ttende virksomhet tilstrekkelig til \u00e5 dokumentere r\u00e5dighet over dennes ressurser, eller m\u00e5 forpliktelseserkl\u00e6ring foreligge ved tilbudsfrist?',
		);
	});

	function handleNodeClick(id: string) {
		uiState.selectNode(id);
	}
</script>

<main>
	<h1>Paragraf</h1>
	<p class="problem">{analysisState.analysis.problemStatement}</p>

	<div class="stats">
		<span>Noder: {analysisState.nodes.length}</span>
		<span>Kanter: {analysisState.edges.length}</span>
		<span>Visning: {uiState.viewMode}</span>
	</div>

	<ul class="node-list">
		{#each analysisState.nodes as node}
			<li class:selected={uiState.selectedNodeId === node.id}>
				<button onclick={() => handleNodeClick(node.id)}>
					<span class="label">{node.label}</span>
					<span class="meta">
						{node.type} · {node.category ?? '\u2014'} · {node.citations} sit.
					</span>
				</button>
			</li>
		{/each}
	</ul>

	{#if uiState.selectedNodeId}
		<aside>
			<h2>Valgt: {uiState.selectedNodeId}</h2>
			<button onclick={() => uiState.selectNode(null)}>Lukk</button>
		</aside>
	{/if}
</main>

<style>
	main {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--spacing-6);
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--p-ink);
	}
	.problem {
		color: var(--p-ink2);
		font-style: italic;
		margin-bottom: var(--spacing-4);
	}
	.stats {
		display: flex;
		gap: var(--spacing-4);
		color: var(--p-ink3);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-4);
	}
	.node-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.node-list button {
		all: unset;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
	}
	.node-list button:hover {
		background: var(--p-hover);
	}
	.selected button {
		border-color: var(--p-kofa-accent);
		background: var(--p-kofa-bg);
	}
	.label {
		font-family: var(--font-data);
		font-weight: 600;
		color: var(--p-ink);
	}
	.meta {
		font-size: 0.75rem;
		color: var(--p-ink3);
	}
	aside {
		margin-top: var(--spacing-6);
		padding: var(--spacing-4);
		background: var(--p-panel);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
	}
	aside h2 {
		font-family: var(--font-data);
		font-size: 0.875rem;
	}
	aside button {
		margin-top: var(--spacing-2);
		padding: var(--spacing-1) var(--spacing-3);
		background: none;
		border: 1px solid var(--p-border-s);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--p-ink2);
	}
</style>
