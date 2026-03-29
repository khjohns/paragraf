<script lang="ts">
  import { Sparkles, Check, Star, Scale, Edit3, Plus, X } from 'lucide-svelte';
  import EvidencePanel from './EvidencePanel.svelte';
  import {
    MOCK_RETTSSETNINGER,
    THEMES,
    groupByTheme,
    type Rettssetning,
  } from '$lib/mockup/data/rettssetninger';

  let rules = $state<Rettssetning[]>([...MOCK_RETTSSETNINGER]);
  let selectedRuleId = $state<string | null>(MOCK_RETTSSETNINGER[0].id);
  let editingRuleId = $state<string | null>(null);
  let editBuffer = $state('');

  const selectedRule = $derived(rules.find((r) => r.id === selectedRuleId) ?? null);
  const groupedByTheme = $derived(groupByTheme(rules));
  const aiCount = $derived(rules.filter((r) => r.isAiGenerated).length);
  const tensionCount = $derived(rules.filter((r) => r.tension).length);

  /** Pre-computed tension target map to avoid O(N²) lookups in render */
  const tensionTargetMap = $derived(
    new Map(
      rules
        .filter((r) => r.tension)
        .map((r) => [r.id, rules.find((x) => x.id === r.tension!.withId)?.topic ?? null])
    )
  );

  function handleRowClick(id: string) {
    if (editingRuleId === id) return;
    selectedRuleId = id;
  }

  function startEditing(rule: Rettssetning, e: MouseEvent) {
    e.stopPropagation();
    editingRuleId = rule.id;
    editBuffer = rule.proposition;
  }

  function saveEdit(id: string) {
    rules = rules.map((r) =>
      r.id === id ? { ...r, proposition: editBuffer, isAiGenerated: false, lastEditedBy: 'Meg' } : r
    );
    editingRuleId = null;
  }

  function cancelEdit() {
    editingRuleId = null;
    editBuffer = '';
  }

  function navigateToRule(id: string) {
    selectedRuleId = id;
  }
</script>

