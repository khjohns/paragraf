<script lang="ts">
	import { analysisState } from '$lib/stores/analysis.svelte';
	import { toastState } from '$lib/stores/toast.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import LeftPanelSection from './LeftPanelSection.svelte';
	import SeedInput from './SeedInput.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import DelimBadge from './DelimBadge.svelte';
	import ValencePip from './ValencePip.svelte';
	import { formatProvision } from '$lib/utils/provisions';

	// Stats
	let cases = $derived(analysisState.nodes.filter(n => n.category));
	let counts = $derived({
		total: cases.length,
		A: cases.filter(n => n.category === 'A').length,
		B: cases.filter(n => n.category === 'B').length,
		C: cases.filter(n => n.category === 'C').length,
	});
	let delimCount = $derived(analysisState.nodes.filter(n => n.isDelimitation).length);

	// Read progress per category (single pass)
	let readCounts = $derived.by(() => {
		const counts = { A: 0, B: 0, C: 0 };
		for (const n of cases) {
			if (n.category && analysisState.analysis.readStatus[n.id]) {
				counts[n.category]++;
			}
		}
		return counts;
	});

	// Gap matrix
	let gaps = $derived(analysisState.gaps);
	let zeroGaps = $derived(gaps.filter(g => g.count === 0));
</script>

