<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import type { Section } from '$lib/mockup/data/lesevisning';

  let {
    sections,
    activeSection,
    onSelect,
    originalUrl,
  }: {
    sections: Section[];
    activeSection: string;
    onSelect: (id: string) => void;
    originalUrl?: string;
  } = $props();
</script>

<nav class="section-nav">
  <div class="section-tabs">
    {#each sections as s}
      <button class="sec-tab" class:active={activeSection === s.id} onclick={() => onSelect(s.id)}>
        {s.label}
        <span class="sec-tab-count">{s.paragraphs.length}</span>
      </button>
    {/each}
  </div>
  {#if originalUrl}
    <div class="section-nav-right">
      <a href={originalUrl} target="_blank" rel="noopener noreferrer" class="original-link">
        Original <ExternalLink size={10} />
      </a>
    </div>
  {/if}
</nav>

<style>
  .section-nav {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    display: flex;
  }

  .section-tabs {
    display: flex;
  }

  .sec-tab {
    padding: 6px 16px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    border-bottom: 2px solid transparent;
  }

  .sec-tab:hover {
    color: var(--ink-secondary);
  }

  .sec-tab.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .sec-tab-count {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--ink-muted);
    margin-left: 4px;
  }

  .section-nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 8px;
  }

  .original-link {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    gap: 4px;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .original-link:hover {
    color: var(--ink);
  }
</style>
