# Sprint 8 — Fase 1 avrunding + Fase 2 start

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close remaining Fase 1 gaps (provision/EU/forarbeid detail panels, AI loading state, keyboard shortcuts) and start Fase 2 Lag 1 deterministic tools (vector seed from problem statement, suggested provisions).

**Architecture:** Extend NodeDetail.svelte to render type-specific detail views for provisions, EU cases, and forarbeider. Add two new backend endpoints (`/api/eu-cases/<id>`, `/api/forarbeider/<doc_id>/<section>`). Add global keyboard handler. For Fase 2, add embedding generation in backend (reuse existing `search_kofa_decision_hybrid` RPC) and a suggestion component under SeedInput.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind v4, Flask, Supabase (PostgreSQL + pgvector), @tanstack/svelte-query v6

---

## Task 1: Fix ProvisionDetail — dynamic dok_id from node

**Problem:** NodeDetail.svelte line 259 hardcodes `dokId="forskrift/2016-08-12-974"`. Should use the provision node's actual dok_id.

**Files:**
- Modify: `src/lib/components/NodeDetail.svelte:257-260`

**Step 1: Fix the hardcoded dok_id**

The provision node ID format is `{law_name}:{section}` (e.g. `anskaffelsesforskriften:16-10`). The backend `provisions.py` already resolves law_name aliases to full dok_id. So pass `parts[0]` as dokId instead of hardcoding.

```svelte
{#if selectedNode.type === 'provision'}
	{@const parts = selectedNode.id.split(':')}
	<ProvisionDetail dokId={parts[0] ?? ''} sectionId={parts[1] ?? ''} />
{/if}
```

**Step 2: Verify in browser**

Navigate to app, select a provision node. Confirm ProvisionDetail loads with correct law text.

**Step 3: Enhance ProvisionDetail with referencing cases list**

Currently shows count only. Add list of referencing KOFA cases (clickable, navigate to case).

Modify `backend/provisions.py` to return top referencing cases (not just count):

```python
# After the count query, fetch top 10 referencing case details
ref_cases_result = (
    client.table("kofa_law_references")
    .select("sak_nr")
    .eq("law_name", dok_id)  # dok_id here is the alias
)
ref_cases_result = _section_filter(ref_cases_result, "law_section", section_id).execute()

ref_sak_nrs = list(set(r["sak_nr"] for r in (ref_cases_result.data or [])))[:10]
```

Add `"referencing_case_list"` to the response dict.

**Step 4: Update ProvisionDetail.svelte to show clickable case list**

Add a section below the meta showing referencing cases as clickable buttons that call `uiState.navigateTo()`.

**Step 5: Commit**

```
feat: fix provision detail dynamic dok_id, add referencing case list
```

---

## Task 2: EU case detail endpoint + panel

**Files:**
- Create: `backend/eu_cases.py`
- Modify: `backend/app.py` (add route)
- Modify: `src/lib/types/api.ts` (add EuCaseDetailResponse)
- Modify: `src/lib/api/cases.ts` (add fetchEuCaseDetail)
- Create: `src/lib/components/EuCaseDetail.svelte`
- Modify: `src/lib/components/NodeDetail.svelte` (render EuCaseDetail for eu_case type)

**Step 1: Backend endpoint**

`backend/eu_cases.py`:
```python
from db import get_client


def get_eu_case_detail(eu_case_id: str) -> dict | None:
    client = get_client()

    # 1. EU case metadata
    result = (
        client.table("kofa_eu_case_law")
        .select("eu_case_id, celex, case_name, judgment_date, subject, description, source_url")
        .eq("eu_case_id", eu_case_id)
        .limit(1)
        .execute()
    )
    case = (result.data or [None])[0]
    if not case:
        return None

    # 2. KOFA cases that reference this EU case
    refs = (
        client.table("kofa_eu_references")
        .select("sak_nr, context")
        .eq("eu_case_id", eu_case_id)
        .execute()
    )

    return {
        "eu_case_id": case["eu_case_id"],
        "celex": case.get("celex"),
        "case_name": case.get("case_name"),
        "judgment_date": str(case["judgment_date"]) if case.get("judgment_date") else None,
        "subject": case.get("subject"),
        "description": case.get("description"),
        "source_url": case.get("source_url"),
        "referencing_cases": [
            {"sak_nr": r["sak_nr"], "context": r.get("context") or ""}
            for r in (refs.data or [])
        ],
    }
```

