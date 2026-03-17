<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
</script>

<header class="workspace-header">
  <span class="brand">Paragraf</span>
  {#if analysisState.analysis.title}
    <span class="sep">&middot;</span>
    <span class="context">{analysisState.analysis.title}</span>
  {/if}
  <span class="spacer"></span>
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
    letter-spacing: 0.06em;
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
</style>
