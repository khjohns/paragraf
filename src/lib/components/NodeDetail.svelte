<script lang="ts">
	import type { GraphNode } from '$lib/types/graph';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import CaseReader from './CaseReader.svelte';
	import ProvisionDetail from './ProvisionDetail.svelte';

	let selectedNode = $derived(
		analysisState.nodes.find(n => n.id === uiState.selectedNodeId) ?? null
	);

	let isRead = $derived(
		selectedNode ? !!analysisState.analysis.readStatus[selectedNode.id] : false
	);
	let isDelimitation = $derived(
		selectedNode ? !!analysisState.analysis.delimitations[selectedNode.id] : false
	);
	let note = $derived(
		selectedNode ? (analysisState.analysis.notes[selectedNode.id] ?? '') : ''
	);

	let showReading = $state(false);

	// Reset reading mode when node changes
	$effect(() => {
		uiState.selectedNodeId;
		showReading = false;
	});

	const typeMeta: Record<string, { label: string; bgVar: string; accentVar: string }> = {
		provision: { label: 'Lovbestemmelse', bgVar: '--p-provision-bg', accentVar: '--p-provision-accent' },
		kofa_case: { label: 'KOFA-avgjørelse', bgVar: '--p-kofa-bg', accentVar: '--p-kofa-accent' },
		eu_case: { label: 'EU-dom', bgVar: '--p-eu-bg', accentVar: '--p-eu-accent' },
		court_case: { label: 'Domstolsavgjørelse', bgVar: '--p-court-bg', accentVar: '--p-court-accent' },
		prep_work: { label: 'Forarbeid', bgVar: '--p-prep-bg', accentVar: '--p-prep-accent' },
	};

	let meta = $derived(typeMeta[selectedNode?.type ?? ''] ?? typeMeta.kofa_case);
</script>

