<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';

  import { formatProvision } from '$lib/utils/provisions';
  import SeedInput from './SeedInput.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import PostSearchPanel from './PostSearchPanel.svelte';
  import EuScreeningPanel from './EuScreeningPanel.svelte';

  let editing = $state(false);
  let zeroGaps = $derived(analysisState.gaps.filter((g) => g.count === 0));
  let nonZeroGaps = $derived(analysisState.gaps.filter((g) => g.count > 0));
</script>

<div class="context-view">
  <div class="process-header">
    <span class="process-title">Søkeoppsett</span>
    <span class="header-spacer"></span>
    {#if !editing}
      <button class="header-btn" onclick={() => (editing = true)}>Rediger søkeparametre</button>
    {/if}
  </div>

  <div class="context-scroll">
    <div class="context-flow">
      <!-- 1. Problem — the hero -->
      <section class="card hero-card">
        <div class="card-label">Problemstilling</div>
        <p class="card-desc">
          Det juridiske spørsmålet denne analysen undersøker.{#if analysisState.scopingResult}
            Claude har analysert spørsmålet og foreslått bestemmelser og søketermer.{/if}
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
            Søkeparametrene bestemmer hvilke KOFA-avgjørelser som blir funnet. Tre uavhengige
            søkemetoder kjøres parallelt — saker som treffes av flere metoder rangeres høyere.
          </p>

          <!-- Provisions with inline coverage -->
          <div class="param-group">
            <div class="param-label">Bestemmelser</div>
            <p class="param-desc">
              Lovbestemmelsene søket er bygget rundt. Saker som refererer til disse i KOFAs database
              gir R-signal.
            </p>
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
              <div class="param-label">Fulltekstsøk</div>
              <p class="param-desc">
                Søkeord som matches direkte mot avgjørelsesteksten — som et Lovdata-søk. Gir
                F-signal.
              </p>
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
              <div class="param-label">Semantisk søk (vektor)</div>
              <p class="param-desc">
                En naturlig beskrivelse av problemstillingen. Finner saker med lignende <em
                  >innhold</em
                > selv om de bruker andre ord enn fulltekstsøket — basert på maskinlæring. Gir V-signal.
              </p>
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
            Alle KOFA-avgjørelser som ble funnet av minst én søkemetode. Hver sak får en kategori
            basert på hvor mange metoder som fant den: <strong>A</strong> = alle tre (R+F+V),
            <strong>B</strong>
            = to, <strong>C</strong> = én. Dette er et mål på <em>oppdagbarhet</em>, ikke relevans —
            en C-sak kan være svært viktig.
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
          <div class="param-label">Søkemetoder — hvor mange saker hver metode fant</div>
          <div class="signal-row">
            <div class="signal-item">
              <span class="signal-letter">R</span>
              <div class="signal-text">
                <span class="signal-name">Referansetabell</span>
                <span class="signal-desc"
                  >Bestemmelsene er registrert i KOFAs referanser til saken</span
                >
              </div>
              <span class="signal-count">{analysisState.coverageStats.ref}</span>
            </div>
            <div class="signal-item">
              <span class="signal-letter">F</span>
              <div class="signal-text">
                <span class="signal-name">Fulltekstsøk</span>
                <span class="signal-desc">Søkeordene forekommer i avgjørelsesteksten</span>
              </div>
              <span class="signal-count">{analysisState.coverageStats.fts}</span>
            </div>
            <div class="signal-item">
              <span class="signal-letter">V</span>
              <div class="signal-text">
                <span class="signal-name">Vektor</span>
                <span class="signal-desc">Innholdet ligner semantisk på den beskrivelsen du ga</span
                >
              </div>
              <span class="signal-count">{analysisState.coverageStats.vec}</span>
            </div>
          </div>

          <!-- Gap matrix — compact -->
          {#if analysisState.gaps.length > 0}
            <div class="gap-section">
              <div class="param-label">Kryssdekning mellom bestemmelser</div>
              <p class="param-desc">
                Finnes det saker som behandler to bestemmelser <em>sammen</em>? Hull betyr at ingen
                saker ble funnet for den kombinasjonen — du kan legge til begge som søkeparametre
                for å se om nye saker dukker opp.
              </p>
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
                  <span class="gap-zero-label"
                    >{zeroGaps.length} kombinasjoner uten treff — klikk for å utvide søket:</span
                  >
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
                  <span class="gap-hint"
                    >Klikk «+» for å legge til begge bestemmelsene som nye søkeparametre</span
                  >
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
          <p class="card-desc">
            Hver runde representerer ett søk med bestemte parametre. Du kan legge til nye
            bestemmelser eller søkeord og kjøre en ny runde — nye saker vises med et eget merke i
            listen. Klikk en runde for å filtrere listen til bare den rundens saker.
          </p>
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

      <!-- 5. Post-search suggestions (from screening analysis) -->
      {#if analysisState.showPostSearch}
        <section class="card">
          <div class="card-label">Ettersøksforslag</div>
          <p class="card-desc">
            Basert på screeningresultatene og hull i kryssdekningsmatrisen kan Claude foreslå nye
            søketermer og bestemmelser du kanskje har oversett.
          </p>
          <PostSearchPanel />
        </section>
      {/if}

      <!-- 6. EU case discovery -->
      {#if analysisState.showEuSection}
        <section class="card">
          <div class="card-label">EU-dommer</div>
          <p class="card-desc">
            Identifiser EU-dommer som refereres fra KOFA-sakene du har screenet. Disse kan belyse de
            EU-rettslige kildene bak norsk praksis.
          </p>
          <EuScreeningPanel />
        </section>
      {/if}

      <div class="iter-action">
        <button class="new-iter-btn" onclick={() => analysisState.startNewIteration()}>
          + Ny søkerunde
        </button>
        <p class="iter-desc">
          Start en ny runde med justerte søkeparametre. Legg til bestemmelser, endre søkeord, eller
          utvid den semantiske beskrivelsen — deretter kjør søk på nytt. Nye saker markeres i listen
          slik at du ser hva som er nytt.
        </p>
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
    gap: 12px;
  }

  /* Cards */
  .card {
    padding: 20px 24px;
    border: 1px solid var(--p-border);
    border-radius: var(--radius-lg);
    background: var(--p-surface);
  }
  .hero-card {
    padding: 24px 28px;
    border-color: var(--p-border-m);
  }
  .hero-card .problem-text {
    font-size: 15px;
  }
  .card-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 4px;
  }

  .card-desc {
    font-size: 11px;
    line-height: 1.5;
    color: var(--p-ink3);
    margin: 0 0 12px;
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
    margin-bottom: 4px;
  }
  .param-desc {
    font-size: 11px;
    line-height: 1.45;
    color: var(--p-ink3);
    margin: 0 0 8px;
  }
  .iter-action {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .iter-desc {
    font-size: 11px;
    line-height: 1.45;
    color: var(--p-ink3);
    margin: 0;
  }

  .provision-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    margin: -4px -4px -4px 0;
  }
  .prov-remove:hover {
    color: var(--p-ink);
    background: var(--p-hover);
  }

  .suggested {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
    gap: 8px;
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
    display: inline-block;
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
    gap: 8px;
    padding: 0;
    margin: 4px 0 16px;
  }
  .signal-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex: 1;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--p-input);
    border: 1px solid var(--p-border);
  }
  .signal-letter {
    font-family: var(--font-data);
    font-weight: 700;
    font-size: 11px;
    color: var(--p-ink3);
    margin-top: 1px;
  }
  .signal-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .signal-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .signal-desc {
    font-size: 10px;
    color: var(--p-ink3);
    line-height: 1.4;
  }
  .signal-count {
    font-family: var(--font-data);
    font-size: 16px;
    font-weight: 700;
    color: var(--p-ink);
    flex-shrink: 0;
    line-height: 1;
    align-self: center;
  }

  /* Gaps — compact chips */
  .gap-section {
    margin-top: 4px;
  }
  .gap-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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

  @media (max-width: 768px) {
    .context-flow {
      max-width: 100%;
      padding: 16px 12px;
    }
  }
</style>
