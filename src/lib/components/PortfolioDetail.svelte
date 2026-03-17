<script lang="ts">
  import type { AnalysisDbResponse } from '$lib/types/analysis';
  import { STATUS_META } from '$lib/utils/analysisStatus';

  interface Props {
    analysis: AnalysisDbResponse;
    onOpen: (id: string) => void;
    onClose: () => void;
  }

  const { analysis, onOpen, onClose }: Props = $props();

  let meta = $derived(STATUS_META[analysis.status] ?? { label: analysis.status, color: '#B0A99E' });

  // Extract provisions from seeds
  let provisions = $derived(
    analysis.seeds.filter((s) => s.seed_type === 'provision').map((s) => s.value)
  );

  // Reading progress per category (single pass)
  let categoryStats = $derived.by(() => {
    const stats: Record<string, { total: number; read: number }> = {
      A: { total: 0, read: 0 },
      B: { total: 0, read: 0 },
      C: { total: 0, read: 0 },
    };
    for (const c of analysis.candidates) {
      if (c.category && stats[c.category]) {
        stats[c.category].total++;
        if (c.read_at) stats[c.category].read++;
      }
    }
    return stats;
  });

  let totalCases = $derived(analysis.candidates.length);
  let totalRead = $derived(Object.values(categoryStats).reduce((sum, s) => sum + s.read, 0));

  // Extract unique propositions from AI screening results
  let propositions = $derived.by(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of analysis.candidates) {
      const prop = c.ai_screening?.proposition;
      if (prop && !seen.has(prop)) {
        seen.add(prop);
        result.push(prop);
      }
    }
    return result;
  });

  // Count tensions from propositions
  // (Not yet available — would need cross-proposition analysis)
</script>