<div class="registry-layout">
  <!-- MAIN REGISTER -->
  <main class="register">
    <div class="register-header">
      <h2 class="register-title">Rettssetninger</h2>
      <p class="register-subtitle">
        {rules.length} rettssetninger i {THEMES.length} temaer &mdash;
        {aiCount} KI-foreslåtte &middot;
        {tensionCount} spenning{tensionCount !== 1 ? 'er' : ''}
      </p>
    </div>

    <div class="register-body">
      {#each groupedByTheme as group, gi}
        <!-- Theme header -->
        <div class="theme-header" class:core={gi === 0}>
          <h3 class="theme-title" class:core={gi === 0}>{group.theme}</h3>
        </div>

        {#each group.rules as r (r.id)}
          {@const isSelected = selectedRuleId === r.id}
          {@const isEditing = editingRuleId === r.id}
          {@const starCount = r.cases.filter((c) => c.star).length}

          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="register-row"
            class:row-active={isSelected}
            class:ai-border={r.isAiGenerated && !isSelected}
            onclick={() => handleRowClick(r.id)}
          >
            <div class="rule-row">
              <!-- Col 1: Proposition -->
              <div class="prop-col">
                <div class="prop-topic">{r.topic}</div>

                {#if isEditing}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div onclick={(e) => e.stopPropagation()}>
                    <textarea class="edit-textarea" bind:value={editBuffer}></textarea>
                    <div class="edit-actions">
                      <button class="action-btn" onclick={cancelEdit}>Avbryt</button>
                      <button class="btn-primary" onclick={() => saveEdit(r.id)}>
                        <Check size={12} /> Lagre
                      </button>
                    </div>
                  </div>
                {:else}
                  <div class="prop-text" class:ai={r.isAiGenerated}>
                    {r.proposition}
                  </div>
                {/if}

                <!-- Tension indicator -->
                {#if r.tension && !isEditing}
                  {@const tensionTopic = tensionTargetMap.get(r.id)}
                  {#if tensionTopic}
                    <div class="tension-indicator">
                      <Scale size={12} />
                      <span>Spenning med: {tensionTopic}</span>
                    </div>
                  {/if}
                {/if}
              </div>

              <!-- Col 2: Status -->
              <div class="status-col">
                {#if r.isAiGenerated}
                  <div class="status-badge ai">
                    <Sparkles size={11} />
                    <span>KI-utkast</span>
                  </div>
                {:else}
                  <div class="status-badge verified">
                    <Check size={11} />
                    <span>Verifisert</span>
                  </div>
                {/if}
                <div class="status-meta">Sist: {r.lastEditedBy}</div>
              </div>

              <!-- Col 3: Omfang -->
              <div class="scope-col">
                <span class="scope-count">{r.cases.length} forekomster</span>
                <span class="scope-years">{r.yearSpan}</span>
                {#if starCount > 0}
                  <span class="scope-stars">
                    <Star size={11} fill="currentColor" />
                    {starCount}
                  </span>
                {/if}
              </div>

              <!-- Col 4: Edit -->
              <div class="edit-col">
                {#if !isEditing}
                  <button class="edit-btn" onclick={(e) => startEditing(r, e)} title="Rediger">
                    <Edit3 size={14} />
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      {/each}

      <div class="add-row">
        <button class="action-btn add-btn">
          <Plus size={14} /> Opprett ny rettssetning
        </button>
      </div>
    </div>
  </main>

  <!-- EVIDENCE PANEL -->
  {#if selectedRule}
    <div class="evidence-slot">
      <EvidencePanel
        rule={selectedRule}
        allRules={rules}
        onClose={() => (selectedRuleId = null)}
        onNavigateToRule={navigateToRule}
      />
    </div>
  {/if}
</div>

<style>
  .registry-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Register main */
  .register {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .register-header {
    padding: 20px 24px 12px;
    flex-shrink: 0;
    border-bottom: 2px solid var(--ink);
  }

  .register-title {
    font-family: var(--font-serif);
    font-size: 24px;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .register-subtitle {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-tertiary);
    margin-top: 4px;
  }

  .register-body {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 80px;
  }

  /* Theme headers */
  .theme-header {
    padding: 16px 24px 8px;
    border-bottom: 1px solid var(--border);
  }

  .theme-title {
    font-family: var(--font-serif);
    font-size: 16px;
    font-style: italic;
    font-weight: 400;
    color: var(--ink-tertiary);
  }

  .theme-title.core {
    font-size: 18px;
    color: var(--ink-secondary);
  }

  /* Register rows */
  .register-row {
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .register-row:hover {
    background: var(--hover-bg);
  }

  .register-row:hover .edit-btn {
    opacity: 1;
  }

  .register-row:focus-visible {
    outline: none;
    box-shadow: inset 2px 0 0 var(--control-border-focus);
    background: var(--hover-bg);
  }

  .register-row.row-active {
    background: var(--row-active-bg);
    box-shadow: inset 3px 0 0 var(--ink);
  }

  .register-row.ai-border {
    box-shadow: inset 3px 0 0 var(--ai-border);
  }

  /* 4-column grid */
  .rule-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 112px 112px 36px;
    gap: 20px;
    align-items: start;
    padding: 16px 24px;
  }

  /* Col 1: Proposition */
  .prop-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .prop-topic {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  .prop-text {
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.6;
    color: var(--ink);
    padding-right: 16px;
  }

  .prop-text.ai {
    font-style: italic;
    color: var(--ai-accent);
  }

  /* Editing */
  .edit-textarea {
    width: 100%;
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.6;
    color: var(--ink);
    padding: 12px;
    border: 1px solid var(--border-stronger);
    border-radius: 2px;
    background: var(--paper);
    outline: none;
    resize: vertical;
    min-height: 120px;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  /* Tension indicator */
  .tension-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    color: var(--tension-color);
  }

  .tension-indicator span {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
  }

  /* Col 2: Status */
  .status-col {
    padding-top: 20px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 2px;
  }

  .status-badge span {
    font-family: var(--font-sans);
    font-size: 11px;
  }

  .status-badge.ai {
    border: 1px solid var(--ai-border);
    color: var(--ai-accent);
  }

  .status-badge.ai span {
    font-weight: 600;
  }

  .status-badge.verified {
    border: 1px solid var(--border);
    color: var(--ink-tertiary);
  }

  .status-badge.verified span {
    font-weight: 500;
  }

  .status-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    margin-top: 6px;
  }

  /* Col 3: Omfang */
  .scope-col {
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .scope-count {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .scope-years {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
  }

  .scope-stars {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--gold-star);
    margin-top: 2px;
  }

  /* Col 4: Edit */
  .edit-col {
    padding-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .edit-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
  }

  .edit-btn:hover {
    color: var(--ink);
  }

  /* Add row — .action-btn and .btn-primary come from tokens.css */
  .add-row {
    padding: 16px 24px;
  }

  .add-btn {
    padding: 8px 16px;
  }

  /* Evidence slot */
  .evidence-slot {
    border-left: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
