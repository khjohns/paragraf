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

  let rightPanelOpen = $derived(!!uiState.selectedNodeId && !uiState.activeProcessView);

  // Keep right panel content rendered during close animation
  let displayedNodeId = $state<string | null>(null);
  $effect(() => {
    if (uiState.selectedNodeId) {
      displayedNodeId = uiState.selectedNodeId;
    } else {
      const timer = setTimeout(() => {
        displayedNodeId = null;
      }, 250);
      return () => clearTimeout(timer);
    }
  });
</script>

<div class="app-shell">
  <WorkspaceHeader />
  <ContextStrip />
  <div class="panels">
    <div class="panel-slot left-slot" class:open={uiState.leftPanelOpen}>
      {@render leftPanel()}
    </div>

    <main class="middle-panel">
      {@render middlePanel()}
    </main>

    <div class="panel-slot right-slot" class:open={rightPanelOpen}>
      {#if displayedNodeId && !uiState.activeProcessView}
        {@render rightPanel()}
      {/if}
    </div>
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

  /* Width-transition keeps content mounted so child state survives open/close cycles */
  .panel-slot {
    width: 0;
    min-width: 0;
    overflow: hidden;
    flex-shrink: 0;
    pointer-events: none;
    transition:
      width 250ms cubic-bezier(0.16, 1, 0.3, 1),
      min-width 250ms cubic-bezier(0.16, 1, 0.3, 1),
      border-color 250ms cubic-bezier(0.16, 1, 0.3, 1);
    border-color: transparent;
  }
  .panel-slot.open {
    pointer-events: auto;
  }

  .left-slot {
    background: var(--p-bg);
    display: flex;
    flex-direction: column;
  }
  .left-slot.open {
    width: 260px;
    min-width: 260px;
    border-right: 1px solid var(--p-border);
  }

  .right-slot {
    background: var(--p-panel);
    overflow-y: auto;
  }
  .right-slot.open {
    width: 370px;
    min-width: 370px;
    border-left: 1px solid var(--p-border);
  }

  .middle-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .panels {
      position: relative;
    }
    .left-slot {
      position: absolute;
      inset: 0;
      z-index: 20;
      border-right: none;
      background: var(--p-bg);
    }
    .left-slot.open {
      width: 100%;
      min-width: unset;
    }
    .right-slot {
      position: absolute;
      inset: 0;
      z-index: 30;
      border-left: none;
    }
    .right-slot.open {
      width: 100%;
      min-width: unset;
    }
  }
</style>
