<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import NodeRow from './NodeRow.svelte';

	const categoryOrder: Record<string, number> = { A: 0, B: 1, C: 2 };

	function isNodeDimmed(node: typeof analysisState.nodes[0]): boolean {
		if (uiState.listFilter === 'delimitation') {
			return !analysisState.analysis.delimitations[node.id];
		}
		if (uiState.listFilter === 'unread') {
			return !!analysisState.analysis.readStatus[node.id];
		}
		return false;
	}

	let dimmedSet = $derived.by(() => {
		const set = new Set<string>();
		for (const node of analysisState.nodes) {
			if (isNodeDimmed(node)) set.add(node.id);
		}
		return set;
	});

	let sortedNodes = $derived.by(() => {
		const nodes = [...analysisState.nodes];

		// Sort by chosen criterion
		nodes.sort((a, b) => {
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

		// Then stable-sort: visible nodes first, dimmed nodes after
		if (uiState.listFilter !== 'all') {
			nodes.sort((a, b) => {
				const aDim = dimmedSet.has(a.id) ? 1 : 0;
				const bDim = dimmedSet.has(b.id) ? 1 : 0;
				return aDim - bDim;
			});
		}

		return nodes;
	});
</script>

<div class="node-list">
	<div class="list-body">
		{#each sortedNodes as node (node.id)}
			<NodeRow {node} dimmed={dimmedSet.has(node.id)} />
		{/each}

		{#if analysisState.nodes.length === 0}
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
.empty-state {
		padding: 64px var(--spacing-6) var(--spacing-8);
		text-align: center;
		max-width: 280px;
		margin: 0 auto;
	}
	.empty-title {
		font-size: 15px;
		font-weight: 600;
		color: var(--p-ink);
		margin-bottom: var(--spacing-2);
		letter-spacing: -0.01em;
	}
	.empty-desc {
		font-size: 13px;
		color: var(--p-ink3);
		line-height: 1.55;
	}
</style>
