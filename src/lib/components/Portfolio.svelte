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
  let viewMode = $state<'mine' | 'team'>('mine');
  let teamToastVisible = $state(false);

  let filtered = $derived.by(() => {
    let items = analyses;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.problem.toLowerCase().includes(q) ||
          a.provisions.some((p) => p.toLowerCase().includes(q))
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

  function handleTeamClick() {
    teamToastVisible = true;
    setTimeout(() => (teamToastVisible = false), 2500);
  }

  /** Contextual resume hint — tells the lawyer what to do next */
  function resumeHint(a: AnalysisSummary): string | null {
    if (a.status === 'scoping' || a.status === 'scoping_complete') return null;
    if (a.status === 'searching') return 'Søker etter kandidater…';
    if (a.status === 'complete') return 'Ferdig';

    if (a.candidate_count === 0) return null;

    // Prioritize unread A-cases
    const unreadA = a.abc_unread?.A ?? 0;
    const unreadTotal = a.candidate_count - a.read_count;

    if (a.read_count === a.candidate_count) {
      if (a.status === 'synthesis' || a.status === 'qa') return 'Syntese pågår';
      return 'Alle gjennomgått — klar for syntese';
    }

    // Screening in progress
    if (a.screened_count > 0 && a.screened_count < a.candidate_count) {
      const remaining = a.candidate_count - a.screened_count - a.read_count;
      if (remaining > 0) return `${remaining} saker gjenstår`;
    }

    // Unread A-cases are highest priority
    if (unreadA > 0) return `${unreadA} uleste A-saker`;

    if (unreadTotal > 0) return `${unreadTotal} uleste saker`;

    return null;
  }
</script>

<div class="portfolio-list">
  <!-- Toolbar -->
  <div class="portfolio-toolbar">
    <!-- Mine/Team toggle -->
    <div class="view-toggle">
      <button
        class="toggle-btn"
        class:active={viewMode === 'mine'}
        onclick={() => (viewMode = 'mine')}>Mine</button
      >
      <button class="toggle-btn" class:active={viewMode === 'team'} onclick={handleTeamClick}
        >Team</button
      >
    </div>

    <div class="toolbar-sep"></div>

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
        placeholder="Sok tittel, bestemmelse, begrep..."
        class="search-input"
      />
      {#if search}
        <button class="search-clear" aria-label="Tom sok" onclick={() => (search = '')}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
        </button>
      {/if}
    </div>

    <div class="toolbar-sep"></div>

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

  <!-- Team toast -->
  {#if teamToastVisible}
    <div class="team-toast">Teamvisning krever innlogging</div>
  {/if}

  <!-- Column headers -->
  <div class="col-headers">
    <div class="col-dot-spacer"></div>
    <span class="col-analyse">Analyse</span>
    <span class="col-fase">Fase</span>
    <span class="col-screened">Screenet</span>
    <span class="col-lest">Lest</span>
    <span class="col-search">Søk</span>
    <span class="col-sist">Sist aktiv</span>
  </div>

  <!-- Rows -->
  <div class="rows-scroll">
    {#if filtered.length === 0}
      <div class="empty-state">
        {search ? `Ingen analyser matcher \u00AB${search}\u00BB` : 'Ingen analyser enn\u00E5'}
      </div>
    {/if}

    {#each filtered as analysis}
      {@const meta = STATUS_META[analysis.status] ?? { label: analysis.status, color: '#B0A99E' }}
      {@const pct = analysis.candidate_count
        ? Math.round((analysis.read_count / analysis.candidate_count) * 100)
        : 0}
      <button
        class="analysis-row"
        class:selected={selectedId === analysis.id}
        style:--row-color={meta.color}
        onclick={() => onSelect(analysis.id)}
      >
        <span class="row-dot" style:background={meta.color}></span>
        <div class="row-main">
          <span class="row-title">{analysis.title}</span>
          {#if analysis.provisions.length > 0}
            <div class="row-provisions">
              {#each analysis.provisions.slice(0, 3) as prov}
                <span class="prov-tag">{prov}</span>
              {/each}
              {#if analysis.provisions.length > 3}
                <span class="prov-more">+{analysis.provisions.length - 3}</span>
              {/if}
            </div>
          {/if}
          {#if resumeHint(analysis)}
            <span class="row-hint">{resumeHint(analysis)}</span>
          {/if}
        </div>
        <span class="row-status" style:color={meta.color}>{meta.label}</span>
        <!-- Screened -->
        <div class="row-screened">
          {#if analysis.candidate_count > 0}
            {@const sPct = Math.round((analysis.screened_count / analysis.candidate_count) * 100)}
            <div class="progress-bar">
              <div
                class="progress-fill screened"
                class:complete={sPct === 100}
                style:width="{sPct}%"
              ></div>
            </div>
            <span class="progress-count">{analysis.screened_count}/{analysis.candidate_count}</span>
          {:else}
            <span class="col-empty">&mdash;</span>
          {/if}
        </div>
        <!-- Lest -->
        <div class="row-lest">
          {#if analysis.candidate_count > 0}
            <div class="progress-bar">
              <div class="progress-fill" class:complete={pct === 100} style:width="{pct}%"></div>
            </div>
            <span class="progress-count">{analysis.read_count}/{analysis.candidate_count}</span>
          {:else}
            <span class="col-empty">&mdash;</span>
          {/if}
        </div>
        <!-- Søkerunder -->
        <div class="row-search">
          {#if analysis.iteration > 0}
            <span class="search-badge">{analysis.iteration}</span>
          {:else}
            <span class="col-empty">&mdash;</span>
          {/if}
        </div>
        <span class="row-time">{formatTime(analysis.updated_at)}</span>
      </button>
    {/each}

    <!-- New analysis (inline row) -->
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
    max-width: 1100px;
  }

  .portfolio-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  /* Mine/Team toggle */
  .view-toggle {
    display: flex;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border);
    overflow: hidden;
  }
  .toggle-btn {
    all: unset;
    padding: 4px 14px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    color: var(--p-ink3);
    transition: all 0.1s ease;
  }
  .toggle-btn:hover:not(.active) {
    color: var(--p-ink2);
    background: var(--p-hover);
  }
  .toggle-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
  }

  .team-toast {
    padding: 6px 16px;
    font-size: 11px;
    color: var(--p-ink3);
    font-style: italic;
    background: var(--p-hover);
    border-bottom: 1px solid var(--p-border);
    text-align: center;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    background: var(--p-input);
    border: 1px solid var(--p-border);
    flex: 0 1 220px;
    transition: border-color 0.1s ease;
  }
  .search-box:focus-within {
    border-color: var(--p-border-s);
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
  .search-input::placeholder {
    color: var(--p-ink4);
  }
  .search-clear {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--p-ink4);
    padding: 0;
    display: flex;
    align-items: center;
    transition: color 0.1s ease;
  }
  .search-clear:hover {
    color: var(--p-ink2);
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
    padding: 4px 8px;
    border-radius: var(--radius-md);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--p-border-m);
    color: var(--p-ink3);
    transition: all 0.1s ease;
  }
  .status-chip:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink2);
  }
  .status-chip.active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 7%, transparent);
    color: var(--chip-color);
  }
  .chip-dot {
    width: 4px;
    height: 4px;
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
    padding: 6px 16px 6px 19px;
    border-bottom: 1px solid var(--p-border-m);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink4);
    letter-spacing: 0.04em;
    background: var(--p-bg);
    flex-shrink: 0;
  }
  .col-dot-spacer {
    width: 7px;
  }
  .col-analyse {
    flex: 1;
  }
  .col-fase {
    min-width: 65px;
    text-align: right;
  }
  .col-screened {
    width: 64px;
  }
  .col-lest {
    width: 64px;
  }
  .col-search {
    width: 28px;
    text-align: center;
  }
  .col-sist {
    min-width: 70px;
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
    padding: 10px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--p-border);
    border-left: 3px solid transparent;
    transition: background 0.1s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .analysis-row:hover {
    background: var(--p-hover);
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

  .row-provisions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .prov-tag {
    font-size: 10px;
    font-family: var(--font-data);
    font-weight: 500;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    background: var(--p-provision-bg);
    color: var(--p-provision-accent);
  }
  .prov-more {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .row-hint {
    font-size: 10px;
    color: var(--p-ink3);
    margin-top: 1px;
  }

  .row-status {
    font-size: 10px;
    font-weight: 500;
    min-width: 65px;
    text-align: right;
    flex-shrink: 0;
  }

  .row-screened,
  .row-lest {
    width: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .progress-bar {
    flex: 1;
    height: 2px;
    border-radius: 1px;
    background: var(--p-input);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 1px;
    background: var(--p-ink3);
    transition: width 0.3s ease;
  }
  .progress-fill.screened {
    background: var(--p-kofa-accent);
  }
  .progress-fill.complete {
    background: var(--p-success);
  }
  .progress-count {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    min-width: 20px;
    text-align: right;
  }
  .col-empty {
    font-size: 10px;
    color: var(--p-ink4);
    text-align: right;
    display: block;
    width: 100%;
  }

  .row-search {
    width: 28px;
    flex-shrink: 0;
    text-align: center;
  }
  .search-badge {
    font-family: var(--font-data);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    background: var(--p-hover);
    padding: 1px 5px;
    border-radius: var(--radius-badge);
  }

  .row-time {
    font-size: 10px;
    color: var(--p-ink4);
    min-width: 70px;
    text-align: right;
    flex-shrink: 0;
    font-family: var(--font-data);
  }

  .new-analysis-row {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
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
