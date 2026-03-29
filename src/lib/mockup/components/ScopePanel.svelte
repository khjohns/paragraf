<script lang="ts">
  import { Plus, Sparkles } from 'lucide-svelte';
  import ScopeSection from './ScopeSection.svelte';
  import ProvisionTag from './ProvisionTag.svelte';
  import { MOCK_SCOPE } from '$lib/mockup/data/analyse';

  let openSections = $state({
    problem: true,
    sub: true,
    context: false,
    provisions: true,
    strategy: true,
    reasoning: false,
  });

  function toggleSection(key: keyof typeof openSections) {
    openSections[key] = !openSections[key];
  }

  let primaryProvisions = $derived(MOCK_SCOPE.provisions.filter((p) => p.primary));
  let secondaryProvisions = $derived(MOCK_SCOPE.provisions.filter((p) => !p.primary));
</script>

<aside class="scope-panel">
  <!-- 1. PROBLEMSTILLING -->
  <ScopeSection
    label="Problemstilling"
    open={openSections.problem}
    onToggle={() => toggleSection('problem')}
  >
    <div class="problem-text editable-field">
      {MOCK_SCOPE.refinedProblem}
    </div>
    <div class="ai-source">
      <Sparkles size={10} />
      <span class="ai-label">Spisset av KI fra:</span>
      <span class="ai-original"
        >&laquo;{MOCK_SCOPE.originalProblem.substring(0, 60)}&hellip;&raquo;</span
      >
    </div>
  </ScopeSection>

  <!-- 2. DELSPORSMAAL -->
  <ScopeSection label="Delspørsmål" open={openSections.sub} onToggle={() => toggleSection('sub')}>
    <div class="sub-problems">
      {#each MOCK_SCOPE.subProblems as sp, i}
        <div class="sub-problem-row">
          <span class="sub-number">{i + 1}.</span>
          <span class="sub-text editable-field">{sp.text}</span>
        </div>
      {/each}
      <button class="add-btn">
        <Plus size={11} /> Legg til delspørsmål
      </button>
    </div>
  </ScopeSection>

  <!-- 3. KONTEKST -->
  <ScopeSection
    label="Kontekst"
    open={openSections.context}
    onToggle={() => toggleSection('context')}
  >
    <div class="context-grid">
      {#each [['Prosedyre', MOCK_SCOPE.context.procedure], ['Terskelverdi', MOCK_SCOPE.context.threshold], ['Tjenesteområde', MOCK_SCOPE.context.service_area], ['Marked', MOCK_SCOPE.context.market]] as [label, value]}
        <div class="context-chip">
          <span class="chip-label">{label}</span>
          {#if value}
            <span class="chip-value editable-field">{value}</span>
          {:else}
            <span class="chip-empty">Ikke spesifisert</span>
          {/if}
        </div>
      {/each}
    </div>
  </ScopeSection>

  <!-- 4. BESTEMMELSER -->
  <ScopeSection
    label="Bestemmelser"
    open={openSections.provisions}
    onToggle={() => toggleSection('provisions')}
  >
    <div class="provisions-group">
      <div class="provision-section-label">Primære</div>
      <div class="provision-list">
        {#each primaryProvisions as p}
          <div class="prov-row">
            <ProvisionTag text={p.ref} small />
            <span class="prov-label">{p.label}</span>
            <div class="prov-reason">{p.reason}</div>
          </div>
        {/each}
      </div>
    </div>
    <div class="provisions-group secondary">
      <div class="provision-section-label muted">Sekundære</div>
      <div class="provision-list">
        {#each secondaryProvisions as p}
          <div class="prov-row">
            <span class="prov-ref-secondary">{p.ref}</span>
            <span class="prov-label muted">{p.label}</span>
            <div class="prov-reason">{p.reason}</div>
          </div>
        {/each}
      </div>
    </div>
    <button class="add-btn">
      <Plus size={11} /> Legg til bestemmelse
    </button>
  </ScopeSection>

  <!-- 5. SOKESTRATEGI -->
  <ScopeSection
    label="Søkestrategi"
    open={openSections.strategy}
    onToggle={() => toggleSection('strategy')}
  >
    <!-- Ref [R] -->
    <div class="strategy-group">
      <div class="strategy-label">
        <span class="strategy-dot" style:background="var(--ink-muted)"></span>
        Referansesøk [R]
      </div>
      <div class="strategy-tags">
        {#each MOCK_SCOPE.searchStrategy.refTable as r}
          <ProvisionTag text={r} small />
        {/each}
      </div>
    </div>

    <!-- FTS [F] -->
    <div class="strategy-group">
      <div class="strategy-label">
        <span class="strategy-dot" style:background="var(--signal-fts)"></span>
        Fulltekstsøk [F]
      </div>
      <div class="strategy-tags">
        {#each MOCK_SCOPE.searchStrategy.fts as t}
          <ProvisionTag text={t} small />
        {/each}
      </div>
    </div>

    <!-- Vector [V] -->
    <div class="strategy-group">
      <div class="strategy-label">
        <span class="strategy-dot" style:background="var(--ai-accent)"></span>
        Vektorsøk [V]
      </div>
      <div class="vector-queries">
        {#each MOCK_SCOPE.searchStrategy.vector as v}
          <div class="vector-query editable-field">{v}</div>
        {/each}
      </div>
    </div>

    <!-- Forarbeider -->
    <div class="strategy-group last">
      <div class="strategy-label-plain">Forarbeider</div>
      <div class="strategy-tags">
        {#each MOCK_SCOPE.searchStrategy.prepWork as p}
          <ProvisionTag text={p} small />
        {/each}
        <button class="add-tag-btn">+ Legg til</button>
      </div>
    </div>
  </ScopeSection>

  <!-- 6. RESONNEMENT -->
  <ScopeSection
    label="KI-resonnement"
    open={openSections.reasoning}
    onToggle={() => toggleSection('reasoning')}
    aiOwned
  >
    <div class="reasoning-block">
      <p class="reasoning-text">{MOCK_SCOPE.reasoning}</p>
    </div>
  </ScopeSection>
</aside>

<style>
  .scope-panel {
    width: 360px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow-y: auto;
    padding-bottom: 40px;
  }

  /* Problem */
  .problem-text {
    font-family: var(--font-serif);
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink);
    font-weight: 500;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: text;
    margin-bottom: 12px;
  }

  .ai-source {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ai-accent);
  }

  .ai-label {
    font-family: var(--font-sans);
    font-size: 10px;
  }

  .ai-original {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    font-style: italic;
  }

  /* Sub-problems */
  .sub-problems {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sub-problem-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .sub-number {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
    flex-shrink: 0;
    width: 16px;
    text-align: right;
  }

  .sub-text {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-secondary);
    line-height: 1.45;
    flex: 1;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: text;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 24px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.15s;
  }

  .add-btn:hover {
    color: var(--ink-tertiary);
  }

  /* Context */
  .context-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .context-chip {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chip-label {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    font-weight: 500;
  }

  .chip-value {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-secondary);
    font-weight: 500;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: text;
    display: inline-block;
  }

  .chip-empty {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-muted);
    font-style: italic;
    padding: 2px 8px;
    border: 1px dashed var(--border);
    border-radius: 2px;
    cursor: pointer;
    display: inline-block;
  }

  /* Provisions */
  .provisions-group {
    margin-bottom: 16px;
  }

  .provisions-group.secondary {
    margin-bottom: 12px;
  }

  .provision-section-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .provision-section-label.muted {
    color: var(--ink-muted);
  }

  .provision-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .prov-row {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .prov-label {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-tertiary);
  }

  .prov-label.muted {
    color: var(--ink-muted);
  }

  .prov-ref-secondary {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    border: 1px dashed var(--border-strong);
    padding: 2px 8px;
  }

  .prov-reason {
    display: none;
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 4px;
    width: 260px;
    z-index: 50;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-sans);
    font-size: 11px;
    padding: 8px;
    border-radius: 4px;
    pointer-events: none;
    white-space: normal;
    line-height: 1.4;
  }

  .prov-row:hover .prov-reason {
    display: block;
  }

  /* Strategy */
  .strategy-group {
    margin-bottom: 16px;
  }

  .strategy-group.last {
    margin-bottom: 0;
  }

  .strategy-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 8px;
  }

  .strategy-label-plain {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 8px;
  }

  .strategy-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .strategy-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vector-queries {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vector-query {
    font-family: var(--font-serif);
    font-size: 13px;
    font-style: italic;
    color: var(--ink-tertiary);
    line-height: 1.5;
    padding: 4px 4px 4px 12px;
    border: 1px solid transparent;
    border-left: 2px solid var(--ai-border);
    cursor: text;
  }

  .add-tag-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
    border: 1px dashed var(--border-strong);
    background: transparent;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-tag-btn:hover {
    border-color: var(--border-stronger);
    color: var(--ink-tertiary);
  }

  /* Reasoning */
  .reasoning-block {
    border-left: 2px solid var(--ai-border);
    padding-left: 12px;
  }

  .reasoning-text {
    font-family: var(--font-serif);
    font-size: 13px;
    font-style: italic;
    color: var(--ink-tertiary);
    line-height: 1.6;
  }

  /* Editable field affordance */
  .editable-field {
    transition: border-color 0.15s ease;
  }

  .editable-field:hover {
    border-color: var(--border-strong) !important;
  }
</style>