<div class="detail-panel">
  <!-- Header -->
  <div class="detail-header">
    <div class="header-top">
      <span class="status-label" style:color={meta.color}>{meta.label}</span>
      <button class="close-btn" aria-label="Lukk detaljer" onclick={onClose}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
    <div class="detail-title">{analysis.title}</div>
    {#if analysis.problem}
      <div class="detail-problem">{analysis.problem}</div>
    {/if}
    <button class="open-btn" onclick={() => onOpen(analysis.id)}>Apne analyse</button>
  </div>

  <!-- Scrollable detail -->
  <div class="detail-scroll">
    <!-- Provisions -->
    {#if provisions.length > 0}
      <div class="detail-section">
        <div class="section-label">Bestemmelser</div>
        <div class="provisions-list">
          {#each provisions as prov}
            <div class="provision-row">
              <span class="provision-name">{prov}</span>
              <div class="provision-line"></div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Reading progress per category -->
    {#if totalCases > 0}
      <div class="detail-section">
        <div class="section-label">Lesestatus &mdash; {totalRead} av {totalCases}</div>
        {#each ['A', 'B', 'C'] as cat}
          {@const s = categoryStats[cat]}
          {#if s.total > 0}
            {@const pct = Math.round((s.read / s.total) * 100)}
            <div class="cat-progress-row">
              <span
                class="cat-badge"
                class:cat-a={cat === 'A'}
                class:cat-b={cat === 'B'}
                class:cat-c={cat === 'C'}>{cat}</span
              >
              <div class="cat-bar">
                <div class="cat-bar-fill" class:cat-a={cat === 'A'} style:width="{pct}%"></div>
              </div>
              <span class="cat-count">{s.read}/{s.total}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Propositions -->
    {#if propositions.length > 0}
      <div class="detail-section">
        <div class="section-label">Rettssetninger</div>
        {#each propositions as prop}
          <div class="proposition-item">
            <div class="proposition-dot"></div>
            <span class="proposition-text">{prop}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Tensions placeholder -->
    <div class="detail-section">
      <div class="section-label">Spenninger</div>
      <span class="placeholder-text">Krever kryssanalyse av rettssetninger</span>
    </div>

    <!-- Gap pairs placeholder -->
    <div class="detail-section">
      <div class="section-label">Hull</div>
      <span class="placeholder-text">Krever bestemmelsespar-analyse</span>
    </div>

    <!-- Overlaps placeholder -->
    <div class="detail-section">
      <div class="section-label">Overlapp</div>
      <span class="placeholder-text">Krever teamvisning og kryss-analyse</span>
    </div>

    <!-- Recent activity placeholder -->
    <div class="detail-section">
      <div class="section-label">Siste aktivitet</div>
      <span class="placeholder-text">Krever aktivitetslogg</span>
    </div>

    <!-- AI next step -->
    <div class="detail-section no-border">
      <div class="ai-suggestion">
        <span class="ai-badge">AI</span>
        <span class="ai-text">
          {#if totalCases === 0}
            Kjor primaersok for a finne kandidatsaker.
          {:else if totalRead < totalCases}
            {totalCases - totalRead} uleste saker gjenstar. Start med A-kategorien.
          {:else}
            Alle saker lest. Klar for sammenstilling.
          {/if}
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .detail-panel {
    width: 360px;
    min-width: 360px;
    height: 100%;
    background: var(--p-panel);
    border-left: 1px solid var(--p-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .detail-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--p-border);
    flex-shrink: 0;
  }
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .status-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .close-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--p-ink4);
    padding: 4px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      color 0.1s ease,
      background 0.1s ease;
  }
  .close-btn:hover {
    color: var(--p-ink2);
    background: var(--p-hover);
  }

  .detail-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--p-ink);
    line-height: 1.3;
    letter-spacing: -0.01em;
    margin-bottom: 6px;
  }
  .detail-problem {
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--p-ink2);
  }

  .open-btn {
    margin-top: 12px;
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-ink);
    color: var(--p-panel);
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.12s ease;
  }
  .open-btn:hover {
    opacity: 0.85;
  }

  .detail-scroll {
    flex: 1;
    overflow-y: auto;
  }

  .detail-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--p-border);
  }
  .detail-section.no-border {
    border-bottom: none;
  }
  .section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink4);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .provisions-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .provision-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .provision-name {
    font-family: var(--font-data);
    font-size: 12px;
    font-weight: 600;
    color: var(--p-provision-accent);
    min-width: 55px;
  }
  .provision-line {
    flex: 1;
    height: 1px;
    background: var(--p-border);
  }

  .cat-progress-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .cat-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-badge);
    min-width: 18px;
    text-align: center;
  }
  .cat-badge.cat-a {
    background: rgba(26, 24, 20, 0.08);
    color: var(--p-ink);
  }
  .cat-badge.cat-b {
    background: rgba(26, 24, 20, 0.05);
    color: var(--p-ink2);
  }
  .cat-badge.cat-c {
    background: rgba(26, 24, 20, 0.03);
    color: var(--p-ink3);
  }
  .cat-bar {
    flex: 1;
    height: 3px;
    border-radius: var(--radius-sm);
    background: var(--p-input);
    overflow: hidden;
  }
  .cat-bar-fill {
    height: 100%;
    border-radius: var(--radius-sm);
    background: var(--p-ink2);
    transition: width 0.3s ease;
  }
  .cat-bar-fill.cat-a {
    background: var(--p-ink);
  }
  .cat-count {
    font-family: var(--font-data);
    font-size: 10px;
    color: var(--p-ink3);
    min-width: 20px;
    text-align: right;
  }

  .proposition-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 0;
  }
  .proposition-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--p-ink3);
    margin-top: 6px;
    flex-shrink: 0;
  }
  .proposition-text {
    font-size: 12px;
    color: var(--p-ink2);
    line-height: 1.45;
  }

  .placeholder-text {
    font-size: 11px;
    color: var(--p-ink4);
    font-style: italic;
  }

  .ai-suggestion {
    padding: 8px 10px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border-left: 3px solid var(--p-ai-border-subtle);
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .ai-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: var(--radius-badge);
    background: var(--p-surface);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-kofa-accent);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .ai-text {
    font-size: 12px;
    line-height: 1.5;
    color: var(--p-ink2);
  }
</style>
