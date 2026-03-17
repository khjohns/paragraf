# UI Redesign — Prosessflyt Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Paragraf analysis workspace from a single 3-panel layout into a dual-mode system: Process Mode (fullwidth views for scoping, delegation, synthesis review) and Work Mode (existing 3-panel for reading cases).

**Architecture:** Replace the 300px LeftPanel with a compact (~80px) PhasePanel showing only phase state. Add an expandable ContextStrip between header and workspace for problem/seeds/provenance. Process views (synthesis+QA, screening delegation) take fullwidth when active. Backend persists scoping_result for later recall.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind v4 `@theme inline`, Flask backend, Supabase (PostgreSQL)

**Design system:** `.interface-design/system.md` — warm paper palette, borders-only, Inter/JetBrains Mono, 4px grid. AI trust boundary: gold-brown left border for AI content. No shadows.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/components/ContextStrip.svelte` | Expandable context bar: problem, seeds, coverage stats, gap matrix, iteration |
| `src/lib/components/PhasePanel.svelte` | Compact phase sidebar (~80px): phase icons, state, cost. Clickable → process view |
| `src/lib/components/SynthesisProcessView.svelte` | Fullwidth synthesis review: note (left col) + QA annotations (right col) |
| `src/lib/components/WorkLog.svelte` | Collapsible tool-call log from `_llm_meta.tools_called` |
| `src/lib/components/ScreeningDelegation.svelte` | Fullwidth screening delegation: category toggles, start button, SSE progress |

### Modified files
| File | Change |
|------|--------|
| `src/lib/components/AppShell.svelte` | Add ContextStrip, support `processView` slot, narrower left panel |
| `src/lib/components/WorkspaceHeader.svelte` | Simplify — most context moves to ContextStrip |
| `src/lib/stores/ui.svelte.ts` | Add `activeProcessView`, `contextStripExpanded` state |
| `src/lib/stores/pipeline.svelte.ts` | Store `_llm_meta` for synthesis and QA (for WorkLog) |
| `src/lib/types/analysis.ts` | Add `scoping_result`, `total_cost_usd`, `citation_summary` to `AnalysisDbResponse`; add `LlmMeta` type |
| `src/lib/stores/analysis.svelte.ts` | Expose `scopingResult`, `totalCostUsd`, `citationSummary` from DB load |
| `src/routes/analyse/[id]/+page.svelte` | Wire PhasePanel, process views, ContextStrip into layout |
| `src/lib/components/ScopingOverlay.svelte` | Persist full scoping_result on approval |
| `src/lib/api/analyses.ts` | No changes needed — `scoping_result` auto-returned via `SELECT *` |
| `backend/app.py:228-250` | Persist full scoping result in scope endpoint |

### Unchanged files
NodeList, NodeRow, NodeDetail, GraphView, CaseReader, ChatDrawer, GraphEdge, GraphNode, etc.

---

## Task 1: Backend — Persist scoping_result

**Files:**
- Modify: `backend/app.py:228-250` (scope_analysis_route)

The `get_analysis()` function uses `SELECT *` so the new column is automatically returned.

- [ ] **Step 1: Add scoping_result column via Supabase MCP**

Run Supabase migration:
```sql
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS scoping_result jsonb;
```

- [ ] **Step 2: Add scoping_result to allowed fields in analyses.py**

In `backend/analyses.py:66`, add `"scoping_result"` to the allowed set:

```python
allowed = {"title", "problem", "refined_problem", "sub_problems", "context", "status", "iteration", "gaps", "scoping_result"}
```

- [ ] **Step 3: Persist scoping_result in scope endpoint**

In `backend/app.py`, modify `scope_analysis_route` to add the full result to the updates dict:

```python
# After line 248 (if updates:), add scoping_result to updates
updates["scoping_result"] = result
```

The full `result` dict from `generate_scope()` contains `refined_problem`, `sub_problems`, `context`, `provisions`, `search_strategy`, and `reasoning` — exactly what the ContextStrip needs.

- [ ] **Step 3: Verify via curl**

```bash
curl -s http://localhost:5002/api/analyses/<ID> | python3 -m json.tool | grep scoping_result
```

Expected: `"scoping_result": { ... }` or `"scoping_result": null` for analyses without scoping.

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "feat: persist scoping_result on analyses table"
```

---

## Task 2: Frontend types and state — Add process mode support

**Files:**
- Modify: `src/lib/types/analysis.ts`
- Modify: `src/lib/stores/ui.svelte.ts`
- Modify: `src/lib/stores/analysis.svelte.ts`
- Modify: `src/lib/stores/pipeline.svelte.ts`

- [ ] **Step 1: Extend AnalysisDbResponse type**

In `src/lib/types/analysis.ts`, add fields to `AnalysisDbResponse`:

```typescript
export interface AnalysisDbResponse {
  // ... existing fields ...
  scoping_result: ScopingResult | null;
  total_cost_usd: number;
  citation_summary: { total: number; verified?: number; truncated?: number; inaccurate?: number; not_found?: number } | null;
}
```

Add `LlmMeta` type:

```typescript
export interface LlmMeta {
  model: string;
  total_turns: number;
  tools_called: { turn: number; tool: string; input: Record<string, unknown>; success: boolean }[];
  cost_usd: number;
  elapsed_ms: number;
  agentic: boolean;
}
```

Add `_llm_meta` to `SynthesisResult`:

```typescript
export interface SynthesisResult {
  // ... existing fields ...
  _llm_meta?: LlmMeta;
}
```

- [ ] **Step 2: Add process view state to uiState**

In `src/lib/stores/ui.svelte.ts`:

```typescript
export type ProcessView = 'screening-delegation' | 'synthesis-review' | null;

class UiState {
  // ... existing fields ...
  activeProcessView = $state<ProcessView>(null);
  contextStripExpanded = $state(false);

  setProcessView(view: ProcessView) {
    this.activeProcessView = view;
  }

  clearProcessView() {
    this.activeProcessView = null;
  }

  toggleContextStrip() {
    this.contextStripExpanded = !this.contextStripExpanded;
  }
}
```

