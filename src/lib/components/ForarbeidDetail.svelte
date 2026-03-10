<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { fetchForarbeidDetail } from '$lib/api/cases';
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';
	import type { ForarbeidDetailResponse } from '$lib/types/api';
	import NodeTypeIcon from './NodeTypeIcon.svelte';

	let { docId, sectionNumber }: { docId: string; sectionNumber: string } = $props();

	const query = createQuery<ForarbeidDetailResponse>(() => ({
		queryKey: ['forarbeid-detail', docId, sectionNumber],
		queryFn: () => fetchForarbeidDetail(docId, sectionNumber),
		enabled: !!docId && !!sectionNumber,
	}));

	function navigateToProvision(lawName: string, lawSection: string) {
		const provId = `${lawName}:${lawSection}`;
		const node = analysisState.nodes.find(n => n.id === provId);
		if (node) {
			uiState.navigateTo(node.id);
		}
	}
</script>

<div class="forarbeid-detail">
	{#if query.isLoading}
		<p class="loading">Laster forarbeid...</p>
	{:else if query.data}
		{@const detail = query.data}

		<h3 class="title">{detail.title || detail.doc_id}</h3>
		{#if detail.full_title && detail.full_title !== detail.title}
			<p class="subtitle">{detail.full_title}</p>
		{/if}

		<div class="meta-pairs">
			{#if detail.doc_type}
				<span class="meta-key">Type</span>
				<span class="meta-val">{detail.doc_type}</span>
			{/if}
			{#if detail.session}
				<span class="meta-key">Sesjon</span>
				<span class="meta-val">{detail.session}</span>
			{/if}
			{#if detail.source_url}
				<span class="meta-key">Kilde</span>
				<span class="meta-val">
					<a href={detail.source_url} target="_blank" rel="noopener" class="link">Stortinget.no ↗</a>
				</span>
			{/if}
		</div>

		{#if detail.section}
			<div class="section-block">
				{#if detail.section.parent_path}
					<div class="section-path">{detail.section.parent_path}</div>
				{/if}
				{#if detail.section.title}
					<div class="section-heading">{detail.section.number}. {detail.section.title}</div>
				{/if}
				{#if detail.section.text}
					<div class="section-text">{detail.section.text}</div>
				{/if}
			</div>
		{/if}

		{#if detail.law_references.length > 0}
			<div class="ref-section">
				<div class="ref-heading">Lovhenvisninger</div>
				{#each detail.law_references as ref}
					{@const provId = `${ref.law_name}:${ref.law_section}`}
					{@const inGraph = analysisState.nodes.some(n => n.id === provId)}
					<button
						class="ref-row"
						class:clickable={inGraph}
						disabled={!inGraph}
						onclick={() => navigateToProvision(ref.law_name, ref.law_section)}
					>
						<NodeTypeIcon type="provision" size={10} />
						<span class="ref-id">{ref.law_name} §{ref.law_section}</span>
						{#if ref.context}
							<span class="ref-sub">{ref.context.slice(0, 50)}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.forarbeid-detail {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
	}
	.loading {
		font-size: 0.8125rem;
		color: var(--p-ink3);
	}
	.title {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--p-prep-accent);
		line-height: 1.3;
	}
	.subtitle {
		font-size: 0.75rem;
		color: var(--p-ink2);
		line-height: 1.4;
	}

	/* Metadata key-value pairs */
	.meta-pairs {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-1) var(--spacing-3);
		font-size: 0.6875rem;
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--p-border);
	}
	.meta-key {
		color: var(--p-ink3);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.meta-val { color: var(--p-ink2); }
	.link {
		color: var(--p-prep-accent);
		text-decoration: none;
		font-weight: 500;
	}
	.link:hover { text-decoration: underline; }

	/* Section content block */
	.section-block {
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--p-border);
	}
	.section-path {
		font-size: 0.6875rem;
		color: var(--p-ink4);
		margin-bottom: var(--spacing-1);
	}
	.section-heading {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--p-ink);
		margin-bottom: var(--spacing-1);
	}
	.section-text {
		font-size: 0.8125rem;
		line-height: 1.65;
		color: var(--p-ink);
		white-space: pre-wrap;
		max-height: 280px;
		overflow-y: auto;
		mask-image: linear-gradient(to bottom, black 90%, transparent);
		-webkit-mask-image: linear-gradient(to bottom, black 90%, transparent);
	}

	/* Reference rows */
	.ref-section {
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--p-border);
	}
	.ref-heading {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--p-ink3);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin-bottom: var(--spacing-1);
	}
	.ref-row {
		all: unset;
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1);
		border-radius: var(--radius-md);
		width: 100%;
		font-size: 0.6875rem;
		color: var(--p-ink4);
		transition: background 0.1s;
	}
	.ref-row.clickable {
		cursor: pointer;
		color: var(--p-ink2);
	}
	.ref-row.clickable:hover {
		background: var(--p-hover);
	}
	.ref-id {
		font-family: var(--font-data);
		font-weight: 500;
		flex-shrink: 0;
	}
	.ref-sub {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--p-ink4);
	}
</style>
