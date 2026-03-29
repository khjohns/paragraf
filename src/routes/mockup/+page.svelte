<script lang="ts">
  import '$lib/mockup/tokens.css';
  import { Plus, Search } from 'lucide-svelte';
  import MockupHeader from '$lib/mockup/components/MockupHeader.svelte';
  import ScopeToggle from '$lib/mockup/components/ScopeToggle.svelte';
  import PhaseDropdown from '$lib/mockup/components/PhaseDropdown.svelte';
  import ContinueCard from '$lib/mockup/components/ContinueCard.svelte';
  import IndexRow from '$lib/mockup/components/IndexRow.svelte';
  import VennIcon from '$lib/mockup/components/VennIcon.svelte';
  import ProvisionTag from '$lib/mockup/components/ProvisionTag.svelte';
  import {
    MOCK_ANALYSES,
    PHASE_NAMES,
    PHASE_COLORS,
    TOTAL_PHASES,
    AVAILABLE_TAGS,
    type Phase,
    type MockAnalysis,
  } from '$lib/mockup/data/portfolio';

  let darkMode = $state(false);
  type ViewScope = 'mine' | 'team' | 'corpus';
  let viewScope = $state<ViewScope>('mine');
  let activePhases = $state<Phase[]>([]);
  let analyses = $state<MockAnalysis[]>(structuredClone(MOCK_ANALYSES));

  function togglePhase(phase: Phase) {
    if (activePhases.includes(phase)) {
      activePhases = activePhases.filter((p) => p !== phase);
    } else {
      activePhases = [...activePhases, phase];
    }
  }

  function handleSetTag(analysisId: string, newTag: string) {
    analyses = analyses.map((a) => (a.id === analysisId ? { ...a, tag: newTag } : a));
  }

  let activeAnalysis = $derived(analyses.find((a) => a.lastActive));

  let scopeLabel = $derived(
    viewScope === 'mine'
      ? 'mine analyser'
      : viewScope === 'team'
        ? 'teamets analyser'
        : 'alle publiserte analyser'
  );

  // Collapse to "alle faser" when all phases selected
  let effectivePhases = $derived(activePhases.length === TOTAL_PHASES ? [] : activePhases);

  function matchesFilter(item: MockAnalysis) {
    const scopeMatch = viewScope === 'corpus' || viewScope === 'team' || !item.teamOnly;
    const phaseMatch = effectivePhases.length === 0 || effectivePhases.includes(item.phase);
    return scopeMatch && phaseMatch;
  }

  let allVisible = $derived(analyses.filter(matchesFilter));
  let totalVisible = $derived(allVisible.length);

  let showKrysspollinering = $derived.by(() => {
    const provisions = new Set<string>();
    allVisible.forEach((a) => {
      if (a.overlapWith) provisions.add(a.overlapWith);
    });
    return provisions.size > 0;
  });

  let groupedVisible = $derived.by(() => {
    const groups: Record<string, MockAnalysis[]> = {};
    allVisible.forEach((a) => {
      const tag = a.tag || 'Uten tema';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(a);
    });
    return groups;
  });

  let allKnownTags = $derived.by(() => {
    return [...new Set([...AVAILABLE_TAGS, ...analyses.map((a) => a.tag).filter(Boolean)])];
  });

  let kryssBeskrivelse = $derived(
    viewScope === 'mine'
      ? 'Du har to analyser som krysser hverandre her. Den ene ser på ettersending av skatteattest, den andre på vesentlige avvik. Koblingen ligger i dokumentasjonskravets absolutte natur.'
      : viewScope === 'team'
        ? 'Du og Erik ser på samme bestemmelse fra ulik vinkel. Erik fokuserer på oppdragsgivers plikt til å be om ettersending, mens du ser på konsekvensen av manglende attest.'
        : 'Tre analyser på tvers av teamet konvergerer rundt denne bestemmelsen. Koblingen ligger i dokumentasjonskravets absolutte natur.'
  );
</script>

