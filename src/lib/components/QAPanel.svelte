<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { runQA } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';
  import { QA_SEVERITY_CONFIG, CITATION_STATUS_CONFIG } from '$lib/types/analysis';

  let expanded = $state<string | null>(null);

  let report = $derived(analysisState.qaReport);
  let citationIssues = $derived(
    report?.citation_verification.verified_quotes.filter((q) => q.status !== 'verified') ?? []
  );
  let logicFlags = $derived(report?.logical_consistency.flags ?? []);
  let untreatedCases = $derived(
    report?.coverage.untreated_cases.filter((c) => !c.justified_omission) ?? []
  );

  async function startQA() {
    analysisState.setQaLoading(true);
    try {
      const result = await runQA(analysisState.analysis.id);
      analysisState.setQaReport(result);
      analysisState.setStatus('qa');
      toastState.show(`QA fullført — ${result.total_flags} flagg`, result.total_flags > 0 ? 'info' : 'success');
    } catch (e) {
      toastState.show('QA feilet — prøv igjen', 'error');
      console.error('QA failed:', e);
    } finally {
      analysisState.setQaLoading(false);
    }
  }

  function toggleSection(section: string) {
    expanded = expanded === section ? null : section;
  }
</script>

<div class="qa-panel">
  {#if !report}
    <div class="qa-desc">
      Kvalitetssikring verifiserer sitater, sjekker logisk konsistens og dekningsgrad.
    </div>
    <button class="qa-btn" onclick={startQA} disabled={analysisState.qaLoading || (!analysisState.synthesisMarkdown && analysisState.analysis.status !== 'synthesis')}>
      {#if analysisState.qaLoading}
        <span class="spinner"></span>
        Kjører QA…
      {:else}
        Kjør kvalitetssikring
      {/if}
    </button>
    {#if !analysisState.synthesisMarkdown && analysisState.analysis.status !== 'synthesis'}
      <div class="qa-hint">Generer notat først</div>
    {/if}
  {:else}
    <!-- QA Summary -->
    <div class="qa-summary" class:clean={report.total_flags === 0}>
      <span class="qa-count">{report.total_flags}</span>
      <span>{report.total_flags === 0 ? 'Ingen problemer funnet' : report.total_flags === 1 ? 'problem funnet' : 'problemer funnet'}</span>
    </div>

    <!-- Citation Verification -->
    <button class="qa-section-btn" onclick={() => toggleSection('citations')}>
      <span class="section-title">Sitatverifisering</span>
      <span class="section-count" class:has-issues={citationIssues.length > 0}>
        {citationIssues.length}
      </span>
      <span class="chevron" class:open={expanded === 'citations'}>›</span>
    </button>
    {#if expanded === 'citations'}
      <div class="qa-section-content">
        <div class="section-summary">{report.citation_verification.summary}</div>
        {#each citationIssues as quote}
          <div class="flag-item">
            <div class="flag-header">
              <span class="flag-case">{quote.sak_nr} §{quote.paragraph}</span>
              <span class="flag-status" style:color={CITATION_STATUS_CONFIG[quote.status]?.color}>
                {CITATION_STATUS_CONFIG[quote.status]?.label ?? quote.status}
              </span>
            </div>
            <div class="flag-quote">«{quote.quoted_text}»</div>
            {#if quote.issue}
              <div class="flag-issue">{quote.issue}</div>
            {/if}
          </div>
        {/each}
        {#if citationIssues.length === 0}
          <div class="section-ok">Alle sitater verifisert</div>
        {/if}
      </div>
    {/if}

    <!-- Logical Consistency -->
    <button class="qa-section-btn" onclick={() => toggleSection('logic')}>
      <span class="section-title">Logisk konsistens</span>
      <span class="section-count" class:has-issues={logicFlags.length > 0}>
        {logicFlags.length}
      </span>
      <span class="chevron" class:open={expanded === 'logic'}>›</span>
    </button>
    {#if expanded === 'logic'}
      <div class="qa-section-content">
        <div class="section-summary">{report.logical_consistency.summary}</div>
        {#each logicFlags as flag}
          <div class="flag-item" style:border-left-color={QA_SEVERITY_CONFIG[flag.severity]?.color}>
            <div class="flag-header">
              <span
                class="flag-severity"
                style:background={QA_SEVERITY_CONFIG[flag.severity]?.bg}
                style:color={QA_SEVERITY_CONFIG[flag.severity]?.color}
              >
                {QA_SEVERITY_CONFIG[flag.severity]?.label ?? flag.severity}
              </span>
              <span class="flag-location">{flag.location}</span>
            </div>
            <div class="flag-desc">{flag.description}</div>
            <div class="flag-suggestion">{flag.suggestion}</div>
          </div>
        {/each}
        {#if logicFlags.length === 0}
          <div class="section-ok">Ingen logiske problemer funnet</div>
        {/if}
      </div>
    {/if}

    <!-- Coverage -->
    <button class="qa-section-btn" onclick={() => toggleSection('coverage')}>
      <span class="section-title">Dekningssjekk</span>
      <span class="section-count" class:has-issues={untreatedCases.length > 0}>
        {untreatedCases.length}
      </span>
      <span class="chevron" class:open={expanded === 'coverage'}>›</span>
    </button>
    {#if expanded === 'coverage'}
      <div class="qa-section-content">
        <div class="section-summary">{report.coverage.summary}</div>
        {#each untreatedCases as uc}
          <div class="flag-item">
            <div class="flag-header">
              <span class="flag-case">{uc.sak_nr}</span>
              <span class="flag-cat">{uc.category}</span>
            </div>
            <div class="flag-desc">{uc.proposition}</div>
            <div class="flag-issue">{uc.reason}</div>
          </div>
        {/each}
        {#if untreatedCases.length === 0}
          <div class="section-ok">Alle viktige saker dekket</div>
        {/if}
      </div>
    {/if}

    <!-- Re-run -->
    <button class="qa-rerun" onclick={startQA} disabled={analysisState.qaLoading}>
      {analysisState.qaLoading ? 'Kjører…' : 'Kjør QA på nytt'}
    </button>
  {/if}
</div>

<style>
  .qa-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .qa-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.45;
    margin-bottom: 4px;
  }
  .qa-hint {
    font-size: 11px;
    color: var(--p-ink4);
    font-style: italic;
    text-align: center;
  }
  .qa-btn {
    all: unset;
    width: 100%;
    padding: 9px 12px;
    border-radius: 5px;
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .qa-btn:hover { opacity: 0.85; }
  .qa-btn:disabled { opacity: 0.4; cursor: default; }

  .qa-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--p-warn-bg);
    border: 1px solid rgba(166, 123, 46, 0.12);
    font-size: 12px;
    color: var(--p-warn);
    font-weight: 500;
  }
  .qa-summary.clean {
    background: var(--p-success-bg);
    border-color: rgba(61, 122, 74, 0.1);
    color: var(--p-success);
  }
  .qa-count {
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-data);
  }

  .qa-section-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 5px;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    width: 100%;
    box-sizing: border-box;
  }
  .qa-section-btn:hover { background: var(--p-hover); }
  .section-title {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--p-ink);
  }
  .section-count {
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-success);
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--p-success-bg);
  }
  .section-count.has-issues {
    color: var(--p-warn);
    background: var(--p-warn-bg);
  }
  .chevron {
    font-size: 14px;
    color: var(--p-ink4);
    transition: transform 0.15s ease;
  }
  .chevron.open { transform: rotate(90deg); }

  .qa-section-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 0 6px 8px;
    border-left: 2px solid var(--p-border);
    margin-left: 6px;
  }
  .section-summary {
    font-size: 11px;
    color: var(--p-ink3);
    line-height: 1.45;
    padding: 4px 8px;
    background: var(--p-hover);
    border-radius: 4px;
    margin-bottom: 2px;
  }
  .section-ok {
    font-size: 11px;
    color: var(--p-success);
    font-weight: 500;
    padding: 4px 8px;
  }

  .flag-item {
    padding: 8px 10px;
    border-radius: 4px;
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    border-left: 3px solid var(--p-warn);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .flag-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .flag-case {
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }
  .flag-cat {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
  }
  .flag-status {
    font-size: 10px;
    font-weight: 600;
  }
  .flag-severity {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
  }
  .flag-location {
    font-size: 10px;
    color: var(--p-ink3);
    font-style: italic;
  }
  .flag-desc {
    font-size: 11px;
    color: var(--p-ink);
    line-height: 1.45;
  }
  .flag-quote {
    font-size: 11px;
    color: var(--p-ink2);
    font-style: italic;
    line-height: 1.4;
  }
  .flag-issue {
    font-size: 10px;
    color: var(--p-warn);
    font-weight: 500;
  }
  .flag-suggestion {
    font-size: 10px;
    color: var(--p-ink3);
    font-style: italic;
    line-height: 1.4;
  }

  .qa-rerun {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px dashed var(--p-border-m);
    font-size: 11px;
    font-weight: 500;
    color: var(--p-ink3);
    text-align: center;
    box-sizing: border-box;
    margin-top: 4px;
  }
  .qa-rerun:hover { border-color: var(--p-border-s); color: var(--p-ink); }
  .qa-rerun:disabled { opacity: 0.4; cursor: default; }

  .spinner {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.3);
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }

</style>
