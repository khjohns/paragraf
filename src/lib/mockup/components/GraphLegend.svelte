<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import { MARK_COLORS } from '$lib/mockup/data/graf';

  let {
    nodeMarks = {},
  }: {
    nodeMarks: Record<string, string>;
  } = $props();

  let legendOpen = $state(true);

  let markCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    Object.values(nodeMarks).forEach((c) => {
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  });
</script>

<div class="legend" class:open={legendOpen}>
  <button class="legend-toggle" onclick={() => (legendOpen = !legendOpen)}>
    <ChevronDown size={10} class={legendOpen ? '' : 'rotated'} />
    Tegnforklaring
  </button>

  {#if legendOpen}
    <div class="legend-body">
      <!-- Category states -->
      <div class="legend-item">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--ink)" /></svg>
        <span>A — Kjernesak</span>
      </div>
      <div class="legend-item">
        <svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="var(--paper)" stroke="var(--border-strong)" stroke-width="1.5" /></svg>
        <span>B — Støttesak</span>
      </div>
      <div class="legend-item dim">
        <svg width="10" height="10"><circle cx="5" cy="5" r="3" fill="var(--paper)" stroke="var(--border)" stroke-width="1" /></svg>
        <span>C — Kontekstsak</span>
      </div>
      <div class="legend-item">
        <svg width="10" height="10"><circle cx="5" cy="5" r="3" fill="var(--paper)" stroke="var(--ink-muted)" stroke-width="1" stroke-dasharray="2 2" /></svg>
        <span>Uvurdert</span>
      </div>

      <div class="legend-sep"></div>

      <!-- Edge types -->
      <div class="legend-item">
        <svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="var(--edge-cite)" stroke-width="1" /></svg>
        <span>Sitering</span>
      </div>
      <div class="legend-item">
        <svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="var(--edge-color)" stroke-width="1" stroke-dasharray="3 3" /></svg>
        <span>Bestemmelsesref.</span>
      </div>

      <div class="legend-sep"></div>

      <!-- Signals -->
      <div class="legend-item">
        <div class="signal-dots">
          <svg width="5" height="5"><circle cx="2.5" cy="2.5" r="2.5" fill="var(--ink-muted)" /></svg>
          <svg width="5" height="5"><circle cx="2.5" cy="2.5" r="2.5" fill="var(--signal-fts)" /></svg>
          <svg width="5" height="5"><circle cx="2.5" cy="2.5" r="2.5" fill="var(--ai-accent)" /></svg>
        </div>
        <span>Søkesignaler R&middot;F&middot;V</span>
      </div>
      <div class="legend-item">
        <span class="star-icon">&starf;</span>
        <span>Gullkandidat</span>
      </div>
      <div class="legend-item">
        <span class="cite-icon">&nearr;n</span>
        <span>Siteringstakt</span>
      </div>

      <!-- Active marks -->
      {#if Object.keys(markCounts).length > 0}
        <div class="legend-sep"></div>
        <div class="marks-header">Markeringer</div>
        {#each Object.entries(markCounts) as [colorId, count]}
          {@const mc = MARK_COLORS.find((c) => c.id === colorId)}
          {#if mc}
            <div class="legend-item">
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="none" stroke={mc.hex} stroke-width="2.5" /></svg>
              <span>{mc.label} ({count})</span>
            </div>
          {/if}
        {/each}
      {/if}

      <div class="legend-sep"></div>
      <div class="legend-hint">Høyreklikk node &rarr; marker</div>
    </div>
  {/if}
</div>

<style>
  .legend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    padding: 8px 14px;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 3px;
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    font-weight: 500;
    max-width: 220px;
  }

  .legend.open {
    padding: 10px 14px 12px;
  }

  .legend-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    transition: color 0.15s ease;
  }

  .legend-toggle:hover {
    color: var(--ink-tertiary);
  }

  .legend-toggle :global(.rotated) {
    transform: rotate(-90deg);
  }

  .legend-toggle :global(svg) {
    transition: transform 0.15s ease;
  }

  .legend-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-item.dim {
    opacity: 0.5;
  }

  .legend-sep {
    border-top: 1px solid var(--border-subtle);
    padding-top: 5px;
    margin-top: 1px;
  }

  .signal-dots {
    display: flex;
    gap: 3px;
  }

  .star-icon {
    color: var(--gold-star);
    font-size: 10px;
    width: 18px;
    text-align: center;
  }

  .cite-icon {
    font-family: var(--font-mono);
    font-size: 8px;
    width: 18px;
    text-align: center;
  }

  .marks-header {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-bottom: 2px;
  }

  .legend-hint {
    font-style: italic;
    color: var(--ink-muted);
    font-size: 9px;
  }
</style>
