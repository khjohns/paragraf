<script lang="ts">
  import type { GraphNode, Valence } from '$lib/types/graph';
  import { uiState } from '$lib/stores/ui.svelte';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import ProvisionDetail from './ProvisionDetail.svelte';
  import EuCaseDetail from './EuCaseDetail.svelte';
  import ForarbeidDetail from './ForarbeidDetail.svelte';
  import NodeTypeIcon from './NodeTypeIcon.svelte';
  import ValencePip from './ValencePip.svelte';

  let {
    node,
    curationData = null,
    curationLoading = false,
    onReadMode,
  }: {
    node: GraphNode;
    curationData: import('$lib/types/curation').Curation | null;
    curationLoading: boolean;
    onReadMode: () => void;
  } = $props();

  let note = $derived(analysisState.analysis.notes[node.id] ?? '');
  let isRead = $derived(!!analysisState.analysis.readStatus[node.id]);

  // Connected nodes (use Set for O(1) lookups)
  let connectedNodes = $derived.by(() => {
    if (!node.connectedTo) return [];
    const idSet = new Set(node.connectedTo);
    return analysisState.nodes.filter((n) => idSet.has(n.id));
  });

  // Build valence map once per selection (avoids O(N) per relation)
  let valenceMap = $derived.by(() => {
    const map = new Map<string, Valence>();
    if (node.valence) {
      for (const [id, v] of Object.entries(node.valence)) {
        if (v !== 'unknown') map.set(id, v);
      }
    }
    for (const cn of connectedNodes) {
      if (!map.has(cn.id) && cn.valence?.[node.id] && cn.valence[node.id] !== 'unknown') {
        map.set(cn.id, cn.valence[node.id]);
      }
    }
    return map;
  });
</script>

