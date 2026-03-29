<script lang="ts">
  import { Sparkles, ChevronDown, Check, Star } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import type { Screening } from '$lib/mockup/data/lesevisning';

  let {
    screening,
    open = $bindable(true),
    onScrollToQuote,
  }: {
    screening: Screening;
    open?: boolean;
    onScrollToQuote?: (p: number) => void;
  } = $props();
</script>

<div class="screening-layer">
  <button class="screening-header" onclick={() => (open = !open)}>
    <div class="screening-header-left">
      <Sparkles size={14} color="var(--ai-accent)" />
      <span class="screening-label">KI-screening</span>
      <span class="screening-cat">— Kategori {screening.category}</span>
      {#if screening.star}
        <Star size={12} color="var(--gold-star)" fill="currentColor" />
      {/if}
    </div>
    <ChevronDown
      size={14}
      color="var(--ai-accent)"
      style="transform: rotate({open ? '0' : '-90'}deg); transition: transform 0.15s"
    />
  </button>

  {#if open}
    <div class="screening-body" transition:slide={{ duration: 150 }}>
      <div class="relevance-reasoning">{screening.relevance_reasoning}</div>

      <div class="screening-sections">
        <div class="screening-section">
          <span class="section-label">Faktum</span>
          <p class="section-text tertiary">{screening.factum}</p>
        </div>
        <div class="screening-section">
          <span class="section-label">Vurdering</span>
          <p class="section-text">{screening.assessment}</p>
        </div>
      </div>

      <div class="proposition">
        <span class="section-label ai">Foreslått rettssetning</span>
        <p class="proposition-text">{screening.proposition}</p>
      </div>

      <div class="quotes-section">
        <span class="section-label">Nøkkelsitater</span>
        <div class="quotes-list">
          {#each screening.quotes as q}
            <button class="quote-row" onclick={() => onScrollToQuote?.(q.p)}>
              <span class="quote-para">§{q.p}</span>
              <p class="quote-text">«{q.text}»</p>
            </button>
          {/each}
        </div>
      </div>

      <div class="screening-actions">
        <button class="action-btn ai"><Check size={12} /> Godkjenn kategori</button>
        <button class="action-btn">Endre</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .screening-layer {
    border: 1px solid var(--ai-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .screening-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--ai-bg);
    border: none;
    color: inherit;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .screening-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .screening-label {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    color: var(--ai-accent);
  }

  .screening-cat {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-tertiary);
  }

  .screening-body {
    padding: 16px 20px 20px;
    border-top: 1px solid var(--ai-border);
  }

  .relevance-reasoning {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ai-accent);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .screening-sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .section-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    display: block;
    margin-bottom: 4px;
  }

  .section-label.ai {
    color: var(--ai-accent);
  }

  .section-text {
    font-family: var(--font-serif);
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink);
  }

  .section-text.tertiary {
    color: var(--ink-tertiary);
  }

  .proposition {
    border-left: 2px solid var(--ai-accent);
    padding-left: 16px;
    margin-bottom: 20px;
  }

  .proposition-text {
    font-family: var(--font-serif);
    font-size: 16px;
    font-style: italic;
    line-height: 1.55;
    color: var(--ai-accent);
  }

  .quotes-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .quote-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 6px 8px;
    background: var(--paper-dark);
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    transition: border-color 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .quote-row:hover {
    border-color: var(--border-strong);
  }

  .quote-para {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ai-accent);
    flex-shrink: 0;
  }

  .quote-text {
    font-family: var(--font-serif);
    font-size: 13px;
    font-style: italic;
    color: var(--ink-secondary);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .screening-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }
</style>
