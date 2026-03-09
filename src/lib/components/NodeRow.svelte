<script lang="ts">
	import { NODE_TYPE_ACCENT, type GraphNode } from '$lib/types/graph';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import NodeTypeIcon from './NodeTypeIcon.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import DelimBadge from './DelimBadge.svelte';
	import ValencePip from './ValencePip.svelte';

	let { node }: { node: GraphNode } = $props();

	let isSelected = $derived(uiState.selectedNodeId === node.id);
	let isRead = $derived(!!analysisState.analysis.readStatus[node.id]);
	let isDelimitation = $derived(node.isDelimitation || !!analysisState.analysis.delimitations[node.id]);
	let isDimmed = $derived(uiState.regulationFilter && node.regulation === 'old');

	let accent = $derived(NODE_TYPE_ACCENT[node.type]);

	let valenceEntries = $derived(
		node.valence
			? Object.entries(node.valence).filter(([_, v]) => v !== 'unknown')
			: []
	);

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

	let nodeLabelMap = $derived(
		new Map(analysisState.nodes.map(n => [n.id, n.label]))
	);

	function getTargetLabel(targetId: string): string {
		return nodeLabelMap.get(targetId) ?? targetId;
	}
</script>

<button
	class="node-row"
	class:selected={isSelected}
	class:dimmed={isDimmed}
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

		<!-- Type icon -->
		<span class="type-icon">
			<NodeTypeIcon type={node.type} size={11} />
		</span>

		<!-- Content -->
		<div class="row-content">
			<div class="row-line1">
				<span class="node-label">{node.label}</span>
				{#if node.category}
					<CategoryBadge category={node.category} small />
				{/if}
				{#if node.signals}
					<span class="signal-dots" title="R: Referanse  F: Fulltekst  V: Vektor">
						<span class="dot" class:on={node.signals.ref}></span>
						<span class="dot" class:on={node.signals.fts}></span>
						<span class="dot" class:on={node.signals.vec}></span>
					</span>
				{/if}
				{#if isDelimitation}
					<DelimBadge compact />
				{/if}
				{#if node.iteration > 1}
					<span class="iter-badge">iter. {node.iteration}</span>
				{/if}
				<span class="subtitle">{node.subtitle}</span>
			</div>
			{#if node.date || node.outcome || node.citations > 0 || node.directive || valenceEntries.length > 0}
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
					{#if node.directive}
						<span class="directive">{node.directive}</span>
					{/if}
					{#each valenceEntries as [targetId, val]}
						<span class="valence-ref">
							<ValencePip valence={val} size={9} />
							<span class="valence-label">{getTargetLabel(targetId)}</span>
						</span>
					{/each}
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
		padding: 11px 16px;
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
	.node-row.dimmed {
		opacity: 0.2;
	}

	.row-main {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		width: 100%;
	}

	.checkbox {
		width: 15px;
		height: 15px;
		min-width: 15px;
		border-radius: 3px;
		border: 1.5px solid var(--p-border-s);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
		flex-shrink: 0;
		transition: all 0.12s ease;
	}
	.checkbox.checked {
		background: var(--p-success-bg);
		border-color: var(--p-success);
		color: var(--p-success);
	}
	.checkbox:hover {
		border-color: var(--p-ink3);
	}

	.type-icon {
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
		gap: 5px;
		flex-wrap: wrap;
		overflow: hidden;
	}
	.node-label {
		font-family: var(--font-data);
		font-weight: 600;
		font-size: 12.5px;
		color: var(--p-ink);
		flex-shrink: 0;
	}

	.signal-dots {
		display: inline-flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid var(--p-signal-off);
	}
	.dot.on {
		background: var(--p-signal-on);
		border-color: var(--p-signal-on);
	}

	.iter-badge {
		font-size: 9px;
		font-weight: 600;
		color: var(--p-success);
		background: var(--p-success-bg);
		padding: 1px 5px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.subtitle {
		font-size: 11.5px;
		color: var(--p-ink2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.row-line2 {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 10.5px;
		color: var(--p-ink3);
		margin-top: 3px;
		flex-wrap: wrap;
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

	.directive {
		font-style: italic;
		color: var(--p-eu-accent);
	}

	.valence-ref {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.valence-label {
		font-family: var(--font-data);
		font-size: 9.5px;
	}
</style>
