<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchForarbeidDetail, fetchForarbeidSection } from '$lib/api/cases';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import type { ForarbeidDetailResponse, ForarbeidSectionResponse } from '$lib/types/api';
  import NodeTypeIcon from './NodeTypeIcon.svelte';

  let { docId }: { docId: string } = $props();

  // O(N) map built once, used for both provision lookup and existence checks
  let nodeTypeMap = $derived(new Map(analysisState.nodes.map((n) => [n.id, n.type])));

  // Find which provision this forarbeid is connected to (for section filtering)
  let connectedProvision = $derived.by(() => {
    const nodeId = `forarbeid:${docId}`;
    for (const e of analysisState.edges) {
      if (e.from === nodeId && nodeTypeMap.get(e.to) === 'provision') return e.to;
      if (e.to === nodeId && nodeTypeMap.get(e.from) === 'provision') return e.from;
    }
    return undefined;
  });

  const query = createQuery<ForarbeidDetailResponse>(() => ({
    queryKey: ['forarbeid-detail', docId, connectedProvision],
    queryFn: () => fetchForarbeidDetail(docId, connectedProvision),
    enabled: !!docId,
  }));

  let activeSectionNumber = $state<string | null>(null);
  let lawRefsOpen = $state(false);

  // Reset state when switching forarbeid documents
  $effect(() => {
    docId;
    activeSectionNumber = null;
    lawRefsOpen = false;
  });

  // Reset expand state when switching sections
  $effect(() => {
    activeSectionNumber;
    lawRefsOpen = false;
  });

  // Auto-select first section when data loads
  $effect(() => {
    if (query.data?.sections.length && !activeSectionNumber) {
      activeSectionNumber = query.data.sections[0].number;
    }
  });

  const sectionQuery = createQuery<ForarbeidSectionResponse>(() => ({
    queryKey: ['forarbeid-section', docId, activeSectionNumber],
    queryFn: () => fetchForarbeidSection(docId, activeSectionNumber!),
    enabled: !!docId && !!activeSectionNumber,
  }));

  function navigateToProvision(lawName: string, lawSection: string) {
    const provId = `${lawName}:${lawSection}`;
    if (nodeTypeMap.has(provId)) uiState.navigateTo(provId);
  }
</script>

<div class="forarbeid-detail">
  {#if query.isLoading}
    <p class="loading">Laster forarbeid...</p>
  {:else if query.data}
    {@const detail = query.data}

    <!-- Section navigation -->
    {#if detail.sections.length > 0}
      <div class="sections-nav">
        <div class="nav-heading">
          Omtalt i {detail.sections.length}
          {detail.sections.length === 1 ? 'seksjon' : 'seksjoner'}
        </div>
        {#each detail.sections as rs}
          <button
            class="section-btn"
            class:active={activeSectionNumber === rs.number}
            onclick={() => {
              activeSectionNumber = rs.number;
            }}
          >
            <span class="section-num">{rs.number}</span>
            <span class="section-title">{rs.title || rs.parent_path || ''}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Active section content -->
    {#if sectionQuery.isLoading}
      <p class="loading">Laster seksjon...</p>
    {:else if sectionQuery.data}
      {@const sec = sectionQuery.data}
      <div class="section-block">
        {#if sec.parent_path}
          <div class="section-path">{sec.parent_path}</div>
        {/if}
        {#if sec.title}
          <div class="section-heading">{sec.number}. {sec.title}</div>
        {/if}
        {#if sec.text}
          <div class="section-text">{sec.text}</div>
        {/if}
      </div>

      <!-- Law references -->
      {#if sec.law_references.length > 0}
        <div class="ref-section">
          <div class="ref-heading">Lovhenvisninger ({sec.law_references.length})</div>
          {#each lawRefsOpen ? sec.law_references : sec.law_references.slice(0, 3) as ref}
            {@const provId = `${ref.law_name}:${ref.law_section}`}
            {@const inGraph = nodeTypeMap.has(provId)}
            <button
              class="ref-row"
              class:clickable={inGraph}
              disabled={!inGraph}
              onclick={() => navigateToProvision(ref.law_name, ref.law_section)}
            >
              <NodeTypeIcon type="provision" size={10} />
              <span class="ref-id">{ref.law_name} §{ref.law_section}</span>
            </button>
          {/each}
          {#if sec.law_references.length > 3}
            <button
              class="show-more-btn"
              onclick={() => {
                lawRefsOpen = !lawRefsOpen;
              }}
            >
              {lawRefsOpen ? 'Vis færre' : `+ ${sec.law_references.length - 3} til`}
            </button>
          {/if}
        </div>
      {/if}
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

  /* Section navigation */
  .sections-nav {
    padding-top: var(--spacing-2);
    border-top: 1px solid var(--p-border);
  }
  .nav-heading {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: var(--spacing-1);
  }
  .section-btn {
    all: unset;
    display: flex;
    align-items: baseline;
    gap: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-md);
    width: 100%;
    font-size: 0.75rem;
    color: var(--p-ink3);
    cursor: pointer;
    transition: background 0.1s;
  }
  .section-btn:hover {
    background: var(--p-hover);
  }
  .section-btn.active {
    background: var(--p-surface);
    color: var(--p-ink);
  }
  .section-num {
    font-family: var(--font-data);
    font-weight: 600;
    flex-shrink: 0;
    min-width: 2.5em;
  }
  .section-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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
  .show-more-btn {
    all: unset;
    font-size: 0.6875rem;
    color: var(--p-prep-accent);
    cursor: pointer;
    padding: var(--spacing-1);
    font-weight: 500;
  }
  .show-more-btn:hover {
    text-decoration: underline;
  }
</style>