**Step 2: Register route in app.py**

```python
from eu_cases import get_eu_case_detail

@app.route("/api/eu-cases/<path:eu_case_id>")
def eu_case_detail(eu_case_id):
    result = get_eu_case_detail(eu_case_id)
    if result is None:
        return jsonify({"error": "EU case not found"}), 404
    return jsonify(result)
```

**Step 3: Frontend types + API function**

Add `EuCaseDetailResponse` to `src/lib/types/api.ts`:
```typescript
export interface EuCaseDetailResponse {
	eu_case_id: string;
	celex: string | null;
	case_name: string | null;
	judgment_date: string | null;
	subject: string | null;
	description: string | null;
	source_url: string | null;
	referencing_cases: Array<{ sak_nr: string; context: string }>;
}
```

Add `fetchEuCaseDetail` to `src/lib/api/cases.ts`.

**Step 4: Create EuCaseDetail.svelte**

Component that fetches EU case detail via query. Shows:
- Case name (large, as per spec: "partsnavn størst")
- Subject/description
- CELEX number
- Judgment date
- Referencing KOFA cases (clickable list)
- Source URL link

Style with `--p-eu-bg` / `--p-eu-accent` / `--p-eu-border` tokens.

**Step 5: Wire into NodeDetail.svelte**

After the provision detail block (~line 260), add:
```svelte
{#if selectedNode.type === 'eu_case'}
	<EuCaseDetail euCaseId={selectedNode.id.replace('eu:', '')} />
{/if}
```

The EU node ID format from traversal.py is `eu:{eu_case_id}`.

**Step 6: Verify in browser + commit**

```
feat: EU case detail panel with referencing cases
```

---

## Task 3: Forarbeid detail endpoint + panel

**Files:**
- Create: `backend/forarbeider.py`
- Modify: `backend/app.py` (add route)
- Modify: `src/lib/types/api.ts` (add ForarbeidDetailResponse)
- Modify: `src/lib/api/cases.ts` (add fetchForarbeidDetail)
- Create: `src/lib/components/ForarbeidDetail.svelte`
- Modify: `src/lib/components/NodeDetail.svelte`

**Step 1: Backend endpoint**

`backend/forarbeider.py`:
```python
from db import get_client


def get_forarbeid_detail(doc_id: str, section_number: str) -> dict | None:
    client = get_client()

    # 1. Document metadata
    doc_result = (
        client.table("kofa_forarbeider")
        .select("doc_id, doc_type, title, full_title, session, page_count, source_url")
        .eq("doc_id", doc_id)
        .limit(1)
        .execute()
    )
    doc = (doc_result.data or [None])[0]
    if not doc:
        return None

    # 2. Section content
    section_result = (
        client.table("kofa_forarbeider_sections")
        .select("section_number, title, level, text, parent_path")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .limit(1)
        .execute()
    )
    section = (section_result.data or [None])[0]

    # 3. Law references from this section
    law_refs = (
        client.table("kofa_forarbeider_law_refs")
        .select("law_name, law_section, context")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .execute()
    )

    return {
        "doc_id": doc["doc_id"],
        "doc_type": doc.get("doc_type"),
        "title": doc.get("title"),
        "full_title": doc.get("full_title"),
        "session": doc.get("session"),
        "source_url": doc.get("source_url"),
        "section": {
            "number": section["section_number"],
            "title": section.get("title"),
            "level": section.get("level"),
            "text": section.get("text"),
            "parent_path": section.get("parent_path"),
        } if section else None,
        "law_references": [
            {"law_name": r["law_name"], "law_section": r.get("law_section") or "", "context": r.get("context") or ""}
            for r in (law_refs.data or [])
        ],
    }
```

