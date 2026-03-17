<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';
  import SeedInput from './SeedInput.svelte';

  let editing = $state(false);

  let readCount = $derived(Object.values(analysisState.analysis.readStatus).filter(Boolean).length);
  let totalCount = $derived(analysisState.caseNodes.length);

  let primaryProvision = $derived(
    analysisState.analysis.seeds.provisions.length > 0
      ? formatProvision(analysisState.analysis.seeds.provisions[0])
      : null
  );

  let ftsTerms = $derived(analysisState.analysis.seeds.ftsTerms);
  let vectorQuery = $derived(analysisState.analysis.seeds.vectorQuery);
  let suggestions = $derived(analysisState.suggestedProvisions);
  let zeroGaps = $derived(analysisState.gaps.filter((g) => g.count === 0));

  function removeProvision(index: number) {
    analysisState.setSeeds({
      ...analysisState.analysis.seeds,
      provisions: analysisState.analysis.seeds.provisions.filter((_, i) => i !== index),
    });
  }

  function removeFtsTerm(index: number) {
    analysisState.setSeeds({
      ...analysisState.analysis.seeds,
      ftsTerms: ftsTerms.filter((_, i) => i !== index),
    });
  }
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
      <!-- Left column: Problem + Seeds -->
      <div class="strip-left">
        {#if analysisState.analysis.problemStatement}
          <div class="strip-section">
            <div class="strip-label">Problemstilling</div>
            <div class="strip-text">{analysisState.analysis.problemStatement}</div>
          </div>
        {/if}

        {#if editing}
          <!-- Full seed editor -->
          <div class="strip-section">
            <SeedInput />
            <button class="edit-done-btn" onclick={() => (editing = false)}>Ferdig</button>
          </div>
        {:else}
          <!-- Read-only seeds with remove buttons -->
          <div class="strip-section">
            <div class="strip-label-row">
              <div class="strip-label">Bestemmelser</div>
              <button class="edit-seeds-btn" onclick={() => (editing = true)}>Rediger seeds</button>
            </div>
            <div class="strip-provisions">
              {#each analysisState.analysis.seeds.provisions as prov, i}
                <span class="strip-prov-badge">
                  {formatProvision(prov)}
                  <button class="badge-remove" onclick={() => removeProvision(i)}>×</button>
                </span>
              {/each}
            </div>
            {#if suggestions.length > 0}
              <div class="suggested-row">
                <span class="suggested-label">Foreslåtte:</span>
                {#each suggestions as s}
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

          {#if ftsTerms.length > 0}
            <div class="strip-section">
              <div class="strip-label">Fulltekstsøk</div>
              <div class="strip-terms">
                {#each ftsTerms as term, i}
                  <span class="strip-term-badge">
                    «{term}»
                    <button class="badge-remove" onclick={() => removeFtsTerm(i)}>×</button>
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          {#if vectorQuery}
            <div class="strip-section">
              <div class="strip-label">Semantisk søk</div>
              <div class="strip-text vector-text">{vectorQuery}</div>
            </div>
          {/if}

          {#if analysisState.scopingResult?.reasoning}
            <div class="strip-section ai-section">
              <div class="strip-text ai-text">{analysisState.scopingResult.reasoning}</div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Right column: Coverage + Gaps + Iterations -->
      <div class="strip-right">
        {#if totalCount > 0}
          <div class="strip-section">
            <div class="strip-label">Søkedekning</div>
            <div class="coverage-rows">
              <div class="coverage-row">
                <span class="coverage-signal">R</span>
                <span class="coverage-desc">Referansetabell</span>
                <span class="coverage-count">{analysisState.coverageStats.ref}</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">F</span>
                <span class="coverage-desc">Fulltekstsøk</span>
                <span class="coverage-count">{analysisState.coverageStats.fts}</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">V</span>
                <span class="coverage-desc">Vektor</span>
                <span class="coverage-count">{analysisState.coverageStats.vec}</span>
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
            {#each analysisState.gaps.slice(0, 6) as gap}
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
          <div class="strip-section">
            <div class="strip-label">Søkerunder</div>
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
          + Ny iterasjon
        </button>
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
    padding: 7px 16px;
    width: 100%;
    box-sizing: border-box;
    font-size: 12px;
    color: var(--p-ink2);
    transition: background 0.1s ease;
  }
  .strip-toggle:hover {
    background: var(--p-hover);
  }
  .strip-toggle:active {
    background: var(--p-active);
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
    grid-template-columns: 3fr 2fr;
    gap: 24px;
    padding: 8px 16px 12px;
    border-top: 1px solid rgba(26, 24, 20, 0.05);
    max-height: 50vh;
    overflow-y: auto;
  }
  .strip-left,
  .strip-right {
    min-width: 0; /* prevent grid overflow */
  }

  .strip-section {
    margin-bottom: 8px;
  }
  .strip-section:last-child {
    margin-bottom: 0;
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
    font-size: 12px;
    line-height: 1.5;
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

  /* Label row with edit button */
  .strip-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .strip-label-row .strip-label {
    margin-bottom: 0;
  }
  .edit-seeds-btn {
    all: unset;
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    color: var(--p-ink3);
    padding: 2px 6px;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border);
  }
  .edit-seeds-btn:hover {
    background: var(--p-hover);
    color: var(--p-ink);
  }
  .edit-done-btn {
    all: unset;
    cursor: pointer;
    margin-top: 8px;
    padding: 6px 16px;
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

  /* Badge remove button */
  .badge-remove {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    opacity: 0.4;
    margin-left: 2px;
  }
  .badge-remove:hover {
    opacity: 1;
  }

  /* Provisions */
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

  /* Suggested provisions */
  .suggested-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
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
    padding: 1px 6px;
    border-radius: var(--radius-badge);
    border: 1px dashed var(--p-border-m);
  }
  .suggested-btn:hover {
    border-color: var(--p-provision-accent);
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
  }

  /* FTS terms */
  .strip-terms {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .strip-term-badge {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink2);
    background: var(--p-hover);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
  }

  /* Vector query */
  .vector-text {
    font-size: 12px;
    color: var(--p-ink2);
    font-style: italic;
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
  .coverage-desc {
    font-size: 10px;
    color: var(--p-ink3);
    flex: 1;
  }
  .coverage-count {
    font-family: var(--font-data);
    color: var(--p-ink2);
    font-weight: 600;
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
    all: unset;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink2);
    padding: 2px 4px;
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
  }
  .gap-val {
    margin-left: auto;
    font-weight: 600;
  }
  .gap-hint {
    font-size: 10px;
    color: var(--p-gap);
    font-style: italic;
    margin-top: 4px;
  }

  /* Iteration history */
  .round-row {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
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
    width: 14px;
    height: 14px;
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
    padding: 6px 8px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--p-border-m);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    text-align: center;
    box-sizing: border-box;
  }
  .new-iter-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink);
  }
</style>
