<script lang="ts">
  import { ChevronRight, Sparkles } from 'lucide-svelte';

  let {
    label,
    defaultOpen = true,
    aiOwned = false,
    children,
  }: {
    label: string;
    defaultOpen?: boolean;
    aiOwned?: boolean;
    children: import('svelte').Snippet;
  } = $props();

  let open = $state(defaultOpen);
</script>

<div class="review-section">
  <button class="section-toggle" onclick={() => (open = !open)}>
    <ChevronRight size={12} class="chevron {open ? 'open' : ''}" />
    <span class="section-label" class:ai={aiOwned}>{label}</span>
    {#if aiOwned}
      <Sparkles size={10} class="ai-icon" />
    {/if}
  </button>
  {#if open}
    <div class="section-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .review-section {
    border-bottom: 1px solid var(--border-subtle);
  }

  .section-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 14px 0;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .section-toggle:hover .section-label {
    color: var(--ink-secondary);
  }

  .section-toggle:hover .section-label.ai {
    color: var(--ai-accent);
  }

  .section-toggle :global(.chevron) {
    color: var(--ink-muted);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  .section-toggle :global(.chevron.open) {
    transform: rotate(90deg);
  }

  .section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-tertiary);
  }

  .section-label.ai {
    color: var(--ai-accent);
  }

  .section-toggle :global(.ai-icon) {
    color: var(--ai-accent);
  }

  .section-body {
    padding-bottom: 16px;
    padding-left: 20px;
  }
</style>
