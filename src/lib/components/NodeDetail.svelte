<script lang="ts">
	import type { GraphNode, Valence } from '$lib/types/graph';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import { createCurationQuery } from '$lib/queries/curation';
	import CaseReader from './CaseReader.svelte';
	import ProvisionDetail from './ProvisionDetail.svelte';
	import EuCaseDetail from './EuCaseDetail.svelte';
	import ForarbeidDetail from './ForarbeidDetail.svelte';
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

	// Keyboard shortcut handler
	function handleShortcut(e: CustomEvent<string>) {
		if (!selectedNode) return;
		if (e.detail === 'read' && hasText) {
			mode = 'reading';
		} else if (e.detail === 'escape') {
			if (mode === 'reading') {
				mode = 'overview';
			} else {
				uiState.selectNode(null);
			}
		}
	}

	$effect(() => {
		const handler = (e: Event) => handleShortcut(e as CustomEvent<string>);
		window.addEventListener('paragraf:shortcut', handler);
		return () => window.removeEventListener('paragraf:shortcut', handler);
	});

	// AI curation query (only for KOFA cases with a problem statement)
	const curationQuery = createCurationQuery(() => ({
		sakNr: selectedNode?.type === 'kofa_case' ? selectedNode.label : null,
		problemStatement: analysisState.analysis.problemStatement,
		seedProvisions: analysisState.analysis.seeds.provisions,
	}));

	// Connected nodes (use Set for O(1) lookups)
	let connectedNodes = $derived.by(() => {
		if (!selectedNode?.connectedTo) return [];
		const idSet = new Set(selectedNode.connectedTo);
		return analysisState.nodes.filter(n => idSet.has(n.id));
	});

	// Build valence map once per selection (avoids O(N) per relation)
	let valenceMap = $derived.by(() => {
		if (!selectedNode) return new Map<string, Valence>();
		const map = new Map<string, Valence>();
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

	// Build breadcrumb labels from navigation history node IDs
	let breadcrumbNodes = $derived(
		uiState.navigationHistory.map(id => analysisState.nodes.find(n => n.id === id)).filter(Boolean) as import('$lib/types/graph').GraphNode[]
	);
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
				<button class="close-btn" onclick={() => uiState.selectNode(null)}>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>

			<!-- Breadcrumb trail (only when navigating via cross-references) -->
			{#if breadcrumbNodes.length > 0}
				<div class="breadcrumb-trail">
					{#each breadcrumbNodes as crumb, i}
						<button class="breadcrumb-item" onclick={() => uiState.navigateToBreadcrumb(i)}>
							{crumb.label}
						</button>
						<span class="breadcrumb-sep">&rarr;</span>
					{/each}
					<span class="breadcrumb-current">{selectedNode.label}</span>
				</div>
			{/if}

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
					curation={curationQuery.data ?? null}
					curationLoading={curationQuery.isLoading}
				/>
			{:else}
				<!-- Detail / Summary text -->
				{#if selectedNode.detail}
					<div class="detail-section">
						<div class="section-label">{selectedNode.type === 'provision' ? 'Ordlyd' : 'Sammendrag'}</div>
						<div class="detail-text">{selectedNode.detail}</div>
					</div>
				{/if}

				<!-- AI-curated summary (KOFA cases only) -->
				{#if selectedNode.type === 'kofa_case' && (curationQuery.data || curationQuery.isLoading)}
					<div class="detail-section">
						<div class="section-label">AI-markerte avsnitt</div>
						{#if curationQuery.isLoading}
							<div class="ai-loading">
								<div class="ai-loading-bar"></div>
								<span class="ai-loading-text">Genererer AI-kuratering...</span>
							</div>
						{:else if curationQuery.data}
							{#if curationQuery.data.summary_note}
								<div class="ai-summary-note">{curationQuery.data.summary_note}</div>
							{/if}
							{#each curationQuery.data.highlights.slice(0, 3) as hl}
								<div class="ai-preview">
									<div class="ai-preview-num">Avsnitt {hl.paragraph}</div>
									<p class="ai-preview-text">
										{hl.relevance.length > 150 ? hl.relevance.slice(0, 150) + '...' : hl.relevance}
									</p>
									<button class="ai-preview-link" onclick={() => { mode = 'reading'; }}>
										Les i kontekst →
									</button>
								</div>
							{/each}
						{/if}
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
							<button class="relation-row" onclick={() => uiState.navigateTo(cn.id)}>
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
					<ProvisionDetail dokId={parts[0] ?? ''} sectionId={parts[1] ?? ''} />
				{/if}

				<!-- EU case detail -->
				{#if selectedNode.type === 'eu_case'}
					<EuCaseDetail euCaseId={selectedNode.id.replace('eu:', '')} />
				{/if}

				<!-- Forarbeid detail -->
				{#if selectedNode.type === 'prep_work'}
					{@const parts = selectedNode.id.split(':')}
					<ForarbeidDetail docId={parts.length > 3 ? parts.slice(1, -1).join(':') : parts[1] ?? ''} sectionNumber={parts[parts.length - 1] ?? ''} />
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
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--p-ink3);
	}
	.close-btn:hover {
		background: var(--p-hover);
		color: var(--p-ink);
	}
	/* Breadcrumb trail */
	.breadcrumb-trail {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
		margin-bottom: 6px;
		font-size: 11px;
		line-height: 1.3;
	}
	.breadcrumb-item {
		all: unset;
		cursor: pointer;
		font-family: var(--font-data);
		color: var(--p-ink3);
		font-weight: 500;
	}
	.breadcrumb-item:hover {
		color: var(--p-ink);
		text-decoration: underline;
	}
	.breadcrumb-sep {
		color: var(--p-ink4);
		font-size: 10px;
	}
	.breadcrumb-current {
		font-family: var(--font-data);
		color: var(--p-ink2);
		font-weight: 600;
	}

	.node-title {
		font-family: var(--font-data);
		font-size: 15px;
		font-weight: 700;
		color: var(--p-ink);
		margin-bottom: 3px;
	}
	.node-subtitle {
		font-size: 13px;
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

	/* Tab bar — matches view-switcher pattern */
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
		padding: 4px 0;
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		color: var(--p-ink3);
		background: transparent;
	}
	.tab-btn:hover:not(.active) {
		background: var(--p-hover);
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
		border-radius: var(--radius-sm);
		margin-bottom: 2px;
		font-size: 12px;
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
		font-size: 12px;
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
		font-size: 13px;
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
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--p-delim-bg);
		border: 1px solid rgba(196,101,10,0.1);
		font-size: 0.6875rem;
		color: var(--p-delim);
		line-height: 1.4;
		text-align: center;
	}

	/* AI loading state in overview */
	.ai-loading {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-1) 0;
	}
	.ai-loading-bar {
		width: 3px;
		height: var(--spacing-4);
		border-radius: 2px;
		background: var(--p-ai-border);
		animation: pulse 2s ease-in-out infinite;
	}
	.ai-loading-text {
		font-size: 0.75rem;
		color: var(--p-ink4);
	}
	@keyframes pulse {
		0%, 100% { opacity: 0.15; }
		50% { opacity: 0.8; }
	}
	.ai-summary-note {
		border-left: 3px solid var(--p-ai-border);
		background: var(--p-ai-bg);
		padding: 8px 12px;
		margin-bottom: 8px;
		border-radius: 0 4px 4px 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--p-ai-text);
	}
	.ai-preview {
		padding: 6px 0;
		border-bottom: 1px solid var(--p-border);
	}
	.ai-preview-num {
		font-family: var(--font-data);
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--p-ai-border);
		margin-bottom: 2px;
	}
	.ai-preview-text {
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--p-ink2);
	}
	.ai-preview-link {
		all: unset;
		cursor: pointer;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--p-ai-border);
		margin-top: 4px;
		display: inline-block;
	}
	.ai-preview-link:hover {
		text-decoration: underline;
	}
</style>
