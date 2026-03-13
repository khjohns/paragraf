<script lang="ts">
  import type { AnalysisSummary, AnalysisStatus } from '$lib/types/analysis';
  import { STATUS_META } from '$lib/utils/analysisStatus';

  interface Props {
    analyses: AnalysisSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
  }

  const { analyses, selectedId, onSelect, onCreate }: Props = $props();

  let search = $state('');
  let statusFilter = $state<AnalysisStatus | null>(null);

  let filtered = $derived.by(() => {
    let items = analyses;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) => a.title.toLowerCase().includes(q) || a.problem.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      items = items.filter((a) => a.status === statusFilter);
    }
    return items;
  });

  let statusCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const a of analyses) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  });

  // Unique status phases for filter chips (derived from shared STATUS_META)
  const STATUS_PHASE_KEYS: AnalysisStatus[] = [
    'scoping',
    'candidates_ready',
    'screening',
    'post_search',
    'synthesis',
    'complete',
  ];
  const STATUS_PHASES = STATUS_PHASE_KEYS.map((key) => ({ key, ...STATUS_META[key] }));

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m siden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}t siden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d siden`;
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  }
</script>

<div class="portfolio-list">
  <!-- Toolbar -->
  <div class="portfolio-toolbar">
    <!-- Search -->
    <div class="search-box">
      <svg width="13" height="13" viewBox="0 0 13 13" class="search-icon">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3" fill="none" />
        <line
          x1="8.5"
          y1="8.5"
          x2="12"
          y2="12"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
      <input
        bind:value={search}
        placeholder="Søk tittel, bestemmelse, begrep…"
        class="search-input"
      />
      {#if search}
        <button class="search-clear" onclick={() => (search = '')}>×</button>
      {/if}
    </div>

    <div class="toolbar-sep"></div>

    <!-- Status filter chips -->
    {#each STATUS_PHASES.filter((s) => statusCounts[s.key]) as phase}
      <button
        class="status-chip"
        class:active={statusFilter === phase.key}
        style:--chip-color={phase.color}
        onclick={() =>
          (statusFilter = statusFilter === phase.key ? null : (phase.key as AnalysisStatus))}
      >
        <span class="chip-dot" style:background={phase.color}></span>
        {phase.label}
        <span class="chip-count">{statusCounts[phase.key]}</span>
      </button>
    {/each}

    <span class="flex-spacer"></span>
    <span class="analysis-count">{filtered.length} analyser</span>
  </div>

  <!-- Column headers -->
  <div class="col-headers">
    <div class="col-dot"></div>
    <span class="col-analyse">Analyse</span>
    <span class="col-fase">Fase</span>
    <span class="col-sist">Sist aktiv</span>
  </div>

  <!-- Rows -->
  <div class="rows-scroll">
    {#if filtered.length === 0}
      <div class="empty-state">
        {search ? `Ingen analyser matcher «${search}»` : 'Ingen analyser ennå'}
      </div>
    {/if}

    {#each filtered as analysis}
      {@const meta = STATUS_META[analysis.status] ?? { label: analysis.status, color: '#B0A99E' }}
      <button
        class="analysis-row"
        class:selected={selectedId === analysis.id}
        style:--row-color={meta.color}
        onclick={() => onSelect(analysis.id)}
      >
        <span class="row-dot" style:background={meta.color}></span>
        <div class="row-main">
          <span class="row-title">{analysis.title}</span>
          {#if analysis.problem}
            <span class="row-problem">{analysis.problem}</span>
          {/if}
        </div>
        <span class="row-status" style:color={meta.color}>{meta.label}</span>
        <span class="row-time">{formatTime(analysis.updated_at)}</span>
      </button>
    {/each}

    <!-- New analysis row -->
    <button class="new-analysis-row" onclick={onCreate}>
      <span class="new-plus">+</span>
      Ny analyse
    </button>
  </div>
</div>

<style>
  .portfolio-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .portfolio-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 5px;
    background: var(--p-input);
    border: 1px solid var(--p-border);
    flex: 0 1 220px;
  }
  .search-icon {
    flex-shrink: 0;
    opacity: 0.35;
  }
  .search-input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 12px;
    color: var(--p-ink);
    width: 100%;
    padding: 0;
    font-family: inherit;
  }
  .search-clear {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--p-ink4);
    font-size: 13px;
    padding: 0;
    line-height: 1;
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--p-border);
  }

  .status-chip {
    all: unset;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--p-border-m);
    color: var(--p-ink3);
    transition: all 0.1s ease;
  }
  .status-chip.active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 7%, transparent);
    color: var(--chip-color);
  }
  .chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    opacity: 0.6;
  }
  .chip-count {
    font-family: var(--font-data);
    opacity: 0.7;
  }

  .flex-spacer {
    flex: 1;
  }
  .analysis-count {
    font-size: 11px;
    color: var(--p-ink4);
  }

  .col-headers {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 20px;
    border-bottom: 1px solid var(--p-border-m);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink4);
    letter-spacing: 0.04em;
    background: var(--p-bg);
    flex-shrink: 0;
  }
  .col-dot {
    width: 7px;
  }
  .col-analyse {
    flex: 1;
  }
  .col-fase {
    min-width: 80px;
    text-align: right;
  }
  .col-sist {
    min-width: 80px;
    text-align: right;
  }

  .rows-scroll {
    flex: 1;
    overflow-y: auto;
  }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--p-ink3);
    font-size: 13px;
  }

  .analysis-row {
    all: unset;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    cursor: pointer;
    border-bottom: 1px solid var(--p-border);
    border-left: 3px solid transparent;
    transition: background 0.1s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .analysis-row:hover {
    background: rgba(26, 24, 20, 0.02);
  }
  .analysis-row.selected {
    background: var(--p-active);
    border-left-color: var(--row-color);
  }

  .row-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-problem {
    font-size: 11px;
    color: var(--p-ink3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-status {
    font-size: 10px;
    font-weight: 500;
    min-width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .row-time {
    font-size: 10px;
    color: var(--p-ink4);
    min-width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .new-analysis-row {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 20px;
    cursor: pointer;
    color: var(--p-ink3);
    font-size: 12px;
    font-weight: 500;
    transition: color 0.12s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .new-analysis-row:hover {
    color: var(--p-ink);
  }
  .new-plus {
    font-size: 16px;
    line-height: 1;
  }
</style>
