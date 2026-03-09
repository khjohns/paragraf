# Paragraf Phase 1 — Architecture Reference

> This document is the **architecture reference** for Phase 1. It defines scope, tech decisions, design rules, and known corrections. It is NOT an implementation guide — sprint plans in separate files handle step-by-step execution with verified APIs.

**Design spec (authoritative):** `docs/design/paragraf-designspesifikasjon.md`
**Implementation prompt:** `docs/design/paragraf-implementation-prompt.md`
**Original plan (superseded):** `docs/plans/2026-03-09-phase1-implementation.md`

---

## Architecture

**Frontend:** SvelteKit 2 SPA (`adapter-static`, `ssr: false`), Svelte 5 runes, Tailwind CSS v4
**Backend:** Python Flask (port 5002), proxied via Vite dev server
**Database:** Supabase project `unified-timeline` (id: `iyetsvrteyzpirygxenu`)
**Graph:** D3 (calculations) + dagre (hierarchical layout) + Svelte (SVG rendering)
**State:** Svelte 5 runes in `.svelte.ts` files, `@tanstack/svelte-query` v6 for server state
**Icons:** lucide-svelte
**Dev port:** 5174 (avoids conflict with endringsmeldinger on 5173)

**Reference projects:**
- `~/Projects/endringsmeldinger` — UI component patterns, Tailwind/Svelte styling approach
- `~/Projects/Catenda/paragraf` — Paragraf MCP server (lovdata_* tables, `LovdataService`, `LovdataVectorSearch`)
- `~/Projects/Catenda/kofa` — KOFA MCP server (kofa_* tables, scraping/parsing)
- `~/Projects/codegrasp` — Implementation patterns: confidence scores, content_hash staleness, capsule pattern (pivots + supports), FQN convention (spec section 34)

---

## Phase 1 Scope (spec section 33)

- Three-panel layout with list view as default
- Graph view with hierarchical layout (D3+dagre+SVG)
- A/B/C categorization with R/F/V signal dots
- Regulation version filter (prominent, yellow warning box, default on)
- Gap matrix in left panel
- Read status and notes **with persistence** (localStorage minimum, Supabase preferred)
- Delimitation as content tag (manual toggle)
- Edge valence (UI ready, data shown as "unknown" until NLP)
- Citation direction in graph (directed arrows on hover)
- Persistent selected node across views
- Empty states pointing to next action
- Subtle toasts
- **Full decision text in right panel** (raw text, no AI curation — "Les avgjørelsen →")

---

## Sprint Structure

```
Sprint 1: Foundation
  - Project scaffold (SvelteKit + Tailwind v4 + design tokens)
  - TypeScript types & domain model
  - Svelte stores (class-based pattern)
  - API client & query layer
  - Mock data from design JSX

Sprint 2: Backend
  - Verify Supabase schema (column names, RPC functions)
  - Flask endpoints (traverse, case detail, provision detail)
  - Batch queries (not per-row loops)
  - Gap matrix computation

Sprint 3: UI Components
  - Three-panel layout shell
  - Left panel (5 workflow sections, gap matrix)
  - List view (sorting, filtering, dimming)
  - Right panel (overview + raw text mode per node type)
  - Shared components (badges, signal dots, icons)

Sprint 4: Graph & Polish
  - Graph view (dagre layout, node shapes, edge styles)
  - Graph tooltips (300ms delay, 3-line)
  - Toast notifications
  - Empty states
  - localStorage persistence
  - Integration testing with real Supabase data
```

Each sprint plan is written just-before-execution with verified API docs.

---

## QA Corrections (from 2026-03-09 review)

### CRITICAL: Fix before implementation

#### 1. `@tanstack/svelte-query` v6 requires thunk syntax

svelte-query v6 (for Svelte 5) **requires** options wrapped in a function:

