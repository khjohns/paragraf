<script lang="ts">
  import type { SignalType } from '$lib/mockup/data/analyse';

  let {
    type,
    detail,
    explanation,
  }: {
    type: SignalType;
    detail: string;
    explanation?: string;
  } = $props();
</script>

<div class="signal-badge {type.toLowerCase()}">
  <span class="signal-type">[{type}]</span>
  <span class="signal-detail">{detail}</span>
  {#if explanation}
    <div class="signal-tooltip">{explanation}</div>
  {/if}
</div>

<style>
  .signal-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    line-height: 1.4;
    cursor: default;
    position: relative;
    border: 1px solid;
  }

  .signal-badge.r {
    color: var(--ink-secondary);
    border-color: var(--border);
    background: var(--paper-dark);
  }

  .signal-badge.f {
    color: var(--signal-fts);
    border-color: var(--signal-fts-border);
    background: var(--signal-fts-bg);
  }

  .signal-badge.v {
    color: var(--ai-accent);
    border-color: var(--ai-border);
    background: var(--ai-bg);
  }

  .signal-type {
    font-weight: 700;
    opacity: 0.6;
  }

  .signal-detail {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .signal-tooltip {
    position: absolute;
    left: 0;
    bottom: 100%;
    margin-bottom: 4px;
    display: none;
    width: 200px;
    z-index: 50;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-sans);
    font-size: 11px;
    padding: 8px;
    border-radius: 3px;
    pointer-events: none;
    white-space: normal;
  }

  .signal-badge:hover .signal-tooltip {
    display: block;
  }
</style>
