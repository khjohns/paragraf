<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState, type ProcessView } from '$lib/stores/ui.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import ScreeningPanel from './ScreeningPanel.svelte';
  import PostSearchPanel from './PostSearchPanel.svelte';
  import EuScreeningPanel from './EuScreeningPanel.svelte';
  import type { AnalysisStatus } from '$lib/types/analysis';

  let status = $derived(analysisState.analysis.status ?? 'scoping');

  const STATUS_TO_PHASE: Record<AnalysisStatus, number> = {
    scoping: 1,
    scoping_complete: 1,
    searching: 2,
    candidates_ready: 2,
    screening: 3,
    screening_complete: 3,
    post_search: 3,
    synthesis: 4,
    qa: 4,
    complete: 5,
  };

  let sn = $derived(STATUS_TO_PHASE[status]);
  let totalCases = $derived(analysisState.caseNodes.length);
  let screenedCount = $derived(Object.keys(screeningState.screeningResults).length);
  let readCount = $derived(Object.values(analysisState.analysis.readStatus).filter(Boolean).length);

  // Show screening controls when in screening-relevant phase
  let showScreening = $derived(totalCases > 0 && sn >= 2);
  let showPostSearch = $derived(
    analysisState.isScreeningPhase || status === 'screening_complete' || status === 'post_search'
  );
  let showEuScreening = $derived(
    analysisState.isScreeningPhase ||
      status === 'screening_complete' ||
      status === 'post_search' ||
      status === 'synthesis' ||
      status === 'qa'
  );

  let phases = $derived([
    {
      num: 1,
      label: 'Problem',
      state: sn > 1 ? 'done' : status === 'scoping' ? 'active' : 'pending',
      detail: sn > 1 ? 'definert' : null,
      processView: 'context' as ProcessView,
    },
    {
      num: 2,
      label: 'Kandidater',
      state: sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending',
      detail:
        totalCases > 0
          ? `${totalCases} (${analysisState.catCounts.A}A ${analysisState.catCounts.B}B ${analysisState.catCounts.C}C)`
          : null,
      processView: 'context' as ProcessView,
    },
    {
      num: 3,
      label: 'Screening',
      state: sn > 3 ? 'done' : sn === 3 ? 'active' : 'pending',
      detail: sn >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
      processView: null as ProcessView, // controls shown in-panel below
    },
    {
      num: 4,
      label: 'Syntese',
      state: pipelineState.synthesisMarkdown
        ? 'done'
        : status === 'synthesis'
          ? 'active'
          : 'pending',
      detail: pipelineState.synthesisResult
        ? `${pipelineState.synthesisResult.sections.length} seksjoner`
        : null,
      processView: 'synthesis-review' as ProcessView,
      children: pipelineState.qaReport
        ? [
            {
              label: 'QA',
              state: pipelineState.qaReport.total_flags > 0 ? 'warning' : ('done' as const),
              detail:
                pipelineState.qaReport.total_flags > 0
                  ? `${pipelineState.qaReport.total_flags} merknader`
                  : 'ok',
            },
          ]
        : [],
    },
  ]);

  function handlePhaseClick(processView: ProcessView) {
    if (!processView) return;
    if (uiState.activeProcessView === processView) {
      uiState.clearProcessView();
    } else {
      uiState.setProcessView(processView);
    }
  }
</script>