**Step 2: Register route**

```python
from forarbeider import get_forarbeid_detail

@app.route("/api/forarbeider/<path:doc_id>/<section_number>")
def forarbeid_detail(doc_id, section_number):
    result = get_forarbeid_detail(doc_id, section_number)
    if result is None:
        return jsonify({"error": "Forarbeid not found"}), 404
    return jsonify(result)
```

**Step 3: Frontend types + API function + component**

Same pattern as EU case. Forarbeid node ID format from traversal.py: `forarbeid:{doc_id}:{section_number}`.

Component shows:
- Document title (large) + full_title subtitle
- Doc type, session, source_url
- Section content (if available)
- Law references (clickable provisions)

Style with `--p-prep-bg` / `--p-prep-accent` / `--p-prep-border` tokens.

**Step 4: Wire into NodeDetail.svelte**

```svelte
{#if selectedNode.type === 'prep_work'}
	{@const parts = selectedNode.id.split(':')}
	<ForarbeidDetail docId={parts.slice(1, -1).join(':')} sectionNumber={parts[parts.length - 1]} />
{/if}
```

Note: doc_id may contain colons, so split carefully — section_number is always the last part.

**Step 5: Verify + commit**

```
feat: forarbeid detail panel with section content and law references
```

---

## Task 4: AI curation loading state — pulsating border

**Files:**
- Modify: `src/lib/components/CaseReader.svelte` (add pulsating border during loading)
- Modify: `src/lib/components/NodeDetail.svelte` (loading indicator in overview)

**Step 1: Add pulsating gold-brown left border in CaseReader**

Per spec §32: "En dempet pulserende gullbrun venstrekant ved siden av teksten indikerer at kuratering genereres."

In CaseReader, when `curationLoading` is true, add a pulsating left border to the text container:

```css
@keyframes pulse-border {
	0%, 100% { border-left-color: var(--p-ai-border); opacity: 0.3; }
	50% { border-left-color: var(--p-ai-border); opacity: 1; }
}

.curation-loading-border {
	border-left: 3px solid var(--p-ai-border);
	animation: pulse-border 2s ease-in-out infinite;
	padding-left: 12px;
}
```

Apply this class to the paragraph container when `curationLoading && !curation`.

**Step 2: Fade-in when curation arrives**

When curation loads, highlights should fade in without reflow. The existing `fade-in` keyframe can be reused. Ensure text doesn't jump — highlights are background color changes only (already the case).

**Step 3: Update overview shimmer**

Replace the plain text "Henter AI-kuratering..." in NodeDetail with a pulsating indicator:

```svelte
{#if curationQuery.isLoading}
	<div class="ai-loading">
		<div class="ai-loading-bar"></div>
		<span>Genererer AI-kuratering...</span>
	</div>
{/if}
```

```css
.ai-loading {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 0;
}
.ai-loading-bar {
	width: 3px;
	height: 16px;
	border-radius: 2px;
	background: var(--p-ai-border);
	animation: pulse-border 2s ease-in-out infinite;
}
```

**Step 4: Verify + commit**

```
feat: pulsating gold-brown loading state for AI curation
```

---

## Task 5: Keyboard shortcuts

**Files:**
- Create: `src/lib/components/KeyboardShortcuts.svelte`
- Modify: `src/routes/+page.svelte` (mount KeyboardShortcuts)

**Step 1: Create global keyboard handler component**

Per spec §32, implement these shortcuts:

| Key | Action |
|-----|--------|
| `↓` / `↑` | Next/previous case in list |
| `M` | Toggle read status on selected node |
| `R` | Open reading mode in right panel |
| `Esc` | Back to overview / close panel |
| `?` | Show shortcut overlay |