```ts
// WRONG (old v5 syntax):
createQuery({ queryKey: [...], queryFn: ... })

// CORRECT (v6 for Svelte 5 runes):
createQuery(() => ({ queryKey: [...], queryFn: ... }))
```

TypeScript enforces this. All `createQuery` / `createMutation` calls must use the thunk pattern.

#### 2. Svelte 5 stores — use class pattern, not getter functions

The original plan used module-level `let` with `$state` and exported getter functions. This works but is fragile and non-idiomatic. Use the documented class-based pattern:

```ts
// src/lib/stores/analysis.svelte.ts
class AnalysisState {
  nodes = $state<GraphNode[]>([]);
  edges = $state<GraphEdge[]>([]);
  gaps = $state<GapPair[]>([]);
  analysis = $state<Analysis>({ /* defaults */ });

  setResults(n: GraphNode[], e: GraphEdge[], g: GapPair[]) {
    this.nodes = n;
    this.edges = e;
    this.gaps = g;
  }

  toggleRead(nodeId: string) {
    this.analysis.readStatus[nodeId] = !this.analysis.readStatus[nodeId];
  }

  get categoryCounts() {
    // $derived equivalent via getter
    return {
      a: this.nodes.filter(n => n.category === 'A').length,
      // ...
    };
  }
}

export const analysisState = new AnalysisState();
```

This gives reliable reactivity when components access `analysisState.nodes` in templates.

**Note:** "you cannot export reassigned state" — class properties with `$state` circumvent this because the class instance itself is never reassigned.

#### 3. dagre does NOT support `rank` property on nodes

The original plan sets `rank: rankMap[node.type]` — dagre ignores this. dagre computes ranks automatically from edge direction.

**Solution for three-layer layout:** Add invisible edges between layers to force ranking:

```ts
// After adding all real edges, add invisible constraint edges:
// provision → kofa_case (forces provisions above cases)
// kofa_case → eu_case/prep_work (forces cases above EU/prep)
for (const provNode of nodes.filter(n => n.type === 'provision')) {
  const firstCase = nodes.find(n => n.type === 'kofa_case');
  if (firstCase) {
    g.setEdge(provNode.id, firstCase.id, { weight: 0, minlen: 1, style: 'invis' });
  }
}
```

Alternative: compute dagre layout per layer separately and stack with manual y-offsets. The sprint plan should prototype both approaches.

#### 4. Backend: batch queries instead of per-row loops

The original `traverse()` fetches each case individually in a loop (O(n) DB calls). Fix:

```python
# WRONG:
for sak_nr in all_cases:
    case_data = db.table('kofa_cases').select('*').eq('sak_nr', sak_nr).single().execute()

# CORRECT:
case_data = db.table('kofa_cases').select('*').in_('sak_nr', list(all_cases)).execute()
case_map = {c['sak_nr']: c for c in case_data.data}
```

Same for `determine_regulation_version` — batch all regulation version queries.

#### 5. Verify Supabase RPC functions before building custom queries

The database has existing RPC functions: `search_lovdata_hybrid`, `search_lovdata_fast`, `search_lovdata_vector`. The original plan assumed `search_decision_text` and `match_decision_text` — **verify these actually exist** via Supabase MCP before implementing. Also check column names in all referenced tables.

#### 6. Persistence missing from stores

Spec explicitly requires "lesestatus og notater **med persistering**". Add `localStorage` save/load in the store class, or Supabase `user_annotations` table. Without this, all work is lost on refresh.

### IMPORTANT: Spec features missing from original plan

#### 7. "Les avgjørelsen →" — raw decision text in right panel

The right panel needs two modes even in Phase 1:
- **Overview mode** (default): metadata, signals, relations, notes
- **Read mode**: full `kofa_decision_text` paragraphs, plain (no AI highlighting)

The "Les avgjørelsen →" button switches between them. This is essential — without it, the right panel shows only metadata, not the actual legal text.

#### 8. List item Line 3 — valence indicators for cited cases

