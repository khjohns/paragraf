<script lang="ts">
  import { goto } from '$app/navigation';
  import { createAnalysesListQuery, createAnalysisQuery } from '$lib/queries/analyses';
  import { createAnalysis } from '$lib/api/analyses';
  import Portfolio from '$lib/components/Portfolio.svelte';
  import PortfolioDetail from '$lib/components/PortfolioDetail.svelte';

  const analysesQuery = createAnalysesListQuery();

  let selectedId = $state<string | null>(null);
  const selectedQuery = createAnalysisQuery(() => selectedId);

  async function handleCreate() {
    const analysis = await createAnalysis('Ny analyse');
    goto(`/analyse/${analysis.id}`);
  }

  function handleOpen(id: string) {
    goto(`/analyse/${id}`);
  }
</script>

<div class="portfolio-page">
  <header class="portfolio-header">
    <span class="brand">Paragraf</span>
    <span class="spacer"></span>
  </header>

  <div class="portfolio-body">
    {#if analysesQuery.data}
      <Portfolio
        analyses={analysesQuery.data}
        {selectedId}
        onSelect={(id) => (selectedId = id)}
        onCreate={handleCreate}
      />
    {/if}

    {#if selectedId && selectedQuery.data}
      <PortfolioDetail
        analysis={selectedQuery.data}
        onOpen={handleOpen}
        onClose={() => (selectedId = null)}
      />
    {/if}
  </div>
</div>

<style>
  .portfolio-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--p-bg);
    color: var(--p-ink);
  }

  .portfolio-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .brand {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--p-ink2);
  }
  .spacer {
    flex: 1;
  }
</style>
