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
  {#each STEPS as step, i}
    {@const isCompleted = step.num <= completedSteps}
    {@const isActive = step.num === activeStep && !isCompleted}
    <div class="step" class:completed={isCompleted} class:active={isActive}>
      <div class="step-track">
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
        {#if i < STEPS.length - 1}
          <div class="step-connector" class:completed={step.num < activeStep || isCompleted}></div>
        {/if}
      </div>
      <span class="step-label">{step.label}</span>
    </div>
  {/each}
</div>

<style>
  .progress-indicator {
    display: flex;
    flex-direction: column;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .step-track {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 20px;
  }

  .step-circle {
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
  .step-circle.completed {
    background: var(--p-ink);
    border-color: var(--p-ink);
    color: var(--p-panel);
  }
  .step-circle.active {
    border-color: var(--p-kofa-accent);
    color: var(--p-kofa-accent);
    background: var(--p-ai-bg);
  }

  .step-num {
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .step-connector {
    width: 1.5px;
    height: 8px;
    background: var(--p-input);
    flex-shrink: 0;
  }
  .step-connector.completed {
    background: var(--p-ink);
  }

  .step-label {
    font-size: 11px;
    color: var(--p-ink3);
    font-weight: 500;
    line-height: 20px;
  }
  .step.completed .step-label {
    color: var(--p-ink2);
  }
  .step.active .step-label {
    color: var(--p-ink);
    font-weight: 600;
  }
</style>
