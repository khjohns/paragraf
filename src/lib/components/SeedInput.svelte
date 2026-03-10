<script lang="ts">
	import { analysisState } from '$lib/stores/analysis.svelte';

	let provisionInput = $state('');
	let ftsInput = $state('');

	let provisions = $derived(analysisState.analysis.seeds.provisions);
	let ftsTerms = $derived(analysisState.analysis.seeds.ftsTerms);
	let vectorQuery = $derived(analysisState.analysis.seeds.vectorQuery);
	let suggestions = $derived(analysisState.suggestedProvisions);

	// Debounce vectorQuery updates to avoid firing on every keystroke
	let vectorInputValue = $state(analysisState.analysis.seeds.vectorQuery);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleVectorInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		vectorInputValue = value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			analysisState.setSeeds({
				...analysisState.analysis.seeds,
				vectorQuery: value,
			});
		}, 1000);
	}

	// Sync external changes (e.g. load from storage)
	$effect(() => {
		if (vectorQuery !== vectorInputValue) {
			vectorInputValue = vectorQuery;
		}
	});

	function addProvision(value?: string) {
		const v = (value ?? provisionInput).trim();
		if (!v || provisions.includes(v)) return;
		analysisState.setSeeds({
			...analysisState.analysis.seeds,
			provisions: [...provisions, v],
		});
		if (!value) provisionInput = '';
	}

	function removeProvision(index: number) {
		analysisState.setSeeds({
			...analysisState.analysis.seeds,
			provisions: provisions.filter((_, i) => i !== index),
		});
	}

	function addFtsTerm() {
		const value = ftsInput.trim();
		if (!value || ftsTerms.includes(value)) return;
		analysisState.setSeeds({
			...analysisState.analysis.seeds,
			ftsTerms: [...ftsTerms, value],
		});
		ftsInput = '';
	}

	function removeFtsTerm(index: number) {
		analysisState.setSeeds({
			...analysisState.analysis.seeds,
			ftsTerms: ftsTerms.filter((_, i) => i !== index),
		});
	}

	function handleProvisionKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addProvision();
		}
	}

	function handleFtsKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addFtsTerm();
		}
	}
</script>

<div class="seed-input">
	<section>
		<label class="field-label" for="vector-input">Problemstilling</label>
		<textarea
			id="vector-input"
			value={vectorInputValue}
			oninput={handleVectorInput}
			placeholder="Beskriv problemstillingen med egne ord..."
			class="vector-field"
			rows="3"
		></textarea>
		{#if vectorQuery}
			<p class="field-hint">V-signal aktiv — semantisk søk kjøres</p>
		{/if}
	</section>

	<section>
		<label class="field-label" for="provision-input">Bestemmelser</label>
		<div class="chip-input">
			{#each provisions as prov, i}
				<span class="chip chip-provision">
					<span class="mono">{prov}</span>
					<button class="chip-remove" onclick={() => removeProvision(i)}>&times;</button>
				</span>
			{/each}
			<input
				id="provision-input"
				type="text"
				bind:value={provisionInput}
				onkeydown={handleProvisionKeydown}
				placeholder="f.eks. anskaffelsesforskriften:16-10"
				class="chip-field"
			/>
		</div>
		<p class="field-hint">Trykk Enter for å legge til. Format: lovnavn:paragraf</p>

		{#if suggestions.length > 0}
			<div class="suggestions">
				<span class="suggestions-label">Kan også være relevant:</span>
				<div class="suggestion-chips">
					{#each suggestions as s}
						<button class="suggestion-chip" onclick={() => addProvision(s.id)}>
							§{s.id.split(':')[1]} <span class="suggestion-count">({s.count})</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<section>
		<label class="field-label" for="fts-input">FTS-begreper</label>
		<div class="chip-input">
			{#each ftsTerms as term, i}
				<span class="chip chip-fts">
					<span>{term}</span>
					<button class="chip-remove" onclick={() => removeFtsTerm(i)}>&times;</button>
				</span>
			{/each}
			<input
				id="fts-input"
				type="text"
				bind:value={ftsInput}
				onkeydown={handleFtsKeydown}
				placeholder="f.eks. forpliktelseserklæring"
				class="chip-field"
			/>
		</div>
	</section>
</div>

<style>
	.seed-input {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
	.field-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--p-ink2);
	}
	.field-hint {
		font-size: 0.6875rem;
		color: var(--p-ink4);
	}

	/* Problem statement textarea */
	.vector-field {
		font-size: 0.8125rem;
		font-family: var(--font-body);
		line-height: 1.5;
		padding: var(--spacing-2);
		background: var(--p-input);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
		color: var(--p-ink);
		resize: vertical;
	}
	.vector-field:focus {
		outline: none;
		border-color: var(--p-border-s);
	}

	/* Chip inputs */
	.chip-input {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
		padding: var(--spacing-2);
		background: var(--p-input);
		border: 1px solid var(--p-border);
		border-radius: var(--radius-md);
		min-height: 36px;
		align-items: center;
	}
	.chip-input:focus-within {
		border-color: var(--p-border-s);
	}
	.chip-field {
		all: unset;
		flex: 1;
		min-width: 120px;
		font-size: 0.8125rem;
		font-family: var(--font-data);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}
	.chip-provision {
		background: var(--p-provision-bg);
		color: var(--p-provision-accent);
		border: 1px solid var(--p-provision-border);
	}
	.chip-fts {
		background: var(--p-kofa-bg);
		color: var(--p-kofa-accent);
		border: 1px solid var(--p-kofa-border);
	}
	.chip-remove {
		all: unset;
		cursor: pointer;
		font-size: 0.875rem;
		line-height: 1;
		opacity: 0.6;
	}
	.chip-remove:hover {
		opacity: 1;
	}
	.mono {
		font-family: var(--font-data);
	}

	/* Suggestion chips */
	.suggestions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding-top: var(--spacing-1);
	}
	.suggestions-label {
		font-size: 0.6875rem;
		color: var(--p-ink4);
		font-weight: 500;
	}
	.suggestion-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}
	.suggestion-chip {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.6875rem;
		font-family: var(--font-data);
		color: var(--p-provision-accent);
		border: 1px dashed var(--p-provision-border);
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
	}
	.suggestion-chip:hover {
		background: var(--p-provision-bg);
		border-color: var(--p-provision-accent);
	}
	.suggestion-count {
		color: var(--p-ink4);
		font-weight: 400;
	}
</style>
