<script lang="ts">
  import { Filter, ChevronDown, Check } from 'lucide-svelte';
  import { PHASE_NAMES, PHASE_COLORS, type Phase } from '$lib/mockup/data/portfolio';

  let {
    activePhases = [],
    onToggle,
    onClear,
  }: {
    activePhases: Phase[];
    onToggle: (phase: Phase) => void;
    onClear: () => void;
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

  let count = $derived(activePhases.length);
</script>

<div class="dropdown-container" bind:this={containerEl}>
  <button class="trigger" class:has-selection={count > 0} onclick={() => (open = !open)}>
    <Filter size={12} />
    Faser
    {#if count > 0}
      <span class="count">{count}</span>
    {/if}
    <ChevronDown size={11} class={open ? 'chevron-up' : ''} />
  </button>

  {#if open}
    <div class="dropdown">
      {#if count > 0}
        <div class="dropdown-header">
          <span class="selected-count">{count} valgt</span>
          <button
            class="reset-btn"
            onclick={(e) => {
              e.stopPropagation();
              onClear();
            }}>Nullstill</button
          >
        </div>
      {/if}

      {#each Object.entries(PHASE_NAMES) as [key, name]}
        {@const phase = key as Phase}
        {@const isActive = activePhases.includes(phase)}
        <button
          class="dropdown-item"
          class:active={isActive}
          onclick={(e) => {
            e.stopPropagation();
            onToggle(phase);
          }}
        >
          <span
            class="phase-dot"
            class:ring={isActive}
            style:background-color={PHASE_COLORS[phase]}
            style:--dot-color={PHASE_COLORS[phase]}
          ></span>
          <span class="item-label">{name}</span>
          {#if isActive}
            <Check size={12} color="var(--ink-tertiary)" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-container {
    position: relative;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-tertiary);
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .trigger:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .trigger.has-selection {
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .count {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    background: var(--ink);
    color: var(--paper);
    border-radius: 2px;
    padding: 0 4px;
    line-height: 16px;
    min-width: 16px;
    text-align: center;
  }

  .trigger :global(.chevron-up) {
    transform: rotate(180deg);
  }

  .trigger :global(svg:last-child) {
    color: var(--ink-muted);
    transition: transform 0.2s ease;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--paper);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 4px 0;
    min-width: 200px;
    z-index: 50;
    animation: mockup-drop-in 0.15s ease-out;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px 8px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }

  .selected-count {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    font-weight: 500;
  }

  .reset-btn {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-tertiary);
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .dropdown-item {
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

  .dropdown-item:hover {
    background: var(--hover-bg-ctrl);
  }

  .dropdown-item.active {
    font-weight: 500;
    color: var(--ink);
    background: var(--hover-bg-ctrl-active);
  }

  .dropdown-item.active:hover {
    background: var(--hover-bg-ctrl-active);
  }

  .phase-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: box-shadow 0.15s ease;
  }

  .phase-dot.ring {
    box-shadow:
      0 0 0 2px var(--paper),
      0 0 0 3.5px var(--dot-color);
  }

  .item-label {
    flex: 1;
  }
</style>
