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

  let selectedPropositions = $derived.by(() => {
    if (selectedIds.size === 0) {
      return propositions.slice(0, 3);
    }
    return propositions.filter((p) => selectedIds.has(p.id));
  });

  // Pre-compute selected set for O(1) chip lookups in auto-select mode
  let selectedIdSet = $derived(new Set(selectedPropositions.map((p) => p.id)));

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

  function yearOf(date: string): number {
    return parseInt(date.slice(0, 4));
  }

  // Single-pass derived: build timeAxis, eventMap (with stored indices), and propYearSets
  interface IndexedInstance {
    inst: PropositionInstance;
    globalIdx: number;
  }

  let computed = $derived.by(() => {
    const allYears = new Set<number>();
    const events = new Map<string, Map<number, IndexedInstance[]>>();
    const yearSets = new Map<string, Set<number>>();

    for (const p of selectedPropositions) {
      const yearMap = new Map<number, IndexedInstance[]>();
      const pYears = new Set<number>();

      for (let gi = 0; gi < p.instances.length; gi++) {
        const y = yearOf(p.instances[gi].date);
        if (!isNaN(y)) {
          allYears.add(y);
          pYears.add(y);
          const bucket = yearMap.get(y) ?? [];
          bucket.push({ inst: p.instances[gi], globalIdx: gi });
          yearMap.set(y, bucket);
        }
      }
      events.set(p.id, yearMap);
      yearSets.set(p.id, pYears);
    }

    const timeAxis = [...allYears].sort((a, b) => a - b);
    return { timeAxis, events, yearSets };
  });

  // Pre-compute connector state: for each prop, boolean arrays of hasBefore/hasAfter per timeAxis index
  let connectors = $derived.by(() => {
    const cache = new Map<string, { before: boolean[]; after: boolean[] }>();
    for (const p of selectedPropositions) {
      const years = computed.yearSets.get(p.id);
      if (!years) continue;
      const before: boolean[] = [];
      const after: boolean[] = [];
      let seen = false;
      for (let i = 0; i < computed.timeAxis.length; i++) {
        before.push(seen);
        if (years.has(computed.timeAxis[i])) seen = true;
      }
      let seenAfter = false;
      for (let i = computed.timeAxis.length - 1; i >= 0; i--) {
        after[i] = seenAfter;
        if (years.has(computed.timeAxis[i])) seenAfter = true;
      }
      cache.set(p.id, { before, after });
    }
    return cache;
  });

  function getEventsAt(propId: string, year: number): IndexedInstance[] {
    return computed.events.get(propId)?.get(year) ?? [];
  }

  // CSS grid columns
  let gridColumns = $derived(`48px ${selectedPropositions.map(() => '1fr').join(' ')}`);

  // Pre-compute which propositions are *targets* of a tension (i.e. another selected
  // proposition has tension.withId pointing at them). We mark the target column, not
  // the source, because the tension originates from the source's perspective.
  let tensionTargetIds = $derived(
    new Set(selectedPropositions.filter((p) => p.tension).map((p) => p.tension!.withId))
  );

  function evoColor(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.color ?? 'var(--p-ink3)';
  }

  function evoBg(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.bg ?? 'rgba(26,24,20,0.06)';
  }

  function evoLabel(type: EvolutionType): string {
    return EVOLUTION_CONFIG[type]?.label ?? type;
  }

  function isDashed(type: EvolutionType): boolean {
    return type === 'qualified';
  }

  function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '\u2026' : text;
  }

  let expandedEvent = $state<{ propId: string; instIdx: number } | null>(null);

  function toggleEvent(propId: string, instIdx: number) {
    if (expandedEvent?.propId === propId && expandedEvent?.instIdx === instIdx) {
      expandedEvent = null;
    } else {
      expandedEvent = { propId, instIdx };
    }
  }

  function handleCaseClick(caseId: string) {
    uiState.selectNode(caseId);
  }

  let showBiasNote = $state(false);
</script>

