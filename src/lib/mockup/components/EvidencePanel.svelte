<script lang="ts">
  import {
    X,
    BookOpen,
    Scale,
    Link2,
    Sparkles,
    Star,
    AlertTriangle,
    ChevronDown,
  } from 'lucide-svelte';
  import EvolutionTag from './EvolutionTag.svelte';
  import type { Rettssetning } from '$lib/mockup/data/rettssetninger';

  let {
    rule,
    allRules = [],
    onClose,
    onNavigateToRule,
  }: {
    rule: Rettssetning;
    allRules: Rettssetning[];
    onClose: () => void;
    onNavigateToRule?: (id: string) => void;
  } = $props();

  let copiedQuoteId = $state<string | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  let showLineage = $state<Record<string, boolean>>({});
  let showBoundary = $state(false);

  // Reset collapse state when switching between rules
  const ruleId = $derived(rule.id);
  $effect(() => {
    // Subscribe to ruleId changes
    ruleId;
    showLineage = {};
    showBoundary = false;
  });

  const tensionRule = $derived(
    rule.tension ? (allRules.find((r) => r.id === rule.tension!.withId) ?? null) : null
  );

  function handleCopyQuote(text: string, id: string) {
    navigator.clipboard?.writeText(text).then(() => {
      copiedQuoteId = id;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedQuoteId = null), 2000);
    });
  }

  function toggleLineage(ref: string) {
    showLineage = { ...showLineage, [ref]: !showLineage[ref] };
  }

  function navigateToTension() {
    if (tensionRule && onNavigateToRule) {
      showBoundary = false;
      showLineage = {};
      onNavigateToRule(tensionRule.id);
    }
  }
</script>

