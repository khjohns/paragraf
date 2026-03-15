<script lang="ts">
  import type { GraphNode } from '$lib/types/graph';

  let {
    node,
    x,
    y,
  }: {
    node: GraphNode | null;
    x: number;
    y: number;
  } = $props();

  // Delay is handled by parent (GraphView) — tooltip just renders when node is set

  let meta = $derived.by(() => {
    if (!node) return '';
    const parts: string[] = [];
    if (node.date) parts.push(node.date);
    if (node.outcome) parts.push(node.outcome);
    if (node.citations > 0) parts.push(`${node.citations} siteringer`);
    return parts.join(' · ');
  });
</script>

{#if node}
  <div class="tooltip" style:left="{x}px" style:top="{y}px">
    <div class="tooltip-label">{node.label}</div>
    <div class="tooltip-subtitle">{node.subtitle}</div>
    {#if meta}
      <div class="tooltip-meta">{meta}</div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 100;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-lg);
    padding: 8px 10px;
    font-size: 11px;
    font-family: var(--font-ui);
    color: var(--p-ink);
    border: 1px solid var(--p-border-m);
    max-width: 260px;
    transform: translate(-50%, -100%);
    margin-top: -8px;
  }
  .tooltip-label {
    font-weight: 600;
    font-family: var(--font-data);
    margin-bottom: 2px;
  }
  .tooltip-subtitle {
    color: var(--p-ink2);
    margin-bottom: 2px;
  }
  .tooltip-meta {
    color: var(--p-ink3);
    font-size: 10px;
  }
</style>
