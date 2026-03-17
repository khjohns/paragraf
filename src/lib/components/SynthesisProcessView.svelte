<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { synthesize, updateSynthesisNote } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';
  import {
    QA_SEVERITY_CONFIG,
    CITATION_STATUS_CONFIG,
    type QAVerifiedQuote,
  } from '$lib/types/analysis';
  import WorkLog from './WorkLog.svelte';

  const CITATION_SEVERITY: Record<QAVerifiedQuote['status'], 'high' | 'medium' | 'low'> = {
    inaccurate: 'high',
    not_found: 'medium',
    truncated: 'low',
    verified: 'low',
  };

  let editing = $state(false);
  let editContent = $state('');
  let saving = $state(false);

  function renderBold(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  let hasNote = $derived(!!pipelineState.synthesisResult || !!pipelineState.synthesisMarkdown);
  let lawyerSections = $derived(
    pipelineState.synthesisResult?.sections.filter((s) => s.requires_lawyer_input) ?? []
  );

  // QA data
  let report = $derived(pipelineState.qaReport);
  let citationIssues = $derived(
    report?.citation_verification.verified_quotes.filter((q) => q.status !== 'verified') ?? []
  );
  let logicFlags = $derived(report?.logical_consistency.flags ?? []);
  let untreatedCases = $derived(
    report?.coverage.untreated_cases.filter((c) => !c.justified_omission) ?? []
  );

  // Pre-processed lines from synthesis markdown — avoids re-splitting on every render
  let renderedLines = $derived(pipelineState.synthesisMarkdown.split('\n'));

  // Verified references from tool calls
  let verifiedRefs = $derived.by(() => {
    const refs = new Set<string>();
    const meta = pipelineState.synthesisLlmMeta;
    if (!meta) return refs;
    for (const call of meta.tools_called) {
      if (call.tool === 'fetch_case_paragraphs' && call.success) {
        const input = call.input as { sak_nr?: string };
        if (input.sak_nr) refs.add(input.sak_nr);
      }
    }
    return refs;
  });

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
    } catch {
      toastState.show('Lagring feilet', 'error');
    } finally {
      saving = false;
    }
  }

  function exportMarkdown() {
    const blob = new Blob([pipelineState.synthesisMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysisState.analysis.title ?? 'notat'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="synthesis-process">
  <!-- Header bar -->
  <div class="process-header">
    <button class="back-btn" onclick={() => uiState.clearProcessView()}
      >← Tilbake til arbeidsrom</button
    >
    <span class="process-title">Syntese-gjennomgang</span>
    <span class="header-spacer"></span>
    {#if hasNote && !editing}
      <div class="header-actions">
        <button class="header-btn" onclick={startEditing}>Rediger notat</button>
        <button
          class="header-btn"
          onclick={() => screeningState.startQaBatch()}
          disabled={pipelineState.qaLoading}
        >
          {pipelineState.qaLoading ? 'Kjører QA…' : 'Kjør QA på nytt'}
        </button>
        <button class="header-btn primary" onclick={exportMarkdown}>Eksporter markdown</button>
      </div>
    {/if}
  </div>

  {#if !hasNote}
    <div class="empty-state">
      <div class="empty-title">Ingen syntese ennå</div>
      <div class="empty-desc">
        Generer et notatutkast basert på screeningresultater og rettssetningsregisteret.
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
    <div class="edit-mode">
      <div class="edit-toolbar">
        <span class="edit-label">Redigerer notat</span>
        <button class="edit-btn cancel" onclick={() => (editing = false)}>Avbryt</button>
        <button class="edit-btn save" onclick={saveEdits} disabled={saving}>
          {saving ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
      <textarea class="edit-area" bind:value={editContent}></textarea>
    </div>
  {:else}
    <div class="two-column">
      <!-- Left: Note -->
      <div class="note-column">
        {#if lawyerSections.length > 0}
          <div class="lawyer-notice">
            {lawyerSections.length}
            {lawyerSections.length === 1 ? 'seksjon' : 'seksjoner'} krever din vurdering
          </div>
        {/if}

        <div class="note-content">
          {#each renderedLines as line}
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
                <div class="lawyer-text">{line}</div>
                <div class="lawyer-input-hint">Legg til din vurdering her</div>
              </div>
            {:else if line.match(/\d{4}\/\d+/)}
              {@const sakMatch = line.match(/(\d{4}\/\d+)/)}
              {@const isVerified = sakMatch && verifiedRefs.has(sakMatch[1])}
              <p>
                {@html renderBold(line)}
                {#if isVerified}
                  <span
                    class="verified-badge"
                    title="Verifisert — Claude slo opp denne saken direkte">📎</span
                  >
                {/if}
              </p>
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

        <WorkLog meta={pipelineState.synthesisLlmMeta} label="Syntese-logg" />
        <WorkLog meta={pipelineState.qaLlmMeta} label="QA-logg" />
      </div>

      <!-- Right: QA Column -->
      <div class="qa-column">
        {#if !report}
          <div class="qa-empty">
            <button
              class="qa-run-btn"
              onclick={() => screeningState.startQaBatch()}
              disabled={pipelineState.qaLoading}
            >
              {#if pipelineState.qaLoading}
                <span class="spinner"></span>
                Kjører QA…
              {:else}
                Kjør QA →
              {/if}
            </button>
          </div>
        {:else}
          <div class="qa-summary" class:clean={report.total_flags === 0}>
            <span class="qa-icon">{report.total_flags > 0 ? '⚠' : '✓'}</span>
            <span class="qa-count">{report.total_flags}</span>
            <span
              >{report.total_flags === 0
                ? 'Ingen problemer'
                : report.total_flags === 1
                  ? 'problem'
                  : 'problemer'}</span
            >
          </div>

          {#if citationIssues.length > 0}
            <div class="qa-section">
              <div class="qa-section-label">Referanser</div>
              {#each citationIssues as quote}
                {@const sev = CITATION_SEVERITY[quote.status]}
                <div class="qa-flag">
                  <div class="qa-flag-header">
                    <span
                      class="severity-badge"
                      style:background={QA_SEVERITY_CONFIG[sev]?.bg}
                      style:color={QA_SEVERITY_CONFIG[sev]?.color}
                      >{QA_SEVERITY_CONFIG[sev]?.label}</span
                    >
                    <span class="qa-flag-case">{quote.sak_nr}</span>
                  </div>
                  <div class="qa-flag-text">
                    p{quote.paragraph}: {quote.issue ?? CITATION_STATUS_CONFIG[quote.status]?.label}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if logicFlags.length > 0}
            <div class="qa-section">
              <div class="qa-section-label">Logikk</div>
              {#each logicFlags as flag}
                <div class="qa-flag">
                  <div class="qa-flag-header">
                    <span
                      class="severity-badge"
                      style:background={QA_SEVERITY_CONFIG[flag.severity]?.bg}
                      style:color={QA_SEVERITY_CONFIG[flag.severity]?.color}
                      >{QA_SEVERITY_CONFIG[flag.severity]?.label}</span
                    >
                    <span class="qa-flag-location">{flag.location}</span>
                  </div>
                  <div class="qa-flag-text">{flag.description}</div>
                  <div class="qa-flag-suggestion">{flag.suggestion}</div>
                </div>
              {/each}
            </div>
          {/if}

          {#if untreatedCases.length > 0}
            <div class="qa-section">
              <div class="qa-section-label">Ubehandlet</div>
              {#each untreatedCases as uc}
                <div class="qa-flag">
                  <span class="qa-flag-case">{uc.sak_nr} ({uc.category})</span>
                  <div class="qa-flag-text">{uc.reason}</div>
                </div>
              {/each}
            </div>
          {/if}

          <button
            class="qa-rerun-btn"
            onclick={() => screeningState.startQaBatch()}
            disabled={pipelineState.qaLoading}
          >
            {pipelineState.qaLoading ? 'Kjører…' : 'Kjør QA på nytt'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .synthesis-process {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .process-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border-m);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .back-btn {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    color: var(--p-ink3);
    font-weight: 500;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    transition: all 0.1s ease;
  }
  .back-btn:hover {
    color: var(--p-ink);
    background: var(--p-hover);
  }
  .back-btn:active {
    background: var(--p-active);
  }
  .process-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .header-spacer {
    flex: 1;
  }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  .header-btn {
    all: unset;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink3);
    border: 1px solid var(--p-border);
  }
  .header-btn:hover {
    background: var(--p-hover);
    color: var(--p-ink);
  }
  .header-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .header-btn.primary {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .header-btn.primary:hover {
    opacity: 0.85;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    gap: 12px;
    padding: 32px;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .empty-desc {
    font-size: 13px;
    color: var(--p-ink3);
    max-width: 400px;
    line-height: 1.55;
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

  .edit-mode {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 16px 24px;
    overflow: hidden;
  }
  .edit-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--p-border);
  }
  .edit-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink2);
    flex: 1;
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
  .edit-btn.save {
    background: var(--p-ink);
    color: var(--p-panel);
  }
  .edit-btn:disabled {
    opacity: 0.4;
  }
  .edit-area {
    flex: 1;
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

  .two-column {
    display: grid;
    grid-template-columns: 1fr 300px;
    flex: 1;
    overflow: hidden;
  }

  .note-column {
    overflow-y: auto;
    padding: 24px 40px;
  }

  .lawyer-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-warn-bg);
    border: 1px solid rgba(166, 123, 46, 0.12);
    font-size: 12px;
    color: var(--p-warn);
    font-weight: 500;
    margin-bottom: 16px;
  }

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
  }
  .note-content h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 24px 0 8px;
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
  }
  .lawyer-text {
    font-size: 13px;
    color: var(--p-warn);
    font-weight: 500;
    font-style: italic;
  }
  .lawyer-input-hint {
    margin-top: 8px;
    font-size: 11px;
    color: var(--p-ink4);
    font-style: italic;
  }

  .verified-badge {
    cursor: help;
    font-size: 12px;
  }

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
    background: rgba(166, 61, 61, 0.04);
    border: 1px solid rgba(166, 61, 61, 0.1);
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

  .qa-column {
    border-left: 1px solid var(--p-border);
    overflow-y: auto;
    padding: 16px;
    background: var(--p-panel);
  }

  .qa-empty {
    display: flex;
    justify-content: center;
    padding: 24px 0;
  }
  .qa-run-btn {
    all: unset;
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
  .qa-run-btn:hover {
    opacity: 0.85;
  }
  .qa-run-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .qa-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-warn-bg);
    border: 1px solid rgba(166, 123, 46, 0.12);
    font-size: 12px;
    color: var(--p-warn);
    font-weight: 500;
    margin-bottom: 12px;
  }
  .qa-summary.clean {
    background: var(--p-success-bg);
    color: var(--p-success);
    border-color: rgba(61, 122, 74, 0.1);
  }
  .qa-icon {
    font-size: 14px;
  }
  .qa-count {
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-data);
  }

  .qa-section {
    margin-bottom: 16px;
  }
  .qa-section-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--p-border);
  }

  .qa-flag {
    padding: 8px;
    border-radius: var(--radius-md);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    margin-bottom: 6px;
  }
  .qa-flag-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .severity-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
  }
  .qa-flag-case {
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }
  .qa-flag-location {
    font-size: 10px;
    color: var(--p-ink3);
    font-style: italic;
  }
  .qa-flag-text {
    font-size: 11px;
    color: var(--p-ink);
    line-height: 1.45;
  }
  .qa-flag-suggestion {
    font-size: 10px;
    color: var(--p-ink3);
    font-style: italic;
    margin-top: 4px;
  }

  .qa-rerun-btn {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--p-border-m);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    text-align: center;
    box-sizing: border-box;
    margin-top: 8px;
  }
  .qa-rerun-btn:hover {
    border-color: var(--p-border-s);
    color: var(--p-ink);
  }
  .qa-rerun-btn:disabled {
    opacity: 0.4;
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
</style>
