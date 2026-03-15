<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { fetchEuCases, screenEuCases } from '$lib/api/analyses';
  import type { EuCaseForScreening } from '$lib/types/analysis';

  let euCases = $state<EuCaseForScreening[]>([]);
  let loading = $state(false);
  let identified = $state(false);

  let screenedCount = $derived(Object.keys(analysisState.euScreeningResults).length);

  async function identifyEuCases() {
    loading = true;
    try {
      euCases = await fetchEuCases(analysisState.analysis.id);
      identified = true;
    } catch (e) {
      console.error('Failed to identify EU cases:', e);
    } finally {
      loading = false;
    }
  }

  function startEuScreening() {
    if (euCases.length === 0) return;

    analysisState.setEuScreeningLoading(true);
    const ids = euCases.map((ec) => ec.eu_case_id);
    analysisState.setStreamingEuCaseId(ids[0]);

    const caseIndex = new Map(ids.map((id, i) => [id, i]));

    screenEuCases(
      analysisState.analysis.id,
      ids,
      (result) => {
        if (result.error && !result.eu_case_id) return;
        analysisState.addEuScreeningResult(result);
        const idx = caseIndex.get(result.eu_case_id) ?? -1;
        if (idx < ids.length - 1) {
          analysisState.setStreamingEuCaseId(ids[idx + 1]);
        } else {
          analysisState.setStreamingEuCaseId(null);
        }
      },
      () => {
        analysisState.setStreamingEuCaseId(null);
        analysisState.setEuScreeningLoading(false);
      },
      (error) => {
        analysisState.setStreamingEuCaseId(null);
        analysisState.setEuScreeningLoading(false);
        console.error('EU screening error:', error);
      },
    );
  }
</script>

<div class="eu-panel">
  {#if !identified}
    <div class="eu-desc">
      Identifiser EU-dommer referert fra screenede KOFA-saker.
    </div>
    <button class="eu-btn" onclick={identifyEuCases} disabled={loading}>
      {loading ? 'Identifiserer…' : 'Finn EU-dommer'}
    </button>
  {:else if euCases.length === 0}
    <div class="eu-empty">Ingen EU-dommer funnet i referansene.</div>
  {:else}
    <div class="eu-desc">{euCases.length} EU-dommer funnet</div>

    <div class="eu-list">
      {#each euCases as ec}
        {@const result = analysisState.euScreeningResults[ec.eu_case_id]}
        <div class="eu-row" class:screened={!!result}>
          <div class="eu-row-header">
            <span class="eu-id">{ec.eu_case_id}</span>
            <span class="eu-refs">{ec.ref_count} ref</span>
            {#if result}
              <span class="eu-relevance" class:rel-a={result.relevance === 'A'} class:rel-b={result.relevance === 'B'}>
                {result.relevance}
              </span>
            {/if}
          </div>
          {#if ec.case_name}
            <div class="eu-name">{ec.case_name}</div>
          {/if}
          {#if result && !result.error}
            <div class="eu-proposition">{result.proposition}</div>
          {/if}
        </div>
      {/each}
    </div>

    {#if screenedCount < euCases.length}
      <button class="eu-btn" onclick={startEuScreening} disabled={analysisState.euScreeningLoading}>
        {analysisState.euScreeningLoading ? 'Screener…' : 'Screen EU-dommer'}
      </button>
    {:else}
      <div class="eu-done">{screenedCount} av {euCases.length} screenet</div>
    {/if}

    {#if analysisState.streamingEuCaseId}
      <div class="streaming-indicator">
        <div class="streaming-spinner"></div>
        Leser {analysisState.streamingEuCaseId}…
      </div>
    {/if}
  {/if}
</div>

<style>
  .eu-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .eu-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.45;
  }
  .eu-empty {
    font-size: 12px;
    color: var(--p-ink4);
    font-style: italic;
  }
  .eu-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
  }
  .eu-row {
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }
  .eu-row.screened {
    border-left: 3px solid var(--p-eu-accent, #2D6A5D);
  }
  .eu-row-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  .eu-id {
    font-size: 12px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-eu-accent, #2D6A5D);
  }
  .eu-refs {
    font-size: 10px;
    color: var(--p-ink4);
    font-family: var(--font-data);
  }
  .eu-relevance {
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-data);
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--p-hover);
    color: var(--p-ink3);
    margin-left: auto;
  }
  .eu-relevance.rel-a {
    background: var(--p-active);
    color: var(--p-ink);
  }
  .eu-relevance.rel-b {
    background: var(--p-hover);
    color: var(--p-ink2);
  }
  .eu-name {
    font-size: 11px;
    color: var(--p-ink2);
    font-style: italic;
    margin-bottom: 4px;
  }
  .eu-proposition {
    font-size: 11px;
    color: var(--p-ink);
    line-height: 1.45;
    padding: 4px 8px;
    background: var(--p-highlight);
    border-radius: 3px;
    border-left: 2px solid var(--p-ai-border);
  }
  .eu-btn {
    all: unset;
    width: 100%;
    padding: 9px 12px;
    border-radius: 5px;
    background: var(--p-eu-accent, #2D6A5D);
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
  }
  .eu-btn:hover { opacity: 0.85; }
  .eu-btn:disabled { opacity: 0.4; cursor: default; }
  .eu-done {
    font-size: 11px;
    color: var(--p-success);
    font-weight: 500;
    text-align: center;
    padding: 6px;
  }
  .streaming-indicator {
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--p-eu-accent, #2D6A5D);
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-ai-border);
    border-top-color: var(--p-eu-accent, #2D6A5D);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
