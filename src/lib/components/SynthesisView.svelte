<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { synthesize, updateSynthesisNote } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';

  let editing = $state(false);
  let editContent = $state('');
  let saving = $state(false);

  /** Escape HTML, then render **bold** markdown safely */
  function renderBold(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  let hasNote = $derived(!!pipelineState.synthesisResult || !!pipelineState.synthesisMarkdown);
  let lawyerSections = $derived(
    pipelineState.synthesisResult?.sections.filter((s) => s.requires_lawyer_input) ?? []
  );
  let showQABar = $derived(hasNote && !editing && analysisState.isPostSynthesisPhase);

  async function generateNote() {
    pipelineState.setSynthesisLoading(true);
    try {
      const result = await synthesize(analysisState.analysis.id);
      pipelineState.setSynthesisResult(result);
      analysisState.setStatus('synthesis');
      toastState.show('Notatutkast generert', 'success');
    } catch (e) {
      toastState.show('Syntese feilet — prøv igjen', 'error');
      console.error('Synthesis failed:', e);
    } finally {
      pipelineState.setSynthesisLoading(false);
    }
  }

  function startEditing() {
    editContent = pipelineState.synthesisMarkdown;
    editing = true;
  }

  async function saveEdits() {
    saving = true;
    try {
      await updateSynthesisNote(analysisState.analysis.id, editContent);
      pipelineState.setSynthesisMarkdown(editContent);
      editing = false;
      toastState.show('Notat lagret', 'success');
    } catch (e) {
      toastState.show('Lagring feilet', 'error');
    } finally {
      saving = false;
    }
  }

  function cancelEditing() {
    editing = false;
  }
</script>

<div class="synthesis-view">
  {#if !hasNote}
    <!-- Empty state -->
    <div class="empty-state">
      <div class="empty-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--p-ink4)"
          stroke-width="1.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      </div>
      <div class="empty-title">Ingen syntese ennå</div>
      <div class="empty-desc">
        Generer et notatutkast basert på screeningresultater og rettssetningsregisteret. Claude
        organiserer materialet systematisk — du fyller inn vurderinger.
      </div>
      <button class="generate-btn" onclick={generateNote} disabled={pipelineState.synthesisLoading}>
        {#if pipelineState.synthesisLoading}
          <span class="spinner"></span>
          Genererer notat…
        {:else}
          Generer notat
        {/if}
      </button>
    </div>
  {:else if editing}
    <!-- Edit mode -->
    <div class="edit-mode">
      <div class="edit-toolbar">
        <span class="edit-label">Redigerer notat</span>
        <div class="edit-actions">
          <button class="edit-btn cancel" onclick={cancelEditing}>Avbryt</button>
          <button class="edit-btn save" onclick={saveEdits} disabled={saving}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
      <textarea class="edit-area" bind:value={editContent}></textarea>
    </div>
  {:else}
    <!-- Display mode -->
    <div class="display-mode">
      <!-- Unified header: KS status left, actions right -->
      <div class="note-header">
        <div class="note-header-left">
          {#if pipelineState.qaReport}
            <button
              class="ks-badge"
              class:clean={pipelineState.qaReport.total_flags === 0}
              class:has-flags={pipelineState.qaReport.total_flags > 0}
              onclick={() => (uiState.activeProcessView = 'synthesis-review')}
            >
              <span class="ks-count">{pipelineState.qaReport.total_flags}</span>
              <span class="ks-label">
                {pipelineState.qaReport.total_flags === 0
                  ? 'KS ok'
                  : pipelineState.qaReport.total_flags === 1
                    ? 'KS-merknad'
                    : 'KS-merknader'}
              </span>
              <span class="ks-arrow">→</span>
            </button>
          {:else if showQABar}
            <button
              class="ks-run-btn"
              onclick={() => screeningState.startQaBatch()}
              disabled={pipelineState.qaLoading}
            >
              {pipelineState.qaLoading ? 'Kjører KS…' : 'Kjør kvalitetssikring'}
            </button>
          {/if}
          {#if lawyerSections.length > 0}
            <span class="lawyer-hint">
              {lawyerSections.length}
              {lawyerSections.length === 1 ? 'seksjon' : 'seksjoner'} krever vurdering
            </span>
          {/if}
        </div>
        <div class="note-header-right">
          <button class="note-action" onclick={startEditing}>Rediger</button>
          <button
            class="note-action"
            onclick={generateNote}
            disabled={pipelineState.synthesisLoading}
          >
            {pipelineState.synthesisLoading ? 'Genererer…' : 'Re-generer'}
          </button>
          {#if pipelineState.qaReport}
            <button
              class="note-action"
              onclick={() => screeningState.startQaBatch()}
              disabled={pipelineState.qaLoading}
            >
              {pipelineState.qaLoading ? 'Kjører…' : 'Kjør KS på nytt'}
            </button>
          {/if}
          {#if showQABar && pipelineState.qaReport}
            {#if analysisState.analysis.status !== 'complete'}
              <button class="note-action primary" onclick={() => analysisState.markComplete()}>
                Ferdigstill
              </button>
            {:else}
              <span class="complete-badge">Ferdigstilt</span>
            {/if}
          {/if}
        </div>
      </div>

      <div class="note-content">
        {#each pipelineState.synthesisMarkdown.split('\n') as line}
          {#if line.startsWith('# ')}
            <h1>{line.slice(2)}</h1>
          {:else if line.startsWith('## ')}
            <h2>{line.slice(3)}</h2>
          {:else if line.startsWith('### ')}
            <h3>{line.slice(4)}</h3>
          {:else if line.startsWith('- **')}
            <p class="list-bold">{@html renderBold(line)}</p>
          {:else if line.startsWith('- ')}
            <p class="list-item">{line.slice(2)}</p>
          {:else if line.includes('[JURISTENS VURDERING')}
            <div class="lawyer-block">
              {line}
            </div>
          {:else if line.trim()}
            <p>{@html renderBold(line)}</p>
          {:else}
            <div class="spacer"></div>
          {/if}
        {/each}
      </div>

      {#if pipelineState.synthesisResult?.unresolved_tensions?.length}
        <div class="tensions-section">
          <div class="tensions-label">Uløste spenninger</div>
          {#each pipelineState.synthesisResult.unresolved_tensions as tension}
            <div class="tension-item">
              <span class="tension-desc">{tension.description}</span>
              <span class="tension-cases">{tension.cases.join(', ')}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .synthesis-view {
    height: 100%;
    overflow-y: auto;
    padding: 24px 32px;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    gap: 12px;
  }
  .empty-icon {
    opacity: 0.4;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .empty-desc {
    font-size: 13px;
    color: var(--p-ink3);
    line-height: 1.55;
    max-width: 400px;
  }
  .generate-btn {
    all: unset;
    margin-top: 8px;
    padding: 12px 24px;
    border-radius: var(--radius-lg);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .generate-btn:hover {
    opacity: 0.85;
  }
  .generate-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--p-panel);
    animation: spin 0.8s linear infinite;
  }

  /* ── Unified header ── */
  .note-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 0 12px;
    border-bottom: 1px solid var(--p-border);
    flex-wrap: wrap;
  }
  .note-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .note-header-right {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .ks-badge {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--radius-md);
    font-size: 11px;
    font-weight: 600;
    border: 1px solid var(--p-ai-border-subtle);
    background: var(--p-highlight);
    color: var(--p-warn);
  }
  .ks-badge.clean {
    background: var(--p-success-bg);
    border-color: rgba(61, 122, 74, 0.12);
    color: var(--p-success);
  }
  @media (hover: hover) {
    .ks-badge:hover {
      border-color: var(--p-border-s);
    }
  }
  .ks-count {
    font-family: var(--font-data);
    font-size: 13px;
    font-weight: 700;
  }
  .ks-label {
    white-space: nowrap;
  }
  .ks-arrow {
    opacity: 0.4;
    font-size: 10px;
  }
  .ks-badge:hover .ks-arrow {
    opacity: 0.8;
  }

  .ks-run-btn {
    all: unset;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: var(--radius-md);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink2);
    border: 1px solid var(--p-border-m);
  }
  @media (hover: hover) {
    .ks-run-btn:hover {
      border-color: var(--p-border-s);
      color: var(--p-ink);
    }
  }
  .ks-run-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .lawyer-hint {
    font-size: 11px;
    color: var(--p-warn);
    font-weight: 500;
  }

  .note-action {
    all: unset;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: var(--radius-md);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
  }
  @media (hover: hover) {
    .note-action:hover {
      background: var(--p-hover);
      color: var(--p-ink);
    }
  }
  .note-action:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .note-action.primary {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  @media (hover: hover) {
    .note-action.primary:hover {
      opacity: 0.85;
    }
  }
  .complete-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-success);
    padding: 4px 10px;
  }

  /* Note content — AI-generated */
  .note-content {
    font-size: 14px;
    line-height: 1.7;
    color: var(--p-ink);
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
    padding: 16px 20px;
    border-radius: var(--radius-md);
  }
  .note-content h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 16px;
    color: var(--p-ink);
  }
  .note-content h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 24px 0 8px;
    color: var(--p-ink);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--p-border);
  }
  .note-content h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 4px;
    color: var(--p-ink2);
  }
  .note-content p {
    margin: 0 0 8px;
  }
  .note-content .list-item {
    padding-left: 16px;
    position: relative;
  }
  .note-content .list-item::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: var(--p-ink3);
  }
  .note-content .list-bold {
    padding-left: 16px;
  }
  .note-content .spacer {
    height: 8px;
  }

  .lawyer-block {
    margin: 12px 0;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--p-warn-bg);
    border-left: 3px solid var(--p-warn);
    font-size: 13px;
    color: var(--p-warn);
    font-weight: 500;
    font-style: italic;
  }

  /* Tensions section — AI-generated */
  .tensions-section {
    margin-top: 24px;
    padding: 16px 20px;
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
    border-radius: var(--radius-md);
  }
  .tensions-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-tension, #a63d3d);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .tension-item {
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-tension-bg, rgba(166, 61, 61, 0.04));
    border: 1px solid var(--p-tension-border, rgba(166, 61, 61, 0.1));
    margin-bottom: 8px;
  }
  .tension-desc {
    font-size: 12px;
    color: var(--p-ink);
    display: block;
    margin-bottom: 2px;
  }
  .tension-cases {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  /* Edit mode */
  .edit-mode {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .edit-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--p-border);
  }
  .edit-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .edit-actions {
    display: flex;
    gap: 8px;
  }
  .edit-btn {
    all: unset;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
  }
  .edit-btn.cancel {
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
  }
  .edit-btn.cancel:hover {
    background: var(--p-hover);
  }
  .edit-btn.save {
    background: var(--p-ink);
    color: var(--p-panel);
  }
  .edit-btn.save:hover {
    opacity: 0.85;
  }
  .edit-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .edit-area {
    flex: 1;
    min-height: 500px;
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    font-size: 13px;
    line-height: 1.65;
    color: var(--p-ink);
    font-family: var(--font-data);
    resize: vertical;
  }
  .edit-area:focus {
    outline: none;
    border-color: var(--p-border-s);
  }

  /* (workflow-bar styles removed — merged into note-header) */

  @media (max-width: 768px) {
    .synthesis-view {
      max-width: 100%;
      padding: 16px 12px;
    }
    .empty-desc {
      max-width: 100%;
    }
  }
</style>
