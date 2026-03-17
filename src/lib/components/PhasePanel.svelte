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
        num: 1,
        label: 'Problem',
        state: sn > 1 ? 'done' : status === 'scoping' ? 'active' : 'pending',
        detail: sn > 1 ? 'definert' : null,
        processView: null as ProcessView,
      },
      {
        num: 2,
        label: 'Kandidater',
        state: sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending',
        detail:
          totalCases > 0 ? `${totalCases} (${catCounts.A}A ${catCounts.B}B ${catCounts.C}C)` : null,
        processView: null as ProcessView,
      },
      {
        num: 3,
        label: 'Screening',
        state: sn > 3 ? 'done' : sn === 3 ? 'active' : 'pending',
        detail: sn >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
        processView: 'screening-delegation' as ProcessView,
        children: analysisState.citationSummary
          ? [
              {
                label: 'Sitater',
                state:
                  (analysisState.citationSummary.inaccurate ?? 0) > 0
                    ? 'warning'
                    : ('done' as const),
                detail: `${analysisState.citationSummary.verified ?? 0}/${analysisState.citationSummary.total}`,
              },
            ]
          : [],
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

      <!-- Nested children (QA under Syntese, Sitater under Screening) -->
      {#if phase.children?.length}
        {#each phase.children as child}
          <div class="phase-child">
            <div class="child-indent"></div>
            <span
              class="child-icon"
              class:done={child.state === 'done'}
              class:warning={child.state === 'warning'}
              >{child.state === 'done' ? '✓' : child.state === 'warning' ? '⚠' : '○'}</span
            >
            <span class="child-label">{child.label}</span>
            <span class="child-detail">{child.detail}</span>
          </div>
        {/each}
      {/if}
    {/each}
  </nav>

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
    padding: 16px 12px;
  }

  .panel-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    padding: 0 4px;
    margin-bottom: 16px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* Phase item — each row is circle + text */
  .phase-item {
    all: unset;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 4px 4px;
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

  /* Track: circle + connector */
  .phase-track {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 20px;
  }

  .phase-circle {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1.5px solid var(--p-ink4);
    color: var(--p-ink4);
    background: transparent;
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
    height: 12px;
    background: var(--p-input);
    flex-shrink: 0;
  }
  .phase-connector.done {
    background: var(--p-ink);
  }

  /* Text: label + detail stacked */
  .phase-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-top: 1px;
    min-width: 0;
  }
  .phase-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink2);
    line-height: 20px; /* align with circle */
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

  /* Nested children (indented under parent) */
  .phase-child {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 2px 0;
    margin-left: 14px;
  }
  .child-indent {
    width: 6px;
    flex-shrink: 0;
  }
  .child-icon {
    font-size: 10px;
    flex-shrink: 0;
    width: 14px;
    text-align: center;
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

  /* Cost at bottom */
  .cost-display {
    margin-top: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    padding: 12px 4px 0;
    border-top: 1px solid var(--p-border);
  }
</style>
