<script lang="ts">
  import {
    BookOpen,
    Sparkles,
    Plus,
    Link2,
    Check,
    ChevronRight,
    ArrowLeft,
    Star,
  } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import EvolutionTag from './EvolutionTag.svelte';
  import type { Screening } from '$lib/mockup/data/lesevisning';
  import {
    MOCK_RETTSSETNINGER,
    EVOLUTION_CONFIG,
    type Rettssetning,
    type EvolutionType,
  } from '$lib/mockup/data/rettssetninger';

  type Step = 'choose' | 'create' | 'link' | 'done';

  let {
    screening,
    caseRef,
    onClose,
  }: {
    screening: Screening;
    caseRef: string;
    onClose: () => void;
  } = $props();

  // Initial values from screening prop (stable for panel lifetime)
  const initProposition = screening.proposition;
  const initQuotes = screening.quotes;

  let step = $state<Step>('choose');
  let propositionText = $state(initProposition);
  let theme = $state('Miljøbestemmelsen § 7-9');
  let selectedQuotes = $state<Set<number>>(new Set(initQuotes.map((q) => q.p)));
  let selectedRuleId = $state<string | null>(null);
  let evolution = $state<EvolutionType>('confirmed');

  // Track the most recent action for the done state
  let lastAction = $state<
    | { type: 'created'; theme: string }
    | { type: 'linked'; ruleTopic: string; evolution: EvolutionType }
    | null
  >(null);
  let actionCount = $state(0);

  const existingRules = MOCK_RETTSSETNINGER;

  const selectedRule = $derived(existingRules.find((r) => r.id === selectedRuleId) ?? null);

  // Evolution options for linking (not 'established' — that's the first occurrence)
  const LINK_EVOLUTIONS: { type: EvolutionType; label: string; desc: string }[] = [
    { type: 'confirmed', label: 'Bekreftet', desc: 'Saken sier det samme' },
    { type: 'qualified', label: 'Kvalifisert', desc: 'Saken innsnevrer eller nyanserer' },
    { type: 'consolidating', label: 'Konsoliderende', desc: 'Saken fester rettstilstanden' },
  ];

  function toggleQuote(p: number) {
    const next = new Set(selectedQuotes);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    selectedQuotes = next;
  }

  function handleCreate() {
    lastAction = { type: 'created', theme };
    actionCount++;
    step = 'done';
  }

  function handleLink() {
    if (!selectedRule) return;
    lastAction = { type: 'linked', ruleTopic: selectedRule.topic, evolution };
    actionCount++;
    step = 'done';
  }

  function handleMarkMore() {
    propositionText = initProposition;
    selectedQuotes = new Set(initQuotes.map((q) => q.p));
    selectedRuleId = null;
    evolution = 'confirmed';
    step = 'choose';
  }
</script>

