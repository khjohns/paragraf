<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    num,
    title,
    subtitle = '',
    defaultOpen = false,
    badge,
    children,
  }: {
    num: string;
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    badge?: Snippet;
    children: Snippet;
  } = $props();

  // Use prop as initial value only — subsequent changes managed locally
  // svelte-ignore state_referenced_locally
  let open = $state(defaultOpen);
</script>

<div class="section">
  <button class="section-header" onclick={() => (open = !open)}>
    <span class="num" class:active={open}>{num}</span>
    <span class="title-area">
      <span class="section-title">{title}</span>
      {#if subtitle}
        <span class="section-subtitle">{subtitle}</span>
      {/if}
    </span>
    {#if badge}
      {@render badge()}
    {/if}
    <svg class="chevron" class:open width="12" height="12" viewBox="0 0 12 12">
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        stroke-width="1.5"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  </button>
  {#if open}
    <div class="section-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .section {
    border-bottom: 1px solid var(--p-border);
  }
  .section-header {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-header:hover {
    background: var(--p-hover);
  }
  .num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    border: 1.5px solid var(--p-border-s);
    background: transparent;
    color: var(--p-ink);
    transition: all 0.15s ease;
  }
  .num.active {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .title-area {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .section-subtitle {
    font-size: 11px;
    color: var(--p-ink3);
  }
  .chevron {
    opacity: 0.4;
    transition: transform 0.15s ease;
    transform: rotate(-90deg);
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(0);
  }
  .section-body {
    padding: 0 16px 14px;
  }
</style>
