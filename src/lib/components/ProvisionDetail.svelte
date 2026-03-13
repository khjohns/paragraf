<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchProvisionDetail } from '$lib/api/cases';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import type { ProvisionDetailResponse } from '$lib/types/api';
  import NodeTypeIcon from './NodeTypeIcon.svelte';

  let { dokId, sectionId }: { dokId: string; sectionId: string } = $props();

  const query = createQuery<ProvisionDetailResponse>(() => ({
    queryKey: ['provision-detail', dokId, sectionId],
    queryFn: () => fetchProvisionDetail(dokId, sectionId),
    enabled: !!dokId && !!sectionId,
  }));

  let nodeLabelSet = $derived(new Set(analysisState.nodes.map((n) => n.label)));

  function navigateToCase(sakNr: string) {
    const node = analysisState.nodes.find((n) => n.label === sakNr);
    if (node) {
      uiState.navigateTo(node.id);
    }
  }
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

    <h3 class="title">{detail.title}</h3>

    <div class="content">{detail.content}</div>

    {#if detail.referencing_case_list.length > 0}
      <div class="ref-section">
        <div class="ref-heading">{detail.referencing_cases} refererende saker</div>
        {#each detail.referencing_case_list as c}
          {@const inGraph = nodeLabelSet.has(c.sak_nr)}
          <button
            class="ref-row"
            class:clickable={inGraph}
            disabled={!inGraph}
            onclick={() => navigateToCase(c.sak_nr)}
          >
            <NodeTypeIcon type="kofa_case" size={10} />
            <span class="ref-id">{c.sak_nr}</span>
            <span class="ref-sub">{c.saken_gjelder?.slice(0, 40)}</span>
          </button>
        {/each}
      </div>
    {:else if detail.referencing_cases > 0}
      <div class="ref-count">{detail.referencing_cases} KOFA-saker refererer hit</div>
    {/if}
  {/if}
</div>

<style>
  .provision-detail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
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
    line-height: 1.4;
  }
  .sep {
    color: var(--p-ink4);
  }
  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--p-provision-accent);
    line-height: 1.3;
  }
  .content {
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--p-ink);
    white-space: pre-wrap;
  }

  /* Reference section */
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
  .ref-count {
    font-size: 0.6875rem;
    color: var(--p-ink3);
  }
  .ref-row {
    all: unset;
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-1);
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
