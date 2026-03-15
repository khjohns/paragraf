<script lang="ts">
  import { NODE_TYPE_ACCENT, type GraphNode } from '$lib/types/graph';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { rescreenCase } from '$lib/api/analyses';
  import NodeTypeIcon from './NodeTypeIcon.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import DelimBadge from './DelimBadge.svelte';
  import ValencePip from './ValencePip.svelte';
  import ScreeningResultCard from './ScreeningResultCard.svelte';

  let { node, dimmed = false }: { node: GraphNode; dimmed?: boolean } = $props();

  let isSelected = $derived(uiState.selectedNodeId === node.id);
  let isRead = $derived(!!analysisState.analysis.readStatus[node.id]);
  let screeningStatus = $derived(analysisState.screeningStatus[node.id]);
  let isDelimitation = $derived(
    node.isDelimitation || !!analysisState.analysis.delimitations[node.id]
  );
  let isRegDimmed = $derived(uiState.regulationFilter && node.regulation === 'old');
  let isDimmed = $derived(dimmed || isRegDimmed);

  let accent = $derived(NODE_TYPE_ACCENT[node.type]);
  let isCase = $derived(node.type === 'kofa_case');
  let sakNr = $derived(node.label);
  let screeningResult = $derived(isCase ? analysisState.screeningResults[sakNr] : undefined);
  let isStreaming = $derived(analysisState.streamingSakNr === sakNr);
  let assignment = $derived(isCase ? analysisState.getAssignment(sakNr, node.category) : undefined);
  let showScreening = $derived(analysisState.isScreeningPhase);
  let expanded = $state(false);

  let rowEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (isSelected && rowEl) {
      rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  let valenceEntries = $derived(
    node.valence ? Object.entries(node.valence).filter(([_, v]) => v !== 'unknown') : []
  );

  function handleCheckbox(e: Event) {
    e.stopPropagation();
    analysisState.toggleRead(node.id);
  }

  function handleCheckboxKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      analysisState.toggleRead(node.id);
    }
  }

  function handleAssign(e: Event, value: 'claude' | 'me') {
    e.stopPropagation();
    analysisState.setAssignment(sakNr, node.category, value);
  }

  async function handleRescreen() {
    try {
      const result = await rescreenCase(analysisState.analysis.id, sakNr);
      analysisState.addScreeningResult(result);
    } catch (err) {
      console.error('Re-screen failed:', err);
    }
  }

  let nodeLabelMap = $derived(new Map(analysisState.nodes.map((n) => [n.id, n.label])));

  function getTargetLabel(targetId: string): string {
    return nodeLabelMap.get(targetId) ?? targetId;
  }
</script>

