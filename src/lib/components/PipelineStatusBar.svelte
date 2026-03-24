<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';

  let expanded = $state(false);
  let dismissed = $state(false);
  let elapsed = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  // ── Derived pipeline phase ──

  let status = $derived(analysisState.analysis.status);

  let isSearching = $derived(status === 'searching');
  let isScreening = $derived(
    screeningState.screeningStarted &&
      (!!screeningState.streamingSakNr || screeningState.isBatchActive('screening'))
  );
  let isVerifyingCitations = $derived(screeningState.verifyingCitations);
  let isSynthesizing = $derived(pipelineState.synthesisStreaming);
  let isQa = $derived(pipelineState.qaStreaming);

  let isActive = $derived(
    isSearching || isScreening || isVerifyingCitations || isSynthesizing || isQa
  );

  // Screening progress
  let screenedCount = $derived(Object.keys(screeningState.screeningResults).length);
  let screeningTotal = $derived.by(() => {
    let count = 0;
    for (const n of analysisState.caseNodes) {
      if (screeningState.getAssignment(n.label, n.category) === 'claude') count++;
    }
    return count;
  });

  // Synthesis/QA progress
  let synthProgress = $derived(pipelineState.synthesisProgress);
  let qaProgress = $derived(pipelineState.qaProgress);
  let currentStreamItem = $derived.by(() => {
    const arr = isSynthesizing ? synthProgress : isQa ? qaProgress : [];
    return arr.findLast((p) => !p.done) ?? arr.at(-1) ?? null;
  });

  // ── Timer ──

  $effect(() => {
    if (isActive) {
      elapsed = 0;
      timer = setInterval(() => (elapsed += 1), 1000);
      dismissed = false;
    }
    return () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  });

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Completed summaries ──
  // Only show summary when something was *actively running* and then completed.
  // Track "was active" to avoid firing on page load with historical data.

  let lastCompletedPhase = $state<string | null>(null);
  let lastSummary = $state<string | null>(null);
  let lastElapsed = $state<number>(0);
  let wasActive = $state(false);

  // Track when any operation starts
  $effect(() => {
    if (isActive) wasActive = true;
  });

  // Screening just finished (was running → no longer running)
  $effect(() => {
    if (wasActive && !isActive && screeningState.screeningStarted && screenedCount > 0) {
      const cats = analysisState.catCounts;
      lastCompletedPhase = 'screening';
      lastSummary = `${screenedCount} screenet · ${cats.A}A ${cats.B}B ${cats.C}C`;
      lastElapsed = elapsed;
    }
  });

  // Synthesis just finished
  $effect(() => {
    if (wasActive && !pipelineState.synthesisStreaming && pipelineState.synthesisMarkdown) {
      const cost = pipelineState.synthesisLlmMeta?.cost_usd;
      lastCompletedPhase = 'synthesis';
      lastSummary = `Notat generert${cost ? ` · $${cost.toFixed(2)}` : ''}`;
      lastElapsed = elapsed;
    }
  });

  // QA just finished
  $effect(() => {
    if (wasActive && !pipelineState.qaStreaming && pipelineState.qaReport) {
      const flags = pipelineState.qaReport.total_flags;
      lastCompletedPhase = 'qa';
      lastSummary = flags > 0 ? `${flags} merknader` : 'ingen merknader';
      lastElapsed = elapsed;
      if (flags === 0) {
        setTimeout(() => (dismissed = true), 5000);
      }
    }
  });

  // ── Visibility ──

  let showBar = $derived(isActive || (lastCompletedPhase && !dismissed));
</script>

