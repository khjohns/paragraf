<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import NodeRow from './NodeRow.svelte';

	const categoryOrder: Record<string, number> = { A: 0, B: 1, C: 2 };

	let filteredNodes = $derived.by(() => {
		let nodes = analysisState.nodes;

		// Filter
		if (uiState.listFilter === 'delimitation') {
			nodes = nodes.filter(n => analysisState.analysis.delimitations[n.id]);
		} else if (uiState.listFilter === 'unread') {
			nodes = nodes.filter(n => !analysisState.analysis.readStatus[n.id]);
		}

		// Sort
		return [...nodes].sort((a, b) => {
			if (uiState.listSort === 'category') {
				const ca = categoryOrder[a.category ?? 'C'] ?? 3;
				const cb = categoryOrder[b.category ?? 'C'] ?? 3;
				if (ca !== cb) return ca - cb;
				return b.citations - a.citations;
			}
			if (uiState.listSort === 'citations') {
				return b.citations - a.citations;
			}
			if (uiState.listSort === 'date') {
				return (b.date ?? '').localeCompare(a.date ?? '');
			}
			return 0;
		});
	});
</script>

<div class="node-list">
	<div class="list-body">
		{#each filteredNodes as node (node.id)}
			<NodeRow {node} />
		{/each}

		{#if filteredNodes.length === 0 && analysisState.nodes.length > 0}
			<p class="empty">Ingen resultater med dette filteret.</p>
		{:else if analysisState.nodes.length === 0}
			<div class="empty-state">
				<p class="empty-title">Definer utgangspunkt</p>
				<p class="empty-desc">Legg til bestemmelser og søkebegreper i venstrepanelet for å starte søket.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.node-list {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.list-body {
		flex: 1;
		overflow-y: auto;
	}
	.empty {
		padding: var(--spacing-6);
		text-align: center;
		color: var(--p-ink3);
		font-size: 0.8125rem;
	}
	.empty-state {
		padding: var(--spacing-8) var(--spacing-6);
		text-align: center;
	}
	.empty-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--p-ink2);
		margin-bottom: var(--spacing-1);
	}
	.empty-desc {
		font-size: 0.8125rem;
		color: var(--p-ink3);
		line-height: 1.5;
	}
</style>
