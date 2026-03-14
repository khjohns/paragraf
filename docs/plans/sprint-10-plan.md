# Sprint 10: Fundament — DB + Portefølje + Routing

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multiple analyses persisted in Supabase, navigable portfolio, workspace loaded by ID.

**Architecture:** Five new DB tables store analysis state. Backend CRUD endpoints expose them. Frontend gets two routes: `/` (portfolio) and `/analyse/[id]` (workspace). `AnalysisState` switches from localStorage to DB persistence while keeping Svelte 5 rune reactivity. Portfolio view follows `paragraf-portfolio-concept.jsx` mock.

**Tech Stack:** Supabase (Postgres), Flask, SvelteKit 2, Svelte 5 runes, @tanstack/svelte-query v6, Tailwind CSS v4

**Implementeringsprinsipper:**
- Commit etter hver oppgave
- `/simplify` der hensiktsmessig
- `interface-design:init` før portefølje-UI, les `docs/design/paragraf-portfolio-concept.jsx` mock først
- `interface-design:critique` etter UI-oppgaver
- `codegrasp` MCP for avhengighetsanalyse ved AnalysisState-refaktorering

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/analyses.py` | CRUD operations for analyses table (create, list, get, update) |
| `src/lib/api/analyses.ts` | Frontend API client for analyses endpoints |
| `src/lib/queries/analyses.ts` | TanStack Query factories for analyses |
| `src/routes/analyse/[id]/+page.svelte` | Workspace route (moved from current `+page.svelte`) |
| `src/routes/analyse/[id]/+page.ts` | Route load function — extracts analysis ID from params |
| `src/lib/components/Portfolio.svelte` | Portfolio list view with search, status filter, analysis rows |
| `src/lib/components/PortfolioDetail.svelte` | Right-panel detail for selected analysis in portfolio |
| `src/lib/components/ProgressIndicator.svelte` | 7-step vertical progress indicator for guided analysis |

### Modified Files

| File | Changes |
|------|---------|
| `src/routes/+page.svelte` | Replace workspace with portfolio view |
| `src/routes/+layout.svelte` | Add SvelteKit navigation awareness |
| `src/lib/types/analysis.ts` | Add `AnalysisStatus` enum, `AnalysisSummary`, extend `Analysis` with DB fields |
| `src/lib/stores/analysis.svelte.ts` | Replace localStorage with DB persistence via API calls |
| `src/lib/components/LeftPanel.svelte` | Add `ProgressIndicator` as new section 0, keep existing sections |
| `backend/app.py` | Add analyses CRUD routes |

### Database

| Migration | Tables |
|-----------|--------|
| `create_analysis_tables` | `analyses`, `analysis_seeds`, `analysis_candidates`, `analysis_propositions`, `analysis_documents` |

---

## Chunk 1: Database + Backend

### Task 1: Database Migration

**Files:**
- Create: Migration via Supabase MCP

**Context:** Supabase project is `unified-timeline` (id: `iyetsvrteyzpirygxenu`). Most recent migration is `create_ai_curations_table` (2026-03-09). None of the 5 analysis tables exist yet.

- [ ] **Step 1: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with this SQL:

```sql
-- Analysis lifecycle status
create type analysis_status as enum (
  'scoping',
  'scoping_complete',
  'searching',
  'candidates_ready',
  'screening',
  'screening_complete',
  'post_search',
  'synthesis',
  'qa',
  'complete'
);

-- Core analysis table
create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- nullable until auth is implemented
  title text not null,
  problem text not null default '',
  refined_problem text,
  sub_problems jsonb default '[]'::jsonb,
  context jsonb default '{}'::jsonb,
  status analysis_status not null default 'scoping',
  iteration int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seeds per analysis (provisions, FTS terms, vector queries, case seeds)
create table analysis_seeds (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  seed_type text not null check (seed_type in ('provision', 'fts', 'vector', 'case')),
  value text not null,
  iteration int not null default 1,
  source text not null default 'user' check (source in ('user', 'ai_suggested')),
  confirmed boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_analysis_seeds_analysis on analysis_seeds(analysis_id);

-- Candidate cases per analysis
create table analysis_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  sak_nr text not null,
  category text check (category in ('A', 'B', 'C')),
  signals jsonb default '{"ref":false,"fts":false,"vec":false}'::jsonb,
  iteration int not null default 1,
  screening_status text not null default 'pending'
    check (screening_status in ('pending', 'ai_screened', 'user_read', 'both')),
  ai_screening jsonb, -- structured screening result from Claude
  user_notes text,
  is_delimitation boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_analysis_candidates_analysis on analysis_candidates(analysis_id);
create unique index idx_analysis_candidates_unique on analysis_candidates(analysis_id, sak_nr);

-- Legal propositions extracted during screening
create table analysis_propositions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  proposition_text text not null,
  theme text,
  source_case text, -- sak_nr
  source_paragraph int,
  evolution_type text, -- 'established', 'developing', 'contested'
  source text not null default 'ai_screening'
    check (source in ('ai_screening', 'user', 'cross_analysis')),
  confirmed boolean not null default false,
  tension_with_id uuid references analysis_propositions(id),
  created_at timestamptz not null default now()
);
create index idx_analysis_propositions_analysis on analysis_propositions(analysis_id);

