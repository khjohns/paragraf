<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';

  let readCount = $derived(Object.values(analysisState.analysis.readStatus).filter(Boolean).length);
  let totalCount = $derived(analysisState.caseNodes.length);

  let primaryProvision = $derived(
    analysisState.analysis.seeds.provisions.length > 0
      ? formatProvision(analysisState.analysis.seeds.provisions[0])
      : null
  );
</script>

<div class="context-strip" class:expanded={uiState.contextStripExpanded}>
  <button class="strip-toggle" onclick={() => uiState.toggleContextStrip()}>
    <span class="chevron">{uiState.contextStripExpanded ? '▾' : '▸'}</span>
    {#if primaryProvision}
      <span class="strip-provision">{primaryProvision}</span>
      {#if analysisState.analysis.problemStatement}
        <span class="strip-sep">—</span>
        <span class="strip-problem"
          >{analysisState.analysis.problemStatement.slice(0, 60)}{analysisState.analysis
            .problemStatement.length > 60
            ? '…'
            : ''}</span
        >
      {/if}
    {:else}
      <span class="strip-empty">Ingen bestemmelser valgt</span>
    {/if}
    <span class="strip-spacer"></span>
    {#if totalCount > 0}
      <span class="strip-stat">{readCount}/{totalCount} lest</span>
    {/if}
    {#if analysisState.analysis.iteration > 1}
      <span class="strip-iter">Iter. {analysisState.analysis.iteration}</span>
    {/if}
  </button>

  {#if uiState.contextStripExpanded}
    <div class="strip-content">
      <div class="strip-left">
        {#if analysisState.analysis.problemStatement}
          <div class="strip-section">
            <div class="strip-label">Problemstilling</div>
            <div class="strip-text">{analysisState.analysis.problemStatement}</div>
          </div>
        {/if}

        <div class="strip-section">
          <div class="strip-label">Bestemmelser</div>
          <div class="strip-provisions">
            {#each analysisState.analysis.seeds.provisions as prov}
              <span class="strip-prov-badge">{formatProvision(prov)}</span>
            {/each}
          </div>
        </div>

        {#if analysisState.scopingResult?.reasoning}
          <div class="strip-section ai-section">
            <div class="strip-text ai-text">{analysisState.scopingResult.reasoning}</div>
          </div>
        {/if}
      </div>

      <div class="strip-right">
        {#if totalCount > 0}
          <div class="strip-section">
            <div class="strip-label">Søkedekning</div>
            <div class="coverage-rows">
              <div class="coverage-row">
                <span class="coverage-signal">R</span>
                <span class="coverage-count">{analysisState.coverageStats.ref} treff</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">F</span>
                <span class="coverage-count">{analysisState.coverageStats.fts} treff</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">V</span>
                <span class="coverage-count">{analysisState.coverageStats.vec} treff</span>
              </div>
              <div class="coverage-divider"></div>
              <div class="coverage-row">
                <span class="coverage-total"
                  >{totalCount} unike → {analysisState.catCounts.A}A {analysisState.catCounts.B}B {analysisState
                    .catCounts.C}C</span
                >
              </div>
            </div>
          </div>
        {/if}

        {#if analysisState.gaps.length > 0}
          <div class="strip-section">
            <div class="strip-label">Gap-matrise</div>
            {#each analysisState.gaps.slice(0, 5) as gap}
              <div class="gap-row" class:is-zero={gap.count === 0}>
                <span class="gap-prov">{gap.provision1}</span>
                <span class="gap-sep">∩</span>
                <span class="gap-prov">{gap.provision2}</span>
                <span class="gap-val">{gap.count === 0 ? '⚠' : gap.count}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .context-strip {
    border-bottom: 1px solid rgba(26, 24, 20, 0.08);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .context-strip.expanded {
    background: var(--p-surface);
  }

  .strip-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    width: 100%;
    box-sizing: border-box;
    font-size: 12px;
    color: var(--p-ink2);
  }
  .strip-toggle:hover {
    background: var(--p-hover);
  }

  .chevron {
    font-size: 10px;
    color: var(--p-ink4);
    flex-shrink: 0;
  }
  .strip-provision {
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
    font-size: 12px;
  }
  .strip-sep {
    color: var(--p-ink4);
  }
  .strip-problem {
    color: var(--p-ink2);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .strip-empty {
    color: var(--p-ink4);
    font-style: italic;
  }
  .strip-spacer {
    flex: 1;
  }
  .strip-stat {
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }
  .strip-iter {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-hover);
  }

  /* Expanded content */
  .strip-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 12px 16px 16px;
    border-top: 1px solid rgba(26, 24, 20, 0.05);
  }

  .strip-section {
    margin-bottom: 12px;
  }
  .strip-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 4px;
  }
  .strip-text {
    font-size: 13px;
    line-height: 1.55;
    color: var(--p-ink);
  }

  .ai-section {
    border-left: 3px solid var(--p-ai-border);
    background: var(--p-ai-bg);
    border-radius: var(--radius-md);
    padding: 8px 12px;
  }
  .ai-text {
    font-size: 12px;
    color: var(--p-ink2);
    font-style: italic;
  }

  .strip-provisions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .strip-prov-badge {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
    border: 1px solid var(--p-provision-border);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
  }

  /* Coverage stats */
  .coverage-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .coverage-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }
  .coverage-signal {
    font-family: var(--font-data);
    font-weight: 700;
    font-size: 10px;
    color: var(--p-ink3);
    width: 12px;
  }
  .coverage-count {
    font-family: var(--font-data);
    color: var(--p-ink2);
  }
  .coverage-divider {
    height: 1px;
    background: var(--p-border);
    margin: 4px 0;
  }
  .coverage-total {
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }

  /* Gap rows */
  .gap-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink2);
    padding: 2px 0;
  }
  .gap-row.is-zero {
    color: var(--p-gap);
  }
  .gap-prov {
    min-width: 48px;
  }
  .gap-sep {
    color: var(--p-ink4);
    font-size: 10px;
  }
  .gap-val {
    margin-left: auto;
    font-weight: 600;
  }
</style>