The component:
- Listens to `window:keydown`
- Ignores events when focus is in input/textarea
- Accesses `uiState` and `analysisState`
- For ↓/↑: derives sorted/filtered node list, finds current index, selects next/prev

```svelte
<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';
	import { analysisState } from '$lib/stores/analysis.svelte';

	let showHelp = $state(false);

	function isInputFocused() {
		const tag = document.activeElement?.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (isInputFocused()) return;

		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowUp': {
				e.preventDefault();
				const nodes = analysisState.nodes.filter(n => n.type === 'kofa_case');
				if (nodes.length === 0) return;
				const currentIdx = nodes.findIndex(n => n.id === uiState.selectedNodeId);
				const next = e.key === 'ArrowDown'
					? Math.min(currentIdx + 1, nodes.length - 1)
					: Math.max(currentIdx - 1, 0);
				uiState.selectNode(nodes[next].id);
				break;
			}
			case 'm':
			case 'M':
				if (uiState.selectedNodeId) {
					analysisState.toggleRead(uiState.selectedNodeId);
				}
				break;
			case 'r':
			case 'R':
				// Dispatch custom event for NodeDetail to pick up
				window.dispatchEvent(new CustomEvent('shortcut-read'));
				break;
			case 'Escape':
				if (uiState.selectedNodeId) {
					window.dispatchEvent(new CustomEvent('shortcut-escape'));
				}
				break;
			case '?':
				showHelp = !showHelp;
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showHelp}
	<!-- Shortcut overlay -->
	<div class="shortcut-overlay" role="dialog">
		<div class="shortcut-panel">
			<h3>Tastatursnarveier</h3>
			<div class="shortcut-grid">
				<kbd>↓</kbd><span>Neste sak</span>
				<kbd>↑</kbd><span>Forrige sak</span>
				<kbd>M</kbd><span>Marker som lest</span>
				<kbd>R</kbd><span>Les avgjørelsen</span>
				<kbd>Esc</kbd><span>Lukk / tilbake</span>
				<kbd>?</kbd><span>Vis/skjul snarveier</span>
			</div>
			<button onclick={() => showHelp = false}>Lukk</button>
		</div>
	</div>
{/if}
```

**Step 2: Wire into +page.svelte**

Import and add `<KeyboardShortcuts />` to the page.

**Step 3: Handle R and Esc in NodeDetail**

In NodeDetail, listen for the custom events:
- `shortcut-read`: set `mode = 'reading'` if hasText
- `shortcut-escape`: if `mode === 'reading'`, go to overview; else close panel

**Step 4: Verify + commit**

```
feat: keyboard shortcuts for list navigation, read, escape
```

---

## Task 6: Vector seed from problem statement (Fase 2, Lag 1)

**Files:**
- Create: `backend/vector_seed.py`
- Modify: `backend/app.py` (add route)
- Modify: `src/lib/types/api.ts`
- Modify: `src/lib/api/cases.ts`
- Modify: `src/lib/components/SeedInput.svelte` (auto-populate vector query)

**Step 1: Backend — generate embedding + search**

The `search_kofa_decision_hybrid` RPC needs a vector embedding. We need to generate one from the problem statement text. Use OpenAI's embedding API (same as the KOFA MCP server uses).

`backend/vector_seed.py`:
```python
import os
import openai
from db import get_client

# Use same model as existing embeddings in DB
EMBED_MODEL = "text-embedding-3-small"


def _get_embedding(text: str) -> list[float]:
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    resp = client.embeddings.create(input=text, model=EMBED_MODEL)
    return resp.data[0].embedding


def search_vector_seed(problem_statement: str, max_results: int = 30) -> dict:
    """Search KOFA decision text using problem statement as vector query.

    Returns unique sak_nrs ranked by combined similarity score.
    """
    embedding = _get_embedding(problem_statement)
    client = get_client()

    result = client.rpc(
        "search_kofa_decision_hybrid",
        {
            "query_text": problem_statement,
            "query_embedding": embedding,
            "match_count": max_results,
        },
    ).execute()

    # Deduplicate by sak_nr, keep best score per case
    seen = {}
    for row in result.data or []:
        sak = row["sak_nr"]
        score = row.get("combined_score", 0)
        if sak not in seen or score > seen[sak]["score"]:
            seen[sak] = {"sak_nr": sak, "score": score}

    return {
        "cases": sorted(seen.values(), key=lambda x: -x["score"]),
        "query_used": problem_statement,
    }
```

