<script lang="ts">
	import type { GraphNode } from '$lib/types/graph';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';

	let { node }: { node: GraphNode } = $props();

	let isSelected = $derived(uiState.selectedNodeId === node.id);
	let isRead = $derived(!!analysisState.analysis.readStatus[node.id]);
	let isDelimitation = $derived(!!analysisState.analysis.delimitations[node.id]);

	const accentMap: Record<string, string> = {
		provision: 'var(--p-provision-accent)',
		kofa_case: 'var(--p-kofa-accent)',
		eu_case: 'var(--p-eu-accent)',
		court_case: 'var(--p-court-accent)',
		prep_work: 'var(--p-prep-accent)',
	};

	let accent = $derived(accentMap[node.type] ?? 'var(--p-kofa-accent)');

	function handleCheckbox(e: Event) {
		e.stopPropagation();
		analysisState.toggleRead(node.id);
	}

	function handleCheckboxKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			analysisState.toggleRead(node.id);
		}
	}
</script>

<button
	class="node-row"
	class:selected={isSelected}
	style:border-left-color={isSelected ? accent : 'transparent'}
	onclick={() => uiState.selectNode(node.id)}
>
	<div class="row-main">
		<!-- Read checkbox -->
		<div
			class="checkbox"
			class:checked={isRead}
			onclick={handleCheckbox}
			onkeydown={handleCheckboxKeydown}
			role="checkbox"
			aria-checked={isRead}
			tabindex="0"
		>
			{#if isRead}
				<svg width="10" height="10" viewBox="0 0 10 10">
					<path d="M2 5L4.5 7.5L8 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
				</svg>
			{/if}
		</div>

		<!-- Type dot -->
		<span class="type-dot" style:background={accent}></span>

		<!-- Content -->
		<div class="row-content">
			<div class="row-line1">
				<span class="node-label">{node.label}</span>
				{#if node.category}
					<span class="cat-badge cat-{node.category.toLowerCase()}">{node.category}</span>
				{/if}
				{#if node.signals}
					<span class="signal-dots" title="R: Referanse  F: Fulltekst  V: Vektor">
						<span class="dot" class:on={node.signals.ref}></span>
						<span class="dot" class:on={node.signals.fts}></span>
						<span class="dot" class:on={node.signals.vec}></span>
					</span>
				{/if}
				{#if isDelimitation}
					<span class="delim-badge">Avgr.</span>
				{/if}
				<span class="subtitle">{node.subtitle}</span>
			</div>
			{#if node.date || node.outcome || node.citations > 0}
				<div class="row-line2">
					{#if node.date}<span>{node.date}</span>{/if}
					{#if node.outcome}
						<span
							class="outcome-badge"
							class:brudd={node.outcome === 'Brudd'}
							class:ikke-brudd={node.outcome === 'Ikke brudd'}
						>{node.outcome}</span>
					{/if}
					{#if node.citations > 0}
						<span class="citations">{node.citations} sit.</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</button>

<style>
	.node-row {
		all: unset;
		cursor: pointer;
		display: flex;
		width: 100%;
		padding: 9px 16px;
		border-bottom: 1px solid var(--p-border);
		border-left: 3px solid transparent;
		transition: background 0.12s ease;
	}
	.node-row:hover {
		background: var(--p-hover);
	}
	.node-row.selected {
		background: var(--p-active);
	}

	.row-main {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		width: 100%;
	}

	/* Checkbox — matches mock: 14px, rounded corners, border */
	.checkbox {
		width: 14px;
		height: 14px;
		min-width: 14px;
		border-radius: 3px;
		border: 1.5px solid var(--p-border-s);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1px;
		flex-shrink: 0;
		transition: all 0.12s ease;
	}
	.checkbox.checked {
		background: var(--p-success);
		border-color: var(--p-success);
		color: white;
	}
	.checkbox:hover {
		border-color: var(--p-ink3);
	}

	/* Type dot — 9px colored circle from mock */
	.type-dot {
		width: 9px;
		height: 9px;
		min-width: 9px;
		border-radius: 50%;
		opacity: 0.7;
		margin-top: 3px;
		flex-shrink: 0;
	}

	.row-content {
		flex: 1;
		min-width: 0;
	}

	.row-line1 {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		flex-wrap: nowrap;
		overflow: hidden;
	}
	.node-label {
		font-family: var(--font-data);
		font-weight: 600;
		font-size: 12px;
		color: var(--p-ink);
		flex-shrink: 0;
	}
	.cat-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 600;
		font-family: var(--font-data);
		flex-shrink: 0;
	}
	.cat-a { background: var(--p-success-bg); color: var(--p-success); }
	.cat-b { background: var(--p-warn-bg); color: var(--p-warn); }
	.cat-c { background: rgba(26,24,20,0.06); color: var(--p-ink2); }

	/* Signal dots — ●●○ pattern from mock */
	.signal-dots {
		display: inline-flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--p-signal-off);
	}
	.dot.on {
		background: var(--p-signal-on);
	}

	.delim-badge {
		font-size: 10px;
		font-weight: 600;
		color: var(--p-delim);
		background: var(--p-delim-bg);
		padding: 1px 5px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.subtitle {
		font-size: 11px;
		color: var(--p-ink2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.row-line2 {
		display: flex;
		gap: var(--spacing-2);
		font-size: 11px;
		color: var(--p-ink3);
		margin-top: 2px;
	}

	.outcome-badge {
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 10px;
	}
	.outcome-badge.brudd {
		background: var(--p-warn-bg);
		color: var(--p-warn);
	}
	.outcome-badge.ikke-brudd {
		background: var(--p-success-bg);
		color: var(--p-success);
	}

	.citations {
		font-family: var(--font-data);
	}
</style>
