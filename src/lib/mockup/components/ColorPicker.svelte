<script lang="ts">
  import { X } from 'lucide-svelte';
  import { MARK_COLORS } from '$lib/mockup/data/graf';

  let {
    x = 0,
    y = 0,
    currentMark = '',
    onApply,
  }: {
    x: number;
    y: number;
    currentMark: string;
    onApply: (colorId: string) => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ctx-menu" style="left:{x}px;top:{y}px" onmousedown={(e) => e.stopPropagation()}>
  {#each MARK_COLORS as color}
    <button
      class="ctx-swatch"
      class:active-swatch={currentMark === color.id}
      title={color.label}
      onclick={(e) => { e.stopPropagation(); onApply(color.id); }}
      style={color.id === 'none'
        ? 'background:var(--paper-dark);border:1px dashed var(--border-strong)'
        : `background:${color.hex}`}
    >
      {#if color.id === 'none'}
        <X size={10} />
      {/if}
    </button>
  {/each}
</div>

<style>
  .ctx-menu {
    position: fixed;
    z-index: 100;
    background: var(--paper);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 6px;
    display: flex;
    gap: 4px;
    animation: dropIn 0.12s ease forwards;
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ctx-swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.12s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-muted);
  }

  .ctx-swatch:hover {
    transform: scale(1.15);
    border-color: var(--border-stronger);
  }

  .ctx-swatch.active-swatch {
    border-color: var(--ink);
  }
</style>
