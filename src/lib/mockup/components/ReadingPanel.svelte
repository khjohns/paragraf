<script lang="ts">
  import { Maximize2, X, Sparkles, Check, BookOpen } from 'lucide-svelte';
  import ExcerptWithMarkers from './ExcerptWithMarkers.svelte';
  import type { MockCandidate } from '$lib/mockup/data/analyse';

  let {
    selectedCase,
    onClose,
    onExpand,
  }: {
    selectedCase: MockCandidate;
    onClose: () => void;
    onExpand: () => void;
  } = $props();
</script>

<aside class="reading-panel">
  <header class="panel-header">
    <div class="panel-header-info">
      <div class="panel-label">Lesevisning</div>
      <h2 class="panel-title">{selectedCase.ref}</h2>
      <div class="panel-meta">{selectedCase.source} &middot; {selectedCase.date}</div>
    </div>
    <div class="panel-actions">
      <button class="icon-btn" title="Fullskjerm" onclick={onExpand}><Maximize2 size={16} /></button
      >
      <button class="icon-btn" onclick={onClose} title="Lukk"><X size={16} /></button>
    </div>
  </header>

  <div class="panel-body">
    <!-- AI assessment for unread cases -->
    {#if !selectedCase.read_at && selectedCase.ai_screening}
      <div class="ai-assessment">
        <div class="ai-assessment-content">
          <Sparkles size={16} color="var(--ai-accent)" />
          <div>
            <div class="ai-assessment-label">
              KI-vurdering: Kategori {selectedCase.ai_screening.category}
            </div>
            <p class="ai-assessment-text">{selectedCase.ai_screening.proposition}</p>
            <div class="ai-assessment-actions">
              <button class="action-btn ai"><Check size={12} /> Godkjenn</button>
              <button class="action-btn">Endre</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- No AI assessment prompt -->
    {#if !selectedCase.ai_screening}
      <div class="no-ai-prompt">
        <Sparkles size={20} color="var(--ai-accent)" style="opacity: 0.7" />
        <div class="no-ai-title">Ingen KI-vurdering ennå</div>
        <p class="no-ai-text">
          Vil du at maskinen skal skumlese saken og foreslå kategori og rettssetning?
        </p>
        <button class="action-btn ai"><Sparkles size={12} /> Analyser saken</button>
      </div>
    {/if}

    <!-- Excerpt -->
    <div class="excerpt-section">
      <h3 class="excerpt-heading">Utdrag fra avgjørelsen</h3>
      <ExcerptWithMarkers parts={selectedCase.excerpt} />

      <div class="excerpt-action">
        <button class="primary-btn">
          <BookOpen size={14} /> Marker som Rettssetning
        </button>
      </div>
    </div>
  </div>
</aside>

<style>
  .reading-panel {
    width: 420px;
    min-width: 420px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10;
  }

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .panel-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    margin-bottom: 4px;
  }

  .panel-title {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.2;
  }

  .panel-meta {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-tertiary);
    margin-top: 4px;
  }

  .panel-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: var(--ink-tertiary);
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    color: var(--ink);
    background: var(--hover-bg);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 48px;
  }

  /* AI Assessment */
  .ai-assessment {
    margin: 20px;
    border: 1px solid var(--ai-border);
    padding: 16px;
    border-radius: 4px;
  }

  .ai-assessment-content {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .ai-assessment-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--ai-accent);
    margin-bottom: 4px;
  }

  .ai-assessment-text {
    font-family: var(--font-serif);
    font-size: 14px;
    font-style: italic;
    color: var(--ink-secondary);
    line-height: 1.5;
    margin-bottom: 12px;
  }

  .ai-assessment-actions {
    display: flex;
    gap: 8px;
  }

  /* No AI prompt */
  .no-ai-prompt {
    margin: 20px;
    border: 1px dashed var(--ai-border);
    padding: 24px;
    border-radius: 4px;
    text-align: center;
  }

  .no-ai-title {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink);
    margin: 8px 0 4px;
  }

  .no-ai-text {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-tertiary);
    margin-bottom: 16px;
  }

  /* Excerpt */
  .excerpt-section {
    padding: 8px 20px 20px;
  }

  .excerpt-heading {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
    margin-bottom: 16px;
  }

  .excerpt-action {
    margin-top: 32px;
    border-top: 1px solid var(--border-subtle);
    padding-top: 20px;
  }

  /* Buttons */
  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--ink);
    color: var(--paper);
    border: 1.5px solid transparent;
  }

  .primary-btn:hover {
    background: #000;
  }

  :global(.dark) .primary-btn {
    background: transparent;
    color: var(--ink-secondary);
    border-color: var(--border-strong);
  }

  :global(.dark) .primary-btn:hover {
    background: var(--hover-bg-strong);
    color: var(--ink);
    border-color: var(--border-stronger);
  }

  .panel-header-info {
    min-width: 0;
  }
</style>