<div class="left-panel-inner">
	<!-- Panel header -->
	<div class="panel-header">
		<div class="panel-eyebrow">Rettskildeanalyse</div>
		<div class="panel-name">
			{#if analysisState.analysis.seeds.provisions.length > 0}
				{formatProvision(analysisState.analysis.seeds.provisions[0])} — Analyse
			{:else}
				Ny analyse
			{/if}
		</div>
	</div>

	<div class="sections">
		<!-- 1. Problemstilling -->
		<LeftPanelSection num="1" title="Problemstilling" defaultOpen>
			<div class="problem-area">
				<textarea
					class="problem-input"
					value={analysisState.analysis.problemStatement}
					oninput={(e) => analysisState.setProblemStatement(e.currentTarget.value)}
					placeholder="Beskriv det juridiske spørsmålet du undersøker..."
					rows="3"
				></textarea>
			</div>
		</LeftPanelSection>

		<!-- 2. Søk -->
		<LeftPanelSection num="2" title="Søk" defaultOpen>
			<SeedInput />
		</LeftPanelSection>

		<!-- 3. Resultater -->
		<LeftPanelSection num="3" title="Resultater" subtitle="{counts.total} treff" defaultOpen>
			<div class="results-content">
				{#each [
					{ cat: 'A' as const, desc: 'Ref + FTS + Vektor', count: counts.A },
					{ cat: 'B' as const, desc: 'To av tre signaler', count: counts.B },
					{ cat: 'C' as const, desc: 'Ett signal', count: counts.C },
				] as item}
					<div class="result-row">
						<CategoryBadge category={item.cat} />
						<span class="result-desc">{item.desc}</span>
						<span class="result-count">{item.count}</span>
					</div>
				{/each}

				{#if delimCount > 0}
					<div class="result-row delim-row">
						<DelimBadge />
						<span class="result-count delim-count">{delimCount}</span>
					</div>
				{/if}

				{#if uiState.regulationFilter}
					<div class="regulation-notice">
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
							<path d="M8 1L14.5 13H1.5L8 1Z" stroke="var(--p-warn)" stroke-width="1.5" fill="none"/>
							<path d="M8 6V9M8 11V11.5" stroke="var(--p-warn)" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						<span>Kun gjeldende FOA (2017–) — eldre praksis er filtrert bort</span>
					</div>
				{/if}

				<div class="signal-legend">
					<span class="legend-label">Signaler:</span>
					<span class="legend-item"><span class="legend-dot on"></span>R — Ref.tabell</span>
					<span class="legend-item"><span class="legend-dot on"></span>F — Fulltekst</span>
					<span class="legend-item"><span class="legend-dot on"></span>V — Vektor</span>
				</div>
			</div>
		</LeftPanelSection>

		<!-- 4. Kartlegging -->
		<LeftPanelSection
			num="4"
			title="Kartlegging"
			subtitle="Runde {analysisState.analysis.iteration}"
			defaultOpen
		>
			{#snippet badge()}{/snippet}

			<div class="mapping-content">
				<!-- Read progress -->
				<div class="mapping-section">
					<div class="mapping-label">Lesestatus</div>
					{#each [
						{ cat: 'A' as const, total: counts.A, read: readCounts.A },
						{ cat: 'B' as const, total: counts.B, read: readCounts.B },
						{ cat: 'C' as const, total: counts.C, read: readCounts.C },
					] as item}
						<div class="progress-row">
							<CategoryBadge category={item.cat} small />
							<div class="progress-bar">
								<div
									class="progress-fill"
									class:cat-a={item.cat === 'A'}
									style:width="{item.total ? Math.round(item.read / item.total * 100) : 0}%"
								></div>
							</div>
							<span class="progress-count">{item.read}/{item.total}</span>
						</div>
					{/each}
				</div>

				<!-- Gap matrix -->
				{#if gaps.length > 0}
					<div class="mapping-section">
						<div class="mapping-label">Bestemmelsespar — interseksjoner</div>
						{#each gaps as gap}
							{@const isGap = gap.count === 0}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="gap-row"
								class:is-gap={isGap}
								onclick={isGap && gap.id1 && gap.id2 ? () => analysisState.addSeedsFromGap(gap.id1!, gap.id2!) : undefined}
							>
								<span class="gap-prov">{gap.provision1}</span>
								<span class="gap-sep">∩</span>
								<span class="gap-prov">{gap.provision2}</span>
								<span class="gap-value" class:zero={isGap}>{isGap ? '∅' : gap.count}</span>
							</div>
						{/each}
						{#if zeroGaps.length > 0}
							<div class="gap-note">
								{zeroGaps.length} hull — klikk for å legge til som søkeparametre
							</div>
						{/if}
					</div>
				{/if}

				<!-- Iteration history (Søkerunder) -->
				{#if analysisState.analysis.iterationHistory?.length}
					<div class="mapping-section">
						<div class="mapping-label">Søkerunder</div>
						<!-- Iteration 1 is always the initial search -->
						<button
							class="round-row"
							class:active={analysisState.filterIteration === 1}
							onclick={() => analysisState.toggleFilterIteration(1)}
						>
							<span class="round-num">1</span>
							<span class="round-seeds">
								{analysisState.analysis.seeds.provisions.slice(0, 2).map(p => `§${p.split(':')[1]}`).join(', ')}
								{#if analysisState.analysis.seeds.ftsTerms.length > 0}
									, «{analysisState.analysis.seeds.ftsTerms[0]}»
								{/if}
							</span>
							<span class="round-count">{analysisState.nodes.filter(n => n.iteration === 1).length}</span>
						</button>
						{#each analysisState.analysis.iterationHistory as entry}
							<button
								class="round-row"
								class:active={analysisState.filterIteration === entry.iteration}
								onclick={() => analysisState.toggleFilterIteration(entry.iteration)}
							>
								<span class="round-num">{entry.iteration}</span>
								<span class="round-seeds">
									+ {entry.addedSeeds.map(s => s.includes(':') ? `§${s.split(':')[1]}` : `«${s}»`).join(', ') || '—'}
								</span>
								<span class="round-count">+{entry.newNodeCount}</span>
							</button>
						{/each}
						{#if analysisState.filterIteration !== null}
							<div class="filter-active-notice">
								Viser kun runde {analysisState.filterIteration}
								<button class="clear-filter" onclick={() => analysisState.filterIteration = null}>Vis alle</button>
							</div>
						{/if}
					</div>
				{/if}

				<button class="new-iter-btn" onclick={() => analysisState.startNewIteration()}>
					+ Ny iterasjon med nye seeds
				</button>
			</div>
		</LeftPanelSection>

		<!-- 5. Om rangeringen -->
		<LeftPanelSection num="5" title="Om rangeringen">
			<div class="ranking-info">
				<p><strong>Siteringsretning skaper systematisk skjevhet.</strong> Eldre saker dominerer sentralitetsrangeringen.</p>
				<p>Kombiner «Siteringer» med «Dato» for å balansere.</p>
				<div class="valence-legend">
					<ValencePip valence="confirming" size={11} />
					<ValencePip valence="distinguishing" size={11} />
					<ValencePip valence="departing" size={11} />
					<span class="valence-labels">Bekreftende · Avgrensende · Fravikende</span>
				</div>
			</div>
		</LeftPanelSection>
	</div>
</div>

<style>
	.left-panel-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: 16px 16px 12px;
		border-bottom: 1px solid var(--p-border);
		flex-shrink: 0;
	}
	.panel-eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--p-ink3);
		margin-bottom: 4px;
	}
	.panel-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--p-ink);
	}

	.sections {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	/* Section 1: Problemstilling */
	.problem-area {
		display: flex;
		flex-direction: column;
	}
	.problem-input {
		width: 100%;
		padding: 10px 12px;
		border-radius: 6px;
		background: var(--p-input);
		border: 1px solid var(--p-border);
		font-size: 13px;
		line-height: 1.55;
		color: var(--p-ink);
		font-family: var(--font-ui);
		resize: vertical;
	}
	.problem-input:focus {
		outline: none;
		border-color: var(--p-border-s);
	}

	/* Section 3: Resultater */
	.results-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.result-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		border-radius: 5px;
		background: var(--p-surface);
		border: 1px solid var(--p-border);
	}
	.result-desc {
		font-size: 12px;
		color: var(--p-ink2);
		flex: 1;
	}
	.result-count {
		font-size: 13px;
		font-weight: 600;
		color: var(--p-ink);
		font-family: var(--font-data);
	}
	.delim-row {
		background: var(--p-delim-bg);
		border-color: rgba(196,101,10,0.1);
	}
	.delim-count {
		color: var(--p-delim);
	}

	.regulation-notice {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 4px;
		background: var(--p-warn-bg);
		border: 1px solid rgba(166,123,46,0.12);
		font-size: 11px;
		color: var(--p-warn);
		font-weight: 500;
	}

	.signal-legend {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 4px;
		background: var(--p-hover);
		font-size: 10px;
		color: var(--p-ink3);
		flex-wrap: wrap;
	}
	.legend-label {
		font-weight: 600;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.legend-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
	}
	.legend-dot.on {
		background: var(--p-signal-on);
	}

	/* Section 4: Kartlegging */
	.mapping-content {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.mapping-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.mapping-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink3);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin-bottom: 2px;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}
	.progress-bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--p-input);
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		border-radius: 2px;
		background: var(--p-ink2);
		transition: width 0.3s ease;
	}
	.progress-fill.cat-a {
		background: var(--p-ink);
	}
	.progress-count {
		font-family: var(--font-data);
		font-size: 10px;
		color: var(--p-ink3);
		min-width: 24px;
		text-align: right;
	}

	.gap-row {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 8px;
		border-radius: 4px;
		margin-bottom: 2px;
		border: 1px solid transparent;
	}
	.gap-row.is-gap {
		background: var(--p-gap-bg);
		border-color: rgba(155,77,202,0.12);
		cursor: pointer;
	}
	.gap-prov {
		font-size: 11px;
		font-family: var(--font-data);
		color: var(--p-ink2);
		min-width: 52px;
	}
	.gap-sep {
		font-size: 10px;
		color: var(--p-ink4);
	}
	.gap-value {
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-data);
		color: var(--p-ink3);
		margin-left: auto;
	}
	.gap-value.zero {
		color: var(--p-gap);
	}
	.gap-note {
		margin-top: 6px;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 11px;
		line-height: 1.4;
		color: var(--p-gap);
		font-style: italic;
	}

	.iter-info {
		padding: 7px 10px;
		border-radius: 4px;
		background: var(--p-success-bg);
		border: 1px solid rgba(61,122,74,0.1);
		font-size: 11px;
		color: var(--p-success);
		line-height: 1.4;
	}

	.round-row {
		all: unset;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
		color: var(--p-ink2);
		border: 1px solid transparent;
		width: 100%;
		box-sizing: border-box;
	}
	.round-row:hover {
		background: var(--p-hover);
	}
	.round-row.active {
		background: var(--p-active);
		border-color: var(--p-border-m);
	}
	.round-num {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--p-input);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink3);
		flex-shrink: 0;
	}
	.round-row.active .round-num {
		background: var(--p-ink);
		color: var(--p-panel);
	}
	.round-seeds {
		flex: 1;
		font-family: var(--font-data);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.round-count {
		font-family: var(--font-data);
		font-size: 11px;
		font-weight: 600;
		color: var(--p-ink3);
		flex-shrink: 0;
	}
	.filter-active-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 5px 8px;
		border-radius: 4px;
		background: var(--p-active);
		font-size: 10px;
		color: var(--p-ink3);
	}
	.clear-filter {
		all: unset;
		cursor: pointer;
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink2);
		text-decoration: underline;
	}
	.clear-filter:hover {
		color: var(--p-ink);
	}

	.new-iter-btn {
		all: unset;
		cursor: pointer;
		width: 100%;
		padding: 8px 12px;
		border-radius: 5px;
		border: 1px dashed var(--p-border-m);
		font-size: 12px;
		font-weight: 500;
		color: var(--p-ink3);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}
	.new-iter-btn:hover {
		border-color: var(--p-border-s);
		color: var(--p-ink);
	}

	/* Section 5: Om rangeringen */
	.ranking-info {
		font-size: 12px;
		line-height: 1.55;
		color: var(--p-ink2);
	}
	.ranking-info p {
		margin: 0 0 8px;
	}
	.ranking-info strong {
		color: var(--p-ink);
		font-weight: 600;
	}
	.valence-legend {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 4px;
		background: var(--p-hover);
		margin-top: 4px;
	}
	.valence-labels {
		font-size: 10px;
		color: var(--p-ink3);
	}
</style>
