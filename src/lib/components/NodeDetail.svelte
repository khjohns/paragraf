<script lang="ts">
  import type { GraphNode } from '$lib/types/graph';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { createCurationQuery } from '$lib/queries/curation';
  import CaseReader from './CaseReader.svelte';
  import NodeDetailOverview from './NodeDetailOverview.svelte';
  import NodeTypeIcon from './NodeTypeIcon.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import DelimBadge from './DelimBadge.svelte';

  let selectedNode = $derived(
    analysisState.nodes.find((n) => n.id === uiState.selectedNodeId) ?? null
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

  // AI curation query (only for KOFA cases with a problem statement, and KI enabled)
  const curationQuery = createCurationQuery(() => ({
    sakNr: uiState.aiEnabled && selectedNode?.type === 'kofa_case' ? selectedNode.label : null,
    problemStatement: analysisState.analysis.problemStatement,
    seedProvisions: analysisState.analysis.seeds.provisions,
  }));

  // Reset mode when node changes
  $effect(() => {
    uiState.selectedNodeId;
    mode = 'overview';
  });

  const typeMeta: Record<string, { label: string; bgVar: string; accentVar: string }> = {
    provision: {
      label: 'Lovbestemmelse',
      bgVar: '--p-provision-bg',
      accentVar: '--p-provision-accent',
    },
    kofa_case: { label: 'KOFA-avgjørelse', bgVar: '--p-kofa-bg', accentVar: '--p-kofa-accent' },
    eu_case: { label: 'EU-dom', bgVar: '--p-eu-bg', accentVar: '--p-eu-accent' },
    court_case: {
      label: 'Domstolsavgjørelse',
      bgVar: '--p-court-bg',
      accentVar: '--p-court-accent',
    },
    prep_work: { label: 'Forarbeid', bgVar: '--p-prep-bg', accentVar: '--p-prep-accent' },
  };

  let meta = $derived(typeMeta[selectedNode?.type ?? ''] ?? typeMeta.kofa_case);

  // Build breadcrumb labels using Map for O(1) lookups
  let breadcrumbNodes = $derived.by(() => {
    const nodeMap = new Map(analysisState.nodes.map((n) => [n.id, n]));
    return uiState.navigationHistory.map((id) => nodeMap.get(id)).filter(Boolean) as GraphNode[];
  });
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
        <button
          class="close-btn"
          aria-label="Lukk detaljpanel"
          onclick={() => uiState.selectNode(null)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
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
            {#each [{ key: 'ref', on: selectedNode.signals.ref }, { key: 'fts', on: selectedNode.signals.fts }, { key: 'vec', on: selectedNode.signals.vec }] as sig}
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
            class:ikke-brudd={selectedNode.outcome === 'Ikke brudd'}>{selectedNode.outcome}</span
          >
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
            onclick={() => (mode = 'overview')}>Oversikt</button
          >
          <button
            class="tab-btn"
            class:active={mode === 'reading'}
            onclick={() => (mode = 'reading')}>Les avgjørelsen</button
          >
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
        <NodeDetailOverview
          node={selectedNode}
          curationData={curationQuery.data ?? null}
          curationLoading={curationQuery.isLoading}
          onReadMode={() => (mode = 'reading')}
        />
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
    padding: 12px 16px;
    border-bottom: 1px solid var(--p-border);
    flex-shrink: 0;
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .header-type {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .type-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
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
    margin-bottom: 4px;
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
    margin-bottom: 4px;
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
    gap: 4px;
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
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
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
    margin-top: 8px;
    border-radius: var(--radius-md);
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
</style>
