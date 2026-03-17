<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';
  import SeedInput from './SeedInput.svelte';
  import CategoryBadge from './CategoryBadge.svelte';

  let editing = $state(false);
  let zeroGaps = $derived(analysisState.gaps.filter((g) => g.count === 0));
  let nonZeroGaps = $derived(analysisState.gaps.filter((g) => g.count > 0));
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

  <div class="context-scroll">
    <div class="context-flow">
      <!-- 1. Problem — the hero -->
      <section class="card">
        <div class="card-label">Problemstilling</div>
        <p class="card-desc">
          Det juridiske spørsmålet denne analysen undersøker. Claude har foreslått bestemmelser og
          søketermer basert på dette.
        </p>
        <p class="problem-text">
          {analysisState.analysis.problemStatement || 'Ikke definert ennå'}
        </p>
        {#if analysisState.scopingResult?.reasoning}
          <div class="ai-block">
            <p class="ai-text">{analysisState.scopingResult.reasoning}</p>
          </div>
        {/if}
      </section>

      <!-- 2. Search parameters — what we're looking for -->
      {#if editing}
        <section class="card">
          <div class="card-label">Søkeparametre</div>
          <SeedInput />
          <button class="done-btn" onclick={() => (editing = false)}>Ferdig</button>
        </section>
      {:else}
        <section class="card">
          <div class="card-label">Søkeparametre</div>
          <p class="card-desc">
            Bestemmelsene, søkeordene og den semantiske beskrivelsen som brukes for å finne
            relevante KOFA-avgjørelser. Fjern med × eller legg til foreslåtte.
          </p>

          <!-- Provisions with inline coverage -->
          <div class="param-group">
            <div
              class="param-label"
              title="Lovbestemmelser som brukes for å finne saker via referansetabellen (R-signal)"
            >
              Bestemmelser
            </div>
            <div class="provision-list">
              {#each analysisState.analysis.seeds.provisions as prov, i}
                <div class="provision-row">
                  <span class="prov-badge">{formatProvision(prov)}</span>
                  <button
                    class="prov-remove"
                    onclick={() => {
                      analysisState.setSeeds({
                        ...analysisState.analysis.seeds,
                        provisions: analysisState.analysis.seeds.provisions.filter(
                          (_, idx) => idx !== i
                        ),
                      });
                    }}>×</button
                  >
                </div>
              {/each}
            </div>
            {#if analysisState.suggestedProvisions.length > 0}
              <div class="suggested">
                <span class="suggested-label">Kan være relevant:</span>
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
            <div class="param-group">
              <div
                class="param-label"
                title="Eksakte søkeord som matches mot avgjørelsesteksten (F-signal)"
              >
                Fulltekstsøk
              </div>
              <div class="term-list">
                {#each analysisState.analysis.seeds.ftsTerms as term, i}
                  <span class="fts-chip">
                    «{term}»
                    <button
                      class="chip-remove"
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
            <div class="param-group">
              <div
                class="param-label"
                title="En naturlig beskrivelse av problemstillingen — finner saker med lignende innhold selv om ordene er forskjellige (V-signal)"
              >
                Semantisk søk
              </div>
              <p class="vector-text">{analysisState.analysis.seeds.vectorQuery}</p>
            </div>
          {/if}
        </section>
      {/if}

      <!-- 3. Results — what we found -->
      {#if analysisState.caseNodes.length > 0}
        <section class="card">
          <div class="card-label">Resultater</div>
          <p class="card-desc">
            Saker funnet via søkeparametrene. Kategori A = treff på alle tre søkemetoder, B = to, C
            = én. Kategorien sier hvor mange søk som fant saken — ikke hvor relevant den er.
          </p>

          <!-- Candidate summary -->
          <div class="results-hero">
            <span class="results-count">{analysisState.caseNodes.length}</span>
            <span class="results-label">kandidater funnet</span>
            <div class="results-cats">
              <span title="A-saker: Treff på alle tre søkemetoder (R+F+V)"
                ><CategoryBadge category="A" small /><span class="cat-num"
                  >{analysisState.catCounts.A}</span
                ></span
              >
              <span title="B-saker: Treff på to av tre søkemetoder"
                ><CategoryBadge category="B" small /><span class="cat-num"
                  >{analysisState.catCounts.B}</span
                ></span
              >
              <span title="C-saker: Treff på én søkemetode"
                ><CategoryBadge category="C" small /><span class="cat-num"
                  >{analysisState.catCounts.C}</span
                ></span
              >
            </div>
          </div>

          <!-- Signal coverage -->
          <div class="signal-row">
            <div
              class="signal-item"
              title="Saker som refererer til bestemmelsene direkte i KOFAs referansetabell"
            >
              <span class="signal-letter">R</span>
              <span class="signal-name">Referansetabell</span>
              <span class="signal-count">{analysisState.coverageStats.ref}</span>
            </div>
            <div class="signal-item" title="Saker der søkeordene forekommer i avgjørelsesteksten">
              <span class="signal-letter">F</span>
              <span class="signal-name">Fulltekstsøk</span>
              <span class="signal-count">{analysisState.coverageStats.fts}</span>
            </div>
            <div
              class="signal-item"
              title="Saker med lignende innhold basert på maskinlæring (semantisk likhet)"
            >
              <span class="signal-letter">V</span>
              <span class="signal-name">Vektor</span>
              <span class="signal-count">{analysisState.coverageStats.vec}</span>
            </div>
          </div>

          <!-- Gap matrix — compact -->
          {#if analysisState.gaps.length > 0}
            <div class="gap-section">
              <div
                class="param-label"
                title="Viser om det finnes saker som behandler to bestemmelser sammen. Hull (∅) kan bety at kombinasjonen bør undersøkes med flere seeds."
              >
                Bestemmelsespar — interseksjoner
              </div>
              {#if nonZeroGaps.length > 0}
                <div class="gap-compact">
                  {#each nonZeroGaps as gap}
                    <span class="gap-chip"
                      >{gap.provision1} ∩ {gap.provision2}: <strong>{gap.count}</strong></span
                    >
                  {/each}
                </div>
              {/if}
              {#if zeroGaps.length > 0}
                <div class="gap-zeros">
                  <span class="gap-zero-label">{zeroGaps.length} hull uten treff:</span>
                  <div class="gap-compact">
                    {#each zeroGaps as gap}
                      {#if gap.id1 && gap.id2}
                        {@const id1 = gap.id1}
                        {@const id2 = gap.id2}
                        <button
                          class="gap-chip zero"
                          onclick={() => analysisState.addSeedsFromGap(id1, id2)}
                        >
                          {gap.provision1} ∩ {gap.provision2} <span class="gap-add">+</span>
                        </button>
                      {/if}
                    {/each}
                  </div>
                  <span class="gap-hint">Klikk for å legge til som seeds</span>
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <!-- 4. Iterations -->
      {#if analysisState.analysis.iterationHistory?.length}
        <section class="card">
          <div class="card-label">Søkerunder</div>
          <div class="rounds">
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
          </div>
          {#if analysisState.filterIteration !== null}
            <button class="clear-filter" onclick={() => analysisState.clearFilterIteration()}
              >Vis alle runder</button
            >
          {/if}
        </section>
      {/if}

      <button class="new-iter-btn" onclick={() => analysisState.startNewIteration()}>
        + Ny iterasjon med nye seeds
      </button>
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

  /* Scrollable content */
  .context-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 40px;
  }
  .context-flow {
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Cards */
  .card {
    padding: 20px 24px;
    border: 1px solid var(--p-border);
    border-radius: var(--radius-lg);
    background: var(--p-surface);
  }
  .card-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 12px;
  }

  .card-desc {
    font-size: 11px;
    line-height: 1.5;
    color: var(--p-ink3);
    margin: -4px 0 12px;
  }

  /* 1. Problem */
  .problem-text {
    font-size: 14px;
    line-height: 1.65;
    color: var(--p-ink);
    margin: 0;
  }
  .ai-block {
    margin-top: 12px;
    padding: 10px 14px;
    border-left: 3px solid var(--p-ai-border);
    background: var(--p-ai-bg);
    border-radius: var(--radius-md);
  }
  .ai-text {
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink2);
    font-style: italic;
    margin: 0;
  }

  /* 2. Search params */
  .param-group {
    margin-bottom: 16px;
  }
  .param-group:last-child {
    margin-bottom: 0;
  }
  .param-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink2);
    margin-bottom: 6px;
  }

  .provision-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .provision-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .prov-badge {
    font-family: var(--font-data);
    font-size: 12px;
    font-weight: 600;
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
    border: 1px solid var(--p-provision-border);
    padding: 4px 10px;
    border-radius: var(--radius-badge);
  }
  .prov-remove {
    all: unset;
    cursor: pointer;
    font-size: 14px;
    color: var(--p-ink4);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }
  .prov-remove:hover {
    color: var(--p-ink);
    background: var(--p-hover);
  }

  .suggested {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
  }
  .suggested-label {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .suggested-btn {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 11px;
    color: var(--p-ink3);
    padding: 2px 8px;
    border-radius: var(--radius-badge);
    border: 1px dashed var(--p-border-m);
  }
  .suggested-btn:hover {
    border-color: var(--p-provision-accent);
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
  }

  .term-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fts-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-data);
    font-size: 11px;
    color: var(--p-ink2);
    background: var(--p-hover);
    padding: 4px 10px;
    border-radius: var(--radius-badge);
  }
  .chip-remove {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.4;
  }
  .chip-remove:hover {
    opacity: 1;
  }

  .vector-text {
    font-size: 12px;
    line-height: 1.5;
    color: var(--p-ink2);
    font-style: italic;
    margin: 0;
  }

  .done-btn {
    all: unset;
    cursor: pointer;
    margin-top: 16px;
    padding: 8px 24px;
    border-radius: var(--radius-md);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 12px;
    font-weight: 600;
    display: block;
    text-align: center;
  }
  .done-btn:hover {
    opacity: 0.85;
  }

  /* 3. Results */
  .results-hero {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 12px;
  }
  .results-count {
    font-size: 28px;
    font-weight: 700;
    font-family: var(--font-data);
    color: var(--p-ink);
    line-height: 1;
  }
  .results-label {
    font-size: 13px;
    color: var(--p-ink2);
  }
  .results-cats {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .cat-num {
    font-family: var(--font-data);
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink2);
  }

  .signal-row {
    display: flex;
    gap: 16px;
    padding: 10px 0;
    border-top: 1px solid var(--p-border);
    border-bottom: 1px solid var(--p-border);
    margin-bottom: 12px;
  }
  .signal-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }
  .signal-letter {
    font-family: var(--font-data);
    font-weight: 700;
    font-size: 11px;
    color: var(--p-ink3);
  }
  .signal-name {
    font-size: 11px;
    color: var(--p-ink3);
  }
  .signal-count {
    font-family: var(--font-data);
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink);
    margin-left: auto;
  }

  /* Gaps — compact chips */
  .gap-section {
    margin-top: 4px;
  }
  .gap-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .gap-chip {
    font-family: var(--font-data);
    font-size: 10px;
    color: var(--p-ink2);
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    background: var(--p-hover);
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .gap-chip.zero {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 10px;
    color: var(--p-gap);
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    background: var(--p-gap-bg);
    border: 1px solid rgba(155, 77, 202, 0.12);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .gap-chip.zero:hover {
    background: rgba(155, 77, 202, 0.1);
    border-color: rgba(155, 77, 202, 0.2);
  }
  .gap-add {
    font-weight: 700;
  }
  .gap-zeros {
    margin-top: 8px;
  }
  .gap-zero-label {
    font-size: 11px;
    color: var(--p-gap);
    font-weight: 500;
  }
  .gap-hint {
    font-size: 10px;
    color: var(--p-ink4);
    margin-top: 4px;
  }

  /* 4. Iterations */
  .rounds {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .round-row {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
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
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--p-input);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
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
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .round-count {
    font-family: var(--font-data);
    font-size: 11px;
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
    margin-top: 4px;
  }
  .clear-filter:hover {
    color: var(--p-ink);
  }

  .new-iter-btn {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--p-border-m);
    font-size: 12px;
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
