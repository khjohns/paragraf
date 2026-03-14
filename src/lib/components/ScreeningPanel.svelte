<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screenCases } from '$lib/api/analyses';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  // Derive case lists by category
  let cases = $derived(analysisState.nodes.filter((n) => n.category));
  let catCounts = $derived({
    A: cases.filter((n) => n.category === 'A').length,
    B: cases.filter((n) => n.category === 'B').length,
    C: cases.filter((n) => n.category === 'C').length,
  });

  // Screening progress
  let screenedResults = $derived(Object.keys(analysisState.screeningResults));
  let screenedCount = $derived(screenedResults.length);

  let claudeCount = $derived(
    cases.filter((n) => {
      const sakNr = n.label;
      return analysisState.getAssignment(sakNr, n.category) === 'claude';
    }).length
  );
  let meCount = $derived(
    cases.filter((n) => {
      const sakNr = n.label;
      return analysisState.getAssignment(sakNr, n.category) === 'me';
    }).length
  );

  // Per-category screened counts
  function catScreenedCount(cat: string): number {
    return cases
      .filter((n) => n.category === cat)
      .filter((n) => analysisState.screeningResults[n.label])
      .length;
  }
  function catReadCount(cat: string): number {
    return cases
      .filter((n) => n.category === cat)
      .filter((n) => analysisState.getAssignment(n.label, n.category) === 'me' && analysisState.analysis.readStatus[n.id])
      .length;
  }

  let abortController: AbortController | null = null;

  function startScreening() {
    // Collect cases assigned to Claude
    const claudeCases = cases
      .filter((n) => analysisState.getAssignment(n.label, n.category) === 'claude')
      .map((n) => n.label);

    if (claudeCases.length === 0) return;

    analysisState.startScreening();
    analysisState.setStatus('screening');

    // Set first case as streaming
    analysisState.setStreamingSakNr(claudeCases[0]);

    abortController = screenCases(
      analysisState.analysis.id,
      claudeCases,
      (result) => {
        if (result.error && !result.sak_nr) return;
        analysisState.addScreeningResult(result);

        // Set next case as streaming
        const idx = claudeCases.indexOf(result.sak_nr);
        if (idx < claudeCases.length - 1) {
          analysisState.setStreamingSakNr(claudeCases[idx + 1]);
        } else {
          analysisState.setStreamingSakNr(null);
        }
      },
      () => {
        analysisState.setStreamingSakNr(null);
        // Check if all Claude cases are screened
        const allScreened = claudeCases.every((sn) => analysisState.screeningResults[sn]);
        if (allScreened) {
          analysisState.setStatus('screening_complete');
        }
      },
      (error) => {
        analysisState.setStreamingSakNr(null);
        console.error('Screening error:', error);
      },
    );
  }

  const modes: { key: ScreeningMode; label: string }[] = [
    { key: 'claude', label: 'Claude screener' },
    { key: 'me', label: 'Jeg leser' },
    { key: 'pick', label: 'Velg per sak' },
  ];
</script>

<div class="screening-panel">
  <div class="panel-label">Arbeidsfordeling</div>
  <div class="panel-desc">
    Velg hvem som screener per kategori, eller juster per sak i listen.
  </div>

  {#each ['A', 'B', 'C'] as cat}
    {@const count = catCounts[cat as keyof typeof catCounts]}
    {@const screened = catScreenedCount(cat)}
    {@const read = catReadCount(cat)}
    {@const done = screened + read}
    {@const pct = count > 0 ? Math.round((done / count) * 100) : 0}
    {@const currentMode = analysisState.screeningModes[cat] ?? 'claude'}

    <div class="cat-control">
      <div class="cat-header">
        <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
        <span class="cat-count">{count} {count === 1 ? 'sak' : 'saker'}</span>
        <span class="spacer"></span>
        {#if done > 0}
          <div class="cat-progress">
            <div class="progress-track">
              <div
                class="progress-fill"
                class:complete={pct === 100}
                style:width="{pct}%"
              ></div>
            </div>
            <span class="progress-text">{done}/{count}</span>
          </div>
        {/if}
      </div>

      <div class="mode-selector">
        {#each modes as m}
          <button
            class="mode-btn"
            class:active={currentMode === m.key}
            onclick={() => analysisState.setCategoryMode(cat, m.key)}
          >
            {m.label}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  <!-- Summary -->
  <div class="summary">
    <div class="summary-row">
      <span>Claude screener</span>
      <span class="summary-val ai">{claudeCount}</span>
    </div>
    <div class="summary-row">
      <span>Du leser</span>
      <span class="summary-val me">{meCount}</span>
    </div>
    {#if analysisState.screeningStarted && screenedCount > 0}
      <div class="summary-row screened">
        <span>Screenet</span>
        <span class="summary-val">{screenedCount}/{claudeCount}</span>
      </div>
    {/if}
  </div>

  {#if !analysisState.screeningStarted}
    <button class="start-btn" onclick={startScreening} disabled={claudeCount === 0}>
      Start screening
    </button>
  {/if}

  {#if analysisState.streamingSakNr}
    <div class="streaming-indicator">
      <div class="streaming-spinner"></div>
      Leser {analysisState.streamingSakNr}…
    </div>
  {/if}
</div>

<style>
  .screening-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .panel-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.45;
    margin-bottom: 4px;
  }

  .cat-control {
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }

  .cat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .cat-count {
    font-size: 13px;
    font-weight: 500;
    color: var(--p-ink);
  }
  .spacer { flex: 1; }

  .cat-progress {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .progress-track {
    width: 48px;
    height: 3px;
    border-radius: 2px;
    background: var(--p-input);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--p-ink3);
    transition: width 0.3s ease;
  }
  .progress-fill.complete {
    background: var(--p-success);
  }
  .progress-text {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  .mode-selector {
    display: flex;
    gap: 4px;
  }
  .mode-btn {
    all: unset;
    flex: 1;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    background: transparent;
    color: var(--p-ink3);
    border: 1px solid var(--p-border-m);
    transition: all 0.12s ease;
  }
  .mode-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink2);
  }
  .mode-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--p-border);
    margin-top: 4px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--p-ink3);
  }
  .summary-row.screened {
    padding-top: 4px;
    border-top: 1px solid var(--p-border);
  }
  .summary-val {
    font-family: var(--font-data);
    font-weight: 600;
  }
  .summary-val.ai {
    color: var(--p-kofa);
  }
  .summary-val.me {
    color: var(--p-success);
  }

  .start-btn {
    all: unset;
    margin-top: 4px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 5px;
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: opacity 0.12s ease;
    box-sizing: border-box;
  }
  .start-btn:hover {
    opacity: 0.85;
  }
  .start-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .streaming-indicator {
    margin-top: 4px;
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--p-kofa);
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-ai-border);
    border-top-color: var(--p-kofa);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