<div class="precedent-panel" transition:slide={{ duration: 250 }}>
  <!-- Header -->
  <div class="panel-top">
    <div class="panel-top-left">
      <BookOpen size={14} />
      <span class="panel-title">
        {#if step === 'done'}
          Rettssetning markert
        {:else}
          Marker som rettssetning
        {/if}
      </span>
    </div>
    <button class="panel-close" onclick={onClose}>Lukk</button>
  </div>

  <!-- Step: choose -->
  {#if step === 'choose'}
    <div class="panel-body" in:fade={{ duration: 120 }}>
      <!-- AI proposition preview -->
      <div class="ai-proposition">
        <span class="field-label ai"><Sparkles size={10} /> Foreslått rettssetning</span>
        <p class="proposition-preview">{screening.proposition}</p>
      </div>
      <p class="hint-text">
        Denne rettssetningen er basert på KI-screeningen. Rediger den til din egen formulering,
        eller knytt saken til en eksisterende.
      </p>

      <div class="choose-actions">
        <button class="choose-btn" onclick={() => (step = 'create')}>
          <Plus size={14} />
          <div class="choose-btn-content">
            <span class="choose-btn-label">Opprett ny rettssetning</span>
            <span class="choose-btn-desc">Bruk eller rediger proposisjonen over</span>
          </div>
          <ChevronRight size={14} />
        </button>

        <button class="choose-btn" onclick={() => (step = 'link')}>
          <Link2 size={14} />
          <div class="choose-btn-content">
            <span class="choose-btn-label">Knytt til eksisterende</span>
            <span class="choose-btn-desc">{existingRules.length} rettssetninger i registeret</span>
          </div>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>

    <!-- Step: create -->
  {:else if step === 'create'}
    <div class="panel-body" in:fade={{ duration: 120 }}>
      <button class="back-link" onclick={() => (step = 'choose')}>
        <ArrowLeft size={12} /> Tilbake
      </button>

      <div class="form-section">
        <span class="field-label">Rettssetning</span>
        <textarea class="prop-textarea" bind:value={propositionText} rows={4}></textarea>
      </div>

      <div class="form-section">
        <span class="field-label">Tema</span>
        <div class="theme-input-row">
          <input class="theme-input" type="text" bind:value={theme} />
          <span class="theme-hint"><Sparkles size={10} /> KI-foreslått</span>
        </div>
      </div>

      <div class="form-section">
        <span class="field-label">Evolusjon</span>
        <div class="evolution-auto">
          <EvolutionTag evolution="established" />
          <span class="evolution-auto-hint">Første forekomst — settes automatisk</span>
        </div>
      </div>

      <div class="form-section">
        <span class="field-label">Nøkkelsitater</span>
        <div class="quote-checklist">
          {#each screening.quotes as q}
            <label class="quote-check-row">
              <input
                type="checkbox"
                checked={selectedQuotes.has(q.p)}
                onchange={() => toggleQuote(q.p)}
              />
              <span class="quote-check-para">Avsnitt {q.p}</span>
              <span class="quote-check-text">«{q.text}»</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-actions">
        <button class="action-btn" onclick={() => (step = 'choose')}>Avbryt</button>
        <button class="btn-primary" onclick={handleCreate}>
          <Plus size={12} /> Opprett
        </button>
      </div>
    </div>

    <!-- Step: link -->
  {:else if step === 'link'}
    <div class="panel-body" in:fade={{ duration: 120 }}>
      {#if !selectedRuleId}
        <button class="back-link" onclick={() => (step = 'choose')}>
          <ArrowLeft size={12} /> Tilbake
        </button>

        <!-- Rule selection list -->
        <span class="field-label">Velg rettssetning</span>
        <div class="rule-list">
          {#each existingRules as r (r.id)}
            {@const starCount = r.cases.filter((c) => c.star).length}
            <button class="rule-item" onclick={() => (selectedRuleId = r.id)}>
              <div class="rule-item-main">
                <span class="rule-item-theme">{r.theme}</span>
                <span class="rule-item-topic">{r.topic}</span>
                <p class="rule-item-prop" class:ai={r.isAiGenerated}>{r.proposition}</p>
              </div>
              <div class="rule-item-meta">
                <span class="rule-item-count">{r.cases.length} forekomster</span>
                <span class="rule-item-years">{r.yearSpan}</span>
                {#if starCount > 0}
                  <span class="rule-item-stars">
                    <Star size={10} fill="currentColor" />
                    {starCount}
                  </span>
                {/if}
              </div>
              <ChevronRight size={14} class="rule-item-arrow" />
            </button>
          {/each}
        </div>
      {:else}
        <!-- Evolution selection for chosen rule -->
        <button class="back-link" onclick={() => (selectedRuleId = null)}>
          <ArrowLeft size={12} /> Velg annen
        </button>

        <div class="selected-rule-preview">
          <span class="field-label">Knyttes til</span>
          <span class="selected-rule-topic">{selectedRule?.topic}</span>
          <p class="selected-rule-prop" class:ai={selectedRule?.isAiGenerated}>
            {selectedRule?.proposition}
          </p>
        </div>

        <div class="form-section">
          <span class="field-label">Hvordan forholder denne saken seg til rettssetningen?</span>
          <div class="evolution-segmented">
            {#each LINK_EVOLUTIONS as ev}
              <button
                class="evolution-option"
                class:active={evolution === ev.type}
                onclick={() => (evolution = ev.type)}
              >
                <span class="evolution-option-label">{ev.label}</span>
                <span class="evolution-option-desc">{ev.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="form-actions">
          <button class="action-btn" onclick={() => (selectedRuleId = null)}>Avbryt</button>
          <button class="btn-primary" onclick={handleLink}>
            <Link2 size={12} /> Knytt til rettssetning
          </button>
        </div>
      {/if}
    </div>

    <!-- Step: done -->
  {:else if step === 'done'}
    <div class="panel-body" in:fade={{ duration: 120 }}>
      <div class="done-block">
        <div class="done-icon"><Check size={16} /></div>
        <div class="done-content">
          {#if lastAction?.type === 'created'}
            <p class="done-text">
              Ny rettssetning opprettet under <strong>{lastAction.theme}</strong>.
            </p>
            <p class="done-sub">{caseRef} lagt til som første forekomst.</p>
          {:else if lastAction?.type === 'linked'}
            <p class="done-text">
              {caseRef} knyttet til <strong>{lastAction.ruleTopic}</strong>.
            </p>
            <p class="done-sub">
              Evolusjon: {EVOLUTION_CONFIG[lastAction.evolution].label}
            </p>
          {/if}
        </div>
      </div>

      <div class="done-actions">
        <button class="action-btn" onclick={handleMarkMore}>
          <Plus size={12} /> Marker flere
        </button>
        <button class="action-btn" onclick={onClose}>Ferdig</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .precedent-panel {
    border-top: 2px solid var(--ink);
    background: var(--paper);
  }

  /* ── Top bar ── */
  .panel-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
  }

  .panel-top-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ink);
  }

  .panel-title {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .panel-close {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.15s ease;
  }

  .panel-close:hover {
    color: var(--ink);
  }

  /* ── Body ── */
  .panel-body {
    padding: 20px 24px 28px;
  }

  /* ── AI Proposition (step: choose) ── */
  .ai-proposition {
    border-left: 2px solid var(--ai-accent);
    padding-left: 16px;
    margin-bottom: 12px;
  }

  .proposition-preview {
    font-family: var(--font-serif);
    font-size: 16px;
    font-style: italic;
    line-height: 1.55;
    color: var(--ai-accent);
  }

  .hint-text {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-muted);
    line-height: 1.5;
    margin-bottom: 20px;
  }

  /* ── Field labels ── */
  .field-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }

  .field-label.ai {
    color: var(--ai-accent);
  }

  /* ── Choose actions ── */
  .choose-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .choose-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    color: var(--ink-tertiary);
    width: 100%;
  }

  .choose-btn:hover {
    border-color: var(--border-strong);
    background: var(--hover-bg);
  }

  .choose-btn:hover .choose-btn-label {
    color: var(--ink);
  }

  .choose-btn-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .choose-btn-label {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-secondary);
    transition: color 0.15s ease;
  }

  .choose-btn-desc {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
  }

  /* ── Back link ── */
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-bottom: 16px;
    transition: color 0.15s ease;
  }

  .back-link:hover {
    color: var(--ink);
  }

  /* ── Form sections ── */
  .form-section {
    margin-bottom: 16px;
  }

  .prop-textarea {
    width: 100%;
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.55;
    color: var(--ink);
    padding: 12px;
    border: 1px solid var(--border-strong);
    border-radius: 2px;
    background: var(--paper);
    outline: none;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s ease;
  }

  .prop-textarea:focus {
    border-color: var(--control-border-focus);
  }

  .theme-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-input {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink);
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: var(--paper);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .theme-input:focus {
    border-color: var(--control-border-focus);
  }

  .theme-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ai-accent);
    flex-shrink: 0;
  }

  /* ── Evolution auto ── */
  .evolution-auto {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .evolution-auto-hint {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
  }

  /* ── Quote checklist ── */
  .quote-checklist {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .quote-check-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 10px;
    background: var(--paper-dark);
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .quote-check-row:hover {
    border-color: var(--border-strong);
  }

  .quote-check-row input[type='checkbox'] {
    accent-color: var(--ink);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .quote-check-para {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ai-accent);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .quote-check-text {
    font-family: var(--font-serif);
    font-size: 13px;
    font-style: italic;
    color: var(--ink-secondary);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* ── Form actions ── */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  /* ── Rule list (link step) ── */
  .rule-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rule-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 2px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.15s ease;
  }

  .rule-item:hover {
    border-color: var(--border-strong);
    background: var(--hover-bg);
  }

  .rule-item-main {
    flex: 1;
    min-width: 0;
  }

  .rule-item-theme {
    font-family: var(--font-serif);
    font-size: 11px;
    font-style: italic;
    color: var(--ink-muted);
    display: block;
    margin-bottom: 2px;
  }

  .rule-item-topic {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
    display: block;
    margin-bottom: 4px;
  }

  .rule-item-prop {
    font-family: var(--font-serif);
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .rule-item-prop.ai {
    font-style: italic;
    color: var(--ai-accent);
  }

  .rule-item-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .rule-item-count {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-secondary);
  }

  .rule-item-years {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
  }

  .rule-item-stars {
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    color: var(--gold-star);
  }

  .rule-item :global(.rule-item-arrow) {
    color: var(--ink-muted);
    flex-shrink: 0;
  }

  /* ── Link confirm ── */
  .selected-rule-preview {
    border-left: 2px solid var(--border-strong);
    padding-left: 16px;
    margin-bottom: 20px;
  }

  .selected-rule-topic {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
    display: block;
    margin-bottom: 4px;
  }

  .selected-rule-prop {
    font-family: var(--font-serif);
    font-size: 15px;
    line-height: 1.5;
    color: var(--ink);
  }

  .selected-rule-prop.ai {
    font-style: italic;
    color: var(--ai-accent);
  }

  /* ── Evolution segmented control ── */
  .evolution-segmented {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .evolution-option {
    flex: 1;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-right: 1px solid var(--border);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .evolution-option:last-child {
    border-right: none;
  }

  .evolution-option:hover {
    background: var(--hover-bg);
  }

  .evolution-option.active {
    background: var(--btn-primary-bg);
  }

  .evolution-option.active .evolution-option-label {
    color: var(--btn-primary-fg);
  }

  .evolution-option.active .evolution-option-desc {
    color: var(--btn-primary-fg);
    opacity: 0.7;
  }

  .evolution-option-label {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
    transition: color 0.15s ease;
  }

  .evolution-option-desc {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    transition: all 0.15s ease;
  }

  /* ── Done state ── */
  .done-block {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    background: color-mix(in srgb, var(--confirm-color) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--confirm-color) 15%, transparent);
    border-radius: 2px;
    margin-bottom: 16px;
  }

  .done-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--confirm-color);
    color: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .done-content {
    flex: 1;
  }

  .done-text {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.45;
  }

  .done-text strong {
    font-weight: 600;
  }

  .done-sub {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    margin-top: 4px;
  }

  .done-actions {
    display: flex;
    gap: 8px;
  }
</style>
