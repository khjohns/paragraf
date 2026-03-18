<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  // Derive all counts in a single pass
  let cases = $derived(analysisState.caseNodes);
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

  // Cases assigned to Claude that haven't been screened yet
  let unscreenedClaudeCases = $derived(
    cases
      .filter(
        (n) =>
          screeningState.getAssignment(n.label, n.category) === 'claude' &&
          !screeningState.screeningResults[n.label]
      )
      .map((n) => n.label)
  );

  let isScreeningActive = $derived(!!screeningState.streamingSakNr || batchActive);

  function startScreening() {
    if (unscreenedClaudeCases.length === 0) return;
    screeningState.startScreeningSSE(unscreenedClaudeCases);
  }

  const modes: { key: ScreeningMode; label: string }[] = [
    { key: 'claude', label: 'Claude screener' },
    { key: 'me', label: 'Jeg leser' },
    { key: 'pick', label: 'Velg per sak' },
  ];
</script>

<div class="screening-panel">
  {#each ['A', 'B', 'C'] as cat}
    {@const count = stats.catCounts[cat as keyof typeof stats.catCounts]}
    {@const screened = stats.catScreened[cat as keyof typeof stats.catScreened]}
    {@const read = stats.catRead[cat as keyof typeof stats.catRead]}
    {@const done = screened + read}
    {@const pct = count > 0 ? Math.round((done / count) * 100) : 0}
    {@const currentMode = screeningState.screeningModes[cat] ?? 'claude'}
    {#if count > 0}
      <div class="cat-row">
        <div class="cat-top">
          <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
          <span class="cat-count">{count}</span>
          {#if done > 0}
            <div class="cat-progress">
              <div class="progress-track">
                <div class="progress-fill" class:complete={pct === 100} style:width="{pct}%"></div>
              </div>
              <span class="progress-text">{done}/{count}</span>
            </div>
          {/if}
          <span class="spacer"></span>
          <select
            class="mode-select"
            value={currentMode}
            onchange={(e) =>
              screeningState.setCategoryMode(
                cat,
                (e.target as HTMLSelectElement).value as ScreeningMode
              )}
          >
            {#each modes as m}
              <option value={m.key}>{m.label}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}
  {/each}

  {#if !isScreeningActive && unscreenedClaudeCases.length > 0}
    <button class="start-btn" onclick={startScreening}>
      {screeningState.screeningStarted
        ? `Screen ${unscreenedClaudeCases.length} flere →`
        : `Start screening (${unscreenedClaudeCases.length})`}
    </button>
  {:else if !isScreeningActive && screeningState.screeningStarted && unscreenedClaudeCases.length === 0}
    <div class="screening-done">✓ Alle Claude-saker er screenet</div>
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
    gap: 6px;
  }

  .cat-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cat-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cat-count {
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }
  .spacer {
    flex: 1;
  }

  .cat-progress {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .progress-track {
    width: 36px;
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

  .mode-select {
    font-size: 10px;
    font-family: var(--font-ui);
    color: var(--p-ink2);
    background: var(--p-input);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    padding: 2px 4px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mode-select:focus {
    outline: none;
    border-color: var(--p-border-s);
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

  .screening-done {
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-success-bg);
    color: var(--p-success);
    font-size: 11px;
    font-weight: 500;
    text-align: center;
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