<div class="mockup-root" class:dark={darkMode}>
  <MockupHeader {darkMode} onToggleDarkMode={() => (darkMode = !darkMode)} />

  <main class="main-content">
    <!-- TOOLBAR -->
    <div class="toolbar">
      <div class="toolbar-left">
        <ScopeToggle value={viewScope} onchange={(s) => (viewScope = s)} />

        <div class="toolbar-sep"></div>

        <button class="new-analysis-btn">
          <Plus size={12} />
          Ny analyse
          <span class="shortcut">&#x2318;N</span>
        </button>
      </div>

      <div class="toolbar-right">
        <div class="search-container">
          <Search size={12} class="search-icon" />
          <input class="search-input" type="text" placeholder="Søk i arkivet…" />
        </div>
        <PhaseDropdown {activePhases} onToggle={togglePhase} onClear={() => (activePhases = [])} />
      </div>
    </div>

    <!-- NARRATIVE FILTER -->
    <div class="narrative">
      <p class="narrative-text">
        Viser
        <span class="narrative-scope">{scopeLabel}</span>
        {#if effectivePhases.length === 0}
          på tvers av <span class="narrative-highlight">alle faser</span>
        {:else if effectivePhases.length === 1}
          i fasen <span style:color={PHASE_COLORS[effectivePhases[0]]} style:font-weight="500"
            >{PHASE_NAMES[effectivePhases[0]]}</span
          >
        {:else}
          i {#each effectivePhases as phase, i}{#if i > 0}{#if i === effectivePhases.length - 1}
                og
              {:else},
              {/if}{/if}<span style:color={PHASE_COLORS[phase]} style:font-weight="500"
              >{PHASE_NAMES[phase]}</span
            >{/each}
        {/if}.
      </p>
    </div>

    <!-- FORTSETT DER DU SLAPP -->
    {#if viewScope === 'mine' && activeAnalysis && effectivePhases.length === 0}
      <ContinueCard analysis={activeAnalysis} />
    {/if}

    <!-- INDEKS -->
    <section>
      <div class="index-header">
        <h3 class="index-title">Indeks</h3>
        <span class="index-count">{totalVisible} mapper</span>
      </div>

      <!-- Empty state -->
      {#if totalVisible === 0}
        <div class="empty-state">
          <p class="empty-text">Ingen analyser matcher filteret.</p>
          <button class="reset-filter-btn" onclick={() => (activePhases = [])}>
            Nullstill filter
          </button>
        </div>
      {/if}

      {#each Object.entries(groupedVisible) as [groupName, visibleItems], groupIndex}
        <div class="index-group">
          <div class="group-header">
            <h4 class="group-name">{groupName}</h4>
            <span class="group-count">{visibleItems.length}</span>
          </div>

          {#each visibleItems as analysis}
            <IndexRow {analysis} {viewScope} allTags={allKnownTags} onSetTag={handleSetTag} />
          {/each}
        </div>
      {/each}

      <!-- New analysis row -->
      {#if totalVisible > 0}
        <div class="new-analysis-row" tabindex="0" role="button">
          <Plus size={14} color="var(--ink-muted)" />
          <span class="new-analysis-label">Start ny analyse</span>
        </div>
      {/if}
    </section>

    <!-- KRYSSPOLLINERING -->
    {#if showKrysspollinering}
      <section class="cross-section">
        <h3 class="cross-title">
          <VennIcon size={14} />
          Krysspollinering
        </h3>

        <div class="cross-card">
          <h4 class="cross-card-title">Konvergens rundt FOA &sect;16-10</h4>
          <p class="cross-card-text">{kryssBeskrivelse}</p>
          <div class="cross-data">
            <span class="cross-data-label">Datagrunnlag:</span>
            <ProvisionTag text="4 felles KOFA-avgjørelser" small />
            <ProvisionTag text="2 relevante EU-dommer" small />
          </div>
        </div>
      </section>
    {/if}
  </main>
</div>

<style>
  .mockup-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 80px;
  }

  .main-content {
    width: 100%;
    max-width: 860px;
    padding: 0 24px;
    margin-top: 32px;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--border-subtle);
    margin: 0 4px;
  }

  .new-analysis-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink);
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .new-analysis-btn:hover {
    border-color: var(--border-strong);
  }

  .shortcut {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    margin-left: 4px;
  }

  .search-container {
    position: relative;
  }

  .search-container :global(.search-icon) {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-muted);
  }

  .search-input {
    font-family: var(--font-sans);
    font-size: 12px;
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    border-radius: 4px;
    padding: 4px 12px 4px 28px;
    width: 180px;
    outline: none;
    color: var(--ink);
    transition: border-color 0.15s ease;
  }

  .search-input::placeholder {
    color: var(--ink-muted);
  }

  .search-input:hover {
    border-color: var(--border-strong);
  }

  .search-input:focus {
    border-color: var(--control-border-focus);
  }

  /* Narrative */
  .narrative {
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
    margin-bottom: 40px;
  }

  .narrative-text {
    font-family: var(--font-serif);
    font-size: 30px;
    line-height: 1.35;
    font-weight: 400;
    color: var(--ink-tertiary);
    max-width: 680px;
    letter-spacing: -0.01em;
  }

  .narrative-scope,
  .narrative-highlight {
    color: var(--ink);
    font-weight: 500;
  }

  /* Index */
  .index-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 8px;
    margin-bottom: 24px;
  }

  .index-title {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink);
  }

  .index-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
  }

  .empty-text {
    font-family: var(--font-serif);
    font-size: 18px;
    color: var(--ink-tertiary);
    margin-bottom: 16px;
    font-style: italic;
  }

  .reset-filter-btn {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-secondary);
    background: none;
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-filter-btn:hover {
    border-color: var(--border-strong);
  }

  /* Groups */
  .index-group {
    margin-bottom: 40px;
  }

  .group-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 12px;
    padding-left: 4px;
  }

  .group-name {
    font-family: var(--font-serif);
    font-size: 20px;
    font-style: italic;
    font-weight: 400;
    color: var(--ink-tertiary);
  }

  .group-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    border: 1px solid var(--border);
    padding: 2px 4px;
    border-radius: 2px;
  }

  /* New analysis row */
  .new-analysis-row {
    margin-top: 24px;
    border: 1px dashed var(--border);
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .new-analysis-row:hover {
    background: var(--hover-bg);
  }

  .new-analysis-row:focus-visible {
    outline: none;
    border-color: var(--control-border-focus);
  }

  .new-analysis-label {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--ink-tertiary);
  }

  /* Krysspollinering */
  .cross-section {
    margin-top: 80px;
    padding-top: 40px;
    border-top: 1px solid var(--border-strong);
  }

  .cross-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--violet-accent);
    margin-bottom: 16px;
  }

  .cross-card {
    border: 1px solid var(--violet-border);
    padding: 24px;
  }

  .cross-card-title {
    font-family: var(--font-serif);
    font-size: 19px;
    font-weight: 500;
    color: var(--ink);
    margin-bottom: 8px;
  }

  .cross-card-text {
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink-secondary);
    margin-bottom: 16px;
  }

  .cross-data {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    border-top: 1px solid var(--border-subtle);
    padding-top: 12px;
  }

  .cross-data-label {
    font-family: var(--font-mono);
  }
</style>
