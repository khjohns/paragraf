<script lang="ts">
  import type { Snippet } from 'svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import WorkspaceHeader from './WorkspaceHeader.svelte';

  let {
    leftPanel,
    middlePanel,
    rightPanel,
  }: {
    leftPanel: Snippet;
    middlePanel: Snippet;
    rightPanel: Snippet;
  } = $props();
</script>

<div class="app-shell">
  <WorkspaceHeader />
  <div class="panels">
    {#if uiState.leftPanelOpen}
      <aside class="left-panel">
        {@render leftPanel()}
      </aside>
    {/if}

    <main class="middle-panel">
      {@render middlePanel()}
    </main>

    {#if uiState.selectedNodeId}
      <aside class="right-panel">
        {@render rightPanel()}
      </aside>
    {/if}
  </div>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--p-bg);
  }
  .panels {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .left-panel {
    width: 300px;
    min-width: 300px;
    border-right: 1px solid var(--p-border);
    background: var(--p-panel);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .middle-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .right-panel {
    width: 370px;
    min-width: 370px;
    border-left: 1px solid var(--p-border);
    background: var(--p-panel);
    overflow-y: auto;
  }
</style>
