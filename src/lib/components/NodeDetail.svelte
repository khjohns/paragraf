<script lang="ts">
	import type { GraphNode } from '$lib/types/graph';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import CaseReader from './CaseReader.svelte';
	import ProvisionDetail from './ProvisionDetail.svelte';
	import NodeTypeIcon from './NodeTypeIcon.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import DelimBadge from './DelimBadge.svelte';
	import ValencePip from './ValencePip.svelte';

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

	let mode = $state<'overview' | 'reading'>('overview');

	// Has readable text (KOFA cases)
	let hasText = $derived(selectedNode?.type === 'kofa_case');

	// Connected nodes (use Set for O(1) lookups)
	let connectedNodes = $derived.by(() => {
		if (!selectedNode?.connectedTo) return [];
		const idSet = new Set(selectedNode.connectedTo);
		return analysisState.nodes.filter(n => idSet.has(n.id));
	});

	// Build valence map once per selection (avoids O(N) per relation)
	let valenceMap = $derived.by(() => {
		if (!selectedNode) return new Map<string, string>();
		const map = new Map<string, string>();
		// Check selected node's valence first
		if (selectedNode.valence) {
			for (const [id, v] of Object.entries(selectedNode.valence)) {
				if (v !== 'unknown') map.set(id, v);
			}
		}
		// Check reverse valence from connected nodes
		for (const cn of connectedNodes) {
			if (!map.has(cn.id) && cn.valence?.[selectedNode.id] && cn.valence[selectedNode.id] !== 'unknown') {
				map.set(cn.id, cn.valence[selectedNode.id]);
			}
		}
		return map;
	});

	function getValence(targetId: string) {
		return valenceMap.get(targetId) ?? 'unknown';
	}

	// Reset mode when node changes
	$effect(() => {
		uiState.selectedNodeId;
		mode = 'overview';
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
				<div class="header-type">
					<NodeTypeIcon type={selectedNode.type} size={13} />
					<span class="type-label" style:color="var({meta.accentVar})">{meta.label}</span>
				</div>
				<button class="close-btn" onclick={() => uiState.selectNode(null)}>&times;</button>
			</div>
			<h2 class="node-title">{selectedNode.label}</h2>
			{#if selectedNode.subtitle}
				<p class="node-subtitle">{selectedNode.subtitle}</p>
			{/if}

			<div class="meta-row">
				{#if selectedNode.category}
					<CategoryBadge category={selectedNode.category} />
				{/if}
				{#if selectedNode.signals}
					<span class="signal-dots" title="R: Referanse  F: Fulltekst  V: Vektor">
						{#each [
							{ key: 'ref', on: selectedNode.signals.ref },
							{ key: 'fts', on: selectedNode.signals.fts },
							{ key: 'vec', on: selectedNode.signals.vec },
						] as sig}
							<span class="sig-dot" class:on={sig.on}></span>
						{/each}
					</span>
				{/if}
				{#if selectedNode.isDelimitation}
					<DelimBadge />
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
					<span class="meta-item mono">{selectedNode.citations} sit.</span>
				{/if}
				{#if selectedNode.directive}
					<span class="meta-item directive">{selectedNode.directive}</span>
				{/if}
			</div>

			<!-- Tab bar for nodes with readable text -->
			{#if hasText}
				<div class="tab-bar">
					<button
						class="tab-btn"
						class:active={mode === 'overview'}
						onclick={() => (mode = 'overview')}
					>Oversikt</button>
					<button
						class="tab-btn"
						class:active={mode === 'reading'}
						onclick={() => (mode = 'reading')}
					>Les avgjørelsen</button>
				</div>
			{/if}
		</div>

		<!-- Content area -->
		<div class="detail-body">
			{#if mode === 'reading' && selectedNode.type === 'kofa_case'}
				<CaseReader
					sakNr={selectedNode.label}
					onBack={() => (mode = 'overview')}
				/>
			{:else}
				<!-- Detail / Summary text -->
				{#if selectedNode.detail}
					<div class="detail-section">
						<div class="section-label">{selectedNode.type === 'provision' ? 'Ordlyd' : 'Sammendrag'}</div>
						<div class="detail-text">{selectedNode.detail}</div>
					</div>
				{/if}

				<!-- Signals detail -->
				{#if selectedNode.signals}
					<div class="detail-section">
						<div class="section-label">Treffsignaler</div>
						{#each [
							{ key: 'ref' as const, label: 'Referansetabell', on: selectedNode.signals.ref },
							{ key: 'fts' as const, label: 'Fulltekstsøk', on: selectedNode.signals.fts },
							{ key: 'vec' as const, label: 'Vektorsøk', on: selectedNode.signals.vec },
						] as sig}
							<div class="signal-row" class:signal-on={sig.on}>
								<span class="sig-indicator" class:on={sig.on}></span>
								<span class:signal-label-on={sig.on}>{sig.label}</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Relations -->
				{#if connectedNodes.length > 0}
					<div class="detail-section">
						<div class="section-label">Relasjoner ({connectedNodes.length})</div>
						{#each connectedNodes as cn}
							{@const v = getValence(cn.id)}
							<button class="relation-row" onclick={() => uiState.selectNode(cn.id)}>
								<NodeTypeIcon type={cn.type} size={10} />
								<span class="relation-label">{cn.label}</span>
								{#if v !== 'unknown'}
									<ValencePip valence={v} size={9} />
								{/if}
								<span class="relation-subtitle">{cn.subtitle?.slice(0, 28)}</span>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Provision detail -->
				{#if selectedNode.type === 'provision'}
					{@const parts = selectedNode.id.split(':')}
					<ProvisionDetail dokId="forskrift/2016-08-12-974" sectionId={parts[1] ?? ''} />
				{/if}

				<!-- Notes -->
				<div class="detail-section">
					<label class="section-label" for="notes-field">Mine notater</label>
					<textarea
						id="notes-field"
						class="notes-field"
						value={note}
						oninput={(e) => analysisState.setNote(selectedNode!.id, e.currentTarget.value)}
						placeholder="Skriv notater om denne rettskilden..."
						rows="3"
					></textarea>
				</div>

				<!-- Actions -->
				<div class="detail-actions">
					<button
						class="action-btn"
						class:active={isRead}
						onclick={() => analysisState.toggleRead(selectedNode!.id)}
					>
						{isRead ? '✓ Lest og vurdert' : 'Marker som lest'}
					</button>
					<button class="action-btn action-seed">
						Bruk som seed i neste iterasjon
					</button>
					{#if selectedNode.isDelimitation}
						<div class="delim-notice">
							Avgrensningspraksis — bestemmelsen ble vurdert som ikke-anvendelig
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.detail-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Header */
	.detail-header {
		padding: 14px 16px;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}
	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}
	.header-type {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.type-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
	}
	.close-btn {
		all: unset;
		cursor: pointer;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 15px;
		color: var(--p-ink3);
	}
	.close-btn:hover {
		background: var(--p-hover);
		color: var(--p-ink);
	}
	.node-title {
		font-family: var(--font-data);
		font-size: 15px;
		font-weight: 700;
		color: var(--p-ink);
		margin-bottom: 3px;
	}
	.node-subtitle {
		font-size: 12.5px;
		color: var(--p-ink2);
	}
	.meta-row {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.meta-item {
		font-size: 11px;
		color: var(--p-ink3);
	}
	.mono {
		font-family: var(--font-data);
	}
	.directive {
		color: var(--p-eu-accent);
		font-weight: 500;
	}

	.signal-dots {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.sig-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid var(--p-signal-off);
	}
	.sig-dot.on {
		background: var(--p-signal-on);
		border-color: var(--p-signal-on);
	}

	.outcome-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 4px;
	}
	.outcome-badge.brudd {
		background: var(--p-warn-bg);
		color: var(--p-warn);
	}
	.outcome-badge.ikke-brudd {
		background: var(--p-success-bg);
		color: var(--p-success);
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		margin-top: 10px;
		border-radius: 5px;
		border: 1px solid var(--p-border-m);
		overflow: hidden;
	}
	.tab-btn {
		all: unset;
		cursor: pointer;
		flex: 1;
		padding: 5px 0;
		text-align: center;
		font-size: 11px;
		font-weight: 400;
		color: var(--p-ink3);
		background: transparent;
	}
	.tab-btn.active {
		background: var(--p-ink);
		color: var(--p-panel);
		font-weight: 600;
	}

	/* Body */
	.detail-body {
		flex: 1;
		overflow-y: auto;
	}

	.detail-section {
		padding: 12px 16px;
		border-bottom: 1px solid var(--p-border);
	}
	.section-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink3);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin-bottom: 6px;
	}

	/* Detail text */
	.detail-text {
		font-size: 13px;
		line-height: 1.6;
		color: var(--p-ink);
	}

	/* Signals detail */
	.signal-row {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 4px 6px;
		border-radius: 3px;
		margin-bottom: 2px;
		font-size: 11.5px;
		color: var(--p-ink4);
		font-weight: 400;
	}
	.signal-row.signal-on {
		background: rgba(26,24,20,0.025);
	}
	.signal-label-on {
		font-weight: 600;
		color: var(--p-ink);
	}
	.sig-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid var(--p-signal-off);
		flex-shrink: 0;
	}
	.sig-indicator.on {
		background: var(--p-signal-on);
		border-color: var(--p-signal-on);
	}

	/* Relations */
	.relation-row {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 6px;
		border-radius: 4px;
		margin-bottom: 1px;
		width: 100%;
	}
	.relation-row:hover {
		background: var(--p-hover);
	}
	.relation-label {
		font-family: var(--font-data);
		font-weight: 500;
		font-size: 11.5px;
	}
	.relation-subtitle {
		color: var(--p-ink4);
		font-size: 10px;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Notes */
	.notes-field {
		width: 100%;
		padding: 7px 10px;
		font-size: 12.5px;
		line-height: 1.5;
		font-family: var(--font-ui);
		background: var(--p-input);
		border: 1px solid var(--p-border-m);
		border-radius: 5px;
		color: var(--p-ink);
		resize: vertical;
	}
	.notes-field:focus {
		outline: none;
		border-color: var(--p-kofa-accent);
	}

	/* Actions */
	.detail-actions {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.action-btn {
		all: unset;
		cursor: pointer;
		width: 100%;
		padding: 7px 12px;
		border-radius: 5px;
		border: 1px solid var(--p-border-m);
		color: var(--p-ink2);
		font-size: 12px;
		font-weight: 500;
		text-align: center;
	}
	.action-btn:hover {
		border-color: var(--p-border-s);
		color: var(--p-ink);
	}
	.action-btn.active {
		background: var(--p-success-bg);
		border-color: rgba(61,122,74,0.18);
		color: var(--p-success);
	}
	.action-seed {
		background: transparent;
	}
	.delim-notice {
		padding: 7px 10px;
		border-radius: 5px;
		background: var(--p-delim-bg);
		border: 1px solid rgba(196,101,10,0.1);
		font-size: 11px;
		color: var(--p-delim);
		line-height: 1.4;
		text-align: center;
	}
</style>