Spec section 8a shows: `✓2020/567 ↔2023/456` — small valence icons next to cited case numbers. All shown as "unknown" (✓) in Phase 1 since NLP isn't implemented, but the UI structure should be there.

#### 9. Progressive expansion in graph

Spec section 12: Graph starts with seed nodes + aggregate badges ("23 KOFA-saker" in dashed frame). Click expands. The original plan renders all nodes flat. Consider implementing at least the aggregate-badge initial state.

#### 10. Tailwind v4 + Svelte: prefer scoped styles over utility classes

Svelte's scoped `<style>` blocks are a better fit than Tailwind utility classes in templates. With `@theme` defining CSS custom properties, use them directly:

```svelte
<style>
  .panel {
    background: var(--p-panel);
    color: var(--p-ink);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
  }
</style>
```

This gives scoped CSS, readable markup, and full access to design tokens without `@apply` or `@reference`. Tailwind utility classes can still be used selectively in templates for quick layout (`flex`, `gap-4`, `hidden`) but are not the primary styling approach.

**Reference:** Check `~/Projects/endringsmeldinger` for their Tailwind-in-Svelte patterns.

#### 11. Broken edges in citation network

`kofa_case_references.to_sak_nr` lacks FK — may reference cases not in the database. `build_edges()` filters these out, but the count of "unreachable references" should be surfaced as a data quality indicator.

---

## Type Definitions

The types from the original plan are sound. Keep as-is:

- `src/lib/types/graph.ts` — `GraphNode`, `GraphEdge`, `GapPair`, `NodeType`, `Category`, `Valence`, `SignalHits`
- `src/lib/types/analysis.ts` — `Analysis` (with seeds, readStatus, notes, delimitations)
- `src/lib/types/api.ts` — `TraversalRequest`, `TraversalResponse`, `CaseDetailResponse`, `ProvisionDetailResponse`

---

## Component Map

```
src/
  routes/
    +page.svelte              Main workspace
    +layout.svelte            QueryClientProvider + global CSS
    +layout.ts                ssr: false, prerender: false
  lib/
    types/
      graph.ts                Node, edge, gap types
      analysis.ts             Analysis session type
      api.ts                  Request/response types
    stores/
      analysis.svelte.ts      Class-based analysis state
      ui.svelte.ts            Class-based UI state
      toast.svelte.ts         Toast notification state
    api/
      client.ts               Generic fetch wrapper
      traversal.ts            /api/traverse
      cases.ts                /api/cases/:id, /api/provisions/:id/:section
    queries/
      traversal.ts            createQuery wrappers (thunk syntax!)
    components/
      layout/
        ThreePanel.svelte     300px | flex | 370px
        Toolbar.svelte        View switcher, filters, legend
      left-panel/
        LeftPanel.svelte      Container with 5 sections
        Section.svelte        Collapsible numbered section
        ProblemStatement.svelte
        SearchParams.svelte
        Results.svelte        A/B/C counts + regulation warning
        Mapping.svelte        Progress bars + iteration info
        GapMatrix.svelte      Provision pairs with ∅
        AboutRanking.svelte   Fixed pedagogical text
      list/
        ListView.svelte       Sorted, filtered list
        ListItem.svelte       Three-line item layout
      right-panel/
        RightPanel.svelte     Container, routes by node type
        CaseOverview.svelte   Metadata + signals + relations
        CaseReadMode.svelte   Full decision text (raw, no AI)
        ProvisionOverview.svelte
        EuCaseOverview.svelte
        PrepWorkOverview.svelte
        NoteEditor.svelte     Textarea with debounced save
      graph/
        GraphView.svelte      SVG container with zoom/pan
        GraphNode.svelte      Shape by type, overlays
        GraphEdge.svelte      Valence line styles
        GraphLegend.svelte    Shape + line style legend
        GraphTooltip.svelte   3-line hover tooltip
      shared/
        CategoryBadge.svelte  A/B/C pill
        SignalDots.svelte     ●●○ R/F/V indicator
        DelimitationBadge.svelte  Orange ∅ badge
        NodeTypeIcon.svelte   Shape icon per type
        Toast.svelte          Bottom-center transient message
    utils/
      layout.ts               dagre layout computation
    mocks/
      analysis.ts             Mock data from design JSX
```