<aside class="evidence-panel">
  <header class="panel-header">
    <div class="panel-header-content">
      <div class="panel-label">
        <BookOpen size={11} />
        Bevisgrunnlag
      </div>
      <h2 class="panel-proposition" class:ai={rule.isAiGenerated}>
        {rule.proposition}
      </h2>
    </div>
    <button class="close-btn" onclick={onClose} title="Lukk">
      <X size={16} />
    </button>
  </header>

  <div class="panel-body">
    <!-- Tension block -->
    {#if rule.tension && tensionRule}
      <div class="tension-block">
        <div class="tension-header">
          <Scale size={14} />
          <span class="tension-label">Spenning</span>
        </div>
        <p class="tension-note">{rule.tension.note}</p>
        <button class="tension-link" onclick={navigateToTension}>
          <Link2 size={11} />
          Gå til: {tensionRule.topic}
        </button>
      </div>
    {/if}

    <!-- Timeline -->
    <div class="timeline">
      {#each rule.cases as c, idx}
        {@const isLast = idx === rule.cases.length - 1}
        {@const lineageOpen = showLineage[c.ref] ?? false}

        <div class="timeline-entry" class:last={isLast}>
          <!-- Timeline dot -->
          <div class="timeline-dot {c.evolution}"></div>

          <!-- Case header -->
          <div class="case-header">
            <span class="case-ref">{c.ref}</span>
            {#if c.paragraphs}
              <span class="case-para">{c.paragraphs}</span>
            {/if}
            <EvolutionTag evolution={c.evolution} />
            <span class="regulation-tag">{c.regulation}</span>
            {#if c.suggested}
              <span title="KI-tolket kobling"><Sparkles size={11} color="var(--ai-accent)" /></span>
            {/if}
            <span class="case-year">{c.year}</span>
            {#if c.star}
              <Star size={11} color="var(--gold-star)" fill="currentColor" />
            {/if}
          </div>

          <!-- Factum + Assessment -->
          <div class="case-content">
            <p class="factum">{c.factum}</p>
            <p class="assessment">{c.assessment}</p>
          </div>

          <!-- Quotes -->
          {#if c.quotes.length > 0}
            <div class="quotes">
              {#each c.quotes as q, qIdx}
                {@const quoteId = `${c.ref}-${qIdx}`}
                {@const isCopied = copiedQuoteId === quoteId}
                <div class="quote-block">
                  <p class="quote-text">&laquo;{q.text}&raquo;</p>
                  <div class="quote-footer">
                    <span class="quote-ref">[Avsnitt {q.p}]</span>
                    <button
                      class="copy-btn"
                      class:copied={isCopied}
                      onclick={() => handleCopyQuote(q.text, quoteId)}
                    >
                      {isCopied ? '\u2713 Kopiert' : 'Kopier'}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Nuances -->
          {#if c.nuances}
            <div class="nuance-block">
              <AlertTriangle size={13} color="var(--nuance-color)" />
              <div>
                <span class="nuance-label">Unntak</span>
                <p class="nuance-text">{c.nuances}</p>
              </div>
            </div>
          {/if}

          <!-- Lineage -->
          <button class="lineage-toggle" onclick={() => toggleLineage(c.ref)}>
            <ChevronDown size={10} class={lineageOpen ? '' : 'rotated'} />
            Opprinnelig screening-proposisjon
          </button>
          {#if lineageOpen}
            <div class="lineage-content">
              <div class="lineage-header">
                <Sparkles size={10} color="var(--ai-accent)" />
                <span>KI-screening</span>
              </div>
              <p class="lineage-text">{c.screeningProposition}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Boundary notes -->
    {#if rule.boundaryNotes.length > 0}
      <div class="boundary-section">
        <button class="collapse-toggle" onclick={() => (showBoundary = !showBoundary)}>
          <ChevronDown size={11} class={showBoundary ? '' : 'rotated'} />
          Avgrensning ({rule.boundaryNotes.length})
        </button>
        {#if showBoundary}
          <div class="boundary-list">
            {#each rule.boundaryNotes as bn}
              <div class="boundary-item">
                <span class="boundary-ref">{bn.caseId}</span>
                <p class="boundary-note">{bn.note}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="panel-footer">
      <button class="text-link">+ Knytt flere saker til tidslinjen</button>
    </div>
  </div>
</aside>

<style>
  .evidence-panel {
    width: 460px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }

  /* Header */
  .panel-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 16px;
  }

  .panel-header-content {
    flex: 1;
    min-width: 0;
  }

  .panel-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .panel-proposition {
    font-family: var(--font-serif);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.45;
    color: var(--ink);
  }

  .panel-proposition.ai {
    font-style: italic;
    color: var(--ai-accent);
  }

  .close-btn {
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: var(--ink);
  }

  /* Body */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 24px 48px;
  }

  /* Tension */
  .tension-block {
    border: 1px solid var(--tension-border);
    background: var(--tension-bg);
    padding: 16px;
    border-radius: 4px;
    margin-bottom: 24px;
  }

  .tension-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    color: var(--tension-color);
  }

  .tension-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tension-color);
  }

  .tension-note {
    font-family: var(--font-serif);
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-secondary);
    margin-bottom: 8px;
  }

  .tension-link {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--tension-color);
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    transition: opacity 0.15s ease;
  }

  .tension-link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Timeline */
  .timeline {
    position: relative;
    border-left: 1px solid var(--border);
    margin-left: 4px;
  }

  .timeline-entry {
    position: relative;
    padding-left: 28px;
    padding-bottom: 40px;
  }

  .timeline-entry.last {
    padding-bottom: 0;
  }

  /* Timeline dots — evolution-differentiated */
  .timeline-dot {
    position: absolute;
    left: -5px;
    top: 4px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--paper);
  }

  .timeline-dot.established {
    border: 2.5px solid var(--ink);
  }

  .timeline-dot.confirmed {
    border: 2px solid var(--confirm-color);
  }

  .timeline-dot.qualified {
    border: 2px dashed var(--qualified-color);
  }

  .timeline-dot.consolidating {
    border: 2px solid var(--ink-muted);
  }

  /* Case header */
  .case-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .case-ref {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .case-para {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-tertiary);
  }

  .regulation-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    border: 1px solid var(--border);
    padding: 0 4px;
    border-radius: 2px;
  }

  .case-year {
    font-family: var(--font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    margin-left: auto;
  }

  /* Case content */
  .case-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .factum {
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink-tertiary);
  }

  .assessment {
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink);
    font-weight: 600;
  }

  /* Quotes */
  .quotes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .quote-block {
    background: var(--paper-dark);
    padding: 16px 20px;
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .quote-text {
    font-family: var(--font-serif);
    font-size: 15px;
    font-style: italic;
    color: var(--ink-secondary);
    line-height: 1.65;
  }

  .quote-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .quote-ref {
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
  }

  .copy-btn {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-muted);
    opacity: 0;
    transition: all 0.15s ease;
  }

  .quote-block:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    color: var(--ink);
  }

  .copy-btn.copied {
    color: var(--confirm-color);
    opacity: 1;
  }

  /* Nuance */
  .nuance-block {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 4px;
    margin-bottom: 8px;
  }

  .nuance-block :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }

  .nuance-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--nuance-color);
    display: block;
    margin-bottom: 4px;
  }

  .nuance-text {
    font-family: var(--font-serif);
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-secondary);
  }

  /* Lineage */
  .lineage-toggle {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    margin-top: 4px;
    transition: color 0.15s ease;
  }

  .lineage-toggle:hover {
    color: var(--ink-tertiary);
  }

  .lineage-toggle :global(.rotated) {
    transform: rotate(-90deg);
  }

  .lineage-toggle :global(svg) {
    transition: transform 0.15s ease;
  }

  .lineage-content {
    border-left: 2px solid var(--ai-border);
    padding-left: 12px;
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .lineage-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ai-accent);
    font-weight: 500;
  }

  .lineage-text {
    font-family: var(--font-serif);
    font-size: 14px;
    font-style: italic;
    color: var(--ink-tertiary);
    line-height: 1.5;
  }

  /* Boundary */
  .boundary-section {
    margin-top: 24px;
    border-top: 1px solid var(--border-subtle);
    padding-top: 12px;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 0;
    transition: color 0.15s ease;
    width: 100%;
  }

  .collapse-toggle:hover {
    color: var(--ink-tertiary);
  }

  .collapse-toggle :global(.rotated) {
    transform: rotate(-90deg);
  }

  .collapse-toggle :global(svg) {
    transition: transform 0.15s ease;
  }

  .boundary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-left: 16px;
  }

  .boundary-item {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .boundary-ref {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink-tertiary);
    flex-shrink: 0;
  }

  .boundary-note {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-tertiary);
    line-height: 1.45;
  }

  /* Footer */
  .panel-footer {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
  }

  .text-link {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
    padding: 4px 0;
  }

  .text-link:hover {
    color: var(--ink);
  }
</style>
