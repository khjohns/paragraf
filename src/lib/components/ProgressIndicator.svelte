<script lang="ts">
  import type { AnalysisStatus } from '$lib/types/analysis';

  interface Props {
    status: AnalysisStatus;
  }

  const { status }: Props = $props();

  const STEPS = [
    { num: 1, label: 'Problemstilling' },
    { num: 2, label: 'Søk' },
    { num: 3, label: 'Screening' },
    { num: 4, label: 'Ettersøk' },
    { num: 5, label: 'Syntese' },
    { num: 6, label: 'QA' },
    { num: 7, label: 'Deponering' },
  ] as const;

  // Map status to which step is active (1-indexed)
  const STATUS_TO_STEP: Record<AnalysisStatus, number> = {
    scoping: 1,
    scoping_complete: 2,
    searching: 2,
    candidates_ready: 3,
    screening: 3,
    screening_complete: 4,
    post_search: 4,
    synthesis: 5,
    qa: 6,
    complete: 7,
  };

  // Map status to how many steps are fully completed
  const STATUS_TO_COMPLETED: Record<AnalysisStatus, number> = {
    scoping: 0,
    scoping_complete: 1,
    searching: 1,
    candidates_ready: 2,
    screening: 2,
    screening_complete: 3,
    post_search: 3,
    synthesis: 4,
    qa: 5,
    complete: 7,
  };

  let activeStep = $derived(STATUS_TO_STEP[status] ?? 1);
  let completedSteps = $derived(STATUS_TO_COMPLETED[status] ?? 0);
</script>

<div class="progress-indicator">
  {#each STEPS as step}
    {@const isCompleted = step.num <= completedSteps}
    {@const isActive = step.num === activeStep && !isCompleted}
    {@const isPending = step.num > activeStep && !isCompleted}
    <div
      class="step"
      class:completed={isCompleted}
      class:active={isActive}
      class:pending={isPending}
    >
      <div class="step-circle" class:completed={isCompleted} class:active={isActive}>
        {#if isCompleted}
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
          <span class="step-num">{step.num}</span>
        {/if}
      </div>
      {#if step.num < STEPS.length}
        <div class="step-line" class:completed={step.num < activeStep || isCompleted}></div>
      {/if}
      <span class="step-label">{step.label}</span>
    </div>
  {/each}
</div>

<style>
  .progress-indicator {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 2px 0;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    padding: 3px 0;
  }

  .step-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1.5px solid var(--p-ink4);
    color: var(--p-ink4);
    background: transparent;
    position: relative;
    z-index: 1;
  }
  .step-circle.completed {
    background: var(--p-ink);
    border-color: var(--p-ink);
    color: var(--p-panel);
  }
  .step-circle.active {
    border-color: #8b6914;
    color: #8b6914;
    background: rgba(139, 105, 20, 0.08);
  }

  .step-num {
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .step-line {
    position: absolute;
    left: 8px;
    top: 21px;
    width: 1.5px;
    height: 12px;
    background: var(--p-input);
    z-index: 0;
  }
  .step-line.completed {
    background: var(--p-ink);
  }

  .step-label {
    font-size: 11px;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .step.completed .step-label {
    color: var(--p-ink2);
  }
  .step.active .step-label {
    color: var(--p-ink);
    font-weight: 600;
  }
</style>