<div class="phase-panel">
  <!-- Phase indicators -->
  <div class="panel-eyebrow">Metode</div>

  <nav class="phases">
    {#each phases as phase, i}
      {@const isActiveView =
        uiState.activeProcessView === phase.processView && phase.processView !== null}
      <button
        class="phase-item"
        class:active-view={isActiveView}
        class:clickable={phase.processView !== null}
        onclick={() => handlePhaseClick(phase.processView)}
        disabled={phase.processView === null}
      >
        <div class="phase-track">
          <div
            class="phase-circle"
            class:done={phase.state === 'done'}
            class:active={phase.state === 'active'}
          >
            {#if phase.state === 'done'}
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M2 5L4.5 7.5L8 3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {:else}
              <span class="phase-num">{phase.num}</span>
            {/if}
          </div>
          {#if i < phases.length - 1}
            <div class="phase-connector" class:done={phase.state === 'done'}></div>
          {/if}
        </div>
        <div class="phase-text">
          <span class="phase-label">{phase.label}</span>
          {#if phase.detail}
            <span class="phase-detail">{phase.detail}</span>
          {/if}
        </div>
      </button>

      {#if phase.children?.length}
        {#each phase.children as child}
          <div class="phase-child">
            <span
              class="child-icon"
              class:done={child.state === 'done'}
              class:warning={child.state === 'warning'}
            >
              {child.state === 'done' ? '✓' : child.state === 'warning' ? '⚠' : '○'}
            </span>
            <span class="child-label">{child.label}</span>
            <span class="child-detail">{child.detail}</span>
          </div>
        {/each}
      {/if}
    {/each}
  </nav>

  <!-- Phase-contextual controls -->
  {#if showScreening}
    <div class="panel-section">
      <ScreeningPanel />
    </div>
  {/if}

  {#if showPostSearch}
    <div class="panel-section">
      <div class="section-label">Ettersøk</div>
      <PostSearchPanel />
    </div>
  {/if}

  {#if showEuScreening}
    <div class="panel-section">
      <div class="section-label">EU-dommer</div>
      <EuScreeningPanel />
    </div>
  {/if}

  <!-- Cost -->
  {#if analysisState.totalCostUsd > 0}
    <div class="cost-display">
      ${analysisState.totalCostUsd.toFixed(2)}
    </div>
  {/if}
</div>

<style>
  .phase-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 12px 10px;
  }

  .panel-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    padding: 0 4px;
    margin-bottom: 12px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--p-border);
  }

  .phase-item {
    all: unset;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 3px 4px;
    border-radius: var(--radius-md);
    cursor: default;
  }
  .phase-item.clickable {
    cursor: pointer;
  }
  .phase-item.clickable:hover {
    background: var(--p-hover);
  }
  .phase-item.active-view {
    background: var(--p-active);
  }

  .phase-track {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 18px;
  }
  .phase-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--p-ink4);
    color: var(--p-ink4);
    background: transparent;
    flex-shrink: 0;
  }
  .phase-circle.done {
    background: var(--p-ink);
    border-color: var(--p-ink);
    color: var(--p-panel);
  }
  .phase-circle.active {
    border-color: var(--p-kofa-accent);
    color: var(--p-kofa-accent);
    background: var(--p-ai-bg);
  }
  .phase-num {
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .phase-connector {
    width: 1.5px;
    height: 8px;
    background: var(--p-input);
    flex-shrink: 0;
  }
  .phase-connector.done {
    background: var(--p-ink);
  }

  .phase-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .phase-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink2);
    line-height: 18px;
  }
  .phase-item.active-view .phase-label {
    color: var(--p-ink);
    font-weight: 600;
  }
  .phase-detail {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    line-height: 1.3;
  }

  .phase-child {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 2px 30px;
  }
  .child-icon {
    font-size: 10px;
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    color: var(--p-ink4);
  }
  .child-icon.done {
    color: var(--p-success);
  }
  .child-icon.warning {
    color: var(--p-warn);
  }
  .child-label {
    font-size: 11px;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .child-detail {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    margin-left: auto;
  }

  /* Phase-contextual controls */
  .panel-section {
    padding: 8px 0;
    border-bottom: 1px solid var(--p-border);
  }
  .section-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 6px;
    padding: 0 4px;
  }

  .cost-display {
    margin-top: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    padding: 8px 4px 0;
    border-top: 1px solid var(--p-border);
  }
</style>
