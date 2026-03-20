<script lang="ts">
  import type { ScopingResult, ScopingProvision } from '$lib/types/analysis';
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { scopeAnalysis, traverseAnalysis, updateAnalysis } from '$lib/api/analyses';

  type Phase = 'input' | 'loading' | 'proposal' | 'searching';
  let phase = $state<Phase>('input');
  let scopingResult = $state<ScopingResult | null>(null);
  let errorMessage = $state<string | null>(null);
  let searchError = $state<string | null>(null);

  // Editable fields in proposal phase
  let editedProblem = $state('');
  let editedSubProblems = $state<string[]>([]);
  let editedProvisions = $state<ScopingProvision[]>([]);
  let editedFts = $state<string[]>([]);
  let editedVector = $state<string[]>([]);

  // Editing states
  type EditableField = 'problem';
  let editingField = $state<EditableField | null>(null);

  const problemText = $derived(analysisState.analysis.problemStatement);

  /** Apply a scoping result to editable state */
  function applyResult(result: ScopingResult) {
    scopingResult = result;
    editedProblem = result.refined_problem;
    editedSubProblems = [...result.sub_problems];
    editedProvisions = [...result.provisions];
    editedFts = [...result.search_strategy.fts];
    editedVector = [...result.search_strategy.vector];
  }

  /** Run a scoping request, applying results or showing errors */
  async function runScoping(prompt: string, errorPhase: Phase) {
    phase = 'loading';
    errorMessage = null;

    try {
      const result = await scopeAnalysis(analysisState.analysis.id, prompt);
      applyResult(result);
      phase = 'proposal';
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Noe gikk galt';
      phase = errorPhase;
    }
  }

  function submitToClaude() {
    if (!problemText.trim()) return;
    runScoping(problemText, 'input');
  }

  function revise() {
    const revisionPrompt = `Opprinnelig problemstilling: ${problemText}\n\nPresisert: ${editedProblem}\n\nDelspørsmål: ${editedSubProblems.join('; ')}\n\nVennligst revider forslaget basert på disse justeringene.`;
    runScoping(revisionPrompt, 'proposal');
  }

  async function approve() {
    if (!scopingResult) return;

    // Map provisions to seed format
    const provisions = editedProvisions.filter((p) => p.verified).map((p) => p.ref);

    // Update analysis with scoping results
    analysisState.setProblemStatement(editedProblem);
    analysisState.setSeeds({
      provisions,
      ftsTerms: editedFts,
      vectorQuery: editedVector.join('. '),
      cases: analysisState.analysis.seeds.cases,
    });
    analysisState.setStatus('searching');

    // Persist scoping result for later recall in ContextStrip
    analysisState.setScopingResult({
      refined_problem: editedProblem,
      sub_problems: editedSubProblems,
      provisions: editedProvisions,
      search_strategy: scopingResult!.search_strategy,
      context: scopingResult!.context,
      reasoning: scopingResult!.reasoning,
    });

    // Show searching phase with progress indicators
    phase = 'searching';
    searchError = null;

    try {
      // Persist seeds to DB before traversal (backend reads seeds from DB)
      await updateAnalysis(analysisState.analysis.id, {
        seeds: {
          provisions,
          ftsTerms: editedFts,
          vectorQuery: editedVector.join('. '),
          cases: analysisState.analysis.seeds.cases,
        },
        status: 'searching',
      });

      // Run traversal via backend — persists candidates and gaps
      const result = await traverseAnalysis(
        analysisState.analysis.id,
        analysisState.analysis.iteration
      );

      // Apply results to local state
      analysisState.setResults(result.nodes, result.edges, result.gaps, result.suggestedProvisions);
      analysisState.setStatus('candidates_ready');
    } catch (e) {
      searchError = e instanceof Error ? e.message : 'Søk feilet';
      analysisState.setStatus('scoping');
      phase = 'proposal';
    }
  }

  const contextLabels: Record<string, string> = {
    procedure: 'Prosedyre',
    service_area: 'Tjenesteområde',
    market: 'Marked',
    threshold: 'Terskelverdi',
  };
