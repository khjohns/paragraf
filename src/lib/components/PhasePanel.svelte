<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState, type ProcessView } from '$lib/stores/ui.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
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

  let phases = $derived.by(() => {
    const { catCounts } = analysisState;
    const totalCases = analysisState.caseNodes.length;
    const screenedCount = Object.keys(screeningState.screeningResults).length;
    const readCount = Object.values(analysisState.analysis.readStatus).filter(Boolean).length;

    const sn = STATUS_TO_PHASE[status];

    return [
      {
        label: 'Problem',
        icon: sn > 1 ? '✓' : status === 'scoping' ? '◐' : '○',
        state: sn > 1 ? 'done' : status === 'scoping' ? 'active' : 'pending',
        detail: sn > 1 ? 'definert' : null,
        processView: null as ProcessView,
      },
      {
        label: 'Kandidat',
        icon: sn > 2 ? '✓' : sn === 2 ? '◐' : '○',
        state: sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending',
        detail:
          totalCases > 0 ? `${totalCases} (${catCounts.A}A ${catCounts.B}B ${catCounts.C}C)` : null,
        processView: null as ProcessView,
      },
      {
        label: 'Screening',
        icon: sn > 3 ? '✓' : sn === 3 ? '◐' : '○',
        state: sn > 3 ? 'done' : sn === 3 ? 'active' : 'pending',
        detail: sn >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
        processView: 'screening-delegation' as ProcessView,
      },
      {
        label: 'Syntese',
        icon: pipelineState.synthesisMarkdown ? '✓' : status === 'synthesis' ? '◐' : '○',
        state: pipelineState.synthesisMarkdown
          ? 'done'
          : status === 'synthesis'
            ? 'active'
            : 'pending',
        detail: pipelineState.synthesisResult
          ? `${pipelineState.synthesisResult.sections.length} seksj.`
          : null,
        processView: 'synthesis-review' as ProcessView,
      },
      {
        label: 'QA',
        icon: pipelineState.qaReport
          ? pipelineState.qaReport.total_flags > 0
            ? '⚠'
            : '✓'
          : status === 'qa'
            ? '◐'
            : '○',
        state: pipelineState.qaReport
          ? pipelineState.qaReport.total_flags > 0
            ? 'warning'
            : 'done'
          : status === 'qa'
            ? 'active'
            : 'pending',
        detail: pipelineState.qaReport ? `${pipelineState.qaReport.total_flags} issues` : null,
        processView: 'synthesis-review' as ProcessView,
      },
    ];
  });

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
  <div class="panel-eyebrow">Metode</div>

  <div class="phases">
    {#each phases as phase, i}
      <button
        class="phase-item"
        class:active-view={uiState.activeProcessView === phase.processView &&
          phase.processView !== null}
        class:clickable={phase.processView !== null}
        onclick={() => handlePhaseClick(phase.processView)}
        disabled={phase.processView === null}
      >
        <span
          class="phase-icon"
          class:done={phase.state === 'done'}
          class:active={phase.state === 'active'}
          class:warning={phase.state === 'warning'}
          class:pending={phase.state === 'pending'}>{phase.icon}</span
        >
        <span class="phase-label">{phase.label}</span>
        {#if phase.detail}
          <span class="phase-detail">{phase.detail}</span>
        {/if}
      </button>
      {#if i < phases.length - 1}
        <div class="phase-connector" class:done={phase.state === 'done'}></div>
      {/if}
    {/each}
  </div>

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
    padding: 12px 8px;
    gap: 4px;
  }

  .panel-eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    padding: 0 4px;
    margin-bottom: 8px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .phase-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    border-radius: var(--radius-md);
    font-size: 11px;
    color: var(--p-ink3);
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
    color: var(--p-ink);
  }

  .phase-icon {
    font-size: 12px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }
  .phase-icon.done {
    color: var(--p-success);
  }
  .phase-icon.active {
    color: var(--p-kofa-accent);
  }
  .phase-icon.warning {
    color: var(--p-warn);
  }
  .phase-icon.pending {
    color: var(--p-ink4);
  }

  .phase-label {
    font-weight: 500;
    white-space: nowrap;
  }

  .phase-detail {
    font-size: 9px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    margin-left: auto;
    white-space: nowrap;
  }

  .phase-connector {
    width: 1px;
    height: 6px;
    background: var(--p-input);
    margin-left: 11px;
  }
  .phase-connector.done {
    background: var(--p-success);
  }

  .cost-display {
    margin-top: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    text-align: center;
    padding: 8px 0;
    border-top: 1px solid var(--p-border);
  }
</style>