- [ ] **Step 3: Store scoping_result and cost in analysisState**

In `src/lib/stores/analysis.svelte.ts`, add fields to `AnalysisState`:

```typescript
class AnalysisState {
  // ... existing fields ...
  scopingResult = $state<ScopingResult | null>(null);
  totalCostUsd = $state<number>(0);
  citationSummary = $state<Record<string, number> | null>(null);
```

In `loadFromDb()`, populate them:

```typescript
this.scopingResult = data.scoping_result ?? null;
this.totalCostUsd = data.total_cost_usd ?? 0;
this.citationSummary = data.citation_summary ?? null;
```

- [ ] **Step 4: Store _llm_meta in pipelineState**

In `src/lib/stores/pipeline.svelte.ts`, add:

```typescript
import type { LlmMeta } from '$lib/types/analysis';

class PipelineState {
  // ... existing fields ...
  synthesisLlmMeta = $state<LlmMeta | null>(null);
  qaLlmMeta = $state<LlmMeta | null>(null);

  setSynthesisResult(result: SynthesisResult | null) {
    this.synthesisResult = result;
    if (result) {
      this.synthesisMarkdown = result.markdown;
      this.synthesisLlmMeta = result._llm_meta ?? null;
    }
  }

  setQaReport(report: QAReport | null) {
    this.qaReport = report;
  }

  // Add setter for QA meta
  setQaLlmMeta(meta: LlmMeta | null) {
    this.qaLlmMeta = meta;
  }

  reset() {
    // ... existing resets ...
    this.synthesisLlmMeta = null;
    this.qaLlmMeta = null;
  }
}
```

- [ ] **Step 5: Run type check**

```bash
npm run check
```

Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/analysis.ts src/lib/stores/ui.svelte.ts src/lib/stores/analysis.svelte.ts src/lib/stores/pipeline.svelte.ts
git commit -m "feat: add process mode state, llm meta types, scoping_result to stores"
```

---

## Task 3: ContextStrip component

**Files:**
- Create: `src/lib/components/ContextStrip.svelte`
- Modify: `src/lib/components/AppShell.svelte`

### Design spec
- Background: `panel` when collapsed, `surface` when expanded
- Separator: `border-bottom: 1px solid rgba(26,24,20,0.08)`
- Collapsed: single line with chevron, primary provision, read count, iteration
- Expanded: two-column grid — left: problem + seeds, right: search coverage + gaps

- [ ] **Step 1: Create ContextStrip.svelte**

Create `src/lib/components/ContextStrip.svelte`:

```svelte
<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { formatProvision } from '$lib/utils/provisions';

  let expanded = $derived(uiState.contextStripExpanded);

  let readCount = $derived(Object.values(analysisState.analysis.readStatus).filter(Boolean).length);
  let totalCount = $derived(analysisState.nodes.filter((n) => n.category).length);

  let primaryProvision = $derived(
    analysisState.analysis.seeds.provisions.length > 0
      ? formatProvision(analysisState.analysis.seeds.provisions[0])
      : null
  );

  // Aggregate signal coverage from candidates
  let coverageStats = $derived.by(() => {
    const stats = { ref: 0, fts: 0, vec: 0, total: 0 };
    for (const n of analysisState.nodes) {
      if (!n.category) continue;
      stats.total++;
      if (n.signals?.ref) stats.ref++;
      if (n.signals?.fts) stats.fts++;
      if (n.signals?.vec) stats.vec++;
    }
    return stats;
  });

  // Category counts
  let catCounts = $derived.by(() => {
    const counts = { A: 0, B: 0, C: 0 };
    for (const n of analysisState.nodes) {
      if (n.category === 'A') counts.A++;
      else if (n.category === 'B') counts.B++;
      else if (n.category === 'C') counts.C++;
    }
    return counts;
  });

  let gaps = $derived(analysisState.gaps);
  let zeroGaps = $derived(gaps.filter((g) => g.count === 0));
</script>

