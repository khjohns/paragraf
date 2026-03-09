<script lang="ts">
	import { analysisState } from '$lib/stores/analysis.svelte';

	let readCount = $derived(
		Object.values(analysisState.analysis.readStatus).filter(Boolean).length
	);
	let totalCount = $derived(analysisState.nodes.length);
</script>

<header class="workspace-header">
	<span class="brand">Paragraf</span>
	<span class="sep">&middot;</span>
	<span class="context">
		{#if analysisState.analysis.seeds.provisions.length > 0}
			{analysisState.analysis.seeds.provisions[0]}
		{:else}
			Ny analyse
		{/if}
	</span>
	<span class="spacer"></span>
	{#if totalCount > 0}
		<span class="progress">{readCount} av {totalCount} lest</span>
	{/if}
</header>

<style>
	.workspace-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--p-border);
		background: var(--p-panel);
		flex-shrink: 0;
	}
	.brand {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--p-ink3);
	}
	.sep {
		color: var(--p-border-s);
	}
	.context {
		font-size: 13px;
		font-weight: 600;
		color: var(--p-ink);
	}
	.spacer {
		flex: 1;
	}
	.progress {
		font-size: 11px;
		color: var(--p-ink3);
	}
</style>
