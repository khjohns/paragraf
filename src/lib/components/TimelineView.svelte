<script lang="ts">
  import {
    EVOLUTION_CONFIG,
    type Proposition,
    type PropositionInstance,
    type EvolutionType,
  } from '$lib/types/analysis';
  import { uiState } from '$lib/stores/ui.svelte';

  let { propositions }: { propositions: Proposition[] } = $props();

  // Selected propositions for swim lanes (max 4)
  let selectedIds = $state<Set<string>>(new Set());

  // Auto-select first 3 if none selected
  let selectedPropositions = $derived.by(() => {
    if (selectedIds.size === 0) {
      return propositions.slice(0, 3);
    }
    return propositions.filter((p) => selectedIds.has(p.id));
  });

  let isAutoSelected = $derived(selectedIds.size === 0);

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 4) {
      next.add(id);
    }
    selectedIds = next;
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  // Build the time axis: collect all years across selected propositions
  let timeAxis = $derived.by(() => {
    const years = new Set<number>();
    for (const p of selectedPropositions) {
      for (const inst of p.instances) {
        const y = parseInt(inst.date.slice(0, 4));
        if (!isNaN(y)) years.add(y);
      }
    }
    const sorted = [...years].sort((a, b) => a - b);
    return sorted;
  });

  // Map year to row index for positioning
  let yearIndex = $derived(new Map(timeAxis.map((y, i) => [y, i])));

  // Find events for a proposition at a given year
  function getEventsAt(prop: Proposition, year: number): PropositionInstance[] {
    return prop.instances.filter((inst) => parseInt(inst.date.slice(0, 4)) === year);
  }

  // Get evolution color
  function evoColor(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.color ?? 'var(--p-ink3)';
  }

  function evoBg(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.bg ?? 'rgba(26,24,20,0.06)';
  }

  function evoLabel(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.label ?? type;
  }

  // Whether a line should be dashed (qualified = narrowing/departing)
  function isDashed(type: EvolutionType): boolean {
    return type === 'qualified';
  }

  // Truncate proposition text for column headers
  function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }

  // Expanded event for detail tooltip
  let expandedEvent = $state<{ propId: string; instIdx: number } | null>(null);

  function toggleEvent(propId: string, instIdx: number) {
    if (expandedEvent?.propId === propId && expandedEvent?.instIdx === instIdx) {
      expandedEvent = null;
    } else {
      expandedEvent = { propId, instIdx };
    }
  }

  // Handle clicking a case ref to open in detail panel
  function handleCaseClick(caseId: string) {
    // Navigate to the case node in the workspace
    uiState.selectNode(caseId);
  }

  // Citation bias note
  let showBiasNote = $state(false);
</script>