<div class="context-strip" class:expanded>
  <button class="strip-toggle" onclick={() => uiState.toggleContextStrip()}>
    <span class="chevron">{expanded ? '▾' : '▸'}</span>
    {#if primaryProvision}
      <span class="strip-provision">{primaryProvision}</span>
      {#if analysisState.analysis.problemStatement}
        <span class="strip-sep">—</span>
        <span class="strip-problem">{analysisState.analysis.problemStatement.slice(0, 60)}{analysisState.analysis.problemStatement.length > 60 ? '…' : ''}</span>
      {/if}
    {:else}
      <span class="strip-empty">Ingen bestemmelser valgt</span>
    {/if}
    <span class="strip-spacer"></span>
    {#if totalCount > 0}
      <span class="strip-stat">{readCount}/{totalCount} lest</span>
    {/if}
    {#if analysisState.analysis.iteration > 1}
      <span class="strip-iter">Iter. {analysisState.analysis.iteration}</span>
    {/if}
  </button>

  {#if expanded}
    <div class="strip-content">
      <div class="strip-left">
        {#if analysisState.analysis.problemStatement}
          <div class="strip-section">
            <div class="strip-label">Problemstilling</div>
            <div class="strip-text">{analysisState.analysis.problemStatement}</div>
          </div>
        {/if}

        <div class="strip-section">
          <div class="strip-label">Bestemmelser</div>
          <div class="strip-provisions">
            {#each analysisState.analysis.seeds.provisions as prov}
              <span class="strip-prov-badge">{formatProvision(prov)}</span>
            {/each}
          </div>
        </div>

        {#if analysisState.scopingResult?.reasoning}
          <div class="strip-section ai-section">
            <div class="strip-text ai-text">{analysisState.scopingResult.reasoning}</div>
          </div>
        {/if}
      </div>

      <div class="strip-right">
        {#if totalCount > 0}
          <div class="strip-section">
            <div class="strip-label">Søkedekning</div>
            <div class="coverage-rows">
              <div class="coverage-row">
                <span class="coverage-signal">R</span>
                <span class="coverage-count">{coverageStats.ref} treff</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">F</span>
                <span class="coverage-count">{coverageStats.fts} treff</span>
              </div>
              <div class="coverage-row">
                <span class="coverage-signal">V</span>
                <span class="coverage-count">{coverageStats.vec} treff</span>
              </div>
              <div class="coverage-divider"></div>
              <div class="coverage-row">
                <span class="coverage-total">{totalCount} unike → {catCounts.A}A {catCounts.B}B {catCounts.C}C</span>
              </div>
            </div>
          </div>
        {/if}

        {#if gaps.length > 0}
          <div class="strip-section">
            <div class="strip-label">Gap-matrise</div>
            {#each gaps.slice(0, 5) as gap}
              <div class="gap-row" class:is-zero={gap.count === 0}>
                <span class="gap-prov">{gap.provision1}</span>
                <span class="gap-sep">∩</span>
                <span class="gap-prov">{gap.provision2}</span>
                <span class="gap-val">{gap.count === 0 ? '⚠' : gap.count}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .context-strip {
    border-bottom: 1px solid rgba(26,24,20,0.08);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .context-strip.expanded {
    background: var(--p-surface);
  }

  .strip-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    width: 100%;
    box-sizing: border-box;
    font-size: 12px;
    color: var(--p-ink2);
  }
  .strip-toggle:hover {
    background: var(--p-hover);
  }

  .chevron {
    font-size: 10px;
    color: var(--p-ink4);
    flex-shrink: 0;
  }
  .strip-provision {
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
    font-size: 12px;
  }
  .strip-sep {
    color: var(--p-ink4);
  }
  .strip-problem {
    color: var(--p-ink2);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .strip-empty {
    color: var(--p-ink4);
    font-style: italic;
  }
  .strip-spacer {
    flex: 1;
  }
  .strip-stat {
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }
  .strip-iter {
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink3);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-hover);
  }

  /* Expanded content */
  .strip-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 12px 16px 16px;
    border-top: 1px solid rgba(26,24,20,0.05);
  }

  .strip-section {
    margin-bottom: 12px;
  }
  .strip-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    margin-bottom: 4px;
  }
  .strip-text {
    font-size: 13px;
    line-height: 1.55;
    color: var(--p-ink);
  }

  .ai-section {
    border-left: 3px solid var(--p-ai-border);
    padding-left: 12px;
    background: var(--p-ai-bg);
    border-radius: var(--radius-md);
    padding: 8px 12px;
  }
  .ai-text {
    font-size: 12px;
    color: var(--p-ink2);
    font-style: italic;
  }

  .strip-provisions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .strip-prov-badge {
    font-family: var(--font-data);
    font-size: 11px;
    font-weight: 600;
    color: var(--p-provision-accent);
    background: var(--p-provision-bg);
    border: 1px solid var(--p-provision-border);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
  }

  /* Coverage stats */
  .coverage-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .coverage-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }
  .coverage-signal {
    font-family: var(--font-data);
    font-weight: 700;
    font-size: 10px;
    color: var(--p-ink3);
    width: 12px;
  }
  .coverage-count {
    font-family: var(--font-data);
    color: var(--p-ink2);
  }
  .coverage-divider {
    height: 1px;
    background: var(--p-border);
    margin: 4px 0;
  }
  .coverage-total {
    font-size: 11px;
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }

  /* Gap rows */
  .gap-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink2);
    padding: 2px 0;
  }
  .gap-row.is-zero {
    color: var(--p-gap);
  }
  .gap-prov {
    min-width: 48px;
  }
  .gap-sep {
    color: var(--p-ink4);
    font-size: 10px;
  }
  .gap-val {
    margin-left: auto;
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: Wire ContextStrip into AppShell**

Modify `src/lib/components/AppShell.svelte` to add the ContextStrip between header and panels:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import WorkspaceHeader from './WorkspaceHeader.svelte';
  import ContextStrip from './ContextStrip.svelte';

  let {
    leftPanel,
    middlePanel,
    rightPanel,
  }: {
    leftPanel: Snippet;
    middlePanel: Snippet;
    rightPanel: Snippet;
  } = $props();
</script>

<div class="app-shell">
  <WorkspaceHeader />
  <ContextStrip />
  <div class="panels">
    {#if uiState.leftPanelOpen}
      <aside class="left-panel">
        {@render leftPanel()}
      </aside>
    {/if}

    <main class="middle-panel">
      {@render middlePanel()}
    </main>

    {#if uiState.selectedNodeId && !uiState.activeProcessView}
      <aside class="right-panel">
        {@render rightPanel()}
      </aside>
    {/if}
  </div>
</div>
```

Key change: right panel is hidden when a process view is active (`!uiState.activeProcessView`).

- [ ] **Step 3: Simplify WorkspaceHeader**

Move provision/read-count info to ContextStrip. WorkspaceHeader becomes minimal:

```svelte
<header class="workspace-header">
  <span class="brand">Paragraf</span>
  {#if analysisState.analysis.title}
    <span class="sep">&middot;</span>
    <span class="context">{analysisState.analysis.title}</span>
  {/if}
  <span class="spacer"></span>
</header>
```

- [ ] **Step 4: Visual check — run dev server**

```bash
npm run dev
```

Open browser to `/analyse/<id>`. Verify:
- ContextStrip appears between header and workspace
- Collapsed state shows provision + read count
- Click expands to show problem/seeds/coverage
- No layout shift or overflow

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ContextStrip.svelte src/lib/components/AppShell.svelte src/lib/components/WorkspaceHeader.svelte
git commit -m "feat: add ContextStrip between header and workspace"
```

---

## Task 4: PhasePanel — Replace LeftPanel

**Files:**
- Create: `src/lib/components/PhasePanel.svelte`
- Modify: `src/routes/analyse/[id]/+page.svelte`
- Modify: `src/lib/components/AppShell.svelte` (left panel width)

### Design spec
- Width: ~80px (down from 300px)
- Same background as canvas (bg), border separation only (per system.md: "Generic sidebar with different bg → Same bg as canvas, border separation only")
- Shows only phase state, not content
- Each phase clickable → opens process view
- State icons: ✓ green, ◐ gold (in progress), ⚠ orange (issues), ○ grey (not started)
- `total_cost_usd` at bottom in ink3

- [ ] **Step 1: Create PhasePanel.svelte**

Create `src/lib/components/PhasePanel.svelte`:

```svelte
<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { uiState, type ProcessView } from '$lib/stores/ui.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';

  // Derive phase states from analysis status
  let status = $derived(analysisState.analysis.status ?? 'scoping');

  let phases = $derived.by(() => {
    const cases = analysisState.nodes.filter((n) => n.category);
    const catCounts = { A: 0, B: 0, C: 0 };
    for (const n of cases) {
      if (n.category) catCounts[n.category]++;
    }
    const totalCases = cases.length;
    const screenedCount = Object.keys(screeningState.screeningResults).length;
    const readCount = Object.values(analysisState.analysis.readStatus).filter(Boolean).length;

    const statusNum = {
      scoping: 1, scoping_complete: 1, searching: 2,
      candidates_ready: 2, screening: 3, screening_complete: 3,
      post_search: 3, synthesis: 4, qa: 4, complete: 5,
    }[status] ?? 1;

    return [
      {
        id: 'problem' as const,
        label: 'Problem',
        icon: statusNum > 1 ? '✓' : (status === 'scoping' ? '◐' : '○'),
        state: statusNum > 1 ? 'done' : (status === 'scoping' ? 'active' : 'pending'),
        detail: statusNum > 1 ? 'definert' : null,
        processView: null as ProcessView,
      },
      {
        id: 'candidates' as const,
        label: 'Kandidat',
        icon: statusNum > 2 ? '✓' : (statusNum === 2 ? '◐' : '○'),
        state: statusNum > 2 ? 'done' : (statusNum === 2 ? 'active' : 'pending'),
        detail: totalCases > 0 ? `${totalCases} (${catCounts.A}A ${catCounts.B}B ${catCounts.C}C)` : null,
        processView: null as ProcessView,
      },
      {
        id: 'screening' as const,
        label: 'Screening',
        icon: statusNum > 3 ? '✓' : (statusNum === 3 ? '◐' : '○'),
        state: statusNum > 3 ? 'done' : (statusNum === 3 ? 'active' : 'pending'),
        detail: statusNum >= 3 && totalCases > 0 ? `${screenedCount + readCount}/${totalCases}` : null,
        processView: 'screening-delegation' as ProcessView,
      },
      {
        id: 'synthesis' as const,
        label: 'Syntese',
        icon: pipelineState.synthesisMarkdown ? '✓' : (status === 'synthesis' ? '◐' : '○'),
        state: pipelineState.synthesisMarkdown ? 'done' : (status === 'synthesis' ? 'active' : 'pending'),
        detail: pipelineState.synthesisResult ? `${pipelineState.synthesisResult.sections.length} seksjoner` : null,
        processView: 'synthesis-review' as ProcessView,
      },
      {
        id: 'qa' as const,
        label: 'QA',
        icon: pipelineState.qaReport
          ? (pipelineState.qaReport.total_flags > 0 ? '⚠' : '✓')
          : (status === 'qa' ? '◐' : '○'),
        state: pipelineState.qaReport
          ? (pipelineState.qaReport.total_flags > 0 ? 'warning' : 'done')
          : (status === 'qa' ? 'active' : 'pending'),
        detail: pipelineState.qaReport ? `${pipelineState.qaReport.total_flags} issues` : null,
        processView: 'synthesis-review' as ProcessView,  // QA is part of synthesis review
      },
    ];
  });

  function handlePhaseClick(processView: ProcessView) {
    if (!processView) return;
    if (uiState.activeProcessView === processView) {
      uiState.clearProcessView();
    } else {
      uiState.setProcessView(processView);
    }
  }
</script>

<div class="phase-panel">
  <div class="panel-eyebrow">Metode</div>

  <div class="phases">
    {#each phases as phase, i}
      <button
        class="phase-item"
        class:active={uiState.activeProcessView === phase.processView && phase.processView !== null}
        class:clickable={phase.processView !== null}
        onclick={() => handlePhaseClick(phase.processView)}
        disabled={phase.processView === null}
      >
        <span
          class="phase-icon"
          class:done={phase.state === 'done'}
          class:active={phase.state === 'active'}
          class:warning={phase.state === 'warning'}
          class:pending={phase.state === 'pending'}
        >{phase.icon}</span>
        <span class="phase-label">{phase.label}</span>
        {#if phase.detail}
          <span class="phase-detail">{phase.detail}</span>
        {/if}
      </button>
      {#if i < phases.length - 1}
        <div class="phase-connector" class:done={phase.state === 'done'}></div>
      {/if}
    {/each}
  </div>

  {#if analysisState.totalCostUsd > 0}
    <div class="cost-display">
      ${analysisState.totalCostUsd.toFixed(2)}
    </div>
  {/if}
</div>

<style>
  .phase-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 8px;
    gap: 4px;
  }

  .panel-eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
    padding: 0 4px;
    margin-bottom: 8px;
  }

  .phases {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .phase-item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    border-radius: var(--radius-md);
    font-size: 11px;
    color: var(--p-ink3);
    cursor: default;
  }
  .phase-item.clickable {
    cursor: pointer;
  }
  .phase-item.clickable:hover {
    background: var(--p-hover);
  }
  .phase-item.active {
    background: var(--p-active);
    color: var(--p-ink);
  }

  .phase-icon {
    font-size: 12px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }
  .phase-icon.done {
    color: var(--p-success);
  }
  .phase-icon.active {
    color: var(--p-kofa-accent);
  }
  .phase-icon.warning {
    color: var(--p-warn);
  }
  .phase-icon.pending {
    color: var(--p-ink4);
  }

  .phase-label {
    font-weight: 500;
    white-space: nowrap;
  }

  .phase-detail {
    font-size: 10px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    margin-left: auto;
    white-space: nowrap;
  }

  .phase-connector {
    width: 1px;
    height: 6px;
    background: var(--p-input);
    margin-left: 11px;
  }
  .phase-connector.done {
    background: var(--p-success);
  }

  .cost-display {
    margin-top: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
    text-align: center;
    padding: 8px 0;
    border-top: 1px solid var(--p-border);
  }
</style>
```

- [ ] **Step 2: Update AppShell left panel width**

In `src/lib/components/AppShell.svelte`, change the `.left-panel` CSS:

```css
.left-panel {
  width: 140px;
  min-width: 140px;
  border-right: 1px solid var(--p-border);
  background: var(--p-bg);  /* Same as canvas, per system.md */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

Note: `background: var(--p-bg)` instead of `var(--p-panel)` — per design system rejected default #1.

- [ ] **Step 3: Wire PhasePanel into +page.svelte**

In `src/routes/analyse/[id]/+page.svelte`, replace LeftPanel with PhasePanel in the leftPanel snippet:

```svelte
<script lang="ts">
  // ... existing imports ...
  import PhasePanel from '$lib/components/PhasePanel.svelte';
  import SynthesisProcessView from '$lib/components/SynthesisProcessView.svelte';
  import ScreeningDelegation from '$lib/components/ScreeningDelegation.svelte';
  // Remove: import LeftPanel from '$lib/components/LeftPanel.svelte';
</script>

{#if showScoping}
  <ScopingOverlay />
{:else}
  <AppShell>
    {#snippet leftPanel()}
      <PhasePanel />
    {/snippet}

    {#snippet middlePanel()}
      {#if uiState.activeProcessView === 'synthesis-review'}
        <SynthesisProcessView />
      {:else if uiState.activeProcessView === 'screening-delegation'}
        <ScreeningDelegation />
      {:else}
        <Toolbar />
        <div class="middle-content">
          {#if uiState.viewMode === 'graph'}
            <GraphView />
          {:else if uiState.viewMode === 'propositions'}
            <PropositionRegistry />
          {:else if uiState.viewMode === 'synthesis'}
            <SynthesisView />
          {:else}
            <NodeList />
          {/if}
        </div>
        <ChatDrawer />
      {/if}
    {/snippet}

    {#snippet rightPanel()}
      <NodeDetail />
    {/snippet}
  </AppShell>
{/if}
```

- [ ] **Step 4: Visual check**

```bash
npm run dev
```

Verify:
- PhasePanel shows on left (~140px) with phase icons and labels
- Phases derive correct state from analysis status
- Clicking screening/synthesis phases toggles process view
- Right panel hidden when process view active
- Cost shown at bottom if > 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PhasePanel.svelte src/lib/components/AppShell.svelte src/routes/analyse/[id]/+page.svelte
git commit -m "feat: replace LeftPanel with compact PhasePanel"
```

---

## Task 5: SynthesisProcessView — Fullwidth synthesis + QA

**Files:**
- Create: `src/lib/components/SynthesisProcessView.svelte`
- Create: `src/lib/components/WorkLog.svelte`

### Design spec
- Fullwidth two-column: note (left, ~65%) + QA annotations (right, ~35%)
- Note renders markdown sections with AI trust boundary styling
- 📎 icon on verified references (from `_llm_meta.tools_called`)
- [JURISTENS VURDERING] blocks highlighted with gold-brown border
- QA column: issues grouped by type, severity badges
- WorkLog at bottom, collapsed by default

- [ ] **Step 1: Create WorkLog.svelte**

Create `src/lib/components/WorkLog.svelte`:

```svelte
<script lang="ts">
  import type { LlmMeta } from '$lib/types/analysis';

  let { meta, label = 'Arbeidslogg' }: { meta: LlmMeta | null; label?: string } = $props();

  let expanded = $state(false);
</script>

{#if meta && meta.tools_called.length > 0}
  <div class="work-log">
    <button class="log-toggle" onclick={() => (expanded = !expanded)}>
      <span class="log-chevron">{expanded ? '▾' : '▸'}</span>
      <span class="log-label">{label}</span>
      <span class="log-meta">
        {meta.total_turns} turns · {(meta.elapsed_ms / 1000).toFixed(0)}s · ${meta.cost_usd.toFixed(3)}
      </span>
    </button>

    {#if expanded}
      <div class="log-entries">
        {#each meta.tools_called as call}
          <div class="log-entry">
            <span class="log-turn">Turn {call.turn}</span>
            <span class="log-tool">{call.tool}</span>
            <span class="log-input">{JSON.stringify(call.input).slice(0, 80)}</span>
            <span class="log-status" class:error={!call.success}>
              {call.success ? '✓' : '✗'}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .work-log {
    border-top: 1px solid var(--p-border);
    margin-top: 16px;
  }

  .log-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    width: 100%;
    font-size: 11px;
    color: var(--p-ink3);
  }
  .log-toggle:hover {
    color: var(--p-ink2);
  }
  .log-chevron {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .log-label {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 10px;
  }
  .log-meta {
    margin-left: auto;
    font-family: var(--font-data);
    font-size: 10px;
  }

  .log-entries {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0 8px;
  }
  .log-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    background: var(--p-hover);
    font-size: 10px;
  }
  .log-turn {
    font-family: var(--font-data);
    color: var(--p-ink3);
    font-weight: 600;
    flex-shrink: 0;
  }
  .log-tool {
    font-family: var(--font-data);
    color: var(--p-ink2);
    font-weight: 500;
    flex-shrink: 0;
  }
  .log-input {
    color: var(--p-ink4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .log-status {
    color: var(--p-success);
    flex-shrink: 0;
  }
  .log-status.error {
    color: var(--p-error, #c13515);
  }
</style>
```

- [ ] **Step 2: Create SynthesisProcessView.svelte**

Create `src/lib/components/SynthesisProcessView.svelte`. This is the largest new component — fullwidth two-column layout with the note on the left and QA issues on the right.

```svelte
<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { synthesize, updateSynthesisNote } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';
  import { QA_SEVERITY_CONFIG, CITATION_STATUS_CONFIG } from '$lib/types/analysis';
  import WorkLog from './WorkLog.svelte';

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

  function goBack() {
    uiState.clearProcessView();
  }
</script>

<div class="synthesis-process">
  <!-- Header bar -->
  <div class="process-header">
    <button class="back-btn" onclick={goBack}>← Tilbake til arbeidsrom</button>
    <span class="process-title">Syntese-gjennomgang</span>
    <span class="header-spacer"></span>
    <div class="header-actions">
      {#if hasNote && !editing}
        <button class="header-btn" onclick={startEditing}>Rediger notat</button>
        <button class="header-btn" onclick={generateNote} disabled={pipelineState.synthesisLoading}>
          {pipelineState.synthesisLoading ? 'Genererer…' : 'Kjør QA på nytt'}
        </button>
        <button class="header-btn primary" onclick={() => {
          const blob = new Blob([pipelineState.synthesisMarkdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${analysisState.analysis.title ?? 'notat'}.md`;
          a.click();
          URL.revokeObjectURL(url);
        }}>Eksporter markdown</button>
      {/if}
    </div>
  </div>

  {#if !hasNote}
    <!-- Empty state -->
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
    <!-- Edit mode -->
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
    <!-- Two-column: note + QA -->
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
                <div class="lawyer-text">{line}</div>
                <div class="lawyer-input-hint">Legg til din vurdering her</div>
              </div>
            {:else if line.match(/\d{4}\/\d+/)}
              {@const sakMatch = line.match(/(\d{4}\/\d+)/)}
              {@const isVerified = sakMatch && verifiedRefs.has(sakMatch[1])}
              <p>
                {@html renderBold(line)}
                {#if isVerified}
                  <span class="verified-badge" title="Verifisert — Claude slo opp denne saken direkte">📎</span>
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
          <!-- QA Summary -->
          <div class="qa-summary" class:clean={report.total_flags === 0}>
            <span class="qa-icon">{report.total_flags > 0 ? '⚠' : '✓'}</span>
            <span class="qa-count">{report.total_flags}</span>
            <span>{report.total_flags === 0 ? 'Ingen problemer' : report.total_flags === 1 ? 'problem' : 'problemer'}</span>
          </div>

          <!-- Citation Issues -->
          {#if citationIssues.length > 0}
            <div class="qa-section">
              <div class="qa-section-label">Referanser</div>
              {#each citationIssues as quote}
                <div class="qa-flag">
                  <div class="qa-flag-header">
                    <span
                      class="severity-badge"
                      style:background={QA_SEVERITY_CONFIG['medium']?.bg}
                      style:color={QA_SEVERITY_CONFIG['medium']?.color}
                    >medium</span>
                    <span class="qa-flag-case">{quote.sak_nr}</span>
                  </div>
                  <div class="qa-flag-text">
                    p{quote.paragraph}: {quote.issue ?? CITATION_STATUS_CONFIG[quote.status]?.label}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Logic Flags -->
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
                    >{QA_SEVERITY_CONFIG[flag.severity]?.label}</span>
                    <span class="qa-flag-location">{flag.location}</span>
                  </div>
                  <div class="qa-flag-text">{flag.description}</div>
                  <div class="qa-flag-suggestion">{flag.suggestion}</div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Untreated Cases -->
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

  /* Header bar */
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
  }
  .back-btn:hover {
    color: var(--p-ink);
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

  /* Empty state */
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
  .generate-btn:hover { opacity: 0.85; }
  .generate-btn:disabled { opacity: 0.5; cursor: default; }

  /* Edit mode */
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
  .edit-btn:disabled { opacity: 0.4; }
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

  /* Two-column layout */
  .two-column {
    display: grid;
    grid-template-columns: 1fr 320px;
    flex: 1;
    overflow: hidden;
  }

  .note-column {
    overflow-y: auto;
    padding: 24px 32px;
    max-width: 800px;
  }

  /* Note content — same styles as existing SynthesisView */
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
  .note-content h1 { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
  .note-content h2 { font-size: 16px; font-weight: 600; margin: 24px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--p-border); }
  .note-content h3 { font-size: 14px; font-weight: 600; margin: 16px 0 4px; color: var(--p-ink2); }
  .note-content p { margin: 0 0 8px; }
  .note-content .list-item { padding-left: 16px; position: relative; }
  .note-content .list-item::before { content: '•'; position: absolute; left: 4px; color: var(--p-ink3); }
  .note-content .list-bold { padding-left: 16px; }
  .note-content .spacer { height: 8px; }

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
  .tension-desc { font-size: 12px; color: var(--p-ink); display: block; margin-bottom: 2px; }
  .tension-cases { font-size: 10px; font-family: var(--font-data); color: var(--p-ink3); }

  /* QA column */
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
  .qa-run-btn:hover { opacity: 0.85; }
  .qa-run-btn:disabled { opacity: 0.5; cursor: default; }

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
  .qa-icon { font-size: 14px; }
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
  .qa-rerun-btn:hover { border-color: var(--p-border-s); color: var(--p-ink); }
  .qa-rerun-btn:disabled { opacity: 0.4; cursor: default; }

  .spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--p-panel);
    animation: spin 0.8s linear infinite;
  }
</style>
```

- [ ] **Step 3: Run type check and visual verification**

```bash
npm run check
npm run dev
```

Navigate to an analysis with a synthesis note. Click "Syntese" in PhasePanel. Verify:
- Two-column layout (note left, QA right)
- Back button returns to work mode
- QA button works
- WorkLog shows at bottom of note
- 📎 icons on verified case references
- [JURISTENS VURDERING] blocks have gold-brown border

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/SynthesisProcessView.svelte src/lib/components/WorkLog.svelte
git commit -m "feat: fullwidth synthesis process view with QA column and work log"
```

---

## Task 6: ScreeningDelegation — Fullwidth process view

**Files:**
- Create: `src/lib/components/ScreeningDelegation.svelte`

This extracts the screening delegation logic from `ScreeningPanel.svelte` into a fullwidth process view. The existing `ScreeningPanel.svelte` continues to exist for when it's shown as a section in the old layout — but the new ScreeningDelegation is the primary UI.

- [ ] **Step 1: Create ScreeningDelegation.svelte**

Create `src/lib/components/ScreeningDelegation.svelte`. This is a fullwidth version of ScreeningPanel with more visual space for the category controls:

```svelte
<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { screeningState } from '$lib/stores/screening.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import CategoryBadge from './CategoryBadge.svelte';
  import type { ScreeningMode } from '$lib/types/analysis';

  let cases = $derived(analysisState.nodes.filter((n) => n.category));
  let stats = $derived.by(() => {
    const catCounts = { A: 0, B: 0, C: 0 };
    const catScreened = { A: 0, B: 0, C: 0 };
    let claude = 0;
    let me = 0;
    for (const n of cases) {
      const cat = n.category as 'A' | 'B' | 'C';
      catCounts[cat]++;
      const assignment = screeningState.getAssignment(n.label, cat);
      if (assignment === 'claude') claude++;
      else me++;
      if (screeningState.screeningResults[n.label]) catScreened[cat]++;
    }
    return { catCounts, catScreened, claudeCount: claude, meCount: me };
  });

  let batchActive = $derived(screeningState.isBatchActive('screening'));
  let batchProgress = $derived(screeningState.getBatchProgress('screening'));

  function startScreening() {
    const claudeCases = cases
      .filter((n) => screeningState.getAssignment(n.label, n.category) === 'claude')
      .map((n) => n.label);
    if (claudeCases.length === 0) return;
    screeningState.startScreeningSSE(claudeCases);
  }

  function goBack() {
    uiState.clearProcessView();
  }

  const modes: { key: ScreeningMode; label: string }[] = [
    { key: 'claude', label: 'Claude screener' },
    { key: 'me', label: 'Jeg leser' },
    { key: 'pick', label: 'Velg per sak' },
  ];
</script>

<div class="screening-delegation">
  <div class="process-header">
    <button class="back-btn" onclick={goBack}>← Tilbake til arbeidsrom</button>
    <span class="process-title">Screening — Arbeidsfordeling</span>
  </div>

  <div class="delegation-content">
    <div class="categories">
      {#each ['A', 'B', 'C'] as cat}
        {@const count = stats.catCounts[cat as keyof typeof stats.catCounts]}
        {@const screened = stats.catScreened[cat as keyof typeof stats.catScreened]}
        {@const currentMode = screeningState.screeningModes[cat] ?? 'claude'}

        {#if count > 0}
          <div class="cat-card">
            <div class="cat-card-header">
              <CategoryBadge category={cat as 'A' | 'B' | 'C'} />
              <span class="cat-card-label">{cat}-kandidater ({count})</span>
              {#if screened > 0}
                <span class="cat-card-progress">{screened}/{count} screenet</span>
              {/if}
            </div>
            <div class="mode-selector">
              {#each modes as m}
                <button
                  class="mode-btn"
                  class:active={currentMode === m.key}
                  onclick={() => screeningState.setCategoryMode(cat, m.key)}
                >
                  <span class="mode-radio">{currentMode === m.key ? '●' : '○'}</span>
                  {m.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    {#if uiState.regulationFilter}
      <div class="filter-notice">
        ☑ Kun gjeldende FOA (2017–)
        <span class="filter-count">
          {analysisState.nodes.filter((n) => n.regulation === 'old' && n.category).length} eldre saker filtrert
        </span>
      </div>
    {/if}

    <div class="summary-bar">
      <span>Claude: {stats.claudeCount}</span>
      <span class="summary-sep">·</span>
      <span>Du: {stats.meCount}</span>
    </div>

    {#if batchActive}
      <div class="progress-banner">
        <div class="streaming-spinner"></div>
        <span>Screening pågår… {batchProgress}%</span>
        <div class="progress-track">
          <div class="progress-fill" style:width="{batchProgress}%"></div>
        </div>
      </div>
    {:else if !screeningState.screeningStarted}
      <button class="start-btn" onclick={startScreening} disabled={stats.claudeCount === 0}>
        Start screening →
      </button>
    {:else}
      <button class="back-work-btn" onclick={goBack}>
        Tilbake til arbeidsrom →
      </button>
    {/if}
  </div>
</div>

<style>
  .screening-delegation {
    display: flex;
    flex-direction: column;
    height: 100%;
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
  }
  .back-btn:hover { color: var(--p-ink); }
  .process-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }

  .delegation-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .categories {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cat-card {
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
  }
  .cat-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cat-card-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .cat-card-progress {
    margin-left: auto;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink3);
  }

  .mode-selector {
    display: flex;
    gap: 8px;
  }
  .mode-btn {
    all: unset;
    flex: 1;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    color: var(--p-ink3);
    border: 1px solid var(--p-border-m);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .mode-btn:hover { border-color: var(--p-border-s); color: var(--p-ink2); }
  .mode-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
    border-color: var(--p-ink);
  }
  .mode-radio {
    font-size: 10px;
  }

  .filter-notice {
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-hover);
    font-size: 12px;
    color: var(--p-ink2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .filter-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--p-ink3);
  }

  .summary-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--p-ink3);
    font-family: var(--font-data);
  }
  .summary-sep { color: var(--p-ink4); }

  .start-btn {
    all: unset;
    padding: 12px 24px;
    border-radius: var(--radius-lg);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    display: block;
  }
  .start-btn:hover { opacity: 0.85; }
  .start-btn:disabled { opacity: 0.4; cursor: default; }

  .back-work-btn {
    all: unset;
    padding: 12px 24px;
    border-radius: var(--radius-lg);
    background: var(--p-surface);
    border: 1px solid var(--p-border-m);
    color: var(--p-ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    display: block;
  }
  .back-work-btn:hover { background: var(--p-hover); }

  .progress-banner {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--p-ai-text);
  }
  .progress-track {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--p-input);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--p-kofa-accent);
    transition: width 0.3s ease;
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m);
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Visual check**

```bash
npm run dev
```

Click "Screening" in PhasePanel. Verify:
- Fullwidth delegation view with category cards
- Radio-style mode selectors
- Start button works
- Back button returns to work mode

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ScreeningDelegation.svelte
git commit -m "feat: fullwidth screening delegation process view"
```

---

## Task 7: ScopingOverlay — Persist scoping_result

**Files:**
- Modify: `src/lib/components/ScopingOverlay.svelte`
- Modify: `src/lib/stores/analysis.svelte.ts`

- [ ] **Step 1: Persist scoping_result on approval**

In `ScopingOverlay.svelte`, the `approve()` function (around line 60-93) should also store the scoping result to the store:

After `analysisState.setStatus('searching');`, add:

```typescript
// Persist scoping result for later recall in ContextStrip
analysisState.setScopingResult({
  refined_problem: editedProblem,
  sub_problems: editedSubProblems,
  provisions: editedProvisions,
  search_strategy: scopingResult!.search_strategy,
  context: scopingResult!.context,
  reasoning: scopingResult!.reasoning,
});
```

- [ ] **Step 2: Add setScopingResult to analysisState**

In `src/lib/stores/analysis.svelte.ts`:

```typescript
setScopingResult(result: ScopingResult) {
  this.scopingResult = result;
}
```

Import `ScopingResult` from types.

- [ ] **Step 3: Verify**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ScopingOverlay.svelte src/lib/stores/analysis.svelte.ts
git commit -m "feat: persist scoping_result on approval for ContextStrip recall"
```

---

## Task 8: Final wiring and type check

**Files:**
- Modify: `src/routes/analyse/[id]/+page.svelte` (final wiring)

- [ ] **Step 1: Verify all imports and wiring in +page.svelte**

Ensure +page.svelte imports all new components and wires them correctly. The file should already be correct from Task 4 Step 3, but verify:
- PhasePanel in leftPanel snippet
- Process views in middlePanel snippet (conditional on `uiState.activeProcessView`)
- Toolbar/NodeList/etc only shown when no process view active

- [ ] **Step 2: Full type check**

```bash
npm run check
```

Expected: PASS

- [ ] **Step 3: Visual QA — run through full flow**

```bash
npm run dev
```

Test the following flow:
1. Open analysis at `/analyse/<id>` with existing data
2. Verify PhasePanel on left shows correct phase states
3. Verify ContextStrip between header and workspace
4. Click ContextStrip to expand — verify problem, seeds, coverage
5. Click "Screening" phase → fullwidth ScreeningDelegation
6. Click back → returns to work mode
7. Click "Syntese" phase → fullwidth SynthesisProcessView with QA column
8. Verify 📎 icons on verified case refs
9. Verify WorkLog at bottom (collapsed)
10. Click back → returns to work mode

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: UI redesign — dual-mode layout with process views"
```

---

## Notes for implementer

### Key invariants
- **LeftPanel.svelte is NOT deleted** — it remains for potential fallback or reference. PhasePanel is the new default.
- **Existing SynthesisView.svelte is NOT deleted** — it still works as the synthesis tab in work mode. SynthesisProcessView is the fullwidth version.
- **Right panel is hidden** when `activeProcessView !== null` — this gives process views the full width.
- **ContextStrip collapsed state** must remain narrow (~32px height) to not waste space.

### Design system compliance
- No shadows — borders only
- Warm paper palette: bg/panel/surface hierarchy
- AI trust boundary: gold-brown left border for AI content
- Inter for UI, JetBrains Mono for case numbers/data
- 4px base grid
- Badge pattern: `padding: 2px 6px; border-radius: var(--radius-badge); font-size: 10px; font-weight: 600`

### Data sources recap
| Data | Source | Already available? |
|------|--------|-------------------|
| Phase state | `analysisState.analysis.status` | ✅ Yes |
| Candidate counts | `analysisState.nodes` | ✅ Yes |
| Coverage stats | `nodes[].signals` | ✅ Yes (signal dots on nodes) |
| Screening results | `screeningState.screeningResults` | ✅ Yes |
| Synthesis note | `pipelineState.synthesisMarkdown` | ✅ Yes |
| QA report | `pipelineState.qaReport` | ✅ Yes |
| Scoping result | `analysisState.scopingResult` | ✅ After Task 1+2 |
| Total cost | `analysisState.totalCostUsd` | ✅ After Task 2 (from DB) |
| Tool calls (WorkLog) | `pipelineState.synthesisLlmMeta` | ✅ After Task 2 |
