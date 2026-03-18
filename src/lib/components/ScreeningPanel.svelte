<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  // Derive all counts in a single pass
  let cases = $derived(analysisState.caseNodes);
  let stats = $derived.by(() => {
    const catScreened = { A: 0, B: 0, C: 0 };
    const catRead = { A: 0, B: 0, C: 0 };
    let claude = 0;
    let me = 0;

    for (const n of cases) {
      const cat = n.category as 'A' | 'B' | 'C';
      const assignment = screeningState.getAssignment(n.label, cat);
      if (assignment === 'claude') claude++;
      else me++;
      if (screeningState.screeningResults[n.label]) catScreened[cat]++;
      if (assignment === 'me' && analysisState.analysis.readStatus[n.id]) catRead[cat]++;
    }

    return {
      catCounts: analysisState.catCounts,
      catScreened,
      catRead,
      claudeCount: claude,
      meCount: me,
    };
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
    { key: 'claude', label: 'Claude' },
    { key: 'me', label: 'Meg' },
    { key: 'pick', label: 'Per sak' },
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
      <div class="cat-block">
        <div class="cat-info">
          <CategoryBadge category={cat as 'A' | 'B' | 'C'} small />
          <div class="progress-bar">
            <div
              class="progress-fill"
              class:cat-a={cat === 'A'}
              class:cat-b={cat === 'B'}
              class:cat-c={cat === 'C'}
              class:complete={pct === 100}
              style:width="{pct}%"
            ></div>
          </div>
          <span class="progress-text">{done}/{count}</span>
        </div>
        <div class="mode-buttons">
          {#each modes as m}
            <button
              class="mode-btn"
              class:active={currentMode === m.key}
              class:mode-claude={m.key === 'claude' && currentMode === m.key}
              class:mode-me={m.key === 'me' && currentMode === m.key}
              onclick={() => screeningState.setCategoryMode(cat, m.key)}>{m.label}</button
            >
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  {#if !isScreeningActive && unscreenedClaudeCases.length > 0}
    <button class="start-btn" onclick={startScreening}>
      {screeningState.screeningStarted
        ? `Screen ${unscreenedClaudeCases.length} flere`
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
      <div class="batch-track">
        <div
          class="batch-fill"
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

  .cat-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cat-info {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .progress-fill.cat-a {
    background: var(--p-ink);
  }
  .progress-fill.cat-b {
    background: var(--p-ink2);
  }
  .progress-fill.cat-c {
    background: var(--p-ink3);
  }
  .progress-fill.complete {
    background: var(--p-success);
  }
  .progress-text {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    min-width: 28px;
    text-align: right;
    white-space: nowrap;
  }

  /* ── Mode buttons: segmented control per category ── */
  .mode-buttons {
    display: flex;
    gap: 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border);
    overflow: hidden;
  }
  .mode-btn {
    all: unset;
    cursor: pointer;
    flex: 1;
    padding: 3px 0;
    font-size: 10px;
    font-weight: 500;
    text-align: center;
    color: var(--p-ink3);
    background: transparent;
    transition: all 0.1s ease;
  }
  .mode-btn:not(:last-child) {
    border-right: 1px solid var(--p-border);
  }
  .mode-btn:hover:not(.active) {
    background: var(--p-hover);
    color: var(--p-ink2);
  }
  .mode-btn.active {
    font-weight: 600;
  }
  .mode-btn.mode-claude {
    background: var(--p-highlight);
    color: var(--p-kofa-accent);
    border-color: transparent;
  }
  .mode-btn.mode-me {
    background: var(--p-success-bg);
    color: var(--p-success);
    border-color: transparent;
  }
  /* "Per sak" active = neutral dark */
  .mode-btn.active:not(.mode-claude):not(.mode-me) {
    background: var(--p-active);
    color: var(--p-ink);
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
    height: 2px;
    border-radius: 1px;
    background: var(--p-input);
    overflow: hidden;
  }
  .batch-fill {
    height: 100%;
    border-radius: 1px;
    background: var(--p-kofa-accent);
    transition: width 0.3s ease;
  }
  .batch-fill.complete {
    background: var(--p-success);
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
    color: var(--p-ink4);
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
