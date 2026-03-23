<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';
  import ScreeningPanel from './ScreeningPanel.svelte';
  import type { AnalysisStatus } from '$lib/types/analysis';

  let status = $derived(analysisState.analysis.status ?? 'scoping');

  const STATUS_TO_PHASE: Record<AnalysisStatus, number> = {
    scoping: 1,
    scoping_complete: 1,
    searching: 1,
    candidates_ready: 2,
    screening: 2,
    screening_complete: 2,
    post_search: 2,
    synthesis: 3,
    qa: 3,
    complete: 3,
  };

  let sn = $derived(STATUS_TO_PHASE[status]);
  let totalCases = $derived(analysisState.caseNodes.length);
  let readCount = $derived(analysisState.readCount);

  // Independent booleans — toggling one section doesn't invalidate the others
  let s1Open = $state(true);
  let s2Open = $state(true);
  let s3Open = $state(true);

  // Derived info
  let seedProvisions = $derived(analysisState.analysis.seeds.provisions);
  let seedFts = $derived(analysisState.analysis.seeds.ftsTerms);

  // Gap + post-search counts for hint badges
  let gapCount = $derived(analysisState.gaps.filter((g) => g.count === 0).length);
  let postSearchCount = $derived(
    (pipelineState.postSearchSuggestions?.fts_terms?.length ?? 0) +
      (pipelineState.postSearchSuggestions?.provisions?.length ?? 0)
  );
  let iterationCount = $derived(analysisState.analysis.iteration);

  // Section states
  let section1State = $derived<'done' | 'active' | 'pending'>(
    sn > 1 ? 'done' : status === 'scoping' ? 'active' : 'pending'
  );
  let section2State = $derived<'done' | 'active' | 'pending'>(
    sn > 2 ? 'done' : sn === 2 ? 'active' : 'pending'
  );
  let section3State = $derived<'done' | 'active' | 'pending'>(
    pipelineState.synthesisMarkdown ? 'done' : status === 'synthesis' ? 'active' : 'pending'
  );

  // Number circle visual — derived once per section
  type NumVisual = 'filled' | 'done' | 'default';
  function computeNumState(open: boolean, state: 'done' | 'active' | 'pending'): NumVisual {
    if (open || state === 'active') return 'filled';
    if (state === 'done') return 'done';
    return 'default';
  }
  let ns1 = $derived(computeNumState(s1Open, section1State));
  let ns2 = $derived(computeNumState(s2Open, section2State));
  let ns3 = $derived(computeNumState(s3Open, section3State));
</script>

