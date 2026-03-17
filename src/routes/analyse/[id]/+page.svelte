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
  import { onMount, untrack } from 'svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { createTraversalQuery } from '$lib/queries/traversal';
  import { fetchAnalysis } from '$lib/api/analyses';

  const { data: pageData }: { data: PageData } = $props();

  // Track whether we've hydrated from DB/localStorage — suppresses traversal on reload
  let hydrated = $state(false);

  // Show scoping overlay when analysis is in scoping or searching status
  // Skip overlay for legacy analyses that have nodes but no explicit status
  let showScoping = $derived(
    (analysisState.analysis.status === 'scoping' ||
      analysisState.analysis.status === 'searching' ||
      analysisState.analysis.status === undefined) &&
      analysisState.nodes.length === 0
  );

  // Traversal query — disabled when we already have nodes (from hydration).
  // On reload, nodes come from localStorage. Traversal only runs on first
  // scoping (via ScopingOverlay) or explicit re-traversal.
  const traversal = createTraversalQuery(() => ({
    analysisId: analysisState.analysis.id,
    request: {
      provisions: analysisState.analysis.seeds.provisions,
      ftsTerms: analysisState.analysis.seeds.ftsTerms,
      vectorQuery: analysisState.analysis.seeds.vectorQuery,
      cases: analysisState.analysis.seeds.cases,
      regulationFilter: uiState.regulationFilter ? 'new' : 'all',
    },
    enabled: !hydrated || analysisState.nodes.length === 0,
  }));

  // Sync query results to store (untrack prevents cascading state updates)
  $effect(() => {
    const result = traversal.data;
    if (result) {
      untrack(() => {
        analysisState.setResults(
          result.nodes,
          result.edges,
          result.gaps,
          result.suggestedProvisions
        );
      });
    }
  });

  // Load analysis from DB, fall back to localStorage
  onMount(() => {
    const id = pageData.analysisId;
    if (id) {
      fetchAnalysis(id)
        .then((dbData) => {
          analysisState.loadFromDb(dbData);
          hydrated = true;
        })
        .catch(() => {
          analysisState.load();
          hydrated = true;
        });
    } else {
      analysisState.load();
      hydrated = true;
    }
  });
</script>

<KeyboardShortcuts />

{#if showScoping}
  <ScopingOverlay />
{:else}
  <AppShell>
    {#snippet leftPanel()}
      <PhasePanel />
    {/snippet}

    {#snippet middlePanel()}
      {#if uiState.activeProcessView === 'synthesis-review'}
        <SynthesisProcessView />
      {:else if uiState.activeProcessView === 'context'}
        <ContextView />
      {:else}
        <Toolbar />
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
  .middle-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
