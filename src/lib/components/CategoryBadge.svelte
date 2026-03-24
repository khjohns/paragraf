<script lang="ts">
  import type { Category } from '$lib/types/graph';
  import { CATEGORY_LABELS } from '$lib/types/analysis';

  let { category, compact = false }: { category: Category; compact?: boolean } = $props();

  let label = $derived(CATEGORY_LABELS[category]);
</script>

<span class="badge cat-{category.toLowerCase()}" class:compact title={label}
  >{compact ? label.slice(0, 3) + '.' : label}</span
>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-family: var(--font-data);
    flex-shrink: 0;
  }
  .badge.compact {
    padding: 1px 4px;
    font-size: 9px;
  }
  .cat-a {
    background: rgba(26, 24, 20, 0.08);
    color: var(--p-ink);
  }
  .cat-b {
    background: rgba(26, 24, 20, 0.05);
    color: var(--p-ink2);
  }
  .cat-c {
    background: rgba(26, 24, 20, 0.03);
    color: var(--p-ink3);
  }
</style>