<div class="node-row-wrapper" class:streaming={isStreaming}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    bind:this={rowEl}
    class="node-row"
    class:selected={isSelected}
    class:dimmed={isDimmed}
    style:border-left-color={isSelected ? accent : 'transparent'}
    onclick={() => {
      uiState.selectNode(node.id);
      if (screeningResult) expanded = !expanded;
    }}
    title={isDimmed ? 'Utenfor aktivt filter' : undefined}
  >
    <div class="row-main">
      <!-- Assignment toggle (cases only, when screening phase) -->
      {#if isCase && showScreening}
        <div class="assign-toggle" onclick={(e) => e.stopPropagation()}>
          <button
            class="assign-btn assign-ai"
            class:active={assignment === 'claude'}
            title="Claude screener"
            onclick={(e) => handleAssign(e, 'claude')}
          >
            <span class="assign-label">AI</span>
          </button>
          <button
            class="assign-btn assign-me"
            class:active={assignment === 'me'}
            title="Jeg leser"
            onclick={(e) => handleAssign(e, 'me')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="3.5" r="2" stroke="currentColor" stroke-width="1.2" fill="none" />
              <path
                d="M1 9.5C1 7 3 5.5 5 5.5S9 7 9 9.5"
                stroke="currentColor"
                stroke-width="1.2"
                fill="none"
              />
            </svg>
          </button>
        </div>
      {:else}
        <!-- Read checkbox -->
        <div
          class="checkbox"
          class:checked={isRead}
          onclick={handleCheckbox}
          onkeydown={handleCheckboxKeydown}
          role="checkbox"
          aria-checked={isRead}
          tabindex="0"
        >
          {#if isRead}
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 5L4.5 7.5L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              />
            </svg>
          {/if}
        </div>
      {/if}

      <!-- Status indicator (streaming/screened) -->
      {#if isCase && showScreening}
        <span class="status-icon">
          {#if screeningResult}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M3 6L5 8L9 4"
                stroke="var(--p-success)"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              />
            </svg>
          {:else if isStreaming}
            <span class="row-spinner"></span>
          {/if}
        </span>
      {:else}
        <!-- Type icon -->
        <span class="type-icon">
          <NodeTypeIcon type={node.type} size={11} />
        </span>
      {/if}

      <!-- Content -->
      <div class="row-content">
        <div class="row-line1">
          <span class="node-label">{node.label}</span>
          {#if node.category}
            <CategoryBadge category={node.category} small />
          {/if}
          {#if node.signals}
            <span class="signal-dots" title="R: Referanse  F: Fulltekst  V: Vektor">
              <span class="dot" class:on={node.signals.ref} title="R: Referansetabell"></span>
              <span class="dot" class:on={node.signals.fts} title="F: Fulltekstsøk"></span>
              <span class="dot" class:on={node.signals.vec} title="V: Vektorsøk"></span>
            </span>
          {/if}
          {#if isDelimitation}
            <DelimBadge compact />
          {/if}
          {#if node.iteration > 1}
            <span class="iter-badge">iter. {node.iteration}</span>
          {/if}
          {#if screeningStatus === 'ai_screened' || screeningStatus === 'both'}
            <span class="screening-badge">Screenet</span>
          {/if}
          {#if screeningStatus === 'user_read' || screeningStatus === 'both'}
            <span class="screening-read">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M2 5L4.5 7.5L8 3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
            </span>
          {/if}
          {#if screeningResult?.star}
            <span class="star-marker">★</span>
          {/if}
          <span class="subtitle">{node.subtitle}</span>
        </div>
        {#if node.date || node.outcome || node.citations > 0 || node.directive || valenceEntries.length > 0}
          <div class="row-line2">
            {#if node.date}<span>{node.date}</span>{/if}
            {#if node.outcome}
              <span
                class="outcome-badge"
                class:brudd={node.outcome === 'Brudd'}
                class:ikke-brudd={node.outcome === 'Ikke brudd'}>{node.outcome}</span
              >
            {/if}
            {#if node.citations > 0}
              <span class="citations">{node.citations} sit.</span>
            {/if}
            {#if node.directive}
              <span class="directive">{node.directive}</span>
            {/if}
            {#each valenceEntries as [targetId, val]}
              <span class="valence-ref">
                <ValencePip valence={val} size={9} />
                <span class="valence-label">{getTargetLabel(targetId)}</span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Expanded screening result -->
  {#if expanded && screeningResult}
    <div class="screening-expanded">
      <ScreeningResultCard result={screeningResult} onRescreen={handleRescreen} />
    </div>
  {/if}
</div>

<style>
  .node-row-wrapper {
    border-bottom: 1px solid var(--p-border);
    transition: background 0.3s ease;
  }
  .node-row-wrapper.streaming {
    background: var(--p-highlight);
  }

  .node-row {
    all: unset;
    cursor: pointer;
    display: flex;
    width: 100%;
    padding: 11px 16px;
    border-left: 3px solid transparent;
    transition: background 0.12s ease;
    box-sizing: border-box;
  }
  .node-row:hover {
    background: var(--p-hover);
  }
  .node-row.selected {
    background: var(--p-active);
  }
  .node-row.dimmed {
    opacity: 0.2;
  }

  .row-main {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
  }

  .checkbox {
    width: 15px;
    height: 15px;
    min-width: 15px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--p-border-s);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }
  .checkbox.checked {
    background: var(--p-success-bg);
    border-color: var(--p-success);
    color: var(--p-success);
  }
  .checkbox:hover {
    border-color: var(--p-ink3);
  }

  .type-icon {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .row-content {
    flex: 1;
    min-width: 0;
  }

  .row-line1 {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    overflow: hidden;
  }
  .node-label {
    font-family: var(--font-data);
    font-weight: 600;
    font-size: 13px;
    color: var(--p-ink);
    flex-shrink: 0;
  }

  .signal-dots {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: transparent;
    border: 1.5px solid var(--p-signal-off);
  }
  .dot.on {
    background: var(--p-signal-on);
    border-color: var(--p-signal-on);
  }

  .iter-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-success);
    background: var(--p-success-bg);
    padding: 1px 5px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .screening-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--p-highlight, #fbf5e8);
    border: 1px solid var(--p-ai-border);
    color: var(--p-kofa, #8b6914);
    flex-shrink: 0;
  }
  .screening-read {
    color: var(--p-success);
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
  }

  .subtitle {
    font-size: 12px;
    color: var(--p-ink2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .row-line2 {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--p-ink3);
    margin-top: 3px;
    flex-wrap: wrap;
  }

  .outcome-badge {
    font-weight: 600;
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    font-size: 10px;
  }
  .outcome-badge.brudd {
    background: var(--p-warn-bg);
    color: var(--p-warn);
  }
  .outcome-badge.ikke-brudd {
    background: var(--p-success-bg);
    color: var(--p-success);
  }

  .citations {
    font-family: var(--font-data);
  }

  .directive {
    font-style: italic;
    color: var(--p-eu-accent);
  }

  .valence-ref {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .valence-label {
    font-family: var(--font-data);
    font-size: 10px;
  }

  /* Assignment toggle */
  .assign-toggle {
    display: flex;
    gap: 0;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .assign-btn {
    all: unset;
    width: 24px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid var(--p-border-m);
    transition: all 0.1s ease;
  }
  .assign-btn.assign-ai {
    border-radius: 3px 0 0 3px;
    border-right: none;
  }
  .assign-btn.assign-me {
    border-radius: 0 3px 3px 0;
  }
  .assign-btn.assign-ai.active {
    background: var(--p-highlight);
    border-color: var(--p-ai-border);
  }
  .assign-btn.assign-me.active {
    background: var(--p-success-bg);
    border-color: var(--p-success);
    color: var(--p-success);
  }
  .assign-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--p-ink4);
  }
  .assign-btn.assign-ai.active .assign-label {
    color: var(--p-kofa);
  }
  .assign-btn.assign-me {
    color: var(--p-ink4);
  }

  /* Status icon */
  .status-icon {
    width: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 3px;
  }
  .row-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m);
    border-top-color: var(--p-kofa);
    animation: spin 0.8s linear infinite;
  }

  /* Star marker */
  .star-marker {
    font-size: 10px;
    color: var(--p-warn);
    flex-shrink: 0;
  }

  /* Screening expanded */
  .screening-expanded {
    padding: 0 16px 10px 60px;
  }
</style>