<div class="timeline-view">
  <!-- Proposition selector -->
  <div class="selector">
    <div class="selector-header">
      <span class="selector-label">Rettssetninger i tidslinjen</span>
      <span class="selector-hint">
        {#if isAutoSelected}
          {selectedPropositions.length} f\u00f8rste vist
        {:else}
          {selectedIds.size} av maks 4
        {/if}
      </span>
      {#if !isAutoSelected}
        <button class="selector-clear" onclick={clearSelection}>Nullstill</button>
      {/if}
    </div>
    <div class="selector-chips">
      {#each propositions as prop}
        {@const isSelected = selectedIdSet.has(prop.id)}
        <button
          class="chip"
          class:active={isSelected}
          disabled={!isSelected && selectedIds.size >= 4 && !isAutoSelected}
          onclick={() => toggleSelection(prop.id)}
        >
          <span class="chip-dot" style:background={isSelected ? 'var(--p-ink)' : 'var(--p-ink4)'}
          ></span>
          <span class="chip-text">{truncate(prop.proposition, 60)}</span>
          <span class="chip-count">{prop.instances.length}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if selectedPropositions.length === 0}
    <div class="empty-timeline">
      <span>Velg minst \u00e9n rettssetning for \u00e5 vise tidslinjen.</span>
    </div>
  {:else if computed.timeAxis.length === 0}
    <div class="empty-timeline">
      <span>Ingen forekomster funnet for valgte rettssetninger.</span>
    </div>
  {:else}
    <div class="timeline-container">
      <!-- Column headers -->
      <div class="grid-header" style:grid-template-columns={gridColumns}>
        <div class="year-header">
          <button
            class="bias-toggle"
            onclick={() => (showBiasNote = !showBiasNote)}
            title="Om siteringer"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" />
              <path
                d="M8 7V11M8 5V5.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        {#each selectedPropositions as prop}
          {@const hasTension = prop.tension != null && tensionTargetIds.has(prop.id)}
          <div class="col-header" class:has-tension={hasTension}>
            <span class="col-label">{truncate(prop.proposition, 80)}</span>
            <span class="col-meta">
              {prop.instances.length}
              {prop.instances.length === 1 ? 'forekomst' : 'forekomster'}
              {#if hasTension}
                <span class="col-tension">\u00b7 spenning</span>
              {/if}
            </span>
          </div>
        {/each}
      </div>

      {#if showBiasNote}
        <div class="bias-bar">
          Eldre saker har flere siteringer fordi de har hatt lengre tid til \u00e5 bli sitert.
        </div>
      {/if}

      <!-- Timeline rows -->
      <div class="grid-body">
        {#each computed.timeAxis as year, rowIdx}
          <div class="grid-row" style:grid-template-columns={gridColumns}>
            <div class="year-cell">
              <span class="year-label">{year}</span>
            </div>

            {#each selectedPropositions as prop}
              {@const events = getEventsAt(prop.id, year)}
              {@const hasEventThisYear = events.length > 0}
              {@const conn = connectors.get(prop.id)}
              {@const hasBefore = conn?.before[rowIdx] ?? false}
              {@const hasAfter = conn?.after[rowIdx] ?? false}
              {@const showConnector = !hasEventThisYear && hasBefore && hasAfter}

              <div class="lane-cell">
                {#if (hasBefore && hasEventThisYear) || showConnector}
                  <div class="lane-line"></div>
                {/if}

                {#each events as { inst, globalIdx }}
                  {@const isExpanded =
                    expandedEvent?.propId === prop.id && expandedEvent?.instIdx === globalIdx}
                  <button
                    class="event-node"
                    class:dashed={isDashed(inst.evolution)}
                    class:expanded={isExpanded}
                    onclick={() => toggleEvent(prop.id, globalIdx)}
                  >
                    <div
                      class="event-dot"
                      style:background={evoColor(inst.evolution)}
                      style:border-color={evoColor(inst.evolution)}
                    ></div>
                    <span class="event-case">{inst.caseId}</span>
                    <span
                      class="event-evo"
                      style:background={evoBg(inst.evolution)}
                      style:color={evoColor(inst.evolution)}>{evoLabel(inst.evolution)}</span
                    >
                  </button>

                  {#if isExpanded}
                    <div class="event-detail">
                      <div class="detail-header">
                        <button
                          class="detail-case-link"
                          onclick={() => handleCaseClick(inst.caseId)}
                        >
                          {inst.caseId} \u00a7{inst.paragraph}
                        </button>
                        <span class="detail-date">{inst.date}</span>
                        {#if inst.suggested}
                          <span class="detail-ai">AI-forslag</span>
                        {/if}
                      </div>
                      <div class="detail-quote">\u00ab{inst.quote}\u00bb</div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 12px;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
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
  .chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 320px;
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
    overflow-y: auto;
    overflow-x: auto;
    min-height: 0;
  }

  /* ── Bias ── */
  .bias-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--p-ink4);
    padding: 2px;
    border-radius: 50%;
  }
  .bias-toggle:hover {
    color: var(--p-ink3);
  }
  .bias-bar {
    padding: 6px 20px;
    font-size: 11px;
    font-style: italic;
    color: var(--p-ink3);
    background: var(--p-bg);
    border-bottom: 1px solid var(--p-border);
  }

  /* ── Grid header ── */
  .grid-header {
    display: grid;
    gap: 0;
    border-bottom: 1px solid var(--p-border-m);
    position: sticky;
    top: 0;
    background: var(--p-panel);
    z-index: 1;
  }
  .year-header {
    padding: 10px 8px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .col-header {
    padding: 10px 12px;
    border-left: 1px solid var(--p-border);
  }
  .col-header.has-tension {
    border-left-color: var(--p-tension-border);
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
  .col-tension {
    color: var(--p-tension);
    font-weight: 600;
  }

  /* ── Grid rows ── */
  .grid-body {
    position: relative;
  }
  .grid-row {
    display: grid;
    gap: 0;
    min-height: 48px;
    border-bottom: 1px solid var(--p-border);
  }

  /* Year cell */
  .year-cell {
    padding: 10px 8px 10px 12px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    border-right: 1px solid var(--p-border);
  }
  .year-label {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink3);
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

  .lane-line {
    position: absolute;
    left: 16px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--p-border-m);
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
    border: 1px solid transparent;
    transition: background 0.15s ease;
    background: var(--p-surface);
    position: relative;
    z-index: 1;
  }
  .event-node:hover {
    background: var(--p-hover);
  }
  .event-node.expanded {
    background: var(--p-active);
  }
  .event-node.dashed {
    border: 1px dashed var(--p-border-m);
  }
  .event-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2px solid;
    box-sizing: content-box;
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
    border-left: 3px solid var(--p-kofa-border);
    margin-top: 4px;
    position: relative;
    z-index: 1;
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

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .selector {
      padding: 12px;
    }
    .chip-text {
      max-width: 200px;
    }
  }
</style>
