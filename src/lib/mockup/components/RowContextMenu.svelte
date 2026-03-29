<script lang="ts">
  import { MoreVertical, Check, Plus, Tag } from 'lucide-svelte';

  let {
    analysisId,
    currentTag,
    allTags,
    onSetTag,
  }: {
    analysisId: string;
    currentTag: string;
    allTags: string[];
    onSetTag: (id: string, tag: string) => void;
  } = $props();

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
    }
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

<div class="ctx-container" bind:this={containerEl}>
  <button
    class="ctx-btn"
    onclick={(e) => {
      e.stopPropagation();
      open = !open;
    }}
  >
    <MoreVertical size={14} />
  </button>

  {#if open}
    <div class="ctx-dropdown">
      <div class="ctx-header">
        <Tag size={10} />
        Flytt til tema
      </div>

      {#each allTags as tag}
        {@const isActive = tag === currentTag}
        <button
          class="ctx-item"
          class:active={isActive}
          onclick={(e) => {
            e.stopPropagation();
            onSetTag(analysisId, tag);
            open = false;
          }}
        >
          <span class="ctx-item-label">{tag}</span>
          {#if isActive}
            <Check size={12} color="var(--ink-tertiary)" />
          {/if}
        </button>
      {/each}

      <div class="ctx-divider"></div>
      <button
        class="ctx-item new-item"
        onclick={(e) => {
          e.stopPropagation();
          open = false;
        }}
      >
        <Plus size={12} />
        Nytt tema&hellip;
      </button>
    </div>
  {/if}
</div>

<style>
  .ctx-container {
    position: relative;
  }

  .ctx-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    color: var(--ink-muted);
    transition: all 0.15s ease;
  }

  .ctx-btn:hover {
    background: var(--hover-bg-strong);
    color: var(--ink-secondary);
  }

  .ctx-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--paper);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 4px 0;
    min-width: 240px;
    z-index: 50;
  }

  .ctx-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px 6px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 400;
    color: var(--ink-secondary);
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .ctx-item:hover {
    background: var(--hover-bg-ctrl);
  }

  .ctx-item.active {
    font-weight: 500;
    color: var(--ink);
    background: var(--hover-bg-ctrl-active);
  }

  .ctx-item-label {
    flex: 1;
  }

  .new-item {
    color: var(--ink-tertiary);
  }

  .ctx-divider {
    border-top: 1px solid var(--border-subtle);
    margin-top: 4px;
    padding-top: 4px;
  }
</style>
