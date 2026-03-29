<script lang="ts">
  import { Clock, ArrowRight, Check } from 'lucide-svelte';
  import VennIcon from './VennIcon.svelte';
  import ProvisionTag from './ProvisionTag.svelte';
  import { PHASE_NAMES, type MockAnalysis } from '$lib/mockup/data/portfolio';

  let { analysis }: { analysis: MockAnalysis } = $props();
</script>

<section class="continue-section">
  <div class="section-label">
    <Clock size={12} />
    Fortsett der du slapp
  </div>

  <div class="continue-card">
    <div class="progress-line"></div>

    <div class="card-content">
      <div class="card-top">
        <div class="card-info">
          <div class="meta-row">
            <span class="phase-label">{PHASE_NAMES[analysis.phase]}</span>
            <span class="meta-dot">&middot;</span>
            <span class="perspective-label">i {analysis.perspective}</span>
            {#if analysis.overlapWith}
              <span class="overlap-badge">
                <VennIcon size={12} />
                Overlapp med {analysis.overlapWith}
              </span>
            {/if}
          </div>

          <h2 class="card-title">{analysis.title}</h2>
          <p class="card-problem">{analysis.problem}</p>
        </div>

        <a href="/mockup/analyse" class="continue-btn">
          Fortsett i {analysis.perspective}
          <ArrowRight size={14} />
        </a>
      </div>

      <div class="card-data">
        <div class="provisions">
          {#each analysis.provisions as prov}
            <ProvisionTag text={prov} />
          {/each}
        </div>

        <div class="data-separator"></div>

        <div class="last-action">
          <Check size={12} color="var(--ink-muted)" />
          <span class="last-label">Sist:</span>
          {analysis.lastAction}
        </div>

        {#if analysis.newEvents > 0}
          <div class="new-events">
            <span class="event-dot"></span>
            {analysis.newEvents} nye relevante saker
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  .continue-section {
    margin-bottom: 64px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
  }

  .continue-card {
    position: relative;
    padding-left: 32px;
  }

  .progress-line {
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 0;
    width: 2px;
    border-radius: 1px;
    background-color: var(--ink-muted);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }

  .card-info {
    flex: 1 1 400px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .phase-label,
  .perspective-label {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--ink-tertiary);
  }

  .meta-dot {
    color: var(--ink-muted);
    font-size: 11px;
  }

  .overlap-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 2px;
    border: 1px solid var(--violet-border);
    color: var(--violet-accent);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
  }

  .card-title {
    font-family: var(--font-serif);
    font-size: 28px;
    font-weight: 500;
    line-height: 1.25;
    color: var(--ink);
    margin-bottom: 8px;
    letter-spacing: -0.015em;
  }

  .card-problem {
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.55;
    color: var(--ink-secondary);
    max-width: 560px;
  }

  .continue-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--btn-primary-bg);
    color: var(--btn-primary-fg);
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 20px;
    border: 1.5px solid transparent;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    text-decoration: none;
  }

  .continue-btn:hover {
    background: var(--btn-primary-hover);
  }

  :global(.dark) .continue-btn {
    background: transparent;
    color: var(--ink-secondary);
    border-color: var(--border-strong);
  }

  :global(.dark) .continue-btn:hover {
    background: var(--hover-bg-strong);
    color: var(--ink);
    border-color: var(--border-stronger);
  }

  .card-data {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding-top: 12px;
  }

  .provisions {
    display: flex;
    gap: 4px;
  }

  .data-separator {
    width: 1px;
    height: 16px;
    background: var(--border-subtle);
  }

  .last-action {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-secondary);
  }

  .last-label {
    color: var(--ink-tertiary);
  }

  .new-events {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ai-accent);
    margin-left: auto;
  }

  .event-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--ai-accent);
    flex-shrink: 0;
  }
</style>
