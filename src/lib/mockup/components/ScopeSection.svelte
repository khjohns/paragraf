<script lang="ts">
  import { ChevronDown, Sparkles } from 'lucide-svelte';

  let {
    label,
    open = false,
    aiOwned = false,
    onToggle,
    children,
  }: {
    label: string;
    open: boolean;
    aiOwned?: boolean;
    onToggle: () => void;
    children: import('svelte').Snippet;
  } = $props();
</script>

<div class="scope-section">
  <button class="section-header" class:ai={aiOwned} onclick={onToggle}>
    <span class="header-label">
      {#if aiOwned}
        <Sparkles size={10} />
      {/if}
      {label}
    </span>
    <ChevronDown size={12} class={open ? '' : 'collapsed'} />
  </button>
  {#if open}
    <div class="section-content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .scope-section {
    border-bottom: 1px solid var(--border-subtle);
  }

  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
    font-weight: 600;
  }

  .section-header:hover {
    color: var(--ink-tertiary);
  }

  .section-header.ai {
    color: var(--ai-accent);
  }

  .header-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-header :global(.collapsed) {
    transform: rotate(-90deg);
  }

  .section-header :global(svg:last-child) {
    transition: transform 0.2s ease;
  }

  .section-content {
    padding: 0 20px 16px;
  }
</style>