-- Documents generated during analysis (notes, exports, QA reports)
create table analysis_documents (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  doc_type text not null check (doc_type in ('note', 'export', 'qa_report', 'deposit')),
  content text not null default '',
  version int not null default 1,
  created_at timestamptz not null default now()
);
create index idx_analysis_documents_analysis on analysis_documents(analysis_id);

-- Auto-update updated_at on analyses
create or replace function update_analyses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger analyses_updated_at
  before update on analyses
  for each row execute function update_analyses_updated_at();
```

- [ ] **Step 2: Verify migration**

Use `mcp__claude_ai_Supabase__list_tables` to confirm all 5 tables exist. Then use `mcp__claude_ai_Supabase__execute_sql` to run:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'analysis%'
order by table_name;
```
Expected: 5 rows (analyses, analysis_candidates, analysis_documents, analysis_propositions, analysis_seeds).

- [ ] **Step 3: Commit**

No code files to commit (migration is in Supabase), but document migration in commit message if any local files changed.

---

### Task 2: Backend CRUD — analyses.py

**Files:**
- Create: `backend/analyses.py`
- Modify: `backend/app.py`

**Context:** `backend/db.py` exports `get_client()` which returns a Supabase client. All other backend modules (e.g. `backend/cases.py`, `backend/traversal.py`) follow the same pattern: module-level functions that call `get_client()`.

- [ ] **Step 1: Create `backend/analyses.py`**

```python
"""CRUD operations for analyses."""
from db import get_client


def list_analyses(user_id=None):
    """List all analyses, optionally filtered by user."""
    q = get_client().table("analyses").select(
        "id, title, problem, status, iteration, created_at, updated_at"
    ).order("updated_at", desc=True)
    if user_id:
        q = q.eq("user_id", user_id)
    return q.execute().data


def get_analysis(analysis_id):
    """Get a single analysis with its seeds."""
    client = get_client()

    analysis = (
        client.table("analyses")
        .select("*")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not analysis:
        return None

    seeds = (
        client.table("analysis_seeds")
        .select("*")
        .eq("analysis_id", analysis_id)
        .order("created_at")
        .execute()
        .data
    )

    candidates = (
        client.table("analysis_candidates")
        .select("id, sak_nr, category, signals, iteration, screening_status, user_notes, is_delimitation, read_at")
        .eq("analysis_id", analysis_id)
        .order("category")
        .execute()
        .data
    )

    analysis["seeds"] = seeds
    analysis["candidates"] = candidates
    return analysis


def create_analysis(title, problem=""):
    """Create a new analysis."""
    result = (
        get_client()
        .table("analyses")
        .insert({"title": title, "problem": problem})
        .execute()
        .data
    )
    return result[0] if result else None


def update_analysis(analysis_id, updates):
    """Update analysis fields. Accepts: title, problem, refined_problem, sub_problems, context, status, iteration."""
    allowed = {"title", "problem", "refined_problem", "sub_problems", "context", "status", "iteration"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return None
    result = (
        get_client()
        .table("analyses")
        .update(filtered)
        .eq("id", analysis_id)
        .execute()
        .data
    )
    return result[0] if result else None


def upsert_seeds(analysis_id, seeds_data):
    """Replace all seeds for an analysis. seeds_data is a dict with provisions, ftsTerms, vectorQuery, cases."""
    client = get_client()

    # Delete existing seeds
    client.table("analysis_seeds").delete().eq("analysis_id", analysis_id).execute()

    rows = []
    for prov in seeds_data.get("provisions", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "provision", "value": prov})
    for term in seeds_data.get("ftsTerms", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "fts", "value": term})
    if seeds_data.get("vectorQuery"):
        rows.append({"analysis_id": analysis_id, "seed_type": "vector", "value": seeds_data["vectorQuery"]})
    for case in seeds_data.get("cases", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "case", "value": case})

    if rows:
        client.table("analysis_seeds").insert(rows).execute()


def update_candidate(analysis_id, sak_nr, updates):
    """Update a candidate's user_notes, is_delimitation, read_at, or screening_status."""
    allowed = {"user_notes", "is_delimitation", "read_at", "screening_status"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return None
    result = (
        get_client()
        .table("analysis_candidates")
        .update(filtered)
        .eq("analysis_id", analysis_id)
        .eq("sak_nr", sak_nr)
        .execute()
        .data
    )
    return result[0] if result else None
```

