<script lang="ts">
  type ViewScope = 'mine' | 'team' | 'corpus';

  let {
    value = 'mine',
    onchange,
  }: {
    value: ViewScope;
    onchange: (scope: ViewScope) => void;
  } = $props();
</script>

<div class="scope-toggle">
  {#each ['mine', 'team', 'corpus'] as const as scope, i}
    {#if i > 0}
      <div class="scope-sep"></div>
    {/if}
    <button class="scope-btn" class:active={value === scope} onclick={() => onchange(scope)}>
      {scope === 'mine' ? 'Mine' : scope === 'team' ? 'Team' : 'Corpus'}
    </button>
  {/each}
</div>

<style>
  .scope-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .scope-btn {
    padding: 4px 12px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .scope-btn:hover {
    color: var(--ink-secondary);
    background: var(--hover-bg-ctrl);
  }

  .scope-btn:active {
    transform: scale(0.97);
  }

  .scope-btn.active {
    background: var(--paper-dark);
    color: var(--ink);
  }

  .scope-sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
  }
</style>
