<script lang="ts">
  import { X, Sparkles } from 'lucide-svelte';

  let {
    ref: refText,
    label,
    primary = true,
    reason = '',
    onRemove,
  }: {
    ref: string;
    label: string;
    primary?: boolean;
    reason?: string;
    onRemove?: () => void;
  } = $props();

  let hover = $state(false);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tag-wrapper" onmouseenter={() => (hover = true)} onmouseleave={() => (hover = false)}>
  <span class="tag" class:primary class:secondary={!primary}>
    <span class="tag-ref">{refText}</span>
    <span class="tag-label">{label}</span>
    {#if onRemove}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="tag-remove"
        onclick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
      >
        <X size={10} />
      </span>
    {/if}
  </span>
  {#if hover && reason}
    <div class="tooltip">
      <Sparkles size={9} class="tooltip-icon" />
      {reason}
    </div>
  {/if}
</div>

<style>
  .tag-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tag {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 2px;
    color: var(--ink-secondary);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: default;
  }

  .tag.primary {
    background: var(--paper-dark);
    border: 1px solid var(--border);
  }

  .tag.secondary {
    background: transparent;
    border: 1px dashed var(--border-strong);
  }

  .tag-label {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
  }

  .tag-ref {
    white-space: nowrap;
  }

  .tag-remove {
    color: var(--ink-muted);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: inline-flex;
  }

  .tag:hover .tag-remove {
    opacity: 0.5;
  }

  .tag-remove:hover {
    opacity: 1 !important;
  }

  .tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    padding: 8px 12px;
    background: var(--paper);
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-secondary);
    line-height: 1.45;
    max-width: 280px;
    z-index: 10;
    white-space: normal;
    animation: drop-in 0.12s ease forwards;
  }

  .tooltip :global(.tooltip-icon) {
    color: var(--ai-accent);
    display: inline;
    vertical-align: middle;
    margin-right: 4px;
  }

  @keyframes drop-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
