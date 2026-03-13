<script lang="ts">
  import { createCaseDetailQuery } from '$lib/queries/cases';
  import type { Curation, Highlight, CrossReference } from '$lib/types/curation';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { toastState } from '$lib/stores/toast.svelte';

  let {
    sakNr,
    onBack,
    curation = null,
    curationLoading = false,
  }: {
    sakNr: string;
    onBack: () => void;
    curation?: Curation | null;
    curationLoading?: boolean;
  } = $props();

  const caseQuery = createCaseDetailQuery(() => sakNr);

  // Build highlight lookup by paragraph number
  let highlightMap = $derived(new Map((curation?.highlights ?? []).map((h) => [h.paragraph, h])));

  // Highlighted paragraph numbers for pills
  let highlightedParagraphs = $derived(
    (curation?.highlights ?? []).map((h) => h.paragraph).sort((a, b) => a - b)
  );

  // Show/hide toggle for non-highlighted paragraphs
  // Default to curated mode when AI curation exists, otherwise show all
  let hasCuration = $derived(highlightedParagraphs.length > 0);
  let showAllText = $state(false);

  // Track individually expanded (clicked) dimmed paragraphs
  let expandedParagraphs = $state(new Set<number>());

  // When curation status changes, reset to appropriate default
  let prevHasCuration = false;
  $effect(() => {
    if (hasCuration !== prevHasCuration) {
      prevHasCuration = hasCuration;
      showAllText = !hasCuration;
      expandedParagraphs = new Set();
    }
  });

  function expandParagraph(paragraphNumber: number) {
    const next = new Set(expandedParagraphs);
    next.add(paragraphNumber);
    expandedParagraphs = next;
  }

  // Apply char-offset highlights to a paragraph's text
  function applyHighlight(
    text: string,
    hl: Highlight
  ): Array<{ text: string; highlighted: boolean }> {
    const start = Math.max(0, Math.min(hl.start_char, text.length));
    const end = Math.max(start, Math.min(hl.end_char, text.length));
    if (start === end) return [{ text, highlighted: false }];

    const segments: Array<{ text: string; highlighted: boolean }> = [];
    if (start > 0) segments.push({ text: text.slice(0, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    if (end < text.length) segments.push({ text: text.slice(end), highlighted: false });
    return segments;
  }

  function scrollToParagraph(num: number) {
    const el = document.getElementById(`para-${num}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Handle cross-ref scroll target from another case's navigateTo
  $effect(() => {
    if (uiState.scrollToTarget !== null && caseQuery.data) {
      const target = uiState.scrollToTarget;
      uiState.clearScrollTarget();
      requestAnimationFrame(() => scrollToParagraph(target));
    }
  });

  function navigateTo(ref: CrossReference) {
    const targetNode = analysisState.nodes.find(
      (n) => n.label === ref.target_case || n.id.includes(ref.target_case)
    );
    if (targetNode) {
      uiState.navigateTo(targetNode.id);
      uiState.scrollToTarget = ref.target_paragraph;
    } else {
      toastState.show(`Saken ${ref.target_case} er ikke i analysen`, 'info');
    }
  }
</script>

<div class="case-reader">
  <button class="back-btn" onclick={onBack}>← Tilbake til oversikt</button>

  {#if caseQuery.isLoading}
    <p class="loading">Laster avgjørelse...</p>
  {:else if caseQuery.error}
    <p class="error">Kunne ikke laste avgjørelse.</p>
  {:else if caseQuery.data}
    {@const detail = caseQuery.data}

    <div class="case-meta">
      <h2 class="case-title">{detail.sak_nr}</h2>
      {#if detail.saken_gjelder}<p class="case-subject">{detail.saken_gjelder}</p>{/if}
      <div class="case-meta-row">
        {#if detail.avsluttet}<span>{detail.avsluttet}</span>{/if}
        {#if detail.avgjoerelse}
          <span class="verdict">{detail.avgjoerelse}</span>
        {/if}
      </div>
      {#if detail.innklaget || detail.klager}
        <div class="case-parties">
          {#if detail.klager}<span>Klager: {detail.klager}</span>{/if}
          {#if detail.innklaget}<span>Innklaget: {detail.innklaget}</span>{/if}
        </div>
      {/if}
    </div>

    <!-- Paragraph navigation pills -->
    {#if highlightedParagraphs.length > 0}
      <div class="pill-bar">
        <span class="pills-label">Markerte avsnitt:</span>
        {#each highlightedParagraphs as num}
          <button class="pill" onclick={() => scrollToParagraph(num)}>§{num}</button>
        {/each}
        <button
          class="text-toggle"
          onclick={() => {
            showAllText = !showAllText;
            expandedParagraphs = new Set();
          }}
        >
          {showAllText ? 'Vis bare markerte' : 'Vis all tekst'}
        </button>
      </div>
    {:else if curationLoading}
      <div class="pill-bar shimmer">
        <span class="pills-label">AI-kuratering laster...</span>
      </div>
    {/if}

    <div class="paragraphs" class:curation-loading={curationLoading && !curation}>
      {#each detail.paragraphs as para}
        {@const hl = highlightMap.get(para.paragraph_number)}
        {@const isHighlighted = !!hl}
        {@const isExpanded = expandedParagraphs.has(para.paragraph_number)}
        {@const isDimmed = !showAllText && !isHighlighted && !isExpanded && hasCuration}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="paragraph"
          class:has-highlight={isHighlighted}
          class:dimmed={isDimmed}
          id="para-{para.paragraph_number}"
          onclick={() => {
            if (isDimmed) expandParagraph(para.paragraph_number);
          }}
          onkeydown={(e) => {
            if (isDimmed && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              expandParagraph(para.paragraph_number);
            }
          }}
          role={isDimmed ? 'button' : undefined}
          tabindex={isDimmed ? 0 : undefined}
        >
          <span class="para-num">{para.paragraph_number}</span>
          <div class="para-content">
            {#if hl}
              {@const segments = applyHighlight(para.text, hl)}
              <p class="para-text">
                {#each segments as seg}
                  {#if seg.highlighted}
                    <mark class="ai-highlight">{seg.text}</mark>
                  {:else}
                    {seg.text}
                  {/if}
                {/each}
              </p>
            {:else}
              <p class="para-text">{para.text}</p>
            {/if}

            <!-- AI comment block after highlighted paragraph -->
            {#if hl}
              <div class="ai-comment" class:fade-in={!curationLoading}>
                {#if hl.relevance}
                  <p class="ai-relevance">{hl.relevance}</p>
                {/if}
                {#each hl.cross_references as ref}
                  <div class="ai-crossref-row">
                    <button class="ai-crossref" onclick={() => navigateTo(ref)}>
                      → Gå til {ref.target_case} §{ref.target_paragraph}
                    </button>
                    {#if ref.note}
                      <p class="ai-crossref-note">{ref.note}</p>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if detail.law_references.length > 0}
      <div class="references-section">
        <h3 class="ref-title">Lovhenvisninger ({detail.law_references.length})</h3>
        {#each detail.law_references as ref}
          <div class="ref-item">
            <span class="ref-label mono">{ref.law_name} §{ref.law_section}</span>
            {#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if detail.case_references.length > 0}
      <div class="references-section">
        <h3 class="ref-title">Sakshenvisninger ({detail.case_references.length})</h3>
        {#each detail.case_references as ref}
          <div class="ref-item">
            <span class="ref-label mono">{ref.to_sak_nr}</span>
            {#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if detail.eu_references.length > 0}
      <div class="references-section">
        <h3 class="ref-title">EU-referanser ({detail.eu_references.length})</h3>
        {#each detail.eu_references as ref}
          <div class="ref-item">
            <span class="ref-label">{ref.eu_case_name || ref.eu_case_id}</span>
            {#if ref.context}<p class="ref-context">{ref.context}</p>{/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .case-reader {
    padding: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }
  .back-btn {
    all: unset;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--p-kofa-accent);
    font-weight: 500;
  }
  .back-btn:hover {
    text-decoration: underline;
  }
  .loading,
  .error {
    font-size: 0.8125rem;
    color: var(--p-ink3);
  }
  .case-meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding-bottom: var(--spacing-3);
    border-bottom: 1px solid var(--p-border);
  }
  .case-title {
    font-family: var(--font-data);
    font-size: 1rem;
    font-weight: 600;
  }
  .case-subject {
    font-size: 0.8125rem;
    color: var(--p-ink2);
  }
  .case-meta-row {
    display: flex;
    gap: var(--spacing-2);
    font-size: 0.75rem;
    color: var(--p-ink3);
  }
  .verdict {
    font-weight: 500;
  }
  .case-parties {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
    color: var(--p-ink3);
  }

  /* Paragraph navigation pills */
  .pill-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 0;
    border-bottom: 1px solid var(--p-border);
    position: sticky;
    top: 0;
    background: var(--p-panel);
    z-index: 1;
  }
  .pill-bar.shimmer {
    opacity: 0.5;
  }
  .pills-label {
    font-size: 0.6875rem;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .pill {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--p-highlight);
    color: var(--p-ai-border);
    border: 1px solid var(--p-highlight-strong);
  }
  .pill:hover {
    background: var(--p-highlight-strong);
  }
  .text-toggle {
    all: unset;
    cursor: pointer;
    font-size: 0.6875rem;
    color: var(--p-ink4);
    margin-left: auto;
  }
  .text-toggle:hover {
    color: var(--p-ink2);
  }

  /* Paragraph layout */
  .paragraphs {
    display: flex;
    flex-direction: column;
  }
  .paragraph {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-1) 0;
    transition: opacity 0.2s ease;
  }
  .paragraph.has-highlight {
    border-left: 2px solid var(--p-highlight-strong);
    padding-left: 10px;
  }
  .paragraph.dimmed {
    opacity: 0.5;
    cursor: pointer;
  }
  .paragraph.dimmed:hover {
    opacity: 0.7;
  }
  .para-num {
    font-family: var(--font-data);
    font-size: 0.6875rem;
    color: var(--p-ink4);
    min-width: 28px;
    text-align: right;
    user-select: none;
    padding-top: 2px;
    flex-shrink: 0;
  }
  .para-content {
    flex: 1;
    min-width: 0;
  }
  .para-text {
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--p-ink);
  }

  /* AI highlight */
  .ai-highlight {
    background: var(--p-highlight);
    padding: 1px 2px;
    border-radius: 2px;
  }

  /* AI comment — trust boundary: gold-brown left border */
  .ai-comment {
    border-left: 3px solid var(--p-ai-border);
    background: var(--p-ai-bg);
    padding: 8px 12px;
    margin: 6px 0 8px;
    border-radius: 0 4px 4px 0;
  }
  .ai-comment.fade-in {
    animation: fadeIn 0.3s ease;
  }
  .ai-relevance {
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--p-ai-text);
  }
  .ai-crossref-row {
    margin-top: 4px;
  }
  .ai-crossref {
    all: unset;
    cursor: pointer;
    color: var(--p-ai-border);
    font-weight: 500;
    font-size: 0.75rem;
  }
  .ai-crossref:hover {
    text-decoration: underline;
  }
  .ai-crossref-note {
    font-size: 0.75rem;
    color: var(--p-ai-text);
    margin-top: 2px;
  }

  /* Pulsating border during AI curation loading */
  .curation-loading {
    border-left: 3px solid var(--p-ai-border);
    padding-left: var(--spacing-3);
    animation: pulseCuration 2s ease-in-out infinite;
  }

  @keyframes pulseCuration {
    0%,
    100% {
      border-left-color: rgba(180, 140, 80, 0.12);
    }
    50% {
      border-left-color: rgba(180, 140, 80, 0.6);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* References */
  .references-section {
    border-top: 1px solid var(--p-border);
    padding-top: var(--spacing-3);
  }
  .ref-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--p-ink2);
    margin-bottom: var(--spacing-2);
  }
  .ref-item {
    padding: var(--spacing-1) 0;
    border-bottom: 1px solid var(--p-border);
  }
  .ref-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--p-ink);
  }
  .mono {
    font-family: var(--font-data);
  }
  .ref-context {
    font-size: 0.75rem;
    color: var(--p-ink3);
    margin-top: 2px;
  }
</style>
