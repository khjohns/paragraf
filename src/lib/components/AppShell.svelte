<script lang="ts">
  import type { Snippet } from 'svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import WorkspaceHeader from './WorkspaceHeader.svelte';
  import ContextStrip from './ContextStrip.svelte';

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
  <ContextStrip />
  <div class="panels">
    {#if uiState.leftPanelOpen}
      <aside class="left-panel">
        {@render leftPanel()}
      </aside>
    {/if}

    <main class="middle-panel">
      {@render middlePanel()}
    </main>

    {#if uiState.selectedNodeId && !uiState.activeProcessView}
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
    width: 192px;
    min-width: 192px;
    border-right: 1px solid var(--p-border);
    background: var(--p-bg);
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
