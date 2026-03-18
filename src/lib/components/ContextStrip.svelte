<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { formatProvision } from '$lib/utils/provisions';

  let readCount = $derived(analysisState.readCount);
  let totalCount = $derived(analysisState.caseNodes.length);

  let primaryProvision = $derived(
    analysisState.analysis.seeds.provisions.length > 0
      ? formatProvision(analysisState.analysis.seeds.provisions[0])
      : null
  );
</script>

<div class="context-strip">
  {#if primaryProvision}
    <span class="strip-provision">{primaryProvision}</span>
    {#if analysisState.analysis.problemStatement}
      <span class="strip-sep">—</span>
      <span class="strip-problem"
        >{analysisState.analysis.problemStatement.slice(0, 80)}{analysisState.analysis
          .problemStatement.length > 80
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
</div>

<style>
  .context-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    font-size: 12px;
    color: var(--p-ink2);
    border-bottom: 1px solid rgba(26, 24, 20, 0.08);
    background: var(--p-panel);
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
</style>
