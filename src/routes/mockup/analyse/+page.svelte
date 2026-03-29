<script lang="ts">
  import '$lib/mockup/tokens.css';
  import { fly, slide } from 'svelte/transition';
  import { Sun, Moon, Sparkles, Eye, ChevronRight, Square, CheckSquare, X } from 'lucide-svelte';
  import NavRail from '$lib/mockup/components/NavRail.svelte';
  import ScopePanel from '$lib/mockup/components/ScopePanel.svelte';
  import ReadingPanel from '$lib/mockup/components/ReadingPanel.svelte';
  import SignalBadge from '$lib/mockup/components/SignalBadge.svelte';
  import MockupCategoryBadge from '$lib/mockup/components/MockupCategoryBadge.svelte';
  import {
    MOCK_SCOPE,
    MOCK_CANDIDATES,
    MOCK_COUNTS,
    type MockCandidate,
  } from '$lib/mockup/data/analyse';

  let darkMode = $state(false);
  type TabKey = 'all' | 'null' | 'A' | 'B' | 'C';
  let activeTab = $state<TabKey>('all');
  let isScopeOpen = $state(true);
  let expandedAiRow = $state<string | null>(null);
  let selectedCase = $state<MockCandidate | null>(null);
  let selectedRows = $state<string[]>([]);

  let visibleCases = $derived(
    activeTab === 'all'
      ? MOCK_CANDIDATES
      : MOCK_CANDIDATES.filter((c) =>
          activeTab === 'null' ? c.category === null : c.category === activeTab
        )
  );

  function openCase(c: MockCandidate) {
    selectedCase = c;
    isScopeOpen = false;
  }

  function toggleScope() {
    isScopeOpen = !isScopeOpen;
    if (isScopeOpen) selectedCase = null;
  }

  function toggleAiExpanded(id: string, e: MouseEvent) {
    e.stopPropagation();
    expandedAiRow = expandedAiRow === id ? null : id;
  }

  function toggleRowSelection(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (selectedRows.includes(id)) {
      selectedRows = selectedRows.filter((r) => r !== id);
    } else {
      selectedRows = [...selectedRows, id];
    }
  }

  function toggleAllSelection() {
    if (selectedRows.length === visibleCases.length && visibleCases.length > 0) {
      selectedRows = [];
    } else {
      selectedRows = visibleCases.map((c) => c.id);
    }
  }

  function getSignalsByType(
    signals: MockCandidate['signals'],
    type: import('$lib/mockup/data/analyse').SignalType
  ) {
    return signals.filter((s) => s.type === type);
  }

  const TABS = [
    { key: 'all', label: 'Alle', cat: null, count: MOCK_COUNTS.total },
    { key: 'null', label: 'Uvurdert', cat: '\u2013', count: MOCK_COUNTS.null },
    { key: 'A', label: 'Kjernesak', cat: 'A', count: MOCK_COUNTS.A },
    { key: 'B', label: 'Støttesak', cat: 'B', count: MOCK_COUNTS.B },
    { key: 'C', label: 'Kontekstsak', cat: 'C', count: MOCK_COUNTS.C },
  ] as const;
</script>

