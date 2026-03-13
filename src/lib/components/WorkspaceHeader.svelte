<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { formatProvision } from '$lib/utils/provisions';

  let readCount = $derived(Object.values(analysisState.analysis.readStatus).filter(Boolean).length);
  let totalCount = $derived(analysisState.nodes.length);
</script>

<header class="workspace-header">
  <span class="brand">Paragraf</span>
  {#if analysisState.analysis.seeds.provisions.length > 0}
    <span class="sep">&middot;</span>
    <span class="context">{formatProvision(analysisState.analysis.seeds.provisions[0])}</span>
  {/if}
  <span class="spacer"></span>
  {#if totalCount > 0}
    <span class="progress">{readCount} av {totalCount} lest</span>
  {/if}
</header>

<style>
  .workspace-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border-m);
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
  .sep {
    color: var(--p-border-s);
  }
  .context {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .spacer {
    flex: 1;
  }
  .progress {
    font-size: 11px;
    color: var(--p-ink3);
  }
</style>
