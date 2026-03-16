<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  // Derive all counts in a single pass
  let cases = $derived(analysisState.nodes.filter((n) => n.category));
  let stats = $derived.by(() => {
    const catCounts = { A: 0, B: 0, C: 0 };
    const catScreened = { A: 0, B: 0, C: 0 };
    const catRead = { A: 0, B: 0, C: 0 };
    let claude = 0;
    let me = 0;

    for (const n of cases) {
      const cat = n.category as 'A' | 'B' | 'C';
      catCounts[cat]++;
      const assignment = screeningState.getAssignment(n.label, cat);
      if (assignment === 'claude') claude++;
      else me++;
      if (screeningState.screeningResults[n.label]) catScreened[cat]++;
      if (assignment === 'me' && analysisState.analysis.readStatus[n.id]) catRead[cat]++;
    }

    return { catCounts, catScreened, catRead, claudeCount: claude, meCount: me };
  });
  let screenedCount = $derived(Object.keys(screeningState.screeningResults).length);
  let verificationStats = $derived.by(() => {
    let verified = 0,
      truncated = 0,
      inaccurate = 0,
      notFound = 0,
      total = 0;
    for (const result of Object.values(screeningState.screeningResults)) {
      if (result.quote_verification) {
        for (const v of result.quote_verification) {
          total++;
          if (v.status === 'verified') verified++;
          else if (v.status === 'truncated') truncated++;
          else if (v.status === 'inaccurate') inaccurate++;
          else if (v.status === 'not_found') notFound++;
        }
      }
    }
    return { verified, truncated, inaccurate, notFound, total };
  });
  let batchActive = $derived(screeningState.isBatchActive('screening'));
  let batchProgress = $derived(screeningState.getBatchProgress('screening'));

  function startScreening() {
    // Collect cases assigned to Claude
    const claudeCases = cases
      .filter((n) => screeningState.getAssignment(n.label, n.category) === 'claude')
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

<div class="screening-panel">
  <div class="panel-label">Arbeidsfordeling</div>
  <div class="panel-desc">Velg hvem som screener per kategori, eller juster per sak i listen.</div>

  {#each ['A', 'B', 'C'] as cat}
    {@const count = stats.catCounts[cat as keyof typeof stats.catCounts]}
    {@const screened = stats.catScreened[cat as keyof typeof stats.catScreened]}
    {@const read = stats.catRead[cat as keyof typeof stats.catRead]}
    {@const done = screened + read}
    {@const pct = count > 0 ? Math.round((done / count) * 100) : 0}
    {@const currentMode = screeningState.screeningModes[cat] ?? 'claude'}

    <div class="cat-control">
      <div class="cat-header">
        <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
        <span class="cat-count">{count} {count === 1 ? 'sak' : 'saker'}</span>
        <span class="spacer"></span>
        {#if done > 0}
          <div class="cat-progress">
            <div class="progress-track">
              <div class="progress-fill" class:complete={pct === 100} style:width="{pct}%"></div>
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
            onclick={() => screeningState.setCategoryMode(cat, m.key)}
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
      <span class="summary-val ai">{stats.claudeCount}</span>
    </div>
    <div class="summary-row">
      <span>Du leser</span>
      <span class="summary-val me">{stats.meCount}</span>
    </div>
    {#if screeningState.screeningStarted && screenedCount > 0}
      <div class="summary-row screened">
        <span>Screenet</span>
        <span class="summary-val">{screenedCount}/{stats.claudeCount}</span>
      </div>
    {/if}
  </div>

  {#if !screeningState.screeningStarted}
    <button class="start-btn" onclick={startScreening} disabled={stats.claudeCount === 0}>
      Start screening
    </button>
  {/if}

  {#if batchActive}
    <div class="batch-indicator">
      <div class="batch-header">
        <div class="streaming-spinner"></div>
        <span>Screening pågår…</span>
        <span class="batch-pct">{batchProgress}%</span>
      </div>
      <div class="progress-track batch-track">
        <div
          class="progress-fill"
          class:complete={batchProgress === 100}
          style:width="{batchProgress}%"
        ></div>
      </div>
    </div>
  {/if}

  {#if verificationStats.total > 0}
    <div class="verification-banner">
      <span class="verification-label">Sitatverifisering</span>
      <div class="verification-stats">
        <span class="v-stat v-ok">✓ {verificationStats.verified}</span>
        {#if verificationStats.truncated > 0}
          <span class="v-stat v-warn">⚠ {verificationStats.truncated} trunkert</span>
        {/if}
        {#if verificationStats.inaccurate + verificationStats.notFound > 0}
          <span class="v-stat v-err"
            >✗ {verificationStats.inaccurate + verificationStats.notFound} feil</span
          >
        {/if}
      </div>
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
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .panel-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.45;
    margin-bottom: 4px;
  }

  .cat-control {
    padding: 12px 12px;
    border-radius: var(--radius-lg);
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
  .spacer {
    flex: 1;
  }

  .cat-progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .progress-track {
    width: 48px;
    height: 3px;
    border-radius: var(--radius-sm);
    background: var(--p-input);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: var(--radius-sm);
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
    padding: 4px 8px;
    border-radius: var(--radius-md);
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
    color: var(--p-kofa-accent);
  }
  .summary-val.me {
    color: var(--p-success);
  }

  .start-btn {
    all: unset;
    margin-top: 4px;
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
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

  .batch-indicator {
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .batch-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--p-ai-text);
    font-weight: 500;
  }
  .batch-pct {
    margin-left: auto;
    font-family: var(--font-data);
    font-weight: 600;
  }
  .batch-track {
    width: 100%;
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

  .verification-banner {
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }
  .verification-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    display: block;
    margin-bottom: 4px;
  }
  .verification-stats {
    display: flex;
    gap: 12px;
  }
  .v-stat {
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-data);
  }
  .v-ok {
    color: var(--p-success, #2d7d46);
  }
  .v-warn {
    color: var(--p-warn, #b25e09);
  }
  .v-err {
    color: var(--p-error, #c13515);
  }
</style>
