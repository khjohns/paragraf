<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { postSearch } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';

  let suggestions = $derived(analysisState.postSearchSuggestions);

  async function runPostSearch() {
    const id = analysisState.analysis.id;
    analysisState.postSearchLoading = true;
    try {
      const result = await postSearch(id);
      analysisState.setPostSearchSuggestions(result);
      toastState.show('Ettersøksforslag generert', 'success');
    } catch {
      toastState.show('Ettersøk feilet', 'error');
    } finally {
      analysisState.postSearchLoading = false;
    }
  }

  function addFtsTerm(term: string) {
    const current = analysisState.analysis.seeds.ftsTerms;
    if (!current.includes(term)) {
      analysisState.setSeeds({
        ...analysisState.analysis.seeds,
        ftsTerms: [...current, term],
      });
      toastState.show(`«${term}» lagt til som søketerm`, 'success');
    }
  }

  function addProvision(prov: string) {
    const current = analysisState.analysis.seeds.provisions;
    if (!current.includes(prov)) {
      analysisState.setSeeds({
        ...analysisState.analysis.seeds,
        provisions: [...current, prov],
      });
      toastState.show(`${prov} lagt til som bestemmelse`, 'success');
    }
  }
</script>

<div class="post-search">
  {#if !suggestions}
    <div class="ps-empty">
      <p class="ps-desc">
        Analyser hull i søkedekningen basert på screeningresultater og gap-matrise.
      </p>
      <button
        class="ps-btn"
        onclick={runPostSearch}
        disabled={analysisState.postSearchLoading}
      >
        {#if analysisState.postSearchLoading}
          <span class="ps-spinner"></span>
          Analyserer…
        {:else}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          Foreslå ettersøk
        {/if}
      </button>
    </div>
  {:else}
    <div class="ps-results">
      <!-- AI reasoning -->
      <div class="ps-reasoning">
        <div class="ps-ai-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          AI-vurdering
        </div>
        <p>{suggestions.reasoning}</p>
      </div>

      <!-- FTS terms -->
      {#if suggestions.fts_terms.length > 0}
        <div class="ps-section">
          <div class="ps-section-label">Søketermer</div>
          {#each suggestions.fts_terms as term}
            <button class="ps-chip" onclick={() => addFtsTerm(term)}>
              <span class="ps-chip-icon">+</span>
              «{term}»
            </button>
          {/each}
        </div>
      {/if}

      <!-- Provisions -->
      {#if suggestions.provisions.length > 0}
        <div class="ps-section">
          <div class="ps-section-label">Bestemmelser</div>
          {#each suggestions.provisions as prov}
            <button class="ps-chip" onclick={() => addProvision(prov)}>
              <span class="ps-chip-icon">+</span>
              {prov}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Patterns -->
      {#if suggestions.patterns.length > 0}
        <div class="ps-section">
          <div class="ps-section-label">Identifiserte mønstre</div>
          {#each suggestions.patterns as pattern}
            <div class="ps-pattern">{pattern}</div>
          {/each}
        </div>
      {/if}

      <button class="ps-rerun" onclick={runPostSearch} disabled={analysisState.postSearchLoading}>
        {analysisState.postSearchLoading ? 'Analyserer…' : 'Kjør på nytt'}
      </button>
    </div>
  {/if}
</div>

<style>
  .post-search {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ps-empty {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ps-desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--p-ink3);
    margin: 0;
  }
  .ps-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 5px;
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 12px;
    font-weight: 500;
  }
  .ps-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .ps-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .ps-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Results */
  .ps-results {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ps-reasoning {
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--p-ai-bg);
    border-left: 3px solid rgba(166, 139, 91, 0.2);
  }
  .ps-ai-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ai-text);
    margin-bottom: 4px;
  }
  .ps-reasoning p {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--p-ink2);
  }

  .ps-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ps-section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .ps-chip {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 4px;
    border: 1px dashed var(--p-border-m);
    font-size: 12px;
    color: var(--p-ink2);
    transition: all 0.12s ease;
  }
  .ps-chip:hover {
    border-color: var(--p-border-s);
    background: var(--p-hover);
    color: var(--p-ink);
  }
  .ps-chip-icon {
    font-weight: 600;
    color: var(--p-success);
  }

  .ps-pattern {
    font-size: 12px;
    line-height: 1.45;
    color: var(--p-ink2);
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--p-hover);
  }

  .ps-rerun {
    all: unset;
    cursor: pointer;
    font-size: 11px;
    color: var(--p-ink3);
    text-decoration: underline;
    text-align: center;
    padding: 4px;
  }
  .ps-rerun:hover:not(:disabled) {
    color: var(--p-ink);
  }
  .ps-rerun:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
