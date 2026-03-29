<script lang="ts">
  import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize } from 'lucide-svelte';

  type CatKey = 'all' | 'null' | 'A' | 'B' | 'C';

  let {
    activeCats = [],
    showProvisions = true,
    caseCount = 0,
    provCount = 0,
    isolatedCount = 0,
    onToggleCat,
    onToggleProvisions,
    onZoomIn,
    onZoomOut,
    onFitView,
  }: {
    activeCats: CatKey[];
    showProvisions: boolean;
    caseCount: number;
    provCount: number;
    isolatedCount: number;
    onToggleCat: (cat: CatKey) => void;
    onToggleProvisions: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
  } = $props();

  const TABS: { key: CatKey; label: string; cat: string | null }[] = [
    { key: 'all', label: 'Alle', cat: null },
    { key: 'null', label: 'Uvurdert', cat: '\u2013' },
    { key: 'A', label: 'Kjernesak', cat: 'A' },
    { key: 'B', label: 'Støttesak', cat: 'B' },
    { key: 'C', label: 'Kontekstsak', cat: 'C' },
  ];

  function isTabActive(cat: CatKey): boolean {
    return cat === 'all' ? activeCats.length === 0 : activeCats.includes(cat);
  }
</script>

<div class="graph-toolbar">
  <div class="toolbar-left">
    <div class="tab-toggle">
      {#each TABS as tab, i}
        {#if i > 0}
          <div class="tab-sep"></div>
        {/if}
        <button
          class="tab-btn"
          class:active={isTabActive(tab.key)}
          onclick={() => onToggleCat(tab.key)}
        >
          {tab.label}{#if tab.cat}<span class="tab-cat"> &middot; {tab.cat}</span>{/if}
        </button>
      {/each}
    </div>

    <button
      class="toggle-btn"
      class:active={showProvisions}
      onclick={onToggleProvisions}
    >
      {#if showProvisions}
        <Eye size={11} />
      {:else}
        <EyeOff size={11} />
      {/if}
      &sect;
    </button>
  </div>

  <div class="toolbar-right">
    <span class="counter">
      {caseCount} saker &middot; {provCount} best.{#if isolatedCount > 0} &middot; {isolatedCount} isolert{/if}
    </span>
    <button class="toolbar-btn" onclick={onZoomOut} title="Zoom ut">
      <ZoomOut size={14} />
    </button>
    <button class="toolbar-btn" onclick={onFitView} title="Tilpass visning">
      <Maximize size={14} />
    </button>
    <button class="toolbar-btn" onclick={onZoomIn} title="Zoom inn">
      <ZoomIn size={14} />
    </button>
  </div>
</div>

<style>
  .graph-toolbar {
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 12px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .tab-sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
  }

  .tab-btn {
    padding: 4px 10px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--ink-secondary);
    background: var(--hover-bg);
  }

  .tab-btn:active {
    transform: scale(0.97);
  }

  .tab-btn.active {
    background: var(--paper-dark);
    color: var(--ink);
  }

  .tab-cat {
    font-family: var(--font-mono);
    font-size: 10px;
    opacity: 0.5;
    margin-left: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-tertiary);
  }

  .toggle-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink-secondary);
  }

  .toggle-btn.active {
    background: var(--paper-dark);
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .counter {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    margin-right: 8px;
    font-variant-numeric: tabular-nums;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    color: var(--ink);
    border-color: var(--border-strong);
  }
</style>
