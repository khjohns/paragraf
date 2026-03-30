<script lang="ts">
  import {
    EVOLUTION_CONFIG,
    type Rettssetning,
    type CaseInstance,
    type EvolutionType,
  } from '$lib/mockup/data/rettssetninger';
  import EvolutionTag from './EvolutionTag.svelte';

  let { rules, onSelectRule }: { rules: Rettssetning[]; onSelectRule: (id: string) => void } =
    $props();

  // Selected propositions for swim lanes (max 4)
  let selectedIds = $state<Set<string>>(new Set());

  let selectedRules = $derived.by(() => {
    if (selectedIds.size === 0) return rules.slice(0, 3);
    return rules.filter((r) => selectedIds.has(r.id));
  });

  let selectedIdSet = $derived(new Set(selectedRules.map((r) => r.id)));
  let isAutoSelected = $derived(selectedIds.size === 0);

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else if (next.size < 4) next.add(id);
    selectedIds = next;
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  // Single-pass derived: build timeAxis, eventMap, yearSets
  interface IndexedCase {
    c: CaseInstance;
    globalIdx: number;
  }

  let computed = $derived.by(() => {
    const allYears = new Set<number>();
    const events = new Map<string, Map<number, IndexedCase[]>>();
    const yearSets = new Map<string, Set<number>>();

    for (const r of selectedRules) {
      const yearMap = new Map<number, IndexedCase[]>();
      const rYears = new Set<number>();

      for (let gi = 0; gi < r.cases.length; gi++) {
        const y = parseInt(r.cases[gi].year);
        if (!isNaN(y)) {
          allYears.add(y);
          rYears.add(y);
          const bucket = yearMap.get(y) ?? [];
          bucket.push({ c: r.cases[gi], globalIdx: gi });
          yearMap.set(y, bucket);
        }
      }
      events.set(r.id, yearMap);
      yearSets.set(r.id, rYears);
    }

    return { timeAxis: [...allYears].sort((a, b) => a - b), events, yearSets };
  });

  // Pre-compute connector state per rule
  let connectors = $derived.by(() => {
    const cache = new Map<string, { before: boolean[]; after: boolean[] }>();
    for (const r of selectedRules) {
      const years = computed.yearSets.get(r.id);
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
      cache.set(r.id, { before, after });
    }
    return cache;
  });

  function getEventsAt(ruleId: string, year: number): IndexedCase[] {
    return computed.events.get(ruleId)?.get(year) ?? [];
  }

  let gridColumns = $derived(`48px ${selectedRules.map(() => '1fr').join(' ')}`);

  // Pre-compute which rules are *targets* of a tension (i.e. another selected
  // rule has tension.withId pointing at them). We mark the target column, not
  // the source, because the tension originates from the source's perspective.
  let tensionTargetIds = $derived(
    new Set(selectedRules.filter((r) => r.tension).map((r) => r.tension!.withId))
  );

  function evoColor(type: EvolutionType): string {
    const colors: Record<EvolutionType, string> = {
      established: 'var(--ink)',
      confirmed: 'var(--confirm-color)',
      qualified: 'var(--qualified-color)',
      consolidating: 'var(--ink-muted)',
    };
    return colors[type] ?? 'var(--ink-tertiary)';
  }

  function isDashed(type: EvolutionType): boolean {
    return type === 'qualified';
  }

  function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '\u2026' : text;
  }

  let expandedEvent = $state<{ ruleId: string; caseIdx: number } | null>(null);

  function toggleEvent(ruleId: string, caseIdx: number) {
    if (expandedEvent?.ruleId === ruleId && expandedEvent?.caseIdx === caseIdx) {
      expandedEvent = null;
    } else {
      expandedEvent = { ruleId, caseIdx };
    }
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
          {selectedRules.length} første vist
        {:else}
          {selectedIds.size} av maks 4
        {/if}
      </span>
      {#if !isAutoSelected}
        <button class="selector-clear" onclick={clearSelection}>Nullstill</button>
      {/if}
    </div>
    <div class="selector-chips">
      {#each rules as rule}
        {@const isSelected = selectedIdSet.has(rule.id)}
        <button
          class="chip"
          class:active={isSelected}
          disabled={!isSelected && selectedIds.size >= 4 && !isAutoSelected}
          onclick={() => toggleSelection(rule.id)}
        >
          <span class="chip-dot" style:background={isSelected ? 'var(--ink)' : 'var(--ink-muted)'}
          ></span>
          <span class="chip-text">{truncate(rule.proposition, 60)}</span>
          <span class="chip-count">{rule.cases.length}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if selectedRules.length === 0}
    <div class="empty-timeline">
      <span>Velg minst én rettssetning for å vise tidslinjen.</span>
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
        {#each selectedRules as rule}
          {@const hasTension = rule.tension != null && tensionTargetIds.has(rule.id)}
          <div class="col-header" class:has-tension={hasTension}>
            <span class="col-label">{truncate(rule.proposition, 80)}</span>
            <span class="col-meta">
              {rule.cases.length}
              {rule.cases.length === 1 ? 'forekomst' : 'forekomster'}
              {#if hasTension}
                <span class="col-tension">&middot; spenning</span>
              {/if}
            </span>
          </div>
        {/each}
      </div>

      {#if showBiasNote}
        <div class="bias-bar">
          Eldre saker har flere siteringer fordi de har hatt lengre tid til å bli sitert.
        </div>
      {/if}

      <!-- Timeline rows -->
      <div class="grid-body">
        {#each computed.timeAxis as year, rowIdx}
          <div class="grid-row" style:grid-template-columns={gridColumns}>
            <div class="year-cell">
              <span class="year-label">{year}</span>
            </div>

            {#each selectedRules as rule}
              {@const events = getEventsAt(rule.id, year)}
              {@const hasEventThisYear = events.length > 0}
              {@const conn = connectors.get(rule.id)}
              {@const hasBefore = conn?.before[rowIdx] ?? false}
              {@const hasAfter = conn?.after[rowIdx] ?? false}
              {@const showConnector = !hasEventThisYear && hasBefore && hasAfter}

              <div class="lane-cell">
                {#if (hasBefore && hasEventThisYear) || showConnector}
                  <div class="lane-line"></div>
                {/if}

                {#each events as { c, globalIdx }}
                  {@const isExpanded =
                    expandedEvent?.ruleId === rule.id && expandedEvent?.caseIdx === globalIdx}
                  <button
                    class="event-node"
                    class:dashed={isDashed(c.evolution)}
                    class:expanded={isExpanded}
                    onclick={() => toggleEvent(rule.id, globalIdx)}
                  >
                    <div class="event-dot {c.evolution}"></div>
                    <span class="event-case">{c.ref}</span>
                    <EvolutionTag evolution={c.evolution} />
                  </button>

                  {#if isExpanded}
                    <div class="event-detail">
                      <div class="detail-header">
                        <button class="detail-case-link" onclick={() => onSelectRule(rule.id)}>
                          {c.ref}
                          {c.paragraphs}
                        </button>
                        <span class="detail-date">{c.year}</span>
                        {#if c.suggested}
                          <span class="detail-ai">AI-forslag</span>
                        {/if}
                      </div>
                      <div class="detail-quote">&laquo;{c.quotes[0]?.text ?? ''}&raquo;</div>
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
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }
  .selector-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .selector-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-tertiary);
  }
  .selector-hint {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    margin-left: auto;
  }
  .selector-clear {
    all: unset;
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .selector-clear:hover {
    color: var(--ink-secondary);
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
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-tertiary);
    border: 1px solid var(--border);
    border-radius: 2px;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .chip:hover:not(:disabled) {
    border-color: var(--border-strong);
  }
  .chip.active {
    background: var(--row-active-bg);
    border-color: var(--border-strong);
    color: var(--ink);
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
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    flex-shrink: 0;
  }

  /* ── Empty state ── */
  .empty-timeline {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-muted);
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
    color: var(--ink-muted);
    padding: 2px;
    border-radius: 50%;
  }
  .bias-toggle:hover {
    color: var(--ink-tertiary);
  }
  .bias-bar {
    padding: 6px 24px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-style: italic;
    color: var(--ink-tertiary);
    background: var(--paper-dark);
    border-bottom: 1px solid var(--border);
  }

  /* ── Grid header ── */
  .grid-header {
    display: grid;
    gap: 0;
    border-bottom: 1px solid var(--border-strong);
    position: sticky;
    top: 0;
    background: var(--paper);
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
    border-left: 1px solid var(--border);
  }
  .col-header.has-tension {
    border-left-color: var(--tension-border);
  }
  .col-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .col-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    margin-top: 2px;
    display: block;
  }
  .col-tension {
    color: var(--tension-color);
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
    border-bottom: 1px solid var(--border-subtle);
  }

  /* Year cell */
  .year-cell {
    padding: 10px 8px 10px 12px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    border-right: 1px solid var(--border);
  }
  .year-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink-tertiary);
  }

  /* ── Swim lane cell ── */
  .lane-cell {
    position: relative;
    border-left: 1px solid var(--border-subtle);
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
    background: var(--border-strong);
  }

  /* ── Event node ── */
  .event-node {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 2px;
    border: 1px solid transparent;
    transition: background 0.15s ease;
    background: var(--paper-dark);
    position: relative;
    z-index: 1;
  }
  .event-node:hover {
    background: var(--hover-bg-strong);
  }
  .event-node.expanded {
    background: var(--row-active-bg);
  }
  .event-node.dashed {
    border: 1px dashed var(--border-strong);
  }
  .event-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    box-sizing: content-box;
  }
  .event-dot.established {
    border: 2.5px solid var(--ink);
  }
  .event-dot.confirmed {
    border: 2px solid var(--confirm-color);
  }
  .event-dot.qualified {
    border: 2px dashed var(--qualified-color);
  }
  .event-dot.consolidating {
    border: 2px solid var(--ink-muted);
  }
  .event-case {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Event detail card ── */
  .event-detail {
    padding: 8px 10px;
    border-radius: 2px;
    background: var(--paper-dark);
    border-left: 2px solid var(--border-strong);
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
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
    border-bottom: 1px solid transparent;
  }
  .detail-case-link:hover {
    border-bottom-color: var(--ink);
  }
  .detail-date {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
  }
  .detail-ai {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid var(--ai-border);
    color: var(--ai-accent);
  }
  .detail-quote {
    font-size: 12px;
    line-height: 1.55;
    color: var(--ink-secondary);
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
