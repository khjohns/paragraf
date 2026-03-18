<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import ScreeningPanel from './ScreeningPanel.svelte';
  import PostSearchPanel from './PostSearchPanel.svelte';
  import EuScreeningPanel from './EuScreeningPanel.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
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
  let readCount = $derived(analysisState.readCount);

  // Which phase section is expanded in the panel (null = none)
  let expandedPhase = $state<number | null>(null);

  function toggleExpand(num: number) {
    expandedPhase = expandedPhase === num ? null : num;
  }

  // Collapse inline details when a process view is active (avoids showing same info twice)
  $effect(() => {
    if (uiState.activeProcessView) expandedPhase = null;
  });

  // Show screening controls when candidates exist
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

  // Derived info for expandable sections
  let seedProvisions = $derived(analysisState.analysis.seeds.provisions);
  let seedFts = $derived(analysisState.analysis.seeds.ftsTerms);
  let catCounts = $derived(analysisState.catCounts);

  let phases = $derived([
    {
      num: 1,
      label: 'Problem',
      state: sn > 1 ? 'done' : status === 'scoping' ? 'active' : 'pending',
      detail: sn > 1 ? 'definert' : null,
      expandable: sn > 1,
    },
    {
      num: 2,
      label: 'Kandidater',
      state: sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending',
      detail: totalCases > 0 ? `${totalCases} saker` : null,
      expandable: totalCases > 0,
    },
    {
      num: 3,
      label: 'Screening',
      state: sn > 3 ? 'done' : sn === 3 ? 'active' : 'pending',
      detail: sn >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
      expandable: showScreening,
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
      expandable: false,
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
      {@const isExpanded = expandedPhase === phase.num}
      <div class="phase-group">
        <div class="phase-row" class:active-view={isActiveTab}>
          {#if phase.expandable}
            <button class="expand-btn" onclick={() => toggleExpand(phase.num)}>
              {isExpanded ? '▾' : '▸'}
            </button>
          {:else}
            <span class="expand-placeholder"></span>
          {/if}
          <button class="phase-nav" onclick={() => handlePhaseClick(phase.num)}>
            <span class="phase-label">{phase.label}</span>
          </button>
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
        </div>

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

        <!-- Expandable detail sections -->
        {#if isExpanded}
          <div class="phase-detail-section">
            {#if phase.num === 1}
              <!-- Problem: seeds overview -->
              {#if seedProvisions.length > 0}
                <div class="detail-group">
                  <div class="detail-label">Bestemmelser</div>
                  {#each seedProvisions as p}
                    <div class="detail-item">{p}</div>
                  {/each}
                </div>
              {/if}
              {#if seedFts.length > 0}
                <div class="detail-group">
                  <div class="detail-label">Søketermer</div>
                  {#each seedFts as t}
                    <div class="detail-item">«{t}»</div>
                  {/each}
                </div>
              {/if}
            {:else if phase.num === 2}
              <!-- Kandidater: category breakdown -->
              <div class="cat-breakdown">
                {#each ['A', 'B', 'C'] as cat}
                  {@const count = catCounts[cat as keyof typeof catCounts]}
                  {#if count > 0}
                    <div class="cat-row">
                      <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
                      <span class="cat-count">{count}</span>
                    </div>
                  {/if}
                {/each}
              </div>
              <div class="detail-group">
                <div class="detail-label">Lest</div>
                <div class="detail-item">{readCount}/{totalCases}</div>
              </div>
            {:else if phase.num === 3}
              <!-- Screening: controls -->
              <ScreeningPanel />
              {#if showPostSearch}
                <div class="sub-section">
                  <div class="detail-label">Ettersøk</div>
                  <PostSearchPanel />
                </div>
              {/if}
              {#if showEuScreening}
                <div class="sub-section">
                  <div class="detail-label">EU-dommer</div>
                  <EuScreeningPanel />
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </nav>

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
    padding: 8px 6px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .phase-group {
    display: flex;
    flex-direction: column;
  }

  .phase-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 4px;
    border-radius: var(--radius-md);
  }
  .phase-row.active-view {
    background: var(--p-active);
  }

  .expand-btn {
    all: unset;
    cursor: pointer;
    width: 16px;
    font-size: 9px;
    color: var(--p-ink4);
    text-align: center;
    flex-shrink: 0;
    padding: 2px 0;
    border-radius: var(--radius-sm);
  }
  .expand-btn:hover {
    color: var(--p-ink2);
    background: var(--p-hover);
  }
  .expand-placeholder {
    width: 16px;
    flex-shrink: 0;
  }

  .phase-nav {
    all: unset;
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }
  .phase-nav:hover .phase-label {
    color: var(--p-ink);
  }

  .phase-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink2);
    transition: color 0.1s ease;
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
    padding: 3px 4px 3px 24px;
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

  /* Expandable detail sections */
  .phase-detail-section {
    padding: 4px 4px 8px 20px;
    border-bottom: 1px solid var(--p-border);
    margin-bottom: 2px;
  }

  .detail-group {
    margin-bottom: 6px;
  }
  .detail-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 2px;
  }
  .detail-item {
    font-size: 11px;
    color: var(--p-ink2);
    padding: 1px 0;
    font-family: var(--font-data);
  }

  .cat-breakdown {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }
  .cat-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .cat-count {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  .sub-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--p-border);
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
