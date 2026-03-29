<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
  import VennIcon from './VennIcon.svelte';
  import ProvisionTag from './ProvisionTag.svelte';
  import RowContextMenu from './RowContextMenu.svelte';
  import { PHASE_NAMES, type MockAnalysis } from '$lib/mockup/data/portfolio';

  let {
    analysis,
    viewScope,
    allTags,
    onSetTag,
    onclick,
  }: {
    analysis: MockAnalysis;
    viewScope: string;
    allTags: string[];
    onSetTag: (id: string, tag: string) => void;
    onclick?: () => void;
  } = $props();
</script>

<div
  class="index-row"
  tabindex="0"
  role="button"
  {onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
  <div class="row-dot"></div>

  <div class="row-content">
    <div class="row-title-row">
      <h5 class="row-title">{analysis.title}</h5>
      {#if analysis.teamOnly && (viewScope === 'team' || viewScope === 'corpus')}
        <span class="owner-badge">{analysis.owner}</span>
      {/if}
    </div>
    <p class="row-problem">{analysis.problem}</p>
  </div>

  <div class="row-meta">
    {#if analysis.newEvents > 0}
      <span class="event-dot" title="{analysis.newEvents} nye saker"></span>
    {/if}

    {#if analysis.overlapWith}
      <div class="overlap-indicator">
        <VennIcon size={12} />
        <span>{analysis.overlapWith}</span>
      </div>
    {/if}

    <div class="provisions-compact">
      {#each analysis.provisions.slice(0, 1) as prov}
        <ProvisionTag text={prov} small />
      {/each}
      {#if analysis.provisions.length > 1}
        <span class="provision-more">+{analysis.provisions.length - 1}</span>
      {/if}
    </div>

    <span class="phase-name">{PHASE_NAMES[analysis.phase]}</span>

    <div class="row-ctx">
      <RowContextMenu analysisId={analysis.id} currentTag={analysis.tag} {allTags} {onSetTag} />
    </div>

    <ArrowRight size={14} class="row-arrow" />
  </div>
</div>

<style>
  .index-row {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 16px 0 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .index-row:hover {
    background: var(--hover-bg);
  }

  .index-row:hover .row-ctx {
    opacity: 1;
  }

  .index-row:hover :global(.row-arrow) {
    opacity: 1;
    transform: translateX(0);
  }

  .row-dot {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--ink-muted);
  }

  .row-content {
    flex: 1;
    min-width: 0;
    padding-right: 20px;
  }

  .row-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .row-title {
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .owner-badge {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid var(--border);
    padding: 2px 4px;
    color: var(--ink-tertiary);
    flex-shrink: 0;
  }

  .row-problem {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
    margin-top: 8px;
  }

  @media (min-width: 768px) {
    .index-row {
      flex-direction: row;
      align-items: center;
    }
    .row-meta {
      margin-top: 0;
    }
  }

  .event-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--ai-accent);
    flex-shrink: 0;
  }

  .overlap-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--violet-accent);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
  }

  .provisions-compact {
    display: flex;
    gap: 4px;
  }

  .provision-more {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    padding: 2px 4px;
  }

  .phase-name {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    width: 80px;
    text-align: right;
  }

  .row-ctx {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  :global(.row-arrow) {
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.15s ease;
    color: var(--ink-tertiary);
  }
</style>
