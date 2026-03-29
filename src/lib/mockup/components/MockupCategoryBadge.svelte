<script lang="ts">
  import type { MockCategory } from '$lib/mockup/data/analyse';

  let { category }: { category: MockCategory } = $props();
</script>

<button class="cat-badge cat-{category ?? 'null'}">
  {category ?? '\u2013'}
</button>

<style>
  .cat-badge {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-mono);
  }

  .cat-A {
    background: var(--ink);
    color: var(--paper);
    border: 1px solid transparent;
  }

  .cat-B {
    background: var(--paper-dark);
    color: var(--ink);
    border: 1px solid var(--border);
  }

  .cat-C {
    background: transparent;
    color: var(--ink-muted);
    border: 1px solid var(--border);
    opacity: 0.6;
  }

  .cat-null {
    background: transparent;
    color: var(--ink-muted);
    border: 1px dashed var(--border-strong);
  }
</style>