{#if selectedNode}
	<div class="detail-panel">
		<!-- Header with node-type background color -->
		<div class="detail-header" style:background="var({meta.bgVar})">
			<div class="header-top">
				<span class="type-label">{meta.label}</span>
				<button class="close-btn" onclick={() => uiState.selectNode(null)}>&times;</button>
			</div>
			<h2 class="node-title" style:color="var({meta.accentVar})">{selectedNode.label}</h2>
			{#if selectedNode.subtitle}
				<p class="node-subtitle">{selectedNode.subtitle}</p>
			{/if}

			<div class="meta-row">
				{#if selectedNode.category}
					<span class="cat-badge cat-{selectedNode.category.toLowerCase()}">{selectedNode.category}</span>
				{/if}
				{#if selectedNode.signals}
					<span class="signal-info">
						{#if selectedNode.signals.ref}R{/if}
						{#if selectedNode.signals.fts}F{/if}
						{#if selectedNode.signals.vec}V{/if}
					</span>
				{/if}
				{#if selectedNode.date}
					<span class="meta-item">{selectedNode.date}</span>
				{/if}
				{#if selectedNode.outcome}
					<span
						class="outcome-badge"
						class:brudd={selectedNode.outcome === 'Brudd'}
						class:ikke-brudd={selectedNode.outcome === 'Ikke brudd'}
					>{selectedNode.outcome}</span>
				{/if}
				{#if selectedNode.citations > 0}
					<span class="meta-item mono">{selectedNode.citations} siteringer</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="detail-actions">
			<button class="action-btn" class:active={isRead} onclick={() => analysisState.toggleRead(selectedNode!.id)}>
				{isRead ? 'Lest' : 'Merk som lest'}
			</button>
			<button class="action-btn action-delim" class:active={isDelimitation} onclick={() => analysisState.toggleDelimitation(selectedNode!.id)}>
				{isDelimitation ? 'Avgrenset' : 'Avgrens'}
			</button>
		</div>

		<!-- Reading mode link (KOFA cases only) -->
		{#if selectedNode.type === 'kofa_case' && !showReading}
			<button class="read-link" onclick={() => { showReading = true; }}>
				Les avgjørelsen →
			</button>
		{/if}

		<!-- Reading mode content -->
		{#if showReading && selectedNode.type === 'kofa_case'}
			<CaseReader
				sakNr={selectedNode.label}
				onBack={() => { showReading = false; }}
			/>
		{/if}

		<!-- Provision detail -->
		{#if selectedNode.type === 'provision'}
			{@const parts = selectedNode.id.split(':')}
			<ProvisionDetail dokId="forskrift/2016-08-12-974" sectionId={parts[1] ?? ''} />
		{/if}

		<!-- Notes -->
		<div class="detail-notes">
			<label class="notes-label" for="notes-field">Mine notater</label>
			<textarea
				id="notes-field"
				class="notes-field"
				value={note}
				oninput={(e) => analysisState.setNote(selectedNode!.id, e.currentTarget.value)}
				placeholder="Skriv notater her..."
				rows="4"
			></textarea>
		</div>
	</div>
{/if}

<style>
	.detail-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	/* Header — node-type bg color, matching mock */
	.detail-header {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.type-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--p-ink3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.close-btn {
		all: unset;
		cursor: pointer;
		font-size: 1.25rem;
		color: var(--p-ink3);
		line-height: 1;
		padding: var(--spacing-1);
	}
	.close-btn:hover {
		color: var(--p-ink);
	}
	.node-title {
		font-family: var(--font-data);
		font-size: 15px;
		font-weight: 700;
	}
	.node-subtitle {
		font-size: 13px;
		color: var(--p-ink2);
	}
	.meta-row {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
		margin-top: var(--spacing-1);
	}
	.meta-item {
		font-size: 11px;
		color: var(--p-ink3);
	}
	.mono {
		font-family: var(--font-data);
	}
	.signal-info {
		font-family: var(--font-data);
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink3);
		letter-spacing: 0.05em;
	}
	.cat-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 7px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 600;
		font-family: var(--font-data);
	}
	.cat-a { background: var(--p-success-bg); color: var(--p-success); }
	.cat-b { background: var(--p-warn-bg); color: var(--p-warn); }
	.cat-c { background: rgba(26,24,20,0.06); color: var(--p-ink2); }
	.outcome-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 3px;
	}
	.outcome-badge.brudd {
		background: var(--p-warn-bg);
		color: var(--p-warn);
	}
	.outcome-badge.ikke-brudd {
		background: var(--p-success-bg);
		color: var(--p-success);
	}

	/* Actions */
	.detail-actions {
		display: flex;
		gap: var(--spacing-2);
		padding: 0 16px;
	}
	.action-btn {
		all: unset;
		cursor: pointer;
		padding: var(--spacing-1) var(--spacing-3);
		font-size: 0.75rem;
		border: 1px solid var(--p-border-m);
		border-radius: var(--radius-sm);
		color: var(--p-ink2);
	}
	.action-btn:hover {
		background: var(--p-hover);
	}
	.action-btn.active {
		background: var(--p-success-bg);
		border-color: var(--p-success);
		color: var(--p-success);
	}
	.action-delim.active {
		background: var(--p-delim-bg);
		border-color: var(--p-delim);
		color: var(--p-delim);
	}

	/* Reading link */
	.read-link {
		all: unset;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--p-kofa-accent);
		font-weight: 500;
		padding: 0 16px;
	}
	.read-link:hover {
		text-decoration: underline;
	}

	/* Notes */
	.detail-notes {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: 0 16px 16px;
	}
	.notes-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--p-ink3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.notes-field {
		width: 100%;
		padding: var(--spacing-2);
		font-size: 0.8125rem;
		font-family: var(--font-ui);
		background: var(--p-input);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
		color: var(--p-ink);
		resize: vertical;
	}
	.notes-field:focus {
		outline: none;
		border-color: var(--p-border-s);
	}

</style>