**Step 2: Register route**

```python
from vector_seed import search_vector_seed

@app.route("/api/vector-seed", methods=["POST"])
def vector_seed():
    body = request.get_json()
    problem = body.get("problem_statement", "")
    if not problem:
        return jsonify({"error": "problem_statement required"}), 400
    try:
        result = search_vector_seed(problem)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

**Step 3: Frontend integration**

Add to SeedInput: when problemStatement changes (debounced ~1s), call `/api/vector-seed`. Display result count as a chip: "V: 12 saker funnet". Store the case sak_nrs in analysis state as `vectorCases`.

Wire the vector cases into the traversal request (the `vectorQuery` field or a new `vectorCases` field).

**Step 4: Verify + commit**

```
feat: vector seed from problem statement (Fase 2 Lag 1)
```

---

## Task 7: Suggested provisions based on search results

**Files:**
- Modify: `backend/traversal.py` (extract provision suggestions from case law references)
- Modify: `src/lib/components/SeedInput.svelte` (show suggestion chips)

**Step 1: Backend — provision suggestions**

After traversal completes, analyze `kofa_law_references` for discovered cases to find provisions that are frequently referenced but NOT in the user's seed list. Return as `suggested_provisions` in traversal response.

Add to `build_traversal_response()` before the return:

```python
# --- 10. Suggested provisions ---
# Find provisions referenced by discovered cases but not in seed list
prov_counts = {}
seed_set = set(provisions)
for row in all_law_refs_data:
    prov_id = f"{row['law_name']}:{row['law_section']}"
    if prov_id not in seed_set and row.get("regulation_version") == "new":
        prov_counts[prov_id] = prov_counts.get(prov_id, 0) + 1

suggested = sorted(prov_counts.items(), key=lambda x: -x[1])[:5]
```

Add `"suggestedProvisions"` to response: `[{"id": "anskaffelsesforskriften:8-11", "count": 7}, ...]`

**Step 2: Frontend — suggestion chips in SeedInput**

Below the provision input, show suggested provisions as chips with dashed border (per spec §19):
- Dashed border, muted styling
- Click adds to seeds (border becomes solid)
- × to dismiss
- Label: "§8-11 (7 saker)" showing the reference count

```svelte
{#if suggestions.length > 0}
	<div class="suggestions">
		<span class="suggestions-label">Kan også være relevant:</span>
		{#each suggestions as s}
			<button class="suggestion-chip" onclick={() => addProvision(s.id)}>
				§{s.id.split(':')[1]} <span class="count">({s.count})</span>
			</button>
		{/each}
	</div>
{/if}
```

**Step 3: Verify + commit**

```
feat: suggested provisions based on discovered case references
```

---

## Execution Order & Dependencies

```
Task 1 (ProvisionDetail fix)     — independent
Task 2 (EU case detail)          — independent
Task 3 (Forarbeid detail)        — independent
Task 4 (AI loading state)        — independent
Task 5 (Keyboard shortcuts)      — independent
Task 6 (Vector seed)             — independent, needs OPENAI_API_KEY env var
Task 7 (Suggested provisions)    — depends on traversal response, can start after Task 1
```

Tasks 1-5 are all independent and can be parallelized. Task 6 needs an OpenAI API key configured. Task 7 modifies traversal response so should be done after other traversal-related work.

## Post-Sprint

After all tasks:
1. Run `simplify` skill on changed files
2. Update `docs/plans/status-checklist.md`
3. Update memory
4. Browser verification with Playwright
