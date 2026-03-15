<script lang="ts">
  import type { ScreeningResult } from '$lib/types/analysis';

  let {
    result,
    onRescreen,
  }: {
    result: ScreeningResult;
    onRescreen?: () => void;
  } = $props();
</script>

<div class="screening-card">
  <div class="card-header">
    <span class="ai-badge">AI</span>
    <span class="ai-label">Screening</span>
    {#if result.star}
      <span class="star-badge">★ Gullkandidat</span>
    {/if}
    <span class="spacer"></span>
    <span class="relevance">
      Relevans: <strong>{result.relevance}</strong> — {result.relevance_reasoning}
    </span>
  </div>

  <!-- Rettssetning — most important output -->
  <div class="proposition-block">
    <div class="proposition-label">Rettssetning</div>
    <div class="proposition-text">{result.proposition}</div>
  </div>

  <!-- Faktum + Vurdering -->
  <div class="text-block">
    <strong>Faktum:</strong>
    {result.factum}
  </div>
  <div class="text-block">
    <strong>Vurdering:</strong>
    {result.assessment}
  </div>

  <!-- Nøkkelsitater — expandable -->
  {#if result.quotes && result.quotes.length > 0}
    <details class="quotes-details">
      <summary class="quotes-summary">
        Nøkkelsitater ({result.quotes.length})
      </summary>
      <div class="quotes-list">
        {#each result.quotes as q}
          <div class="quote-item">
            <span class="quote-p">§{q.p}</span>
            {q.text}
          </div>
        {/each}
      </div>
    </details>
  {/if}

  <!-- Nyanser — expandable -->
  {#if result.nuances}
    <details class="nuances-details">
      <summary class="nuances-summary"> Nyanser og forbehold </summary>
      <div class="nuances-text">{result.nuances}</div>
    </details>
  {/if}

  <!-- Actions -->
  <div class="card-actions">
    {#if onRescreen}
      <button class="action-btn" onclick={onRescreen}> Re-screen med mer kontekst </button>
    {/if}
  </div>
</div>

<style>
  .screening-card {
    margin-top: 6px;
    padding: 12px 14px;
    border-radius: 5px;
    border-left: 3px solid var(--p-ai-border);
    background: rgba(139, 105, 20, 0.03);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .ai-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border);
    color: var(--p-kofa);
  }
  .ai-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-kofa);
  }
  .star-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-warn);
  }
  .spacer {
    flex: 1;
  }
  .relevance {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .relevance strong {
    color: var(--p-ink);
  }

  /* Rettssetning */
  .proposition-block {
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 10px;
    background: var(--p-highlight);
    border-left: 2px solid var(--p-kofa-bg, rgba(139, 105, 20, 0.15));
  }
  .proposition-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-kofa);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .proposition-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--p-ink);
    font-weight: 500;
  }

  /* Text blocks */
  .text-block {
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink2);
    margin-bottom: 4px;
  }
  .text-block strong {
    color: var(--p-ink);
    font-weight: 600;
  }

  /* Quotes */
  .quotes-details {
    margin-top: 6px;
    margin-bottom: 6px;
  }
  .quotes-summary {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink3);
    cursor: pointer;
    padding: 4px 0;
    user-select: none;
  }
  .quotes-list {
    padding-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .quote-item {
    padding: 6px 10px;
    border-radius: 4px;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink);
  }
  .quote-p {
    font-family: var(--font-data);
    font-size: 10px;
    font-weight: 600;
    color: var(--p-kofa);
    margin-right: 6px;
    cursor: pointer;
  }

  /* Nuances */
  .nuances-details {
    margin-bottom: 6px;
  }
  .nuances-summary {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink3);
    cursor: pointer;
    padding: 4px 0;
    user-select: none;
  }
  .nuances-text {
    padding-top: 4px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink2);
    font-style: italic;
  }

  /* Actions */
  .card-actions {
    margin-top: 8px;
    display: flex;
    gap: 6px;
  }
  .action-btn {
    all: unset;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    background: transparent;
    border: 1px solid var(--p-border-m);
    color: var(--p-ink2);
    cursor: pointer;
  }
  .action-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink);
  }
</style>