</script>

<div class="scoping-overlay">
  <!-- Step indicator -->
  <div class="step-indicator">
    {#each ['Problemstilling', 'Scoping', 'Søk', 'Kandidater'] as step, i}
      {@const isActive =
        (phase === 'input' && i === 0) ||
        ((phase === 'loading' || phase === 'proposal') && i === 1) ||
        (phase === 'searching' && i === 2)}
      {@const isDone = (i === 0 && phase !== 'input') || (i === 1 && phase === 'searching')}
      <div class="step-item">
        <div class="step-circle" class:active={isActive} class:done={isDone}>
          {#if isDone}
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
              />
            </svg>
          {:else}
            {i + 1}
          {/if}
        </div>
        <span class="step-label" class:active={isActive} class:done={isDone}>{step}</span>
      </div>
      {#if i < 3}
        <div class="step-connector" class:done={isDone}></div>
      {/if}
    {/each}
  </div>

  <!-- Phase content -->
  <div class="phase-content">
    {#if phase === 'input'}
      <div class="input-phase">
        <h2 class="phase-title">Ny analyse</h2>
        <p class="phase-desc">
          Beskriv problemstillingen. Claude vil vurdere og foreslå presisering, bestemmelser og
          søkestrategi.
        </p>

        <textarea
          class="problem-textarea"
          value={problemText}
          oninput={(e) => analysisState.setProblemStatement(e.currentTarget.value)}
          placeholder="Skriv problemstillingen her — kan være uformell…"
          rows="5"
        ></textarea>

        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}

        <div class="input-actions">
          <button class="btn-primary" onclick={submitToClaude} disabled={!problemText.trim()}>
            Vurder med Claude
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L8 4M11 7L8 10"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    {:else if phase === 'loading'}
      <div class="loading-phase">
        <div class="spinner"></div>
        <div class="loading-title">Analyserer problemstilling…</div>
        <div class="loading-desc">Claude vurderer bestemmelser, delspørsmål og søkestrategi</div>
      </div>
    {:else if phase === 'proposal' && scopingResult}
      <div class="proposal-phase">
        <!-- AI attribution -->
        <div class="ai-attribution">
          <span class="ai-badge">AI</span>
          <span class="ai-note">Forslag basert på din problemstilling — alt kan redigeres</span>
        </div>

        <!-- Refined problem -->
        <div class="field-group">
          <div class="field-header">
            <span class="field-label">Problemstilling (presisert)</span>
            <button
              class="edit-icon"
              aria-label="Rediger problemstilling"
              onclick={() => (editingField = editingField === 'problem' ? null : 'problem')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10"
                ><path
                  d="M7.5 1.5L8.5 2.5L3 8H2V7L7.5 1.5Z"
                  stroke="currentColor"
                  stroke-width="1"
                  fill="none"
                /></svg
              >
            </button>
          </div>
          {#if editingField === 'problem'}
            <textarea class="edit-textarea" bind:value={editedProblem} rows="3"></textarea>
          {:else}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="field-value clickable"
              onclick={() => (editingField = 'problem')}
              role="button"
              tabindex="0"
            >
              {editedProblem}
            </div>
          {/if}
        </div>

        <!-- Sub-problems -->
        <div class="field-group">
          <span class="field-label">Delspørsmål</span>
          {#each editedSubProblems as sp, i}
            <div class="sub-problem">
              <span class="sp-num">{i + 1}.</span>
              <span>{sp}</span>
            </div>
          {/each}
        </div>

        <!-- Context -->
        {#if scopingResult.context}
          <div class="field-group">
            <span class="field-label">Kontekst</span>
            <div class="context-grid">
              {#each Object.entries(scopingResult.context) as [key, val]}
                {#if val}
                  <div class="context-item">
                    <span class="context-key">{contextLabels[key] ?? key}</span>
                    <div class="context-val">{val}</div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Provisions -->
        <div class="field-group">
          <div class="field-header">
            <span class="field-label">Bestemmelser</span>
            <span class="field-note">— ordlyd hentet fra databasen</span>
            <span class="spacer"></span>
            <div class="verified-indicator">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M2 5L4 7L8 3"
                  stroke="var(--p-success)"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                />
              </svg>
              Verifisert mot lovtekst
            </div>
          </div>

          {#each editedProvisions as prov}
            <div class="provision-row" class:primary={prov.primary}>
              <div class="prov-header">
                <div class="verify-badge" class:verified={prov.verified}>
                  {#if prov.verified}
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="var(--p-success)"
                        stroke-width="1.5"
                        fill="none"
                        stroke-linecap="round"
                      />
                    </svg>
                  {/if}
                </div>
                <span class="prov-ref"
                  >{prov.ref
                    .replace('foa:', 'FOA § ')
                    .replace('loa:', 'LOA § ')
                    .replace('dir:', 'Dir. art. ')}</span
                >
                <span class="prov-label">{prov.label}</span>
                {#if prov.primary}
                  <span class="prov-primary-badge">Primær</span>
                {/if}
                {#if !prov.verified}
                  <span class="prov-unverified">Ikke i databasen</span>
                {/if}
              </div>
              {#if prov.excerpt}
                <div class="prov-excerpt">{prov.excerpt}</div>
              {/if}
            </div>
          {/each}

          <!-- Key connection note -->
          {#if scopingResult.reasoning}
            <div class="ai-note-block">
              <div class="ai-note-header">
                <span class="ai-badge">AI</span>
                <span class="ai-note-title">Nøkkelkobling</span>
              </div>
              <div class="ai-note-text">{scopingResult.reasoning}</div>
            </div>
          {/if}
        </div>

        <!-- Search strategy -->
        <div class="field-group">
          <span class="field-label">Søkestrategi</span>
          {#each [{ label: 'Referansetabell', items: scopingResult.search_strategy.ref_table, type: 'ref' }, { label: 'Fulltekstsøk', items: editedFts, type: 'fts' }, { label: 'Vektorsøk', items: editedVector, type: 'vec' }, { label: 'Forarbeider', items: scopingResult.search_strategy.prep_work, type: 'prep' }] as group}
            <div class="strategy-group">
              <div class="strategy-header">
                <div
                  class="strategy-dot"
                  class:ref={group.type === 'ref'}
                  class:fts={group.type === 'fts'}
                  class:vec={group.type === 'vec'}
                ></div>
                <span class="strategy-label">{group.label}</span>
              </div>
              {#each group.items as item}
                <div class="strategy-item" class:italic={group.type === 'vec'}>{item}</div>
              {/each}
            </div>
          {/each}
        </div>

        <!-- Reasoning — collapsible -->
        <details class="reasoning-details">
          <summary class="reasoning-summary">
            <span class="ai-badge">AI</span>
            Vis begrunnelse for forslaget
          </summary>
          <div class="reasoning-content">{scopingResult.reasoning}</div>
        </details>

        {#if searchError}
          <div class="error-message">{searchError}</div>
        {/if}

        <!-- Actions -->
        <div class="proposal-actions">
          <button class="btn-primary" onclick={approve}>
            Godkjenn og start søk
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7H11M11 7L8 4M11 7L8 10"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button class="btn-secondary" onclick={revise}> Be Claude revidere </button>
          <span class="actions-hint">Alt over kan redigeres — klikk på teksten</span>
        </div>
      </div>
    {:else if phase === 'searching'}
      <div class="searching-phase">
        <div class="spinner"></div>
        <div class="loading-title">Kjører primærsøk</div>
        <div class="loading-desc">Referansetabell · Fulltekstsøk · Vektorsøk</div>

        <div class="search-steps">
          {#each [{ label: 'Referansetabell', detail: editedProvisions
                .filter((p) => p.verified)
                .map((p) => p.ref.replace('foa:', '§ ').replace('loa:', '§ '))
                .join(', ') }, { label: 'Fulltekstsøk', detail: editedFts.join(', ') }, { label: 'Vektorsøk', detail: editedVector.length > 0 ? 'konseptuelt' : '' }] as step}
            {#if step.detail}
              <div class="search-step running">
                <div class="search-step-spinner"></div>
                <span class="search-step-label">{step.label}</span>
                <span class="search-step-detail">{step.detail}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .scoping-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: var(--p-bg);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  /* Step indicator */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 12px 24px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .step-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .step-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    border: 1.5px solid var(--p-border-s);
    color: var(--p-ink3);
    transition: all 0.15s ease;
  }
  .step-circle.active,
  .step-circle.done {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .step-label {
    font-size: 12px;
    color: var(--p-ink4);
  }
  .step-label.active {
    font-weight: 600;
    color: var(--p-ink);
  }
  .step-label.done {
    color: var(--p-ink2);
  }
  .step-connector {
    width: 32px;
    height: 1px;
    background: var(--p-border-m);
    margin: 0 8px;
  }
  .step-connector.done {
    background: var(--p-ink);
    opacity: 0.3;
  }

  /* Phase content */
  .phase-content {
    flex: 1;
    overflow-y: auto;
  }

  /* Input phase */
  .input-phase {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 24px;
  }
  .phase-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--p-ink);
    letter-spacing: -0.02em;
    margin: 0 0 4px;
  }
  .phase-desc {
    font-size: 13px;
    color: var(--p-ink3);
    margin: 0 0 24px;
  }
  .problem-textarea {
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--p-border-m);
    background: var(--p-surface);
    font-size: 14px;
    line-height: 1.6;
    color: var(--p-ink);
    font-family: var(--font-ui);
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }
  .problem-textarea:focus {
    border-color: var(--p-border-s);
  }
  .input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  /* Error */
  .error-message {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-danger-bg);
    border: 1px solid rgba(166, 61, 61, 0.15);
    font-size: 12px;
    color: var(--p-danger);
  }

  /* Loading phase */
  .loading-phase {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 24px;
    text-align: center;
  }
  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 16px;
    border-radius: 50%;
    border: 2px solid var(--p-border-m);
    border-top-color: var(--p-ai-border);
    animation: spin 1s linear infinite;
  }

  .loading-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--p-ink);
    margin-bottom: 4px;
  }
  .loading-desc {
    font-size: 13px;
    color: var(--p-ink3);
  }

  /* Searching phase */
  .searching-phase {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 24px;
    text-align: center;
  }
  .search-steps {
    margin-top: 24px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .search-step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    font-size: 12px;
  }
  .search-step-spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m);
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  .search-step-label {
    font-weight: 600;
    color: var(--p-ink);
  }
  .search-step-detail {
    color: var(--p-ink3);
    font-family: var(--font-data);
    font-size: 11px;
  }

  /* Proposal phase */
  .proposal-phase {
    max-width: 680px;
    margin: 0 auto;
    padding: 24px 24px 48px;
  }

  /* AI attribution */
  .ai-attribution {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .ai-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-ai-text);
  }
  .ai-note {
    font-size: 12px;
    color: var(--p-ink3);
  }

  /* Field groups */
  .field-group {
    margin-bottom: 16px;
  }
  .field-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .field-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .field-note {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .spacer {
    flex: 1;
  }
  .edit-icon {
    all: unset;
    cursor: pointer;
    opacity: 0.3;
    padding: 2px;
  }
  @media (hover: hover) {
    .edit-icon:hover {
      opacity: 0.7;
    }
  }
  .field-value {
    font-size: 13px;
    line-height: 1.55;
    color: var(--p-ink);
    padding: 8px 0;
    border-bottom: 1px dashed var(--p-border);
  }
  .field-value.clickable {
    cursor: pointer;
  }
  @media (hover: hover) {
    .field-value.clickable:hover {
      border-bottom-color: var(--p-border-m);
    }
  }
  .edit-textarea {
    width: 100%;
    padding: 8px;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border-s);
    background: var(--p-input);
    font-size: 13px;
    line-height: 1.55;
    color: var(--p-ink);
    font-family: var(--font-ui);
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }

  /* Sub-problems */
  .sub-problem {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    font-size: 13px;
    color: var(--p-ink);
    line-height: 1.5;
  }
  .sp-num {
    font-family: var(--font-data);
    font-size: 11px;
    color: var(--p-ink4);
    min-width: 16px;
    margin-top: 2px;
  }

  /* Context */
  .context-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    font-size: 12px;
    color: var(--p-ink2);
    line-height: 1.5;
  }
  .context-item {
    padding: 4px 0;
  }
  .context-key {
    color: var(--p-ink4);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .context-val {
    margin-top: 2px;
  }

  /* Provisions */
  .provision-row {
    padding: 8px 12px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--p-border);
    margin-bottom: 8px;
  }
  .provision-row.primary {
    background: var(--p-surface);
    border-color: var(--p-border-m);
  }
  .prov-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .verify-badge {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-badge);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--p-warn-bg);
    border: 1.5px solid var(--p-warn);
  }
  .verify-badge.verified {
    background: var(--p-success-bg);
    border-color: var(--p-success);
  }
  .prov-ref {
    font-family: var(--font-data);
    font-size: 13px;
    font-weight: 700;
    color: var(--p-provision-accent);
  }
  .prov-label {
    font-size: 12px;
    color: var(--p-ink2);
  }
  .prov-primary-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-provision-bg);
    color: var(--p-provision-accent);
  }
  .prov-unverified {
    font-size: 10px;
    color: var(--p-warn);
    font-style: italic;
  }
  .prov-excerpt {
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--p-ink);
    padding-left: 24px;
    border-left: 2px solid var(--p-provision-bg);
    margin-left: 8px;
  }
  .verified-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--p-success);
  }

  /* AI note block */
  .ai-note-block {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
  }
  .ai-note-header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }
  .ai-note-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ai-text);
  }
  .ai-note-text {
    font-size: 12px;
    line-height: 1.55;
    color: var(--p-ink2);
  }

  /* Search strategy */
  .strategy-group {
    margin-bottom: 8px;
  }
  .strategy-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .strategy-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--p-ink4);
  }
  .strategy-dot.ref {
    background: var(--p-ink);
  }
  .strategy-dot.fts {
    background: var(--p-ink2);
  }
  .strategy-dot.vec {
    background: var(--p-ink3);
  }
  .strategy-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .strategy-item {
    padding: 4px 8px 4px 20px;
    font-size: 12px;
    color: var(--p-ink2);
  }
  .strategy-item.italic {
    font-style: italic;
  }

  /* Reasoning */
  .reasoning-details {
    margin-bottom: 24px;
  }
  .reasoning-summary {
    font-size: 11px;
    color: var(--p-ink4);
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .reasoning-content {
    padding: 8px 12px;
    margin-top: 4px;
    border-radius: var(--radius-md);
    background: var(--p-ai-bg);
    border-left: 3px solid var(--p-ai-border-subtle);
    font-size: 13px;
    line-height: 1.6;
    color: var(--p-ink2);
  }

  /* Action buttons */
  .proposal-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    border-top: 1px solid var(--p-border);
  }
  .actions-hint {
    flex: 1;
    text-align: right;
    font-size: 11px;
    color: var(--p-ink4);
  }

  .btn-primary {
    padding: 8px 20px;
    border-radius: var(--radius-lg);
    background: var(--p-ink);
    color: var(--p-panel);
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.12s ease;
  }
  @media (hover: hover) {
    .btn-primary:hover {
      opacity: 0.85;
    }
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn-secondary {
    padding: 8px 16px;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--p-ink2);
    border: 1px solid var(--p-border-m);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  @media (hover: hover) {
    .btn-secondary:hover {
      border-color: var(--p-border-s);
      color: var(--p-ink);
    }
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .input-phase,
    .loading-phase,
    .searching-phase,
    .proposal-phase {
      max-width: 100%;
      padding-left: 16px;
      padding-right: 16px;
    }
    .context-grid {
      grid-template-columns: 1fr;
    }
    .step-indicator {
      padding: 10px 12px;
      overflow-x: auto;
    }
  }
</style>
