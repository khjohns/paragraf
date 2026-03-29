<script lang="ts">
  import type { CaseMetadata } from '$lib/mockup/data/lesevisning';

  let {
    metadata,
  }: {
    metadata: CaseMetadata;
  } = $props();
</script>

<aside class="reading-sidebar">
  <div class="sidebar-section">
    <div class="sidebar-label">Relaterte saker</div>
    {#each metadata.relatedCases as ref}
      <button class="related-case">
        <span class="case-ref">KOFA-{ref}</span>
      </button>
    {/each}
  </div>

  <div class="sidebar-section provisions-section">
    <div class="sidebar-label">Bestemmelser</div>
    <div class="provision-list">
      {#each metadata.provisions as p}
        <span class="provision-tag">{p}</span>
      {/each}
    </div>
  </div>
</aside>

<style>
  .reading-sidebar {
    width: 240px;
    border-left: 1px solid var(--border);
    flex-shrink: 0;
    overflow-y: auto;
    padding: 20px 16px;
  }

  .sidebar-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    margin-bottom: 12px;
  }

  .related-case {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 4px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: transparent;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .related-case:hover {
    background: var(--hover-bg);
  }

  .case-ref {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ref-link);
    transition: color 0.15s ease;
  }

  .related-case:hover .case-ref {
    color: var(--ink);
  }

  .provisions-section {
    margin-top: 32px;
  }

  .provision-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .provision-tag {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    background: var(--paper-dark);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 2px;
    align-self: flex-start;
  }
</style>