<div class="phase-panel">
  <nav class="sections">
    <!-- ① Problemstilling & Søk -->
    <div class="section-group">
      <button class="section-header" onclick={() => (s1Open = !s1Open)}>
        <span class="section-num" class:filled={ns1 === 'filled'} class:done={ns1 === 'done'}>
          {#if ns1 === 'done'}
            <svg width="10" height="10" viewBox="0 0 10 10"
              ><path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              /></svg
            >
          {:else}
            1
          {/if}
        </span>
        <span class="section-label">Problemstilling</span>
        {#if section1State === 'active'}
          <span class="status-active">◐</span>
        {/if}
        <span class="header-spacer"></span>
        <svg class="chevron" class:open={s1Open} width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </button>

      {#if s1Open}
        <div class="section-body">
          {#if seedProvisions.length > 0}
            <div class="detail-group">
              <div class="detail-label">Bestemmelser</div>
              <div class="seed-list">
                {#each seedProvisions as p}
                  <span class="seed-badge prov">{formatProvision(p)}</span>
                {/each}
              </div>
            </div>
          {/if}
          {#if seedFts.length > 0}
            <div class="detail-group">
              <div class="detail-label">Søkeord</div>
              <div class="seed-list">
                {#each seedFts as t}
                  <span class="seed-badge fts">«{t}»</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if totalCases > 0}
            <div class="results-summary">
              <span class="results-num">{totalCases}</span> kandidater
              {#if iterationCount > 1}
                <span class="round-info">
                  · {iterationCount} søkerunder
                  {#if analysisState.analysis.iterationHistory?.length}
                    {@const last =
                      analysisState.analysis.iterationHistory[
                        analysisState.analysis.iterationHistory.length - 1
                      ]}
                    {#if last.newNodeCount > 0}
                      · <span class="round-new">+{last.newNodeCount} nye</span>
                    {/if}
                  {/if}
                </span>
              {/if}
            </div>
          {/if}

          <div class="hint-row">
            {#if gapCount > 0}
              <button class="hint-badge gap" onclick={() => uiState.setPhase(1)}>
                {gapCount} hull i kryssdekning
              </button>
            {/if}
            {#if postSearchCount > 0}
              <button class="hint-badge post-search" onclick={() => uiState.setPhase(1)}>
                {postSearchCount} søkeforslag
              </button>
            {/if}
          </div>

          <button class="link-btn" onclick={() => uiState.setPhase(1)}> Åpne søkeoppsett </button>
        </div>
      {/if}
    </div>

    <!-- ② Gjennomgang -->
    <div class="section-group">
      <button class="section-header" onclick={() => (s2Open = !s2Open)}>
        <span class="section-num" class:filled={ns2 === 'filled'} class:done={ns2 === 'done'}>
          {#if ns2 === 'done'}
            <svg width="10" height="10" viewBox="0 0 10 10"
              ><path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              /></svg
            >
          {:else}
            2
          {/if}
        </span>
        <span class="section-label">Gjennomgang</span>
        {#if section2State === 'active'}
          <span class="status-active">◐</span>
        {/if}
        <span class="header-spacer"></span>
        {#if totalCases > 0 && !s2Open}
          <span class="inline-stat">{readCount}/{totalCases}</span>
        {/if}
        <svg class="chevron" class:open={s2Open} width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </button>

      {#if s2Open}
        <div class="section-body">
          {#if totalCases > 0}
            <ScreeningPanel />
          {:else}
            <div class="empty-hint">Kjør søk først for å finne kandidater</div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ③ Syntese -->
    <div class="section-group">
      <button class="section-header" onclick={() => (s3Open = !s3Open)}>
        <span class="section-num" class:filled={ns3 === 'filled'} class:done={ns3 === 'done'}>
          {#if ns3 === 'done'}
            <svg width="10" height="10" viewBox="0 0 10 10"
              ><path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              /></svg
            >
          {:else}
            3
          {/if}
        </span>
        <span class="section-label">Syntese</span>
        {#if section3State === 'active'}
          <span class="status-active">◐</span>
        {/if}
        <span class="header-spacer"></span>
        <svg class="chevron" class:open={s3Open} width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </button>

      {#if s3Open}
        <div class="section-body">
          {#if pipelineState.synthesisMarkdown}
            <div class="synth-done">✓ Notat generert</div>
            <button class="link-btn" onclick={() => uiState.setPhase(3)}> Åpne syntese </button>
          {:else if section3State === 'active'}
            <div class="synth-active">Syntese pågår…</div>
          {:else}
            <div class="empty-hint">Gjennomgå sakene først</div>
          {/if}

          {#if pipelineState.qaReport}
            <div class="qa-row">
              <span class="qa-label">KS</span>
              {#if pipelineState.qaReport.total_flags > 0}
                <span class="qa-flags">⚠ {pipelineState.qaReport.total_flags} merknader</span>
              {:else}
                <span class="qa-ok">✓ ok</span>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </nav>

  {#if analysisState.totalCostUsd > 0}
    <div class="cost-display">
      ${analysisState.totalCostUsd.toFixed(2)}
    </div>
  {/if}
</div>

<style>
  .phase-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  .sections {
    display: flex;
    flex-direction: column;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--p-border);
  }

  /* ── Section header ── */
  .section-header {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .section-header:hover {
    background: var(--p-hover);
  }

  /* Number circle: three states — default (outlined), filled (expanded/active), done (success) */
  .section-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    color: var(--p-ink3);
    border: 1.5px solid var(--p-border-s);
    transition: all 0.15s ease;
  }
  .section-num.filled {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .section-num.done {
    background: var(--p-success-bg);
    color: var(--p-success);
    border-color: rgba(61, 122, 74, 0.2);
  }

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }

  .status-active {
    font-size: 11px;
    color: var(--p-kofa-accent);
  }

  .header-spacer {
    flex: 1;
  }

  .inline-stat {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink4);
  }

  .chevron {
    color: var(--p-ink4);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(0);
  }
  .chevron:not(.open) {
    transform: rotate(-90deg);
  }

  /* ── Expandable body — indent aligns under label text ── */
  .section-body {
    padding: 0 12px 12px 40px;
  }

  .detail-group {
    margin-bottom: 8px;
  }
  .detail-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink4);
    margin-bottom: 4px;
  }

  /* ── Seed badges ── */
  .seed-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .seed-badge {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-badge);
  }
  .seed-badge.prov {
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
    border: 1px solid var(--p-provision-border);
  }
  .seed-badge.fts {
    color: var(--p-ink2);
    background: var(--p-hover);
  }

  /* ── Results summary ── */
  .results-summary {
    font-size: 11px;
    color: var(--p-ink2);
    margin-bottom: 8px;
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
  }
  .results-num {
    font-family: var(--font-data);
    font-weight: 700;
    color: var(--p-ink);
  }
  .round-info {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .round-new {
    font-weight: 600;
    color: var(--p-success);
  }

  /* ── Hint badges (gaps, post-search) ── */
  .hint-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }
  .hint-badge {
    all: unset;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-badge);
  }
  .hint-badge.gap {
    color: var(--p-gap);
    background: var(--p-gap-bg);
    border: 1px solid rgba(155, 77, 202, 0.12);
  }
  .hint-badge.gap:hover {
    background: rgba(155, 77, 202, 0.12);
    border-color: rgba(155, 77, 202, 0.24);
  }
  .hint-badge.post-search {
    color: var(--p-kofa-accent);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
  }
  .hint-badge.post-search:hover {
    background: rgba(139, 105, 20, 0.08);
    border-color: rgba(139, 105, 20, 0.3);
  }

  /* ── Navigation links ── */
  .link-btn {
    all: unset;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    display: inline-flex;
    padding: 4px 0;
  }
  .link-btn:hover {
    color: var(--p-ink);
  }
  .link-btn::after {
    content: ' →';
  }

  /* ── Synthesis section ── */
  .synth-done {
    font-size: 11px;
    font-weight: 500;
    color: var(--p-success);
    margin-bottom: 4px;
  }
  .synth-active {
    font-size: 11px;
    color: var(--p-kofa-accent);
    margin-bottom: 4px;
  }
  .qa-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--p-border);
  }
  .qa-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink4);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .qa-flags {
    font-size: 10px;
    font-weight: 500;
    color: var(--p-warn);
  }
  .qa-ok {
    font-size: 10px;
    font-weight: 500;
    color: var(--p-success);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--p-ink4);
  }

  /* ── Cost ── */
  .cost-display {
    margin-top: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    padding: 8px 12px;
    border-top: 1px solid var(--p-border);
  }
</style>