<div class="mockup-root" class:dark={darkMode}>
  <!-- HEADER -->
  <header class="ws-header">
    <div class="header-left">
      <a href="/mockup" class="logo" title="Tilbake til porteføljen">
        <span class="logo-symbol">&sect;</span>
      </a>
      <div class="header-sep"></div>
      <h1 class="header-title" title={MOCK_SCOPE.refinedProblem}>
        {MOCK_SCOPE.refinedProblem}
      </h1>
    </div>
    <div class="header-right">
      <button class="mode-toggle" onclick={() => (darkMode = !darkMode)}>
        {#if darkMode}
          <Sun size={14} />
        {:else}
          <Moon size={14} />
        {/if}
      </button>
      <div class="avatar">MJ</div>
    </div>
  </header>

  <div class="workspace">
    <!-- NAV RAIL -->
    <NavRail {isScopeOpen} onToggleScope={toggleScope} />

    <!-- SCOPE PANEL -->
    {#if isScopeOpen}
      <div transition:fly={{ x: -360, duration: 200 }}>
        <ScopePanel />
      </div>
    {/if}

    <!-- MAIN REGISTER -->
    <main class="register">
      <!-- Tab bar -->
      <div class="tab-bar">
        <div class="tab-toggle">
          {#each TABS as tab, i}
            {#if i > 0}
              <div class="tab-sep"></div>
            {/if}
            <button
              class="tab-btn"
              class:active={activeTab === tab.key}
              onclick={() => (activeTab = tab.key)}
            >
              {tab.label}{#if tab.cat}<span class="tab-cat"> &middot; {tab.cat}</span>{/if} ({tab.count})
            </button>
          {/each}
        </div>
        {#if activeTab === 'null'}
          <button class="action-btn ai">
            <Sparkles size={12} /> Screen {MOCK_COUNTS.null} uvurderte
          </button>
        {/if}
      </div>

      <!-- Column headers -->
      <div class="col-headers dense-row">
        <div class="col-check" onclick={toggleAllSelection} role="button" tabindex="0">
          {#if selectedRows.length === visibleCases.length && visibleCases.length > 0}
            <CheckSquare size={14} />
          {:else}
            <Square size={14} />
          {/if}
        </div>
        <div>Kat</div>
        <div>Referanse</div>
        <div>Innsikt</div>
        <div class="col-signal"><span class="signal-dot ref-dot"></span>Ref</div>
        <div class="col-signal"><span class="signal-dot fts-dot"></span>Ord</div>
        <div class="col-signal"><span class="signal-dot vec-dot"></span>Konsept</div>
        <div class="col-right">Lest</div>
      </div>

      <!-- Rows -->
      <div class="rows-container">
        {#each visibleCases as c (c.id)}
          {@const isDimmed = c.category === 'C'}
          {@const isExpanded = expandedAiRow === c.id}
          {@const isActive = selectedCase?.id === c.id}
          {@const isChecked = selectedRows.includes(c.id)}
          {@const rS = getSignalsByType(c.signals, 'R')}
          {@const fS = getSignalsByType(c.signals, 'F')}
          {@const vS = getSignalsByType(c.signals, 'V')}

          <div
            class="register-row"
            class:dimmed={isDimmed && !isActive && !isChecked}
            class:row-active={isActive}
            class:row-checked={isChecked && !isActive}
            onclick={() => openCase(c)}
          >
            <div class="dense-row row-grid">
              <div
                class="col-check"
                onclick={(e) => toggleRowSelection(c.id, e)}
                role="checkbox"
                tabindex="0"
              >
                {#if isChecked}
                  <CheckSquare size={16} color="var(--ai-accent)" />
                {:else}
                  <Square size={16} />
                {/if}
              </div>

              <div onclick={(e) => e.stopPropagation()}>
                <MockupCategoryBadge category={c.category} />
              </div>

              <div class="ref-cell">
                <div class="ref-name">{c.ref}</div>
                <div class="ref-meta">{c.source} &middot; {c.date}</div>
              </div>

              <div onclick={(e) => e.stopPropagation()}>
                {#if c.ai_screening?.proposition}
                  <button
                    class="action-btn"
                    class:ai={isExpanded}
                    onclick={(e) => toggleAiExpanded(c.id, e)}
                  >
                    <Sparkles size={11} />
                    {isExpanded ? 'Skjul' : 'KI-innsikt'}
                  </button>
                {:else}
                  <span class="dash">&ndash;</span>
                {/if}
              </div>

              <div class="signal-col">
                {#if rS.length > 0}
                  {#each rS as s}
                    <SignalBadge type={s.type} detail={s.detail} explanation={s.explanation} />
                  {/each}
                {:else}
                  <span class="dash">&ndash;</span>
                {/if}
              </div>

              <div class="signal-col">
                {#if fS.length > 0}
                  {#each fS as s}
                    <SignalBadge type={s.type} detail={s.detail} explanation={s.explanation} />
                  {/each}
                {:else}
                  <span class="dash">&ndash;</span>
                {/if}
              </div>

              <div class="signal-col">
                {#if vS.length > 0}
                  {#each vS as s}
                    <SignalBadge type={s.type} detail={s.detail} explanation={s.explanation} />
                  {/each}
                {:else}
                  <span class="dash">&ndash;</span>
                {/if}
              </div>

              <div class="read-col">
                {#if c.read_at}
                  <Eye size={14} color="var(--ink-muted)" />
                {:else}
                  <div class="unread-dot" title="Ulest"></div>
                {/if}
                {#if isActive}
                  <ChevronRight size={14} color="var(--ink)" />
                {/if}
              </div>
            </div>

            <!-- Expanded AI row -->
            {#if isExpanded && c.ai_screening}
              <div
                class="ai-expanded"
                transition:slide={{ duration: 150 }}
                onclick={(e) => e.stopPropagation()}
              >
                <div class="ai-expanded-card">
                  <div class="ai-expanded-label">
                    KI foreslår: Kategori {c.ai_screening.category}
                  </div>
                  <div class="ai-expanded-text">{c.ai_screening.proposition}</div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Bulk bar -->
      {#if selectedRows.length > 0}
        <div class="bulk-bar">
          <span class="bulk-count">{selectedRows.length} valgt</span>
          <div class="bulk-sep"></div>
          <button class="bulk-btn primary">
            <Sparkles size={12} /> Screen med KI
          </button>
          <button class="bulk-btn">Sett kategori&hellip;</button>
          <button class="bulk-btn">Marker som lest</button>
          <button class="bulk-close" onclick={() => (selectedRows = [])}>
            <X size={14} />
          </button>
        </div>
      {/if}
    </main>

    <!-- READING PANEL -->
    {#if selectedCase}
      <div transition:fly={{ x: 420, duration: 200 }}>
        <ReadingPanel {selectedCase} onClose={() => (selectedCase = null)} />
      </div>
    {/if}
  </div>
</div>

<style>
  .mockup-root {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-sans);
  }

  /* Header */
  .ws-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid var(--border);
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
    z-index: 30;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .logo {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    flex-shrink: 0;
    background: transparent;
    cursor: pointer;
    transition: border-color 0.15s ease;
    text-decoration: none;
    color: var(--ink);
  }

  .logo:hover {
    border-color: var(--border-strong);
  }

  .logo:active {
    transform: scale(0.95);
  }

  .logo-symbol {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 600;
    font-size: 13px;
    line-height: 1;
  }

  .header-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    flex-shrink: 0;
  }

  .header-title {
    font-family: var(--font-serif);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mode-toggle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .mode-toggle:hover {
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--paper-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-secondary);
  }

  /* Workspace */
  .workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  /* Register main area */
  .register {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Tab bar */
  .tab-bar {
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .tab-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .tab-sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
  }

  .tab-btn {
    padding: 4px 10px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--ink-secondary);
    background: var(--hover-bg);
  }

  .tab-btn:active {
    transform: scale(0.97);
  }

  .tab-btn.active {
    background: var(--paper-dark);
    color: var(--ink);
  }

  .tab-cat {
    font-family: var(--font-mono);
    font-size: 10px;
    opacity: 0.5;
    margin-left: 2px;
  }

  /* Dense row grid */
  .dense-row {
    display: grid;
    grid-template-columns:
      24px 28px minmax(140px, 1.6fr) 88px minmax(70px, 1fr) minmax(70px, 1fr)
      minmax(70px, 1fr) 40px;
    gap: 12px;
    align-items: start;
  }

  /* Column headers */
  .col-headers {
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    flex-shrink: 0;
    align-items: center;
  }

  .col-check {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ink-muted);
  }

  .col-signal {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .signal-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ref-dot {
    background: var(--ink-muted);
  }

  .fts-dot {
    background: var(--signal-fts);
  }

  .vec-dot {
    background: var(--ai-accent);
  }

  .col-right {
    text-align: right;
  }

  /* Rows */
  .rows-container {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 80px;
  }

  .register-row {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-subtle);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .register-row:hover {
    background: var(--hover-bg);
  }

  .register-row:focus-visible {
    outline: none;
    box-shadow: inset 2px 0 0 var(--control-border-focus);
    background: var(--hover-bg);
  }

  .register-row.dimmed {
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  .register-row.dimmed:hover {
    opacity: 0.85;
  }

  .register-row.row-active {
    background: var(--row-active-bg);
    box-shadow: inset 2px 0 0 var(--ink);
  }

  .register-row.row-checked {
    background: var(--ai-bg);
    box-shadow: inset 2px 0 0 var(--ai-accent);
  }

  .row-grid {
    padding: 12px 20px;
    align-items: center;
  }

  .ref-cell {
    min-width: 0;
  }

  .ref-name {
    font-family: var(--font-serif);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.3;
  }

  .ref-meta {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-tertiary);
    margin-top: 2px;
  }

  .signal-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dash {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-muted);
  }

  .read-col {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  .unread-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--signal-fts);
  }

  /* AI expanded row */
  .ai-expanded {
    padding: 0 20px 12px;
  }

  .ai-expanded-card {
    margin-left: 64px;
    margin-right: 52px;
    border: 1px solid var(--ai-border);
    background: var(--ai-bg);
    padding: 12px;
    border-radius: 4px;
  }

  .ai-expanded-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 700;
    color: var(--ai-accent);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .ai-expanded-text {
    font-family: var(--font-serif);
    font-size: 15px;
    font-style: italic;
    color: var(--ink-secondary);
    line-height: 1.5;
  }

  /* Action buttons */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 12px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-tertiary);
  }

  .action-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .action-btn.ai {
    border-color: var(--ai-border);
    color: var(--ai-accent);
  }

  .action-btn.ai:hover {
    border-color: var(--ai-accent);
    background: var(--ai-bg);
  }

  /* Bulk bar */
  .bulk-bar {
    --bulk-bg: #1c1b1a;
    --bulk-fg: #f8f6f1;
    --bulk-muted: #9e9a93;
    --bulk-dim: #7a766f;
    --bulk-border: rgba(248, 246, 241, 0.1);
    --bulk-sep: rgba(248, 246, 241, 0.15);

    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bulk-bg);
    color: var(--bulk-fg);
    padding: 10px 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 20;
    border: 1px solid var(--bulk-border);
    animation: mockup-slide-up 0.2s ease-out;
  }

  .bulk-count {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--bulk-muted);
  }

  .bulk-sep {
    width: 1px;
    height: 16px;
    background: var(--bulk-sep);
  }

  .bulk-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--bulk-muted);
    background: none;
    border: none;
    cursor: pointer;
  }

  .bulk-btn:hover {
    color: var(--bulk-fg);
  }

  .bulk-btn.primary {
    color: var(--bulk-fg);
  }

  .bulk-btn.primary:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .bulk-close {
    padding: 4px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bulk-dim);
    border-radius: 2px;
    transition: color 0.15s ease;
  }

  .bulk-close:hover {
    color: var(--bulk-fg);
  }
</style>
