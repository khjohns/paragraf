<script lang="ts">
  import { goto } from '$app/navigation';
  import { createAnalysesListQuery } from '$lib/queries/analyses';
  import { createAnalysisQuery } from '$lib/queries/analyses';
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

<div class="flex h-screen flex-col bg-[#F5F3EE] font-sans text-[#1A1814]">
  <!-- Header -->
  <div class="flex shrink-0 items-center gap-2.5 border-b border-black/8 bg-[#FAF9F6] px-5 py-2.5">
    <span class="text-[15px] font-bold tracking-tight">Paragraf</span>
    <span class="flex-1"></span>
  </div>

  <!-- Body -->
  <div class="flex flex-1 overflow-hidden">
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