- [ ] **Step 2: Add routes to `backend/app.py`**

Add import at top of `app.py`:
```python
from analyses import list_analyses, get_analysis, create_analysis, update_analysis, upsert_seeds, update_candidate
```

Add routes after existing routes (before the SPA fallback route):
```python
@app.route("/api/analyses", methods=["GET"])
def list_analyses_route():
    return jsonify(list_analyses())


@app.route("/api/analyses", methods=["POST"])
def create_analysis_route():
    body = request.get_json()
    if not body or not body.get("title"):
        return jsonify({"error": "title required"}), 400
    result = create_analysis(body["title"], body.get("problem", ""))
    if not result:
        return jsonify({"error": "Failed to create"}), 500
    return jsonify(result), 201


@app.route("/api/analyses/<analysis_id>")
def get_analysis_route(analysis_id):
    result = get_analysis(analysis_id)
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result)


@app.route("/api/analyses/<analysis_id>", methods=["PATCH"])
def update_analysis_route(analysis_id):
    body = request.get_json()
    if not body:
        return jsonify({"error": "Body required"}), 400
    # Handle seeds separately
    if "seeds" in body:
        upsert_seeds(analysis_id, body.pop("seeds"))
    if body:
        update_analysis(analysis_id, body)
    # Return updated analysis
    result = get_analysis(analysis_id)
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result)


@app.route("/api/analyses/<analysis_id>/candidates/<path:sak_nr>", methods=["PATCH"])
def update_candidate_route(analysis_id, sak_nr):
    body = request.get_json()
    if not body:
        return jsonify({"error": "Body required"}), 400
    result = update_candidate(analysis_id, sak_nr, body)
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result)
```

- [ ] **Step 3: Verify backend starts**

```bash
cd backend && python app.py
```

Test with curl:
```bash
curl -s http://localhost:5002/api/analyses | python -m json.tool
# Expected: []

curl -s -X POST http://localhost:5002/api/analyses \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","problem":"Test problem"}' | python -m json.tool
# Expected: { "id": "...", "title": "Test", ... }
```

- [ ] **Step 4: Commit**

```bash
git add backend/analyses.py backend/app.py
git commit -m "feat: add analyses CRUD backend endpoints"
```

---

## Chunk 2: Frontend Foundation — Types, API, Routing

### Task 3: Extend Frontend Types

**Files:**
- Modify: `src/lib/types/analysis.ts`

**Context:** Current `Analysis` type uses localStorage-only fields. Extend it for DB persistence and portfolio view.

- [ ] **Step 1: Update `src/lib/types/analysis.ts`**

```typescript
export type AnalysisStatus =
	| 'scoping'
	| 'scoping_complete'
	| 'searching'
	| 'candidates_ready'
	| 'screening'
	| 'screening_complete'
	| 'post_search'
	| 'synthesis'
	| 'qa'
	| 'complete';

export interface Seeds {
	provisions: string[];
	ftsTerms: string[];
	vectorQuery: string;
	cases: string[];
}

export interface IterationEntry {
	iteration: number;
	addedSeeds: string[];
	newNodeCount: number;
}

// Existing Analysis interface — KEEP as-is for backward compatibility.
// All existing components depend on this shape (problemStatement, readStatus, etc.)
export interface Analysis {
	id: string;
	title?: string;  // NEW — optional to not break existing code
	problemStatement: string;
	seeds: Seeds;
	iteration: number;
	readStatus: Record<string, boolean>;
	notes: Record<string, string>;
	delimitations: Record<string, boolean>;
	iterationHistory?: IterationEntry[];
	status?: AnalysisStatus;  // NEW — optional to not break existing code
	createdAt: string;
	updatedAt: string;
}

/** Summary for portfolio list — lightweight, no candidates */
export interface AnalysisSummary {
	id: string;
	title: string;
	problem: string;
	status: AnalysisStatus;
	iteration: number;
	created_at: string;
	updated_at: string;
}

/** Seed row from DB */
export interface AnalysisSeed {
	id: string;
	analysis_id: string;
	seed_type: 'provision' | 'fts' | 'vector' | 'case';
	value: string;
	iteration: number;
	source: 'user' | 'ai_suggested';
	confirmed: boolean;
}

/** Candidate row from DB */
export interface AnalysisCandidate {
	id: string;
	sak_nr: string;
	category: 'A' | 'B' | 'C' | null;
	signals: { ref: boolean; fts: boolean; vec: boolean };
	iteration: number;
	screening_status: 'pending' | 'ai_screened' | 'user_read' | 'both';
	user_notes: string | null;
	is_delimitation: boolean;
	read_at: string | null;
}

/** DB response shape — mapped to Analysis in loadFromDb */
export interface AnalysisDbResponse {
	id: string;
	title: string;
	problem: string;
	refined_problem: string | null;
	sub_problems: string[];
	context: Record<string, string>;
	status: AnalysisStatus;
	iteration: number;
	seeds: AnalysisSeed[];
	candidates: AnalysisCandidate[];
	created_at: string;
	updated_at: string;
}
```

