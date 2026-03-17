<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';
  import SeedInput from './SeedInput.svelte';
  import CategoryBadge from './CategoryBadge.svelte';

  let editing = $state(false);
  let zeroGaps = $derived(analysisState.gaps.filter((g) => g.count === 0));
</script>

<div class="context-view">
  <div class="process-header">
    <button class="back-btn" onclick={() => uiState.clearProcessView()}
      >← Tilbake til arbeidsrom</button
    >
    <span class="process-title">Analysekontekst</span>
    <span class="header-spacer"></span>
    {#if !editing}
      <button class="header-btn" onclick={() => (editing = true)}>Rediger seeds</button>
    {/if}
  </div>

  <div class="context-content">
    <div class="context-grid">
      <!-- Left: Problem + Seeds -->
      <div class="context-left">
        {#if analysisState.analysis.problemStatement}
          <div class="ctx-section">
            <div class="ctx-label">Problemstilling</div>
            <div class="ctx-text">{analysisState.analysis.problemStatement}</div>
          </div>
        {/if}

        {#if editing}
          <div class="ctx-section">
            <SeedInput />
            <button class="edit-done-btn" onclick={() => (editing = false)}>Ferdig</button>
          </div>
        {:else}
          <div class="ctx-section">
            <div class="ctx-label">Bestemmelser</div>
            <div class="ctx-badges">
              {#each analysisState.analysis.seeds.provisions as prov, i}
                <span class="prov-badge">
                  {formatProvision(prov)}
                  <button
                    class="badge-remove"
                    onclick={() => {
                      analysisState.setSeeds({
                        ...analysisState.analysis.seeds,
                        provisions: analysisState.analysis.seeds.provisions.filter(
                          (_, idx) => idx !== i
                        ),
                      });
                    }}>×</button
                  >
                </span>
              {/each}
            </div>
            {#if analysisState.suggestedProvisions.length > 0}
              <div class="suggested-row">
                <span class="suggested-label">Foreslåtte:</span>
                {#each analysisState.suggestedProvisions as s}
                  <button
                    class="suggested-btn"
                    onclick={() => {
                      const current = analysisState.analysis.seeds.provisions;
                      if (!current.includes(s.id)) {
                        analysisState.setSeeds({
                          ...analysisState.analysis.seeds,
                          provisions: [...current, s.id],
                        });
                      }
                    }}>+ {formatProvision(s.id)}</button
                  >
                {/each}
              </div>
            {/if}
          </div>

          {#if analysisState.analysis.seeds.ftsTerms.length > 0}
            <div class="ctx-section">
              <div class="ctx-label">Fulltekstsøk</div>
              <div class="ctx-badges">
                {#each analysisState.analysis.seeds.ftsTerms as term, i}
                  <span class="fts-badge">
                    «{term}»
                    <button
                      class="badge-remove"
                      onclick={() => {
                        analysisState.setSeeds({
                          ...analysisState.analysis.seeds,
                          ftsTerms: analysisState.analysis.seeds.ftsTerms.filter(
                            (_, idx) => idx !== i
                          ),
                        });
                      }}>×</button
                    >
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          {#if analysisState.analysis.seeds.vectorQuery}
            <div class="ctx-section">
              <div class="ctx-label">Semantisk søk</div>
              <div class="ctx-text vector-text">{analysisState.analysis.seeds.vectorQuery}</div>
            </div>
          {/if}
        {/if}

        {#if analysisState.scopingResult?.reasoning}
          <div class="ctx-section ai-section">
            <div class="ctx-label">Claudes vurdering</div>
            <div class="ctx-text ai-text">{analysisState.scopingResult.reasoning}</div>
          </div>
        {/if}
      </div>

      <!-- Right: Coverage + Gaps + Iterations -->
      <div class="context-right">
        {#if analysisState.caseNodes.length > 0}
          <div class="ctx-section">
            <div class="ctx-label">Søkedekning</div>
            <div class="coverage-grid">
              <span class="cov-signal">R</span><span class="cov-desc">Referansetabell</span><span
                class="cov-count">{analysisState.coverageStats.ref}</span
              >
              <span class="cov-signal">F</span><span class="cov-desc">Fulltekstsøk</span><span
                class="cov-count">{analysisState.coverageStats.fts}</span
              >
              <span class="cov-signal">V</span><span class="cov-desc">Vektor</span><span
                class="cov-count">{analysisState.coverageStats.vec}</span
              >
            </div>
            <div class="cov-total">
              {analysisState.caseNodes.length} unike kandidater →
              <CategoryBadge category="A" small />
              {analysisState.catCounts.A}
              <CategoryBadge category="B" small />
              {analysisState.catCounts.B}
              <CategoryBadge category="C" small />
              {analysisState.catCounts.C}
            </div>
          </div>
        {/if}

        {#if analysisState.gaps.length > 0}
          <div class="ctx-section">
            <div class="ctx-label">Gap-matrise</div>
            {#each analysisState.gaps as gap}
              {#if gap.count === 0 && gap.id1 && gap.id2}
                {@const id1 = gap.id1}
                {@const id2 = gap.id2}
                <button
                  class="gap-row is-zero"
                  onclick={() => analysisState.addSeedsFromGap(id1, id2)}
                >
                  <span class="gap-prov">{gap.provision1}</span>
                  <span class="gap-sep">∩</span>
                  <span class="gap-prov">{gap.provision2}</span>
                  <span class="gap-val">∅</span>
                </button>
              {:else}
                <div class="gap-row">
                  <span class="gap-prov">{gap.provision1}</span>
                  <span class="gap-sep">∩</span>
                  <span class="gap-prov">{gap.provision2}</span>
                  <span class="gap-val">{gap.count}</span>
                </div>
              {/if}
            {/each}
            {#if zeroGaps.length > 0}
              <div class="gap-hint">{zeroGaps.length} hull — klikk for å legge til som seeds</div>
            {/if}
          </div>
        {/if}

        <!-- Iteration history -->
        {#if analysisState.analysis.iterationHistory?.length}
          <div class="ctx-section">
            <div class="ctx-label">Søkerunder</div>
            <button
              class="round-row"
              class:active={analysisState.filterIteration === 1}
              onclick={() => analysisState.toggleFilterIteration(1)}
            >
              <span class="round-num">1</span>
              <span class="round-seeds">
                {analysisState.analysis.seeds.provisions
                  .slice(0, 2)
                  .map((p) => `§${p.split(':')[1]}`)
                  .join(', ')}
                {#if analysisState.analysis.seeds.ftsTerms.length > 0}
                  , «{analysisState.analysis.seeds.ftsTerms[0]}»
                {/if}
              </span>
              <span class="round-count"
                >{analysisState.nodes.filter((n) => n.iteration === 1).length}</span
              >
            </button>
            {#each analysisState.analysis.iterationHistory as entry}
              <button
                class="round-row"
                class:active={analysisState.filterIteration === entry.iteration}
                onclick={() => analysisState.toggleFilterIteration(entry.iteration)}
              >
                <span class="round-num">{entry.iteration}</span>
                <span class="round-seeds">
                  + {entry.addedSeeds
                    .map((s) => (s.includes(':') ? `§${s.split(':')[1]}` : `«${s}»`))
                    .join(', ') || '—'}
                </span>
                <span class="round-count">+{entry.newNodeCount}</span>
              </button>
            {/each}
            {#if analysisState.filterIteration !== null}
              <button class="clear-filter" onclick={() => analysisState.clearFilterIteration()}>
                Vis alle runder
              </button>
            {/if}
          </div>
        {/if}

        <button class="new-iter-btn" onclick={() => analysisState.startNewIteration()}>
          + Ny iterasjon med nye seeds
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .context-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .process-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border-m);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .back-btn {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    color: var(--p-ink3);
    font-weight: 500;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    transition: all 0.1s ease;
  }
  .back-btn:hover {
    color: var(--p-ink);
    background: var(--p-hover);
  }
  .process-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .header-spacer {
    flex: 1;
  }
  .header-btn {
    all: unset;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
  }
  .header-btn:hover {
    background: var(--p-hover);
    color: var(--p-ink);
  }

  .context-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
  }

  .context-grid {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 40px;
    max-width: 1000px;
  }

  .ctx-section {
    margin-bottom: 16px;
  }
  .ctx-section:last-child {
    margin-bottom: 0;
  }
  .ctx-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 6px;
  }
  .ctx-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--p-ink);
  }
  .vector-text {
    font-style: italic;
    color: var(--p-ink2);
  }

  .ai-section {
    border-left: 3px solid var(--p-ai-border);
    background: var(--p-ai-bg);
    border-radius: var(--radius-md);
    padding: 10px 14px;
  }
  .ai-text {
    font-size: 12px;
    color: var(--p-ink2);
    font-style: italic;
  }

  /* Badges */
  .ctx-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .prov-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
    border: 1px solid var(--p-provision-border);
    padding: 3px 8px;
    border-radius: var(--radius-badge);
  }
  .fts-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink2);
    background: var(--p-hover);
    padding: 3px 8px;
    border-radius: var(--radius-badge);
  }
  .badge-remove {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    opacity: 0.4;
  }
  .badge-remove:hover {
    opacity: 1;
  }

  .suggested-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .suggested-label {
    font-size: 10px;
    color: var(--p-ink4);
    font-weight: 500;
  }
  .suggested-btn {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    border: 1px dashed var(--p-border-m);
  }
  .suggested-btn:hover {
    border-color: var(--p-provision-accent);
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
  }

  .edit-done-btn {
    all: unset;
    cursor: pointer;
    margin-top: 12px;
    padding: 8px 20px;
    border-radius: var(--radius-md);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 12px;
    font-weight: 600;
    display: block;
    text-align: center;
  }
  .edit-done-btn:hover {
    opacity: 0.85;
  }

  /* Coverage */
  .coverage-grid {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    gap: 4px 8px;
    align-items: center;
  }
  .cov-signal {
    font-family: var(--font-data);
    font-weight: 700;
    font-size: 10px;
    color: var(--p-ink3);
  }
  .cov-desc {
    font-size: 11px;
    color: var(--p-ink3);
  }
  .cov-count {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink2);
    text-align: right;
  }
  .cov-total {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--p-border);
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }

  /* Gaps */
  .gap-row {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink2);
    padding: 3px 6px;
    border-radius: var(--radius-md);
    width: 100%;
    box-sizing: border-box;
  }
  .gap-row.is-zero {
    color: var(--p-gap);
    cursor: pointer;
    background: var(--p-gap-bg);
  }
  .gap-row.is-zero:hover {
    background: rgba(155, 77, 202, 0.08);
  }
  .gap-prov {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gap-sep {
    color: var(--p-ink4);
    font-size: 10px;
    flex-shrink: 0;
  }
  .gap-val {
    margin-left: auto;
    font-weight: 600;
    flex-shrink: 0;
  }
  .gap-hint {
    font-size: 10px;
    color: var(--p-gap);
    font-style: italic;
    margin-top: 4px;
  }

  /* Iterations */
  .round-row {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: var(--radius-md);
    font-size: 11px;
    color: var(--p-ink2);
    width: 100%;
    box-sizing: border-box;
  }
  .round-row:hover {
    background: var(--p-hover);
  }
  .round-row.active {
    background: var(--p-active);
  }
  .round-num {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--p-input);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: var(--p-ink3);
    flex-shrink: 0;
  }
  .round-row.active .round-num {
    background: var(--p-ink);
    color: var(--p-panel);
  }
  .round-seeds {
    flex: 1;
    font-family: var(--font-data);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .round-count {
    font-family: var(--font-data);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    flex-shrink: 0;
  }
  .clear-filter {
    all: unset;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink2);
    text-decoration: underline;
    margin-top: 2px;
  }
  .clear-filter:hover {
    color: var(--p-ink);
  }

  .new-iter-btn {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--p-border-m);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    text-align: center;
    box-sizing: border-box;
    margin-top: 8px;
  }
  .new-iter-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink);
  }
</style>
