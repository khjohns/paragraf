<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { fetchProvisionDetail } from '$lib/api/cases';
	import type { ProvisionDetailResponse } from '$lib/types/api';

	let { dokId, sectionId }: { dokId: string; sectionId: string } = $props();

	const query = createQuery<ProvisionDetailResponse>(() => ({
		queryKey: ['provision-detail', dokId, sectionId],
		queryFn: () => fetchProvisionDetail(dokId, sectionId),
		enabled: !!dokId && !!sectionId,
	}));
</script>

<div class="provision-detail">
	{#if query.isLoading}
		<p class="loading">Laster lovtekst...</p>
	{:else if query.data}
		{@const detail = query.data}

		{#if detail.structure_path.length > 0}
			<div class="breadcrumb">
				{#each detail.structure_path as part, i}
					<span>{part}</span>
					{#if i < detail.structure_path.length - 1}<span class="sep">›</span>{/if}
				{/each}
			</div>
		{/if}

		<h3 class="provision-title">{detail.title}</h3>

		<div class="provision-content">
			{detail.content}
		</div>

		<div class="provision-meta">
			<span>{detail.referencing_cases} KOFA-saker refererer til denne bestemmelsen</span>
		</div>
	{/if}
</div>

<style>
	.provision-detail {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		margin: 0 16px;
		background: var(--p-provision-bg);
		border: 1px solid var(--p-provision-border);
		border-radius: var(--radius-md);
	}
	.loading {
		font-size: 0.8125rem;
		color: var(--p-ink3);
	}
	.breadcrumb {
		display: flex;
		gap: var(--spacing-1);
		font-size: 0.6875rem;
		color: var(--p-ink3);
		flex-wrap: wrap;
	}
	.sep {
		color: var(--p-ink4);
	}
	.provision-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--p-provision-accent);
	}
	.provision-content {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--p-ink);
		white-space: pre-wrap;
	}
	.provision-meta {
		font-size: 0.6875rem;
		color: var(--p-ink3);
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--p-provision-border);
	}
</style>