---

## Backend Endpoints

```
POST /api/traverse          Graph traversal (seeds → nodes + edges + gaps)
GET  /api/cases/:sak_nr     Full case detail with decision text + references
GET  /api/provisions/:dok_id/:section_id   Provision text + structure
```

Backend files:
```
backend/
  app.py                    Flask app, CORS, routes
  db.py                     Supabase client singleton
  traversal.py              Core algorithm (batch queries!)
  requirements.txt          flask, flask-cors, supabase, python-dotenv
  .env                      SUPABASE_URL + SUPABASE_SERVICE_KEY
```

---

## Design Tokens

From spec section 17. Implemented via `@theme inline` + `:root` CSS variables in `app.css`.

**`@theme inline`** maps Tailwind namespace → CSS custom properties (no utility class emission).
**`:root`** defines actual color values, enabling future theme switching.

Full token list: see original plan Task 1 Step 6, or spec section 17.

---

## Critical Design Rules (from spec — do not violate)

1. **List view is default, not graph.** The lawyer is unfamiliar with graph visualization.
2. **C cases are not visually degraded.** They often contain delimitation practice of equal value.
3. **A/B/C is discovery signal, delimitation is content type.** Two orthogonal dimensions.
4. **Regulation version filter is prominent.** Yellow warning box, enabled by default.
5. **Filtering dims nodes, doesn't remove them.** 15-25% opacity for filtered nodes.
6. **Shape is primary signal for node type, color is secondary.**
7. **DB text has no marking. AI text has gold-brown left border.** Never confusable.
8. **Aesthetic: researcher workspace, calm authority, warm paper tones.** Not tech-blue, not dashboard-y.
9. **Chatpanel is Phase 2**, but layout should not conflict with future bottom-drawer placement.
10. **Persistence is required.** Read status and notes must survive page refresh.

---

## Task Dependencies

```
Sprint 1: Foundation (sequential)
  Scaffold → Types → Stores → API Client → Mock Data

Sprint 2: Backend (parallel with Sprint 3)
  Schema verification → Flask endpoints → Integration test

Sprint 3: UI Components (after Sprint 1)
  Layout Shell → Left Panel ─┐
                 List View  ──┤── Right Panel (needs list/graph to select nodes)
                 Graph View ──┘

Sprint 4: Polish (after Sprints 2+3)
  Toasts → Empty States → Persistence → End-to-end testing
```

---

## Open Questions to Resolve Per Sprint

| Question | When to resolve | How |
|----------|----------------|-----|
| Exact RPC functions available for FTS/vector on decision_text? | Sprint 2 start | Supabase MCP: `list_tables`, `execute_sql` |
| Column names in all kofa_* and lovdata_* tables? | Sprint 2 start | Supabase MCP: `list_tables` (verbose) |
| dagre three-layer: invisible edges vs manual y-offset? | Sprint 4 start | Prototype with real data |
| Progressive expansion vs flat graph? | Sprint 4 start | Test with 100+ nodes |
| Scoped styles vs utility classes balance? | Sprint 3 start | Check endringsmeldinger patterns |
| Patterns from codegrasp to adopt (FQN, confidence)? | Sprint 2 start | Read ~/Projects/codegrasp source |

**Schema verification:** Always use Supabase MCP (`list_tables`, `execute_sql`) — not assumptions from plan. The kofa and paragraf MCP servers at `~/Projects/Catenda/` are useful references for understanding the data model but Supabase MCP gives the ground truth.