<!-- Detail / Summary text -->
{#if node.detail}
  <div class="detail-section">
    <div class="section-label">
      {node.type === 'provision' ? 'Ordlyd' : 'Sammendrag'}
    </div>
    <div class="detail-text">{node.detail}</div>
  </div>
{/if}

<!-- AI-curated summary (KOFA cases only) -->
{#if node.type === 'kofa_case' && (curationData || curationLoading)}
  <div class="detail-section">
    <div class="section-label">AI-markerte avsnitt</div>
    {#if curationLoading}
      <div class="ai-loading">
        <div class="ai-loading-bar"></div>
        <span class="ai-loading-text">Genererer AI-kuratering...</span>
      </div>
    {:else if curationData}
      {#if curationData.summary_note}
        <div class="ai-summary-note">{curationData.summary_note}</div>
      {/if}
      {#each curationData.highlights.slice(0, 3) as hl}
        <div class="ai-preview">
          <div class="ai-preview-num">Avsnitt {hl.paragraph}</div>
          <p class="ai-preview-text">
            {hl.relevance.length > 150 ? hl.relevance.slice(0, 150) + '...' : hl.relevance}
          </p>
          <button class="ai-preview-link" onclick={onReadMode}> Les i kontekst → </button>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<!-- Signals detail -->
{#if node.signals}
  <div class="detail-section">
    <div class="section-label">Treffsignaler</div>
    {#each [{ key: 'ref' as const, label: 'Referansetabell', on: node.signals.ref }, { key: 'fts' as const, label: 'Fulltekstsøk', on: node.signals.fts }, { key: 'vec' as const, label: 'Vektorsøk', on: node.signals.vec }] as sig}
      <div class="signal-row" class:signal-on={sig.on}>
        <span class="sig-indicator" class:on={sig.on}></span>
        <span class:signal-label-on={sig.on}>{sig.label}</span>
      </div>
    {/each}
  </div>
{/if}

<!-- Relations -->
{#if connectedNodes.length > 0}
  <div class="detail-section">
    <div class="section-label">Relasjoner ({connectedNodes.length})</div>
    {#each connectedNodes as cn}
      {@const v = valenceMap.get(cn.id) ?? 'unknown'}
      <button class="relation-row" onclick={() => uiState.navigateTo(cn.id)}>
        <NodeTypeIcon type={cn.type} size={10} />
        <span class="relation-label">{cn.label}</span>
        {#if v !== 'unknown'}
          <ValencePip valence={v} size={9} />
        {/if}
        <span class="relation-subtitle">{cn.subtitle?.slice(0, 28)}</span>
      </button>
    {/each}
  </div>
{/if}

<!-- Type-specific detail -->
{#if node.type === 'provision'}
  {@const parts = node.id.split(':')}
  <ProvisionDetail dokId={parts[0] ?? ''} sectionId={parts[1] ?? ''} />
{:else if node.type === 'eu_case'}
  <EuCaseDetail euCaseId={node.id.replace('eu:', '')} />
{:else if node.type === 'prep_work'}
  {@const docId = node.id.replace('forarbeid:', '')}
  <ForarbeidDetail {docId} />
{/if}

<!-- Notes -->
<div class="detail-section">
  <label class="section-label" for="notes-field">Mine notater</label>
  <textarea
    id="notes-field"
    class="notes-field"
    value={note}
    oninput={(e) => analysisState.setNote(node.id, e.currentTarget.value)}
    placeholder="Skriv notater om denne rettskilden..."
    rows="3"
  ></textarea>
</div>

<!-- Actions -->
<div class="detail-actions">
  <button
    class="action-btn"
    class:active={isRead}
    onclick={() => analysisState.toggleRead(node.id)}
  >
    {isRead ? '✓ Lest og vurdert' : 'Marker som lest'}
  </button>
  <button class="action-btn action-seed"> Bruk som seed i neste iterasjon </button>
  {#if node.isDelimitation}
    <div class="delim-notice">
      Avgrensningspraksis — bestemmelsen ble vurdert som ikke-anvendelig
    </div>
  {/if}
</div>

<style>
  .detail-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--p-border);
  }
  .section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  /* Detail text */
  .detail-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--p-ink);
  }

  /* Signals detail */
  .signal-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--p-ink4);
    font-weight: 400;
  }
  .signal-row.signal-on {
    background: var(--p-hover);
  }
  .signal-label-on {
    font-weight: 600;
    color: var(--p-ink);
  }
  .sig-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: transparent;
    border: 1.5px solid var(--p-signal-off);
    flex-shrink: 0;
  }
  .sig-indicator.on {
    background: var(--p-signal-on);
    border-color: var(--p-signal-on);
  }

  /* Relations */
  .relation-row {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    margin-bottom: 0;
    width: 100%;
  }
  .relation-row:hover {
    background: var(--p-hover);
  }
  .relation-label {
    font-family: var(--font-data);
    font-weight: 500;
    font-size: 12px;
  }
  .relation-subtitle {
    color: var(--p-ink4);
    font-size: 10px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Notes */
  .notes-field {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    line-height: 1.5;
    font-family: var(--font-ui);
    background: var(--p-input);
    border: 1px solid var(--p-border-m);
    border-radius: var(--radius-md);
    color: var(--p-ink);
    resize: vertical;
  }
  .notes-field:focus {
    outline: none;
    border-color: var(--p-border-s);
  }

  /* Actions */
  .detail-actions {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .action-btn {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border-m);
    color: var(--p-ink2);
    font-size: 12px;
    font-weight: 500;
    text-align: center;
  }
  .action-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink);
  }
  .action-btn.active {
    background: var(--p-success-bg);
    border-color: var(--p-border);
    color: var(--p-success);
  }
  .action-seed {
    background: transparent;
  }
  .delim-notice {
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    background: var(--p-delim-bg);
    border: 1px solid var(--p-border);
    font-size: 0.6875rem;
    color: var(--p-delim);
    line-height: 1.4;
    text-align: center;
  }

  /* AI loading state in overview */
  .ai-loading {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-1) 0;
  }
  .ai-loading-bar {
    width: 3px;
    height: var(--spacing-4);
    border-radius: 2px;
    background: var(--p-ai-border);
    animation: pulse 2s ease-in-out infinite;
  }
  .ai-loading-text {
    font-size: 0.75rem;
    color: var(--p-ink4);
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.8;
    }
  }
  .ai-summary-note {
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--p-ai-text);
  }
  .ai-preview {
    padding: 8px 0;
    border-bottom: 1px solid var(--p-border);
  }
  .ai-preview-num {
    font-family: var(--font-data);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--p-ai-text);
    margin-bottom: 2px;
  }
  .ai-preview-text {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--p-ink2);
  }
  .ai-preview-link {
    all: unset;
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--p-ai-text);
    margin-top: 4px;
    display: inline-block;
  }
  .ai-preview-link:hover {
    text-decoration: underline;
  }
</style>