**Key decision:** The existing `Analysis` interface keeps `problemStatement` (not `problem`), `readStatus`/`notes`/`delimitations` as required fields. A separate `AnalysisDbResponse` type represents the DB shape. `loadFromDb()` maps between them. This avoids breaking any existing components.

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/analysis.ts
git commit -m "feat: extend analysis types for DB persistence and portfolio"
```

---

### Task 4: Frontend API Client for Analyses

**Files:**
- Create: `src/lib/api/analyses.ts`
- Create: `src/lib/queries/analyses.ts`

**Context:** Existing API client pattern is in `src/lib/api/client.ts` which exports `apiFetch<T>(endpoint, options?)`. Query factories in `src/lib/queries/` use `createQuery` from `@tanstack/svelte-query` with thunk syntax (getter functions for reactive params).

- [ ] **Step 1: Create `src/lib/api/analyses.ts`**

```typescript
import { apiFetch } from './client';
import type { AnalysisSummary, AnalysisDbResponse } from '$lib/types/analysis';

export function fetchAnalyses(): Promise<AnalysisSummary[]> {
	return apiFetch<AnalysisSummary[]>('/api/analyses');
}

export function fetchAnalysis(id: string): Promise<AnalysisDbResponse> {
	return apiFetch<AnalysisDbResponse>(`/api/analyses/${id}`);
}

export function createAnalysis(title: string, problem = ''): Promise<AnalysisDbResponse> {
	return apiFetch<AnalysisDbResponse>('/api/analyses', {
		method: 'POST',
		body: JSON.stringify({ title, problem }),
	});
}

