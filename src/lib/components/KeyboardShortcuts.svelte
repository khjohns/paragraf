<script lang="ts">
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { toastState } from '$lib/stores/toast.svelte';

  let showHelp = $state(false);

  let caseNodes = $derived(analysisState.nodes.filter((n) => n.type === 'kofa_case'));

  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isInputFocused()) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (caseNodes.length === 0) return;
        const idx = caseNodes.findIndex((n) => n.id === uiState.selectedNodeId);
        const next =
          idx === -1
            ? 0
            : e.key === 'ArrowDown'
              ? Math.min(idx + 1, caseNodes.length - 1)
              : Math.max(idx - 1, 0);
        uiState.selectNode(caseNodes[next].id);
        break;
      }
      case 'm':
      case 'M':
        if (uiState.selectedNodeId) {
          analysisState.toggleRead(uiState.selectedNodeId);
          const isNowRead = !!analysisState.analysis.readStatus[uiState.selectedNodeId];
          const readCount = Object.values(analysisState.analysis.readStatus).filter(Boolean).length;
          const total = caseNodes.length;
          toastState.show(
            isNowRead ? `Markert som lest · ${readCount} av ${total}` : 'Fjernet lesemarkering',
            'success'
          );
        }
        break;
      case 'r':
      case 'R':
        if (uiState.selectedNodeId) {
          window.dispatchEvent(new CustomEvent('paragraf:shortcut', { detail: 'read' }));
        }
        break;
      case 'Escape':
        if (showHelp) {
          showHelp = false;
        } else if (uiState.selectedNodeId) {
          window.dispatchEvent(new CustomEvent('paragraf:shortcut', { detail: 'escape' }));
        }
        break;
      case '?':
        showHelp = !showHelp;
        break;
    }
  }

  const shortcuts = [
    ['↓ / ↑', 'Neste / forrige sak'],
    ['M', 'Marker som lest'],
    ['R', 'Les avgjørelsen'],
    ['Esc', 'Lukk / tilbake'],
    ['?', 'Vis snarveier'],
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showHelp}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="overlay"
    onclick={() => (showHelp = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape') showHelp = false;
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <div class="dialog-header">Tastatursnarveier</div>
      <div class="shortcut-list">
        {#each shortcuts as [key, desc]}
          <div class="shortcut-row">
            <kbd>{key}</kbd>
            <span class="shortcut-desc">{desc}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 24, 20, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.12s ease-out;
  }
  .dialog {
    background: var(--p-panel);
    border: 1px solid var(--p-border-m);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    max-width: 280px;
    width: 100%;
    animation: scaleIn 0.12s ease-out;
    box-shadow: 0 8px 24px rgba(26, 24, 20, 0.12);
  }
  .dialog-header {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--p-ink);
    margin-bottom: var(--spacing-4);
    letter-spacing: -0.01em;
  }
  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .shortcut-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }
  kbd {
    font-family: var(--font-data);
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 8px;
    min-width: 40px;
    text-align: center;
    background: var(--p-hover);
    border: 1px solid var(--p-border-m);
    border-radius: var(--radius-md);
    color: var(--p-ink);
    line-height: 1.6;
  }
  .shortcut-desc {
    font-size: 0.8125rem;
    color: var(--p-ink2);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
