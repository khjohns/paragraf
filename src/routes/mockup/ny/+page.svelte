<script lang="ts">
  import '$lib/mockup/tokens.css';
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Sparkles, Plus, ChevronRight, Loader2, ArrowRight } from 'lucide-svelte';
  import MockupHeader from '$lib/mockup/components/MockupHeader.svelte';
  import ReviewSection from '$lib/mockup/components/ReviewSection.svelte';
  import EditableText from '$lib/mockup/components/EditableText.svelte';
  import EditableContextChip from '$lib/mockup/components/EditableContextChip.svelte';
  import EditableProvisionTag from '$lib/mockup/components/EditableProvisionTag.svelte';
  import SignalGroup from '$lib/mockup/components/SignalGroup.svelte';
  import SectionSkeleton from '$lib/mockup/components/SectionSkeleton.svelte';
  import {
    SECTION_LABELS,
    SECTION_DELAYS,
    MOCK_SCOPING,
    type Provision,
  } from '$lib/mockup/data/ny-analyse';

  let darkMode = $state(false);
  let inputText = $state('');
  let showContext = $state(false);
  let contextData = $state({ procedure: '', threshold: '', serviceArea: '', provisions: '' });

  // Streaming state
  let streaming = $state(false);
  let completed = $state(0); // 0–6
  let cancelled = $state(false);
  let provisions = $state<Provision[]>([...MOCK_SCOPING.provisions]);
  let timerHandle: ReturnType<typeof setTimeout> | null = null;

  // Elapsed timer
  let elapsed = $state(0);
  let elapsedHandle: ReturnType<typeof setInterval> | null = null;
  let elapsedDisplay = $derived.by(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  onDestroy(stopTimers);

  // Textarea auto-resize
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  function resizeTextarea() {
    if (textareaEl && !streaming) {
      textareaEl.style.height = 'auto';
      textareaEl.style.height = Math.max(80, textareaEl.scrollHeight) + 'px';
    }
  }

  // Derived state
  let canSubmit = $derived(inputText.trim().length > 10);
  let done = $derived(completed >= 6);
  let hasContent = $derived(completed > 0);
  let showCTA = $derived(done || (cancelled && hasContent));
  let inputCollapsed = $derived(streaming || hasContent);

  // ── Streaming simulation ──
  function startStreaming() {
    if (!canSubmit) return;
    completed = 0;
    cancelled = false;
    provisions = [...MOCK_SCOPING.provisions];
    streaming = true;
    elapsed = 0;

    // Start elapsed timer
    elapsedHandle = setInterval(() => (elapsed += 1), 1000);

    // Progressive section completion
    let section = 0;
    function advance() {
      section++;
      completed = section;
      scrollToSection(section);
      if (section >= 6) {
        stopTimers();
        streaming = false;
        return;
      }
      timerHandle = setTimeout(advance, SECTION_DELAYS[section]);
    }
    timerHandle = setTimeout(advance, SECTION_DELAYS[0]);
  }

  function handleCancel() {
    stopTimers();
    streaming = false;
    cancelled = true;
  }

  function stopTimers() {
    if (timerHandle) clearTimeout(timerHandle);
    if (elapsedHandle) clearInterval(elapsedHandle);
    timerHandle = null;
    elapsedHandle = null;
  }

  function resetToInput() {
    completed = 0;
    cancelled = false;
  }

  function handleStartDirect() {
    if (!inputText.trim()) return;
    goto('/mockup/analyse');
  }

  function handleStartAnalysis() {
    goto('/mockup/analyse');
  }

  let primaryProvisions = $derived(provisions.filter((p) => p.primary));
  let secondaryProvisions = $derived(provisions.filter((p) => !p.primary));

  function removeProvision(ref: string) {
    provisions = provisions.filter((p) => p.ref !== ref);
  }

  function scrollToSection(sectionNum: number) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${sectionNum}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
</script>

<div class="mockup-root" class:dark={darkMode}>
  <MockupHeader {darkMode} onToggleDarkMode={() => (darkMode = !darkMode)} pageTitle="Ny analyse" />

  <div class="main-scroll">
    <div class="content-column">
      <!-- ── INPUT AREA ── -->
      <div class="input-area" class:collapsed={inputCollapsed}>
        {#if !inputCollapsed}
          <button class="btn-back" onclick={() => goto('/mockup')}>
            <ArrowLeft size={12} /> Tilbake til porteføljen
          </button>

          <h1 class="page-heading">Ny analyse</h1>
          <p class="page-intro">
            Beskriv hva du vil undersøke. KI strukturerer en forskningsplan, eller start direkte med
            et åpent scope-panel.
          </p>
        {/if}

        <!-- Input: full textarea or collapsed summary -->
        {#if inputCollapsed}
          <div class="input-summary-bar">
            <span class="input-label">Input</span>
            <span class="input-summary-text">«{inputText}»</span>
            {#if !streaming}
              <button class="btn-ghost" onclick={resetToInput}>Endre</button>
            {/if}
          </div>
        {:else}
          <div class="textarea-container">
            <textarea
              bind:this={textareaEl}
              class="problem-textarea"
              placeholder="Beskriv problemstillingen din uformelt…"
              bind:value={inputText}
              oninput={resizeTextarea}
              rows={3}
            ></textarea>
          </div>

          <!-- Optional context -->
          <div class="context-section">
            <button class="context-toggle" onclick={() => (showContext = !showContext)}>
              <ChevronRight size={11} class="ctx-chevron {showContext ? 'open' : ''}" />
              Jeg vet allerede…
              <span class="optional-hint">(valgfritt)</span>
            </button>

            {#if showContext}
              <div class="context-panel fade-up">
                <p class="context-hint">
                  Brukes som input til KI-analysen, eller overføres til scope-panelet ved direkte
                  start.
                </p>
                <div class="context-grid">
                  <div class="context-field">
                    <label class="context-field-label" for="ctx-procedure">Prosedyre</label>
                    <input
                      id="ctx-procedure"
                      class="context-input"
                      placeholder="F.eks. åpen anbudskonkurranse"
                      bind:value={contextData.procedure}
                    />
                  </div>
                  <div class="context-field">
                    <label class="context-field-label" for="ctx-threshold">Terskelverdi</label>
                    <input
                      id="ctx-threshold"
                      class="context-input"
                      placeholder="F.eks. EØS, nasjonal"
                      bind:value={contextData.threshold}
                    />
                  </div>
                  <div class="context-field">
                    <label class="context-field-label" for="ctx-service">Tjenesteområde</label>
                    <input
                      id="ctx-service"
                      class="context-input"
                      placeholder="F.eks. IKT, bygg, helse"
                      bind:value={contextData.serviceArea}
                    />
                  </div>
                  <div class="context-field">
                    <label class="context-field-label" for="ctx-provisions">Bestemmelser</label>
                    <input
                      id="ctx-provisions"
                      class="context-input"
                      placeholder="F.eks. FOA § 16-11"
                      bind:value={contextData.provisions}
                    />
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Actions -->
          <div class="actions-row">
            <button class="btn-analyze" disabled={!canSubmit} onclick={startStreaming}>
              <Sparkles size={13} /> Analyser med KI
            </button>
            <span class="or-separator">eller</span>
            <button class="direct-link" disabled={!canSubmit} onclick={handleStartDirect}>
              Start direkte <ArrowRight size={11} />
            </button>
          </div>
        {/if}
      </div>

      <!-- ── STREAMING / REVIEW AREA ── -->
      {#if hasContent || streaming}
        <div class="review-area">
          <!-- Progress indicator -->
          {#if streaming}
            <div class="progress-block fade-up">
              <div class="progress-header">
                <div class="progress-info">
                  <Loader2 size={12} class="spinner" />
                  <span class="progress-label">Seksjon {Math.min(completed + 1, 6)} av 6</span>
                  <span class="progress-timer">{elapsedDisplay}</span>
                </div>
                <button class="btn-ghost cancel-btn" onclick={handleCancel}>Avbryt</button>
              </div>
              <div class="progress-strip">
                {#each SECTION_LABELS as _, i}
                  <div
                    class="progress-segment"
                    class:done={i < completed}
                    class:active={i === completed}
                  ></div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Review header (after streaming ends) -->
          {#if !streaming && hasContent}
            <div class="review-header">
              <div class="review-title-row">
                <Sparkles size={14} class="review-sparkles" />
                <span class="review-title">
                  Forskningsplan{cancelled ? ` · ${completed} av 6 seksjoner` : ''}
                </span>
              </div>
              <p class="review-subtitle">
                {#if cancelled}
                  Analysen ble avbrutt. Du kan starte med det som er klart, eller kjøre på nytt.
                {:else}
                  Klikk på tekst for å redigere. Scopet kan justeres underveis i analysen.
                {/if}
              </p>
            </div>
          {/if}

          <!-- Initial wait — before first section arrives -->
          {#if streaming && completed === 0}
            <div class="wait-text fade-up">
              <p>
                Leser problemstillingen din og identifiserer relevante rettskilder i grafen. Første
                seksjon dukker opp om et øyeblikk.
              </p>
            </div>
          {/if}

          <!-- 1. Problemstilling -->
          {#if completed >= 1}
            <div id="section-1" class="fade-up">
              <ReviewSection label="Problemstilling" defaultOpen>
                {#snippet children()}
                  <EditableText
                    initialValue={MOCK_SCOPING.refinedProblem}
                    aiGenerated
                    serif
                    size={17}
                    weight={500}
                    multiline
                  />
                  <div class="ai-note">
                    <Sparkles size={10} />
                    <span>Spisset av KI fra din input</span>
                  </div>
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- 2. Delspørsmål -->
          {#if completed >= 2}
            <div id="section-2" class="fade-up">
              <ReviewSection label="Delspørsmål" defaultOpen>
                {#snippet children()}
                  <div class="sub-problems">
                    {#each MOCK_SCOPING.subProblems as sp, i}
                      <div class="sub-problem-row">
                        <span class="sub-problem-num">{i + 1}.</span>
                        <EditableText initialValue={sp.text} aiGenerated serif size={14} />
                      </div>
                    {/each}
                    <button class="btn-ghost add-sub">
                      <Plus size={11} /> Legg til delspørsmål
                    </button>
                  </div>
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- 3. Kontekst -->
          {#if completed >= 3}
            <div id="section-3" class="fade-up">
              <ReviewSection label="Kontekst" defaultOpen={false}>
                {#snippet children()}
                  <div class="context-chips-grid">
                    <EditableContextChip
                      label="Prosedyre"
                      initialValue={MOCK_SCOPING.context.procedure}
                    />
                    <EditableContextChip
                      label="Terskelverdi"
                      initialValue={MOCK_SCOPING.context.threshold}
                    />
                    <EditableContextChip
                      label="Tjenesteområde"
                      initialValue={MOCK_SCOPING.context.service_area}
                    />
                    <EditableContextChip
                      label="Marked"
                      initialValue={MOCK_SCOPING.context.market}
                    />
                  </div>
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- 4. Bestemmelser -->
          {#if completed >= 4}
            <div id="section-4" class="fade-up">
              <ReviewSection label="Bestemmelser" defaultOpen>
                {#snippet children()}
                  <div class="provisions-group">
                    <span class="provisions-label">Primære</span>
                    <div class="provisions-row">
                      {#each primaryProvisions as p (p.ref)}
                        <EditableProvisionTag
                          ref={p.ref}
                          label={p.label}
                          primary
                          reason={p.reason}
                          onRemove={() => removeProvision(p.ref)}
                        />
                      {/each}
                    </div>
                  </div>
                  <div class="provisions-group">
                    <span class="provisions-label">Sekundære</span>
                    <div class="provisions-row">
                      {#each secondaryProvisions as p (p.ref)}
                        <EditableProvisionTag
                          ref={p.ref}
                          label={p.label}
                          primary={false}
                          reason={p.reason}
                          onRemove={() => removeProvision(p.ref)}
                        />
                      {/each}
                    </div>
                  </div>
                  <button class="btn-ghost add-provision">
                    <Plus size={11} /> Legg til bestemmelse
                  </button>
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- 5. Søkestrategi -->
          {#if completed >= 5}
            <div id="section-5" class="fade-up">
              <ReviewSection label="Søkestrategi" defaultOpen>
                {#snippet children()}
                  <SignalGroup
                    type="ref"
                    label="Referansekoblinger"
                    color="var(--ink-muted)"
                    items={MOCK_SCOPING.searchStrategy.ref}
                  />
                  <SignalGroup
                    type="fts"
                    label="Fulltekstsøk"
                    color="var(--signal-fts)"
                    items={MOCK_SCOPING.searchStrategy.fts}
                  />
                  <SignalGroup
                    type="vector"
                    label="Konseptsøk"
                    color="var(--ai-accent)"
                    items={MOCK_SCOPING.searchStrategy.vector}
                  />
                  <SignalGroup
                    type="prepWork"
                    label="Forarbeider"
                    color="var(--ink-tertiary)"
                    items={MOCK_SCOPING.searchStrategy.prepWork}
                  />
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- 6. KI-resonnement -->
          {#if completed >= 6}
            <div id="section-6" class="fade-up">
              <ReviewSection label="KI-resonnement" defaultOpen={false} aiOwned>
                {#snippet children()}
                  <div class="reasoning-block">
                    <p>{MOCK_SCOPING.reasoning}</p>
                  </div>
                {/snippet}
              </ReviewSection>
            </div>
          {/if}

          <!-- Pending section skeleton -->
          {#if streaming && completed < 6}
            <SectionSkeleton label={SECTION_LABELS[completed]} />
          {/if}

          <!-- CTA -->
          {#if showCTA}
            <div class="cta-area fade-up">
              <div class="cta-row">
                <button class="btn-start" onclick={handleStartAnalysis}>
                  {cancelled ? `Start med ${completed} seksjoner` : 'Start analyse'}
                  <ArrowRight size={14} />
                </button>
                {#if cancelled}
                  <button class="btn-ghost" onclick={resetToInput}>Kjør på nytt</button>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── Layout ── */
  .mockup-root {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .main-scroll {
    flex: 1;
    overflow-y: auto;
  }

  .content-column {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* ── Input area ── */
  .input-area {
    padding-top: 64px;
    transition: padding-top 0.3s ease;
  }

  .input-area.collapsed {
    padding-top: 32px;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 0;
    margin-bottom: 32px;
    transition: color 0.15s ease;
  }

  .btn-back:hover {
    color: var(--ink);
  }

  .page-heading {
    font-family: var(--font-serif);
    font-size: 28px;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.015em;
    line-height: 1.25;
    margin-bottom: 8px;
  }

  .page-intro {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--ink-tertiary);
    line-height: 1.5;
    margin-bottom: 40px;
    max-width: 520px;
  }

  /* ── Collapsed input summary ── */
  .input-summary-bar {
    padding: 12px;
    background: var(--paper-dark);
    border: 1px solid var(--border);
    border-radius: 2px;
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 24px;
  }

  .input-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    flex-shrink: 0;
  }

  .input-summary-text {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-tertiary);
    font-style: italic;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* ── Textarea ── */
  .textarea-container {
    border-top: 2px solid var(--ink);
    padding-top: 24px;
    margin-bottom: 20px;
  }

  .problem-textarea {
    width: 100%;
    resize: none;
    overflow: hidden;
    font-family: var(--font-serif);
    font-size: 22px;
    line-height: 1.5;
    font-weight: 400;
    color: var(--ink);
    letter-spacing: -0.01em;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    min-height: 80px;
  }

  .problem-textarea::placeholder {
    color: var(--ink-muted);
    font-style: italic;
  }

  /* ── Context toggle ── */
  .context-section {
    margin-bottom: 32px;
  }

  .context-toggle {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 0;
    transition: color 0.15s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .context-toggle:hover {
    color: var(--ink-tertiary);
  }

  .context-toggle :global(.ctx-chevron) {
    transition: transform 0.15s ease;
  }

  .context-toggle :global(.ctx-chevron.open) {
    transform: rotate(90deg);
  }

  .optional-hint {
    font-size: 11px;
    color: var(--ink-muted);
    font-weight: 400;
    font-style: italic;
  }

  .context-panel {
    margin-top: 12px;
    padding: 16px;
    background: var(--paper-dark);
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .context-hint {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-muted);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .context-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .context-field-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    display: block;
    margin-bottom: 4px;
  }

  .context-input {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-secondary);
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    border-radius: 2px;
    padding: 8px 10px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .context-input:focus {
    border-color: var(--control-border-focus);
  }

  .context-input::placeholder {
    color: var(--ink-muted);
    font-style: italic;
  }

  /* ── Actions row ── */
  .actions-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-analyze {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 13px;
    padding: 8px 20px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    background: var(--btn-primary-bg);
    color: var(--btn-primary-fg);
    border: 1.5px solid transparent;
  }

  .btn-analyze:hover:not(:disabled) {
    background: var(--btn-primary-hover);
  }

  .btn-analyze:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .or-separator {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-muted);
  }

  .direct-link {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    border-bottom: 1px dashed var(--border);
    cursor: pointer;
    padding: 8px 0;
    transition: color 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .direct-link:hover {
    color: var(--ink-secondary);
    border-color: var(--border-strong);
  }

  .direct-link:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── btn-ghost (reused) ── */
  .btn-ghost {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .btn-ghost:hover {
    color: var(--ink);
  }

  /* ── Progress indicator ── */
  .progress-block {
    margin-bottom: 24px;
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .progress-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress-info :global(.spinner) {
    color: var(--ai-accent);
    animation: spin 1.2s linear infinite;
  }

  .progress-label {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--ai-accent);
  }

  .progress-timer {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .cancel-btn {
    font-size: 11px;
    color: var(--ink-muted);
  }

  .progress-strip {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .progress-segment {
    height: 2px;
    border-radius: 1px;
    flex: 1;
    background: var(--border);
    transition: background 0.3s ease;
  }

  .progress-segment.done {
    background: var(--ai-accent);
  }

  .progress-segment.active {
    background: var(--ai-accent);
    opacity: 0.4;
  }

  /* ── Review header ── */
  .review-header {
    border-top: 2px solid var(--ink);
    padding-top: 24px;
    margin-bottom: 24px;
  }

  .review-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .review-title-row :global(.review-sparkles) {
    color: var(--ai-accent);
  }

  .review-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ai-accent);
  }

  .review-subtitle {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-tertiary);
    line-height: 1.5;
  }

  /* ── Wait text ── */
  .wait-text {
    padding: 32px 0;
  }

  .wait-text p {
    font-family: var(--font-serif);
    font-size: 15px;
    font-style: italic;
    color: var(--ai-accent);
    line-height: 1.6;
    max-width: 460px;
  }

  /* ── Section content helpers ── */
  .ai-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    color: var(--ai-accent);
    font-family: var(--font-sans);
    font-size: 10px;
  }

  .sub-problems {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sub-problem-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .sub-problem-num {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    flex-shrink: 0;
    width: 16px;
    text-align: right;
  }

  .add-sub {
    margin-left: 24px;
    margin-top: 4px;
  }

  .context-chips-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .provisions-group {
    margin-bottom: 12px;
  }

  .provisions-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    display: block;
    margin-bottom: 8px;
  }

  .provisions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .add-provision {
    margin-top: 12px;
  }

  .reasoning-block {
    border-left: 2px solid var(--ai-accent);
    padding-left: 16px;
  }

  .reasoning-block p {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ai-accent);
    font-style: italic;
    line-height: 1.65;
  }

  /* ── CTA ── */
  .cta-area {
    padding-top: 40px;
    border-top: 1px solid var(--border-subtle);
    margin-top: 8px;
  }

  .cta-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-start {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 14px;
    padding: 10px 24px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    background: var(--btn-primary-bg);
    color: var(--btn-primary-fg);
    border: 1.5px solid transparent;
  }

  .btn-start:hover {
    background: var(--btn-primary-hover);
  }

  /* ── Animations ── */
  .fade-up {
    opacity: 0;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