export function updateAnalysis(
	id: string,
	updates: Record<string, unknown>,
): Promise<AnalysisDbResponse> {
	return apiFetch<AnalysisDbResponse>(`/api/analyses/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(updates),
	});
}

export function updateCandidate(
	analysisId: string,
	sakNr: string,
	updates: Record<string, unknown>,
): Promise<unknown> {
	return apiFetch(`/api/analyses/${analysisId}/candidates/${sakNr}`, {
		method: 'PATCH',
		body: JSON.stringify(updates),
	});
}
```

**Note:** `apiFetch` in `client.ts` already sets `Content-Type: application/json` by default — no need to set it in individual functions.

- [ ] **Step 2: Create `src/lib/queries/analyses.ts`**

```typescript
import { createQuery } from '@tanstack/svelte-query';
import { fetchAnalyses, fetchAnalysis } from '$lib/api/analyses';
import type { AnalysisSummary, AnalysisDbResponse } from '$lib/types/analysis';

export function createAnalysesListQuery() {
	return createQuery<AnalysisSummary[]>(() => ({
		queryKey: ['analyses'],
		queryFn: fetchAnalyses,
	}));
}

export function createAnalysisQuery(getId: () => string | null) {
	return createQuery<AnalysisDbResponse>(() => {
		const id = getId();
		return {
			queryKey: ['analysis', id],
			queryFn: () => fetchAnalysis(id!),
			enabled: !!id,
		};
	});
}
```

**Note:** Query factory matches existing pattern in `src/lib/queries/cases.ts` — thunk that extracts reactive value, returns config object.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/analyses.ts src/lib/queries/analyses.ts
git commit -m "feat: add analyses API client and query factories"
```

---

### Task 5: Routing — Move Workspace, Create Portfolio Route

**Files:**
- Create: `src/routes/analyse/[id]/+page.svelte`
- Create: `src/routes/analyse/[id]/+page.ts`
- Modify: `src/routes/+page.svelte`

**Context:** Current `+page.svelte` is the entire workspace (~150 lines). It creates a traversal query, syncs results to `analysisState`, and renders AppShell with LeftPanel/NodeList/GraphView/NodeDetail. It needs to move to `/analyse/[id]/` and load the analysis ID from params.

- [ ] **Step 1: Create `src/routes/analyse/[id]/+page.ts`**

```typescript
export function load({ params }: { params: { id: string } }) {
	return { analysisId: params.id };
}
```

- [ ] **Step 2: Create `src/routes/analyse/[id]/+page.svelte`**

Copy the *entire content* of current `src/routes/+page.svelte` into this file. Then make these changes:

1. Add the page data import at the top of the `<script>` block:
```typescript
import type { PageData } from './$types';
const { data }: { data: PageData } = $props();
```

2. The rest stays the same for now — `analysisState.load()` will be refactored in Task 7 to use `data.analysisId`.

- [ ] **Step 3: Replace `src/routes/+page.svelte` with portfolio stub**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { createAnalysesListQuery } from '$lib/queries/analyses';
	import { createAnalysis } from '$lib/api/analyses';

	const analysesQuery = createAnalysesListQuery();

	async function handleNewAnalysis() {
		const analysis = await createAnalysis('Ny analyse');
		goto(`/analyse/${analysis.id}`);
	}
</script>

<div class="min-h-screen bg-[#F5F3EE] font-sans text-[#1A1814]">
	<!-- Header -->
	<div class="flex items-center gap-2.5 border-b border-black/8 bg-[#FAF9F6] px-5 py-2.5">
		<span class="text-[15px] font-bold tracking-tight">Paragraf</span>
		<span class="flex-1"></span>
	</div>

	<!-- Content placeholder — Portfolio component goes here in Task 6 -->
	<div class="mx-auto max-w-3xl p-8">
		<h1 class="mb-4 text-xl font-bold">Analyser</h1>

		{#if $analysesQuery.isLoading}
			<p class="text-sm text-[#8C8578]">Laster...</p>
		{:else if $analysesQuery.data}
			<div class="flex flex-col gap-2">
				{#each $analysesQuery.data as analysis}
					<a
						href="/analyse/{analysis.id}"
						class="rounded-lg border border-black/8 bg-white p-4 transition-colors hover:border-black/13"
					>
						<div class="text-sm font-semibold">{analysis.title}</div>
						<div class="mt-1 text-xs text-[#8C8578]">{analysis.status} · Iterasjon {analysis.iteration}</div>
					</a>
				{/each}
			</div>
		{/if}

		<button
			onclick={handleNewAnalysis}
			class="mt-4 rounded-md bg-[#1A1814] px-4 py-2 text-sm font-medium text-[#FAF9F6] transition-opacity hover:opacity-85"
		>
			+ Ny analyse
		</button>
	</div>
</div>
```

- [ ] **Step 4: Verify routing works**

```bash
npm run dev
```

Visit `http://localhost:5174/` — should show portfolio stub.
Visit `http://localhost:5174/analyse/some-id` — should show existing workspace.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte src/routes/analyse/
git commit -m "feat: add routing — portfolio at /, workspace at /analyse/[id]"
```

---

## Chunk 3: Portfolio View

### Task 6: Portfolio Component

**Files:**
- Create: `src/lib/components/Portfolio.svelte`
- Create: `src/lib/components/PortfolioDetail.svelte`
- Modify: `src/routes/+page.svelte`

**Context:** The mock is in `docs/design/paragraf-portfolio-concept.jsx`. Read it before implementing. Key elements: analysis rows with status dot, provision pills, progress bar, tension count, overlap indicator, time stamp. Detail panel on right with provisions, reading progress per A/B/C, key propositions, gaps, recent activity, AI next-step suggestion.

**IMPORTANT:** Before starting this task:
1. Read `docs/design/paragraf-portfolio-concept.jsx` (the mock)
2. Run `interface-design:init` to establish design direction
3. After completing, run `interface-design:critique`

- [ ] **Step 1: Read the portfolio mock**

Read `docs/design/paragraf-portfolio-concept.jsx` to understand the visual design. Key design tokens from the mock:

```
bg: '#F5F3EE', panel: '#FAF9F6', surface: '#FFFFFF'
ink: '#1A1814', ink2: '#5C564D', ink3: '#8C8578', ink4: '#B0A99E'
kofa: '#8B6914', prov: '#4A6670', confirm: '#3D7A4A', warn: '#A67B2E'
gap: '#9B4DCA', tension: '#A63D3D'
```

Status phases: `scoping` → `candidates_ready` → `screening` → `post_search` → `synthesis` → `complete`

- [ ] **Step 2: Create `src/lib/components/Portfolio.svelte`**

Build the portfolio list from the mock. Key features:
- Search bar filtering on title, provisions, problem text
- Status filter chips with counts (phase dots)
- Mine/Team toggle (team dimmed/disabled until auth)
- Analysis rows: phase dot, title, provision pills (monospace, prov-colored), status label, progress bar (read/total), tension count, last active time
- Clicking a row selects it (shows detail panel)
- «+ Ny analyse» row at bottom
- Column headers: Analyse, Fase, Lest, (tension icon), Sist aktiv

The component should accept these props:
```typescript
interface Props {
  analyses: AnalysisSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}
```

Use Tailwind CSS v4 classes matching the project's existing patterns. The mock uses inline styles — translate to Tailwind equivalents.

- [ ] **Step 3: Create `src/lib/components/PortfolioDetail.svelte`**

Build the detail panel from the mock. Key features:
- Header: status label (colored), title, problem text, «Åpne analyse» button
- Provisions list with monospace styling
- Reading progress per A/B/C category (progress bars)
- Key propositions (bullet list)
- Gap pairs (monospace provision pairs with ∅ indicator)
- AI next-step suggestion (gold-brown left border, AI badge)

Props:
```typescript
interface Props {
  analysis: AnalysisDbResponse;  // Full data from createAnalysisQuery, not just summary
  onOpen: (id: string) => void;
  onClose: () => void;
}
```

The detail panel uses `AnalysisDbResponse` (fetched when row is selected via `createAnalysisQuery`) which carries candidates, seeds, and status. Propositions and gaps are not yet available from the API — show placeholders for those sections until sprint 14 adds them.

- [ ] **Step 4: Wire up portfolio in `src/routes/+page.svelte`**

Replace the stub from Task 5 with the real Portfolio + PortfolioDetail components:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { createAnalysesListQuery } from '$lib/queries/analyses';
	import { createAnalysisQuery } from '$lib/queries/analyses';
	import { createAnalysis } from '$lib/api/analyses';
	import Portfolio from '$lib/components/Portfolio.svelte';
	import PortfolioDetail from '$lib/components/PortfolioDetail.svelte';

	const analysesQuery = createAnalysesListQuery();

	let selectedId = $state<string | null>(null);
	// Full analysis data for detail panel — fetched when a row is selected
	const selectedQuery = createAnalysisQuery(() => selectedId);

	async function handleCreate() {
		const analysis = await createAnalysis('Ny analyse');
		goto(`/analyse/${analysis.id}`);
	}

	function handleOpen(id: string) {
		goto(`/analyse/${id}`);
	}
</script>

<div class="flex h-screen flex-col bg-[#F5F3EE] font-sans text-[#1A1814]">
	<!-- Header -->
	<div class="flex shrink-0 items-center gap-2.5 border-b border-black/8 bg-[#FAF9F6] px-5 py-2.5">
		<span class="text-[15px] font-bold tracking-tight">Paragraf</span>
		<span class="flex-1"></span>
	</div>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden">
		{#if $analysesQuery.data}
			<Portfolio
				analyses={$analysesQuery.data}
				{selectedId}
				onSelect={(id) => selectedId = id}
				onCreate={handleCreate}
			/>
		{/if}

		{#if selectedId && $selectedQuery.data}
			<PortfolioDetail
				analysis={$selectedQuery.data}
				onOpen={handleOpen}
				onClose={() => selectedId = null}
			/>
		{/if}
	</div>
</div>
```

- [ ] **Step 5: Verify portfolio renders**

Start dev server and visit `/`. Create a test analysis, verify it appears in the list, click to see detail panel, click "Åpne analyse" to navigate to workspace.

- [ ] **Step 6: Run `interface-design:critique`**

Review the portfolio UI against design principles and the mock.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/Portfolio.svelte src/lib/components/PortfolioDetail.svelte src/routes/+page.svelte
git commit -m "feat: add portfolio view with analysis list and detail panel"
```

---

## Chunk 4: AnalysisState DB Persistence + Progress Indicator

### Task 7: Refactor AnalysisState for DB Persistence

**Files:**
- Modify: `src/lib/stores/analysis.svelte.ts`
- Modify: `src/routes/analyse/[id]/+page.svelte`

**Context:** Currently `AnalysisState` uses `localStorage` with `save()`/`load()` methods. It stores nodes, edges, gaps in state and the `Analysis` object. The refactoring needs to:
1. Load analysis data from DB on workspace mount (using the route's `analysisId`)
2. Save mutations back to DB (debounced)
3. Keep localStorage as fallback cache for offline/fast reload
4. Preserve existing reactive interface — all components use `analysisState.analysis`, `analysisState.nodes`, etc.

**IMPORTANT:** Before modifying `analysis.svelte.ts`, use `codegrasp` MCP (`get_impact_graph` for `AnalysisState`) to understand all consumers. Key consumers include: `+page.svelte`, `LeftPanel.svelte`, `SeedInput.svelte`, `NodeList.svelte`, `NodeDetail.svelte`, `WorkspaceHeader.svelte`, `GraphView.svelte`, `Toolbar.svelte`.

- [ ] **Step 1: Understand impact via codegrasp**

Use `mcp__codegrasp__get_impact_graph` for `analysisState` to see all files that depend on it. Document the list.

- [ ] **Step 2: Add DB helpers to AnalysisState**

Add to `src/lib/stores/analysis.svelte.ts`:

```typescript
import { updateAnalysis } from '$lib/api/analyses';
import type { AnalysisDbResponse } from '$lib/types/analysis';
```

Add a method to initialize from DB data and a debounced DB save:

```typescript
/** The DB analysis ID — set when loading a workspace */
private dbId: string | null = null;
private dbSaveTimeout: ReturnType<typeof setTimeout> | null = null;

/** Load from DB response — maps AnalysisDbResponse to internal Analysis shape */
loadFromDb(data: AnalysisDbResponse) {
    this.dbId = data.id;

    // Convert DB seeds to local Seeds format
    const provisions = data.seeds.filter(s => s.seed_type === 'provision').map(s => s.value);
    const ftsTerms = data.seeds.filter(s => s.seed_type === 'fts').map(s => s.value);
    const vectorQuery = data.seeds.find(s => s.seed_type === 'vector')?.value ?? '';
    const cases = data.seeds.filter(s => s.seed_type === 'case').map(s => s.value);

    // Convert DB candidates to readStatus/notes/delimitations
    const readStatus: Record<string, boolean> = {};
    const notes: Record<string, string> = {};
    const delimitations: Record<string, boolean> = {};
    for (const c of data.candidates) {
        const nodeId = `kofa:${c.sak_nr}`;
        if (c.read_at) readStatus[nodeId] = true;
        if (c.user_notes) notes[nodeId] = c.user_notes;
        if (c.is_delimitation) delimitations[nodeId] = true;
    }

    this.analysis = {
        id: data.id,
        title: data.title,
        problemStatement: data.problem,  // DB 'problem' → internal 'problemStatement'
        seeds: { provisions, ftsTerms, vectorQuery, cases },
        iteration: data.iteration,
        status: data.status,
        readStatus,
        notes,
        delimitations,
        iterationHistory: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };

    // Also save to localStorage as cache
    this.save();
}

/** Persist current state to DB (debounced) */
private debouncedDbSave() {
    if (!this.dbId) return;
    if (this.dbSaveTimeout) clearTimeout(this.dbSaveTimeout);
    this.dbSaveTimeout = setTimeout(() => this.saveToDb(), 1000);
}

private async saveToDb() {
    if (!this.dbId) return;
    try {
        await updateAnalysis(this.dbId, {
            problem: this.analysis.problemStatement,  // internal 'problemStatement' → DB 'problem'
            title: this.analysis.title ?? '',
            seeds: this.analysis.seeds,  // PATCH handler calls upsert_seeds separately
            iteration: this.analysis.iteration,
            status: this.analysis.status ?? 'scoping',
        });
    } catch {
        // DB save failed — localStorage still has the data
    }
}
```

Update the `touch()` method to also trigger DB save:

```typescript
private touch() {
    this.analysis.updatedAt = new Date().toISOString();
    this.debouncedSave();    // localStorage
    this.debouncedDbSave();  // DB
}
```

- [ ] **Step 3: Update workspace route to load from DB**

In `src/routes/analyse/[id]/+page.svelte`, after the existing `onMount`, add DB loading:

```typescript
import { fetchAnalysis } from '$lib/api/analyses';

// After existing onMount that calls analysisState.load()
$effect(() => {
    const id = data.analysisId;
    if (id) {
        fetchAnalysis(id).then((dbData) => {
            analysisState.loadFromDb(dbData);
        }).catch(() => {
            // Fallback to localStorage if DB fails
            analysisState.load();
        });
    }
});
```

Remove or guard the existing `analysisState.load()` call so it only fires as fallback.

- [ ] **Step 4: Verify workspace loads from DB**

1. Create an analysis via portfolio
2. Navigate to `/analyse/[id]`
3. Add seeds, verify they persist (refresh page — seeds should survive)
4. Check Network tab — PATCH requests should fire to `/api/analyses/:id`

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/analysis.svelte.ts src/routes/analyse/
git commit -m "feat: refactor AnalysisState for DB persistence with localStorage fallback"
```

- [ ] **Step 6: Run `/simplify`**

Review the refactored AnalysisState for duplication or unnecessary complexity.

---

### Task 8: Progress Indicator

**Files:**
- Create: `src/lib/components/ProgressIndicator.svelte`
- Modify: `src/lib/components/LeftPanel.svelte`

**Context:** The guided analysis doc (section 7) defines a 7-step progress indicator. Current `LeftPanel.svelte` has 5 `LeftPanelSection` components. The progress indicator is a *new section* at the top (before the existing sections), showing the analysis's position in the guided workflow.

**IMPORTANT:** Run `interface-design:init` before building this component. Reference the progress indicator design from `paragraf-guidet-analyse.md` section 7.

- [ ] **Step 1: Create `src/lib/components/ProgressIndicator.svelte`**

Design reference (from guidet-analyse doc section 7):
```
① Problemstilling              ✓ Godkjent
② Søk                          ✓ 12 kandidater (3A + 5B + 4C)
③ Screening                    ◐ 8 av 12 (3 Claude, 2 meg, 3 gjenstår)
④ Ettersøk                     ○ Ikke startet
⑤ Syntese                      ○ Ikke startet
⑥ QA                           ○ Ikke startet
⑦ Deponering                   ○ Ikke startet
```

Props:
```typescript
interface Props {
  status: AnalysisStatus;
}
```

Map `AnalysisStatus` to step completion:

| Status | Completed steps |
|--------|----------------|
| `scoping` | none |
| `scoping_complete` | 1 |
| `candidates_ready` | 1, 2 |
| `screening` | 1, 2, 3 (in progress) |
| `screening_complete` | 1, 2, 3 |
| `post_search` | 1, 2, 3, 4 (in progress) |
| `synthesis` | 1, 2, 3, 4, 5 (in progress) |
| `qa` | 1, 2, 3, 4, 5, 6 (in progress) |
| `complete` | all |

Visual: vertical list with numbered circles (filled = done, ring with dot = in progress, empty ring = not started). Each step is clickable (future: navigates to that step's view). Active step highlighted. Skipped steps dimmed.

Use the design tokens from the project: `#1A1814` (ink) for completed circles, `#8B6914` (kofa/ai) for active, `#B0A99E` (ink4) for pending.

- [ ] **Step 2: Add ProgressIndicator to LeftPanel**

In `src/lib/components/LeftPanel.svelte`, add the progress indicator as a new section before the existing sections. Import `ProgressIndicator` and pass `analysisState.analysis.status` (or derive status from current state until DB status is fully wired).

For now, derive a basic status from existing state:
```typescript
const derivedStatus: AnalysisStatus = $derived.by(() => {
    if (analysisState.nodes.length === 0) return 'scoping';
    const readCount = Object.values(analysisState.analysis.readStatus).filter(Boolean).length;
    if (readCount === 0) return 'candidates_ready';
    if (readCount < analysisState.nodes.filter(n => n.type === 'kofa_case').length) return 'screening';
    return 'screening_complete';
});
```

- [ ] **Step 3: Run `interface-design:critique`**

Review the progress indicator against design principles.

- [ ] **Step 4: Verify progress indicator renders**

Visit a workspace with and without results. The indicator should show appropriate step states.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProgressIndicator.svelte src/lib/components/LeftPanel.svelte
git commit -m "feat: add 7-step progress indicator to workspace left panel"
```

---

## Verification Checklist

Before considering Sprint 10 complete:

- [ ] **DB:** All 5 tables exist in Supabase with correct schema
- [ ] **Backend:** `GET/POST /api/analyses`, `GET/PATCH /api/analyses/:id`, `PATCH /api/analyses/:id/candidates/:sak_nr` all work
- [ ] **Routing:** `/` shows portfolio, `/analyse/[id]` shows workspace
- [ ] **Portfolio:** Lists analyses, search works, clicking opens detail panel, «Ny analyse» creates and navigates
- [ ] **Persistence:** Seeds and problem statement survive page refresh (DB-backed)
- [ ] **Progress:** 7-step indicator visible in workspace left panel, reflects analysis state
- [ ] **Existing features:** List view, graph view, detail panel, curation, keyboard shortcuts all still work in workspace
- [ ] **Run `/simplify`** on the final state
