<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchEuCaseDetail } from '$lib/api/cases';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import type { EuCaseDetailResponse } from '$lib/types/api';
  import NodeTypeIcon from './NodeTypeIcon.svelte';

  let { euCaseId }: { euCaseId: string } = $props();

  const query = createQuery<EuCaseDetailResponse>(() => ({
    queryKey: ['eu-case-detail', euCaseId],
    queryFn: () => fetchEuCaseDetail(euCaseId),
    enabled: !!euCaseId,
  }));

  let nodeLabelSet = $derived(new Set(analysisState.nodes.map((n) => n.label)));

  function navigateToCase(sakNr: string) {
    const node = analysisState.nodes.find((n) => n.label === sakNr);
    if (node) {
      uiState.navigateTo(node.id);
    }
  }
</script>

<div class="eu-detail">
  {#if query.isLoading}
    <p class="loading">Laster EU-dom...</p>
  {:else if query.data}
    {@const detail = query.data}

    {#if detail.case_name}
      <h3 class="title">{detail.case_name}</h3>
    {/if}

    {#if detail.subject}
      <p class="subject">{detail.subject}</p>
    {/if}

    {#if detail.description}
      <div class="description">{detail.description}</div>
    {/if}

    <div class="meta-pairs">
      {#if detail.celex}
        <span class="meta-key">CELEX</span>
        <span class="meta-val mono">{detail.celex}</span>
      {/if}
      {#if detail.judgment_date}
        <span class="meta-key">Dato</span>
        <span class="meta-val">{detail.judgment_date}</span>
      {/if}
      {#if detail.source_url}
        <span class="meta-key">Kilde</span>
        <span class="meta-val">
          <a href={detail.source_url} target="_blank" rel="noopener" class="link">EUR-Lex ↗</a>
        </span>
      {/if}
    </div>

    {#if detail.referencing_cases.length > 0}
      <div class="ref-section">
        <div class="ref-heading">Referert i {detail.referencing_cases_count} KOFA-saker</div>
        {#each detail.referencing_cases as ref}
          {@const inGraph = nodeLabelSet.has(ref.sak_nr)}
          <button
            class="ref-row"
            class:clickable={inGraph}
            disabled={!inGraph}
            onclick={() => navigateToCase(ref.sak_nr)}
          >
            <NodeTypeIcon type="kofa_case" size={10} />
            <span class="ref-id">{ref.sak_nr}</span>
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
  .eu-detail {
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
    color: var(--p-eu-accent);
    line-height: 1.3;
  }
  .subject {
    font-size: 0.8125rem;
    color: var(--p-ink2);
    line-height: 1.5;
  }
  .description {
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--p-ink);
    white-space: pre-wrap;
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
  .meta-val {
    color: var(--p-ink2);
  }
  .mono {
    font-family: var(--font-data);
  }
  .link {
    color: var(--p-eu-accent);
    text-decoration: none;
    font-weight: 500;
  }
  .link:hover {
    text-decoration: underline;
  }

  /* Reference rows — shared pattern */
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