{#if showBar}
  <div class="pipeline-status-bar" class:active={isActive} class:completed={!isActive}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="status-main" onclick={() => (expanded = !expanded)} role="button" tabindex="0">
      <span class="status-icon">
        {#if isActive}
          <span class="pulse">◐</span>
        {:else}
          <span class="check">✓</span>
        {/if}
      </span>

      <span class="status-label">
        {#if isSearching}
          Kjører søk
        {:else if isScreening}
          Screening
        {:else if isVerifyingCitations}
          Verifiserer sitater
        {:else if isSynthesizing}
          Genererer notat
        {:else if isQa}
          Kvalitetssikring
        {:else if lastCompletedPhase === 'screening'}
          Screening fullført
        {:else if lastCompletedPhase === 'synthesis'}
          Syntese fullført
        {:else if lastCompletedPhase === 'qa'}
          Kvalitetssikring fullført
        {/if}
      </span>

      {#if isScreening}
        <span class="status-progress">{screenedCount}/{screeningTotal} saker</span>
        {#if screeningState.streamingSakNr}
          <span class="status-detail">{screeningState.streamingSakNr}</span>
        {/if}
      {:else if isVerifyingCitations}
        <span class="status-progress">{screenedCount} saker</span>
      {:else if (isSynthesizing || isQa) && currentStreamItem}
        <span class="status-detail">{currentStreamItem.label}</span>
      {:else if !isActive && lastSummary}
        <span class="status-summary">{lastSummary}</span>
      {/if}

      <span class="status-spacer"></span>

      {#if isActive}
        <span class="status-time">{formatTime(elapsed)}</span>
      {:else if lastElapsed > 0}
        <span class="status-time">{formatTime(lastElapsed)}</span>
      {/if}

      {#if !isActive}
        <button
          class="dismiss-btn"
          onclick={(e) => {
            e.stopPropagation();
            dismissed = true;
          }}
          aria-label="Lukk">✕</button
        >
      {/if}
    </div>

    {#if expanded && isScreening}
      <div class="expanded-list">
        {#each analysisState.caseNodes.filter((n) => screeningState.getAssignment(n.label, n.category) === 'claude') as node}
          {@const result = screeningState.screeningResults[node.label]}
          {@const isCurrent = screeningState.streamingSakNr === node.label}
          <div class="expanded-item" class:done={!!result} class:current={isCurrent}>
            <span class="item-icon">
              {#if result}
                <span class="check">✓</span>
              {:else if isCurrent}
                <span class="pulse">◐</span>
              {:else}
                <span class="queued">·</span>
              {/if}
            </span>
            <span class="item-sak">{node.label}</span>
            <span class="item-cat">{node.category ?? '—'}</span>
            {#if result}
              <span class="item-result">
                {result.star ? 'Gullkandidat' : (result.relevance ?? '')}
              </span>
            {:else if !isCurrent}
              <span class="item-queue">I kø</span>
            {:else}
              <span class="item-queue">Pågår…</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if expanded && (isSynthesizing || isQa)}
      <div class="expanded-list">
        {#each isSynthesizing ? synthProgress : qaProgress as item}
          <div class="expanded-item" class:done={item.done}>
            <span class="item-icon">
              {#if item.done}
                <span class="check">✓</span>
              {:else}
                <span class="pulse">◐</span>
              {/if}
            </span>
            <span class="item-label">{item.label}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .pipeline-status-bar {
    border-bottom: 1px solid var(--p-border);
    font-size: 11px;
    flex-shrink: 0;
  }
  .pipeline-status-bar.active {
    background: var(--p-highlight);
    border-left: 3px solid var(--p-ai-border);
  }
  .pipeline-status-bar.completed {
    background: var(--p-surface);
    border-left: 3px solid var(--p-success);
  }

  .status-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
  }
  .status-main:hover {
    background: var(--p-hover);
  }

  .status-icon {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
  }
  .pulse {
    color: var(--p-kofa-accent);
    animation: pulse-fade 1.2s ease-in-out infinite;
  }
  .check {
    color: var(--p-success);
    font-weight: 600;
  }

  .status-label {
    font-weight: 600;
    color: var(--p-ink);
    white-space: nowrap;
  }

  .status-progress {
    font-family: var(--font-data);
    color: var(--p-ink2);
    white-space: nowrap;
  }

  .status-detail {
    font-family: var(--font-data);
    color: var(--p-ink3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .status-summary {
    color: var(--p-ink2);
    white-space: nowrap;
  }

  .status-spacer {
    flex: 1;
  }

  .status-time {
    font-family: var(--font-data);
    color: var(--p-ink4);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .dismiss-btn {
    all: unset;
    cursor: pointer;
    color: var(--p-ink4);
    padding: 0 2px;
    font-size: 10px;
    line-height: 1;
  }
  .dismiss-btn:hover {
    color: var(--p-ink2);
  }

  /* ── Expanded list ── */
  .expanded-list {
    padding: 0 12px 8px 34px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
  }

  .expanded-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 8px;
    border-radius: var(--radius-md);
    font-size: 10px;
  }
  .expanded-item.done {
    opacity: 0.6;
  }
  .expanded-item.current {
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }

  .item-icon {
    flex-shrink: 0;
    width: 12px;
    text-align: center;
  }
  .queued {
    color: var(--p-ink4);
    font-size: 14px;
    line-height: 1;
  }

  .item-sak {
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }
  .item-cat {
    font-size: 9px;
    font-weight: 700;
    color: var(--p-ink3);
  }
  .item-result {
    color: var(--p-ink2);
    margin-left: auto;
  }
  .item-queue {
    color: var(--p-ink4);
    margin-left: auto;
  }
  .item-label {
    color: var(--p-ink2);
  }

  @keyframes pulse-fade {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