<div class="timeline-view">
  <!-- Proposition selector -->
  <div class="selector">
    <div class="selector-header">
      <span class="selector-label">Velg rettssetninger for tidslinje</span>
      <span class="selector-hint">
        {#if isAutoSelected}
          Viser {selectedPropositions.length} første automatisk
        {:else}
          {selectedIds.size}/4 valgt
        {/if}
      </span>
      {#if !isAutoSelected}
        <button class="selector-clear" onclick={clearSelection}>Nullstill</button>
      {/if}
    </div>
    <div class="selector-chips">
      {#each propositions as prop}
        {@const isSelected = isAutoSelected
          ? selectedPropositions.some((p) => p.id === prop.id)
          : selectedIds.has(prop.id)}
        <button
          class="chip"
          class:active={isSelected}
          disabled={!isSelected && selectedIds.size >= 4 && !isAutoSelected}
          onclick={() => toggleSelection(prop.id)}
        >
          <span class="chip-dot" style:background={isSelected ? 'var(--p-ink)' : 'var(--p-ink4)'}
          ></span>
          {truncate(prop.proposition, 60)}
          <span class="chip-count">{prop.instances.length}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if selectedPropositions.length === 0}
    <div class="empty-timeline">
      <span>Velg minst en rettssetning for a vise tidslinjen.</span>
    </div>
  {:else if timeAxis.length === 0}
    <div class="empty-timeline">
      <span>Ingen forekomster funnet for valgte rettssetninger.</span>
    </div>
  {:else}
    <!-- Timeline grid -->
    <div class="timeline-container">
      <!-- Bias annotation -->
      <div class="bias-note">
        <button class="bias-toggle" onclick={() => (showBiasNote = !showBiasNote)}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" />
            <path
              d="M8 7V11M8 5V5.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
          Siteringsbias
        </button>
        {#if showBiasNote}
          <span class="bias-text"
            >Eldre saker har flere siteringer fordi de har hatt lengre tid til a bli sitert.</span
          >
        {/if}
      </div>

      <!-- Column headers (proposition names) -->
      <div
        class="grid-header"
        style:grid-template-columns="56px {selectedPropositions.map(() => '1fr').join(' ')}"
      >
        <div class="year-header"></div>
        {#each selectedPropositions as prop, colIdx}
          <div class="col-header">
            <span class="col-label">{truncate(prop.proposition, 80)}</span>
            <span class="col-meta">
              {prop.instances.length}
              {prop.instances.length === 1 ? 'forekomst' : 'forekomster'}
            </span>
          </div>
        {/each}
      </div>

      <!-- Timeline rows (one per year) -->
      <div class="grid-body">
        {#each timeAxis as year, rowIdx}
          <div
            class="grid-row"
            class:even={rowIdx % 2 === 0}
            style:grid-template-columns="56px {selectedPropositions.map(() => '1fr').join(' ')}"
          >
            <!-- Year label -->
            <div class="year-cell">
              <span class="year-label">{year}</span>
              {#if rowIdx < timeAxis.length - 1}
                <div class="year-line"></div>
              {/if}
            </div>

            <!-- Swim lane cells -->
            {#each selectedPropositions as prop, colIdx}
              {@const events = getEventsAt(prop, year)}
              <div class="lane-cell">
                {#if events.length > 0}
                  {#each events as inst, eIdx}
                    {@const isExpanded =
                      expandedEvent?.propId === prop.id &&
                      expandedEvent?.instIdx === prop.instances.indexOf(inst)}
                    <!-- Event node -->
                    <button
                      class="event-node"
                      class:dashed={isDashed(inst.evolution)}
                      class:expanded={isExpanded}
                      style:border-color={evoColor(inst.evolution)}
                      onclick={() => toggleEvent(prop.id, prop.instances.indexOf(inst))}
                    >
                      <div class="event-dot" style:background={evoColor(inst.evolution)}></div>
                      <span class="event-case">{inst.caseId}</span>
                      <span
                        class="event-evo"
                        style:background={evoBg(inst.evolution)}
                        style:color={evoColor(inst.evolution)}>{evoLabel(inst.evolution)}</span
                      >
                    </button>

                    <!-- Expanded detail card -->
                    {#if isExpanded}
                      <div class="event-detail">
                        <div class="detail-header">
                          <button
                            class="detail-case-link"
                            onclick={() => handleCaseClick(inst.caseId)}
                          >
                            {inst.caseId} §{inst.paragraph}
                          </button>
                          <span class="detail-date">{inst.date}</span>
                          {#if inst.suggested}
                            <span class="detail-ai">AI-forslag</span>
                          {/if}
                        </div>
                        <div class="detail-quote">&laquo;{inst.quote}&raquo;</div>
                      </div>
                    {/if}
                  {/each}
                {:else}
                  <!-- Empty cell — show vertical connector if proposition has events above and below -->
                  <div class="lane-empty"></div>
                {/if}

                <!-- Vertical connector line within swim lane -->
                {#if colIdx < selectedPropositions.length}
                  {@const hasEventThisYear = events.length > 0}
                  {@const hasEventBefore = timeAxis
                    .slice(0, rowIdx)
                    .some((y) => getEventsAt(prop, y).length > 0)}
                  {@const hasEventAfter = timeAxis
                    .slice(rowIdx + 1)
                    .some((y) => getEventsAt(prop, y).length > 0)}
                  {#if hasEventBefore && hasEventAfter && !hasEventThisYear}
                    <div class="lane-connector"></div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Tension overlay: show tension lines between propositions -->
      {#each selectedPropositions as prop}
        {#if prop.tension}
          {@const tensionTarget = selectedPropositions.find((p) => p.id === prop.tension?.withId)}
          {#if tensionTarget}
            <div class="tension-marker">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8H13M13 8L10 5M13 8L10 11"
                  stroke="var(--p-tension)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              <span class="tension-note">{prop.tension.note}</span>
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Selector ── */
  .selector {
    flex-shrink: 0;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--p-border);
  }
  .selector-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .selector-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--p-ink3);
  }
  .selector-hint {
    font-size: 11px;
    color: var(--p-ink4);
    margin-left: auto;
  }
  .selector-clear {
    all: unset;
    cursor: pointer;
    font-size: 11px;
    color: var(--p-ink4);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .selector-clear:hover {
    color: var(--p-ink2);
  }
  .selector-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 12px;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    transition: all 0.12s ease;
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip:hover:not(:disabled) {
    border-color: var(--p-ink4);
  }
  .chip.active {
    background: var(--p-active);
    border-color: var(--p-border-m);
    color: var(--p-ink);
  }
  .chip:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .chip-count {
    font-family: var(--font-data);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink4);
    flex-shrink: 0;
  }

  /* ── Empty state ── */
  .empty-timeline {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--p-ink4);
    padding: 40px;
  }

  /* ── Timeline container ── */
  .timeline-container {
    flex: 1;
    overflow: auto;
    padding: 0 20px 32px;
  }

  /* ── Bias note ── */
  .bias-note {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    flex-wrap: wrap;
  }
  .bias-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--p-ink4);
  }
  .bias-toggle:hover {
    color: var(--p-ink3);
  }
  .bias-text {
    font-size: 11px;
    color: var(--p-ink3);
    font-style: italic;
  }

  /* ── Grid header ── */
  .grid-header {
    display: grid;
    gap: 0;
    border-bottom: 2px solid var(--p-border-m);
    position: sticky;
    top: 0;
    background: var(--p-panel);
    z-index: 1;
  }
  .year-header {
    padding: 8px 0;
  }
  .col-header {
    padding: 10px 12px;
    border-left: 1px solid var(--p-border);
  }
  .col-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .col-meta {
    font-size: 10px;
    color: var(--p-ink4);
    margin-top: 2px;
    display: block;
  }

  /* ── Grid rows ── */
  .grid-body {
    position: relative;
  }
  .grid-row {
    display: grid;
    gap: 0;
    min-height: 52px;
    border-bottom: 1px solid var(--p-border);
  }
  .grid-row.even {
    background: var(--p-hover);
  }

  /* Year cell */
  .year-cell {
    position: relative;
    padding: 12px 8px 12px 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
  }
  .year-label {
    font-family: var(--font-data);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink3);
  }
  .year-line {
    position: absolute;
    right: 24px;
    top: 28px;
    bottom: -1px;
    width: 1px;
    background: var(--p-border);
  }

  /* ── Swim lane cell ── */
  .lane-cell {
    position: relative;
    border-left: 1px solid var(--p-border);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lane-empty {
    min-height: 20px;
  }
  .lane-connector {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--p-border);
    opacity: 0.5;
  }

  /* ── Event node ── */
  .event-node {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border);
    transition: all 0.12s ease;
    background: var(--p-surface);
  }
  .event-node:hover {
    border-color: var(--p-border-m);
    background: var(--p-panel);
  }
  .event-node.expanded {
    border-color: var(--p-border-s);
    background: var(--p-panel);
  }
  .event-node.dashed {
    border-style: dashed;
  }
  .event-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .event-case {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--p-kofa-accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .event-evo {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: var(--radius-badge);
    flex-shrink: 0;
  }

  /* ── Event detail card ── */
  .event-detail {
    padding: 8px 10px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border-left: 3px solid var(--p-kofa-bg);
    margin-top: 4px;
  }
  .detail-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .detail-case-link {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-kofa-accent);
    border-bottom: 1px solid transparent;
  }
  .detail-case-link:hover {
    border-bottom-color: var(--p-kofa-accent);
  }
  .detail-date {
    font-size: 11px;
    color: var(--p-ink4);
  }
  .detail-ai {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-ai-text);
  }
  .detail-quote {
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink2);
    font-style: italic;
  }

  /* ── Tension marker ── */
  .tension-marker {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    margin-top: 8px;
    border-radius: var(--radius-md);
    background: var(--p-tension-bg);
    border-left: 3px solid var(--p-tension-border);
  }
  .tension-note {
    font-size: 12px;
    color: var(--p-tension);
    line-height: 1.4;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .selector {
      padding: 12px;
    }
    .timeline-container {
      padding: 0 12px 24px;
    }
    .col-header {
      padding: 8px;
    }
  }
</style>
