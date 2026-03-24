<script lang="ts">
  import type { PageData } from './$types';
  import AppShell from '$lib/components/AppShell.svelte';
  import PhasePanel from '$lib/components/PhasePanel.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import NodeList from '$lib/components/NodeList.svelte';
  import GraphView from '$lib/components/GraphView.svelte';
  import PropositionRegistry from '$lib/components/PropositionRegistry.svelte';
  import SynthesisView from '$lib/components/SynthesisView.svelte';
  import SynthesisProcessView from '$lib/components/SynthesisProcessView.svelte';
  import ContextView from '$lib/components/ContextView.svelte';
  import ChatDrawer from '$lib/components/ChatDrawer.svelte';
  import NodeDetail from '$lib/components/NodeDetail.svelte';
  import ScopingOverlay from '$lib/components/ScopingOverlay.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PipelineStatusBar from '$lib/components/PipelineStatusBar.svelte';
  import { onMount } from 'svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { fetchAnalysis, traverseAnalysis } from '$lib/api/analyses';

  const { data: pageData }: { data: PageData } = $props();

  let hydrated = $state(false);

  // Show scoping overlay when analysis is in scoping or searching status
  // Skip overlay for legacy analyses that have nodes but no explicit status
  let showScoping = $derived(
    (analysisState.analysis.status === 'scoping' ||
      analysisState.analysis.status === 'searching' ||
      !analysisState.analysis.status) &&
      analysisState.nodes.length === 0
  );

  // Load analysis from DB, fall back to localStorage.
  // If nodes are missing after hydration (e.g. cleared cache), re-run traversal.
  onMount(async () => {
    const id = pageData.analysisId;
    try {
      if (id) {
        const dbData = await fetchAnalysis(id);
        analysisState.loadFromDb(dbData);
      } else {
        analysisState.load();
      }
    } catch {
      analysisState.load();
    }
    hydrated = true;

    // Reload recovery after hydration
    const { status } = analysisState.analysis;
    const hasSeeds =
      analysisState.analysis.seeds.provisions.length > 0 ||
      analysisState.analysis.seeds.ftsTerms.length > 0;
    const noNodes = analysisState.nodes.length === 0;
    const noEdges = analysisState.edges.length === 0;
    const isActive = status !== 'scoping' && status !== 'searching';

    // Case 1: no nodes at all (cleared cache, not a CLI-pipeline analysis) → full traversal
    // Case 2: has nodes (from candidates) but no edges → merge-only traversal for graph structure
    const needsFullTraversal = hasSeeds && noNodes && isActive;
    const needsEdges = hasSeeds && !noNodes && noEdges && isActive;

    if (needsFullTraversal || needsEdges) {
      try {
        const result = await traverseAnalysis(
          analysisState.analysis.id,
          analysisState.analysis.iteration,
          uiState.regulationFilter ? 'new' : 'all'
        );
        if (needsFullTraversal) {
          analysisState.setResults(
            result.nodes,
            result.edges,
            result.gaps,
            result.suggestedProvisions
          );
        } else {
          analysisState.mergeEdgesFromTraversal(
            result.nodes,
            result.edges,
            result.gaps,
            result.suggestedProvisions
          );
        }
      } catch {
        // Traversal failed — user will see workspace without graph edges
      }
    }
  });
</script>

<KeyboardShortcuts />

{#if !hydrated}
  <div class="loading-state">
    <span class="loading-label">Laster analyse…</span>
  </div>
{:else if showScoping}
  <ScopingOverlay />
{:else}
  <AppShell>
    {#snippet leftPanel()}
      <PhasePanel />
    {/snippet}

    {#snippet middlePanel()}
      <Toolbar />
      <PipelineStatusBar />
      {#if uiState.activeProcessView === 'synthesis-review'}
        <SynthesisProcessView />
      {:else if uiState.activeProcessView === 'context'}
        <ContextView />
      {:else}
        <div class="middle-content">
          {#if uiState.viewMode === 'graph'}
            <GraphView />
          {:else if uiState.viewMode === 'propositions'}
            <PropositionRegistry />
          {:else if uiState.viewMode === 'synthesis'}
            <SynthesisView />
          {:else}
            <NodeList />
          {/if}
        </div>
        <ChatDrawer />
      {/if}
    {/snippet}

    {#snippet rightPanel()}
      <NodeDetail />
    {/snippet}
  </AppShell>
{/if}

<style>
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--p-bg);
  }
  .loading-label {
    font-size: 13px;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .middle-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
