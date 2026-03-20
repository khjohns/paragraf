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
    {@const verifiedCount =
      result.quote_verification?.filter((v) => v.status === 'verified').length ?? 0}
    {@const totalVerified = result.quote_verification?.length ?? 0}
    <details class="quotes-details">
      <summary class="quotes-summary">
        Nøkkelsitater ({result.quotes.length})
        {#if totalVerified > 0}
          <span class="verification-summary">
            — {verifiedCount}/{totalVerified} verifisert
          </span>
        {/if}
      </summary>
      <div class="quotes-list">
        {#each result.quotes as q}
          {@const verification = result.quote_verification?.find((v) => v.paragraph === q.p)}
          <div
            class="quote-item"
            class:truncated={verification?.status === 'truncated'}
            class:inaccurate={verification?.status === 'inaccurate' ||
              verification?.status === 'not_found'}
          >
            <span class="quote-p">§{q.p}</span>
            {#if verification}
              <span
                class="quote-status quote-status-{verification.status}"
                title={verification.issue ?? ''}
              >
                {#if verification.status === 'verified'}✓{:else if verification.status === 'truncated'}⚠{:else}✗{/if}
              </span>
            {/if}
            {q.text}
            {#if verification?.issue}
              <div class="quote-issue">{verification.issue}</div>
            {/if}
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
    margin-top: 8px;
    padding: 12px;
    border-radius: var(--radius-md);
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .ai-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-ai-text);
  }
  .ai-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ai-text);
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
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    background: var(--p-highlight);
    border-left: 2px solid var(--p-kofa-border);
  }
  .proposition-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ai-text);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 4px;
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
    margin-top: 8px;
    margin-bottom: 8px;
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
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .quote-item {
    padding: 8px 12px;
    border-radius: var(--radius-md);
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
    color: var(--p-kofa-accent);
    margin-right: 8px;
    cursor: pointer;
  }
  .quote-status {
    font-size: 10px;
    font-weight: 700;
    margin-right: 4px;
    flex-shrink: 0;
  }
  .quote-status-verified {
    color: var(--p-success, #2d7d46);
  }
  .quote-status-truncated {
    color: var(--p-warn, #b25e09);
  }
  .quote-status-inaccurate,
  .quote-status-not_found {
    color: var(--p-error, #c13515);
  }

  .quote-item.truncated {
    border-color: var(--p-warn, #b25e09);
    border-left: 2px solid var(--p-warn, #b25e09);
  }
  .quote-item.inaccurate {
    border-color: var(--p-error, #c13515);
    border-left: 2px solid var(--p-error, #c13515);
  }

  .quote-issue {
    margin-top: 4px;
    font-size: 11px;
    font-style: italic;
    color: var(--p-ink3);
  }

  .verification-summary {
    font-weight: 400;
    color: var(--p-ink4);
  }

  /* Nuances */
  .nuances-details {
    margin-bottom: 8px;
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
    gap: 8px;
  }
  .action-btn {
    all: unset;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    font-size: 10px;
    font-weight: 500;
    background: transparent;
    border: 1px solid var(--p-border-m);
    color: var(--p-ink2);
    cursor: pointer;
  }
  @media (hover: hover) {
    .action-btn:hover {
      border-color: var(--p-border-s);
      color: var(--p-ink);
    }
  }
</style>
