<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  let cases = $derived(analysisState.caseNodes);
  let stats = $derived.by(() => {
    const catScreened = { A: 0, B: 0, C: 0 };
    let claude = 0;
    let me = 0;
    for (const n of cases) {
      const cat = n.category as 'A' | 'B' | 'C';
      const assignment = screeningState.getAssignment(n.label, cat);
      if (assignment === 'claude') claude++;
      else me++;
      if (screeningState.screeningResults[n.label]) catScreened[cat]++;
    }
    return { catScreened, claudeCount: claude, meCount: me };
  });

  let batchActive = $derived(screeningState.isBatchActive('screening'));
  let batchProgress = $derived(screeningState.getBatchProgress('screening'));

  function startScreening() {
    const claudeCases = cases
      .filter((n) => {
        // Exclude old-regulation cases when filter is active (QA bug #8)
        if (uiState.regulationFilter && n.regulation === 'old') return false;
        return screeningState.getAssignment(n.label, n.category) === 'claude';
      })
      .map((n) => n.label);
    if (claudeCases.length === 0) return;
    screeningState.startScreeningSSE(claudeCases);
  }

  const modes: { key: ScreeningMode; label: string }[] = [
    { key: 'claude', label: 'Claude screener' },
    { key: 'me', label: 'Jeg leser' },
    { key: 'pick', label: 'Velg per sak' },
  ];
</script>

<div class="screening-delegation">
  <div class="process-header">
    <button class="back-btn" onclick={() => uiState.clearProcessView()}
      >← Tilbake til arbeidsrom</button
    >
    <span class="process-title">Screening — Arbeidsfordeling</span>
  </div>

  <div class="delegation-content">
    <div class="categories">
      {#each ['A', 'B', 'C'] as cat}
        {@const count = analysisState.catCounts[cat as 'A' | 'B' | 'C']}
        {@const screened = stats.catScreened[cat as keyof typeof stats.catScreened]}
        {@const currentMode = screeningState.screeningModes[cat] ?? 'claude'}

        {#if count > 0}
          <div class="cat-card">
            <div class="cat-card-header">
              <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
              <span class="cat-card-label">{cat}-kandidater ({count})</span>
              {#if screened > 0}
                <span class="cat-card-progress">{screened}/{count} screenet</span>
              {/if}
            </div>
            <div class="mode-selector">
              {#each modes as m}
                <button
                  class="mode-btn"
                  class:active={currentMode === m.key}
                  onclick={() => screeningState.setCategoryMode(cat, m.key)}
                >
                  <span class="mode-radio">{currentMode === m.key ? '●' : '○'}</span>
                  {m.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    {#if uiState.regulationFilter}
      <div class="filter-notice">
        ☑ Kun gjeldende FOA (2017–)
        <span class="filter-count">
          {analysisState.nodes.filter((n) => n.regulation === 'old' && n.category).length} eldre saker
          filtrert
        </span>
      </div>
    {/if}

    <div class="summary-bar">
      <span>Claude: {stats.claudeCount}</span>
      <span class="summary-sep">·</span>
      <span>Du: {stats.meCount}</span>
    </div>

    {#if batchActive}
      <div class="progress-banner">
        <div class="streaming-spinner"></div>
        <span>Screening pågår… {batchProgress}%</span>
        <div class="progress-track">
          <div class="progress-fill" style:width="{batchProgress}%"></div>
        </div>
      </div>
    {:else if !screeningState.screeningStarted}
      <button class="start-btn" onclick={startScreening} disabled={stats.claudeCount === 0}>
        Start screening →
      </button>
    {:else}
      <button class="back-work-btn" onclick={() => uiState.clearProcessView()}>
        Tilbake til arbeidsrom →
      </button>
    {/if}
  </div>
</div>

<style>
  .screening-delegation {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .process-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border-m);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .back-btn {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    color: var(--p-ink3);
    font-weight: 500;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    transition: all 0.1s ease;
  }
  .back-btn:hover {
    color: var(--p-ink);
    background: var(--p-hover);
  }
  .back-btn:active {
    background: var(--p-active);
  }
  .process-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }

  .delegation-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .categories {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cat-card {
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }
  .cat-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cat-card-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .cat-card-progress {
    margin-left: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  .mode-selector {
    display: flex;
    gap: 8px;
  }
  .mode-btn {
    all: unset;
    flex: 1;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    color: var(--p-ink3);
    border: 1px solid var(--p-border-m);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .mode-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink2);
    background: var(--p-hover);
  }
  .mode-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .mode-radio {
    font-size: 10px;
  }

  .filter-notice {
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-hover);
    font-size: 12px;
    color: var(--p-ink2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .filter-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--p-ink3);
  }

  .summary-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--p-ink3);
    font-family: var(--font-data);
  }
  .summary-sep {
    color: var(--p-ink4);
  }

  .start-btn {
    all: unset;
    padding: 12px 24px;
    border-radius: var(--radius-lg);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    display: block;
  }
  .start-btn:hover {
    opacity: 0.85;
  }
  .start-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .back-work-btn {
    all: unset;
    padding: 12px 24px;
    border-radius: var(--radius-lg);
    background: var(--p-surface);
    border: 1px solid var(--p-border-m);
    color: var(--p-ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    display: block;
  }
  .back-work-btn:hover {
    background: var(--p-hover);
  }

  .progress-banner {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--p-ai-text);
  }
  .progress-track {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--p-input);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--p-kofa-accent);
    transition: width 0.3s ease;
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m);
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
</style>
