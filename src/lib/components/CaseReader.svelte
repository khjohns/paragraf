<script lang="ts">
	import { createCaseDetailQuery } from '$lib/queries/cases';

	let { sakNr, onBack }: { sakNr: string; onBack: () => void } = $props();

	const caseQuery = createCaseDetailQuery(() => sakNr);
</script>

<div class="case-reader">
	<button class="back-btn" onclick={onBack}>← Tilbake til oversikt</button>

	{#if caseQuery.isLoading}
		<p class="loading">Laster avgjørelse...</p>
	{:else if caseQuery.error}
		<p class="error">Kunne ikke laste avgjørelse.</p>
	{:else if caseQuery.data}
		{@const detail = caseQuery.data}

		<div class="case-meta">
			<h2 class="case-title">{detail.sak_nr}</h2>
			{#if detail.saken_gjelder}<p class="case-subject">{detail.saken_gjelder}</p>{/if}
			<div class="case-meta-row">
				{#if detail.avsluttet}<span>{detail.avsluttet}</span>{/if}
				{#if detail.avgjoerelse}
					<span class="verdict">{detail.avgjoerelse}</span>
				{/if}
			</div>
			{#if detail.innklaget || detail.klager}
				<div class="case-parties">
					{#if detail.klager}<span>Klager: {detail.klager}</span>{/if}
					{#if detail.innklaget}<span>Innklaget: {detail.innklaget}</span>{/if}
				</div>
			{/if}
		</div>

		<div class="paragraphs">
			{#each detail.paragraphs as para}
				<div class="paragraph" id="para-{para.paragraph_number}">
					<span class="para-num">{para.paragraph_number}</span>
					<p class="para-text">{para.text}</p>
				</div>
			{/each}
		</div>

		{#if detail.law_references.length > 0}
			<div class="references-section">
				<h3 class="ref-title">Lovhenvisninger ({detail.law_references.length})</h3>
				{#each detail.law_references as ref}
					<div class="ref-item">
						<span class="ref-label mono">{ref.law_name} §{ref.law_section}</span>
						{#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if detail.case_references.length > 0}
			<div class="references-section">
				<h3 class="ref-title">Sakshenvisninger ({detail.case_references.length})</h3>
				{#each detail.case_references as ref}
					<div class="ref-item">
						<span class="ref-label mono">{ref.to_sak_nr}</span>
						{#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if detail.eu_references.length > 0}
			<div class="references-section">
				<h3 class="ref-title">EU-referanser ({detail.eu_references.length})</h3>
				{#each detail.eu_references as ref}
					<div class="ref-item">
						<span class="ref-label">{ref.eu_case_name || ref.eu_case_id}</span>
						{#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.case-reader {
		padding: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.back-btn {
		all: unset;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--p-kofa-accent);
		font-weight: 500;
	}
	.back-btn:hover {
		text-decoration: underline;
	}
	.loading, .error {
		font-size: 0.8125rem;
		color: var(--p-ink3);
	}
	.case-meta {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding-bottom: var(--spacing-3);
		border-bottom: 1px solid var(--p-border);
	}
	.case-title {
		font-family: var(--font-data);
		font-size: 1rem;
		font-weight: 600;
	}
	.case-subject {
		font-size: 0.8125rem;
		color: var(--p-ink2);
	}
	.case-meta-row {
		display: flex;
		gap: var(--spacing-2);
		font-size: 0.75rem;
		color: var(--p-ink3);
	}
	.verdict {
		font-weight: 500;
	}
	.case-parties {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.75rem;
		color: var(--p-ink3);
	}

	/* Paragraph layout — matches mock: number + text */
	.paragraphs {
		display: flex;
		flex-direction: column;
	}
	.paragraph {
		display: flex;
		gap: var(--spacing-2);
		padding: var(--spacing-1) 0;
	}
	.para-num {
		font-family: var(--font-data);
		font-size: 0.6875rem;
		color: var(--p-ink4);
		min-width: 28px;
		text-align: right;
		user-select: none;
		padding-top: 2px;
		flex-shrink: 0;
	}
	.para-text {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--p-ink);
	}

	/* References */
	.references-section {
		border-top: 1px solid var(--p-border);
		padding-top: var(--spacing-3);
	}
	.ref-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--p-ink2);
		margin-bottom: var(--spacing-2);
	}
	.ref-item {
		padding: var(--spacing-1) 0;
		border-bottom: 1px solid var(--p-border);
	}
	.ref-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--p-ink);
	}
	.mono {
		font-family: var(--font-data);
	}
	.ref-context {
		font-size: 0.75rem;
		color: var(--p-ink3);
		margin-top: 2px;
	}
</style>
