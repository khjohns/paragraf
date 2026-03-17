<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
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
    },
    {
      num: 2,
      label: 'Kandidater',
      state: sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending',
      detail: totalCases > 0 ? `${totalCases} saker` : null,
    },
    {
      num: 3,
      label: 'Screening',
      state: sn > 3 ? 'done' : sn === 3 ? 'active' : 'pending',
      detail: sn >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
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

  function handlePhaseClick(phaseNum: number) {
    uiState.setPhase(phaseNum);
  }
</script>

<div class="phase-panel">
  <nav class="phases">
    {#each phases as phase}
      {@const isActiveTab = uiState.activePhase === phase.num}
      <button
        class="phase-row"
        class:active-view={isActiveTab}
        class:clickable={true}
        onclick={() => handlePhaseClick(phase.num)}
      >
        <span class="phase-label">{phase.label}</span>
        <span class="phase-status">
          {#if phase.state === 'done'}
            <span class="status-done">✓</span>
          {:else if phase.state === 'active'}
            <span class="status-active">◐</span>
          {/if}
          {#if phase.detail}
            <span class="status-detail">{phase.detail}</span>
          {/if}
        </span>
      </button>

      {#if phase.children?.length}
        {#each phase.children as child}
          <div class="phase-sub">
            <span class="sub-label">{child.label}</span>
            <span class="phase-status">
              <span
                class="sub-icon"
                class:done={child.state === 'done'}
                class:warning={child.state === 'warning'}
              >
                {child.state === 'done' ? '✓' : child.state === 'warning' ? '⚠' : '—'}
              </span>
              <span class="status-detail">{child.detail}</span>
            </span>
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
    padding: 8px 10px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--p-border);
  }

  .phase-row {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--radius-md);
    cursor: default;
  }
  .phase-row.clickable {
    cursor: pointer;
  }
  .phase-row.clickable:hover {
    background: var(--p-hover);
  }
  .phase-row.active-view {
    background: var(--p-active);
  }
  .phase-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink2);
  }
  .phase-row.active-view .phase-label {
    color: var(--p-ink);
    font-weight: 600;
  }

  .phase-status {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .status-done {
    font-size: 11px;
    color: var(--p-success);
    font-weight: 700;
  }
  .status-active {
    font-size: 11px;
    color: var(--p-kofa-accent);
  }
  .status-detail {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  .phase-sub {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px 3px 20px;
  }
  .sub-label {
    font-size: 11px;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .sub-icon {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .sub-icon.done {
    color: var(--p-success);
  }
  .sub-icon.warning {
    color: var(--p-warn);
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
