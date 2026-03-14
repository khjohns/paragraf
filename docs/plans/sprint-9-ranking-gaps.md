# Sprint 9: Ranking & Gap-søk

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve case ranking with centrality + authority weight, and make gap-matrix holes actionable (click → add seeds).

**Architecture:** Two backend changes (materialized centrality_score, authority_weight per node type, combined final_score formula) and two frontend changes (gap-click adds seeds, iteration history becomes clickable filter). No new API endpoints — changes are within the existing `/api/traverse` response.

**Tech Stack:** Python Flask backend, Supabase Postgres, SvelteKit 5 (Svelte runes), Tailwind v4

**Design system:** `.interface-design/system.md` — warm paper palette, borders-only depth, Inter/JetBrains Mono.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/traversal.py` | Add scoring formula, return `score` per node |
| Modify | `backend/app.py` | No changes needed (pass-through) |
| Modify | `src/lib/types/graph.ts` | Add `score` field to `GraphNode`, add `id1`/`id2` to `GapPair` |
| Modify | `src/lib/components/LeftPanel.svelte` | Gap-click → add seeds, clickable iteration rows |
| Modify | `src/lib/stores/analysis.svelte.ts` | Add `addSeedsFromGap()`, `filterIteration` state |
| Modify | `src/lib/components/SeedInput.svelte` | No changes (seed chips already reactive) |

---

### Task 1: Backend — centrality_score + authority_weight + scoring

**Files:**
- Modify: `backend/traversal.py:292-456` (build_traversal_response)

The backend already computes `citations` per case node (lines 396-410). We reuse this as `centrality_score`. We add a static `authority_weight` mapping per node type and compute a `final_score` per case node.

- [ ] **Step 1: Add authority weight mapping and scoring function**

Add at the top of `traversal.py`, after the imports:

```python
# Eckhoff-based authority weight per node type (§34 in design spec)
AUTHORITY_WEIGHT: dict[str, float] = {
    "provision": 1.0,
    "kofa_case": 0.4,
    "eu_case": 0.9,
    "court_case": 1.0,  # HR; lagmannsrett would be 0.7
    "prep_work": 0.6,
}


def compute_case_score(
    signal_count: int,
    citation_count: int,
    max_citations: int,
    authority_weight: float,
) -> float:
    """Compute final_score for ranking within each category.

    signal_score: normalized 0-1 from signal_count (1-3)
    centrality: normalized citation_count / max_citations
    authority: static per node type
    """
    signal_score = signal_count / 3.0
    centrality = citation_count / max_citations if max_citations > 0 else 0
    return signal_score * 0.4 + centrality * 0.3 + authority_weight * 0.3
```

- [ ] **Step 2: Apply scoring in build_traversal_response**

After the citation count computation (after line 410), add score computation:

```python
    # --- Compute final_score per case node ---
    max_cite = max((n["citations"] for n in case_nodes), default=0)
    for node in case_nodes:
        signal_count = sum(node.get("signals", {}).values())
        node["score"] = round(compute_case_score(
            signal_count=signal_count,
            citation_count=node["citations"],
            max_citations=max_cite,
            authority_weight=AUTHORITY_WEIGHT.get(node["type"], 0.4),
        ), 4)
```

- [ ] **Step 3: Return full provision IDs in gap matrix**

In `_compute_gaps`, change the gap dict to include full provision IDs alongside display strings:

Replace lines 281-287:
```python
            gaps.append({
                "provision1": f"§{s1}",
                "provision2": f"§{s2}",
                "count": len(shared),
            })
```

With:
```python
            gaps.append({
                "provision1": f"§{s1}",
                "provision2": f"§{s2}",
                "id1": p1,
                "id2": p2,
                "count": len(shared),
            })
```

- [ ] **Step 4: Verify backend locally**

Run: `cd backend && python -c "from traversal import compute_case_score; print(compute_case_score(3, 10, 20, 0.4))"`
Expected: `0.55` (1.0*0.4 + 0.5*0.3 + 0.4*0.3)

- [ ] **Step 5: Commit**

```bash
git add backend/traversal.py
git commit -m "feat: add authority_weight + final_score to traversal ranking"
```

---

### Task 2: Frontend types — score + gap IDs

**Files:**
- Modify: `src/lib/types/graph.ts`

- [ ] **Step 1: Add `score` to GraphNode**

In `GraphNode` interface, after `citations: number;` (line 22), add:

```typescript
	score?: number;
```

- [ ] **Step 2: Add `id1` and `id2` to GapPair**

Change the `GapPair` interface (lines 56-60) to:

```typescript
export interface GapPair {
	provision1: string;
	provision2: string;
	id1?: string;
	id2?: string;
	count: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/graph.ts
git commit -m "feat: add score to GraphNode, provision IDs to GapPair"
```

---

### Task 3: Frontend store — gap-søk + iteration filter

**Files:**
- Modify: `src/lib/stores/analysis.svelte.ts`

- [ ] **Step 1: Add `addSeedsFromGap` method and `filterIteration` state**

In the `AnalysisState` class, add a new reactive state and method.

After `suggestedProvisions` (line 12), add:

```typescript
	/** When set, list/graph filters to nodes from this iteration only */
	filterIteration = $state<number | null>(null);
```

After `startNewIteration()` (after line 120), add:

```typescript
	/** Add both provisions from a gap pair as seeds (if not already present) */
	addSeedsFromGap(id1: string, id2: string) {
		const current = this.analysis.seeds.provisions;
		const added: string[] = [];
		if (!current.includes(id1)) {
			current.push(id1);
			added.push(id1);
		}
		if (!current.includes(id2)) {
			current.push(id2);
			added.push(id2);
		}
		if (added.length > 0) {
			this.analysis.seeds = { ...this.analysis.seeds, provisions: [...current] };
			this.touch();
			const labels = added.map(id => `§${id.split(':')[1]}`).join(' og ');
			queueMicrotask(() => toastState.show(`${labels} lagt til som seeds`, 'success'));
		}
	}

	toggleFilterIteration(iteration: number) {
		this.filterIteration = this.filterIteration === iteration ? null : iteration;
	}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/analysis.svelte.ts
git commit -m "feat: add addSeedsFromGap + iteration filter to analysis store"
```

---

### Task 4: Frontend — gap-click adds seeds

**Files:**
- Modify: `src/lib/components/LeftPanel.svelte:143-166`

- [ ] **Step 1: Replace gap-row onclick handler**

Replace the gap-row `onclick` handler (line 153):

```svelte
onclick={isGap ? () => toastState.show('Hull: ' + gap.provision1 + ' ∩ ' + gap.provision2 + ' — legg til som seeds i neste iterasjon', 'info') : undefined}
```

With:

```svelte
onclick={isGap && gap.id1 && gap.id2 ? () => analysisState.addSeedsFromGap(gap.id1!, gap.id2!) : undefined}
```

- [ ] **Step 2: Update gap-note text**

Replace the gap-note content (line 163):

```svelte
{zeroGaps.length} bestemmelsespar uten felles praksis — mulige analytiske hull
```

With:

```svelte
{zeroGaps.length} hull — klikk for å legge til som søkeparametre
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/LeftPanel.svelte
git commit -m "feat: gap-click adds provisions as seeds"
```

---

### Task 5: Frontend — clickable iteration history (Søkerunder)

**Files:**
- Modify: `src/lib/components/LeftPanel.svelte:169-184`

- [ ] **Step 1: Replace iteration history section**

Replace the entire iteration history block (lines 169-184) with:

```svelte
				<!-- Iteration history (Søkerunder) -->
				{#if analysisState.analysis.iterationHistory?.length}
					<div class="mapping-section">
						<div class="mapping-label">Søkerunder</div>
						<!-- Iteration 1 is always the initial search -->
						<button
							class="round-row"
							class:active={analysisState.filterIteration === 1}
							onclick={() => analysisState.toggleFilterIteration(1)}
						>
							<span class="round-num">1</span>
							<span class="round-seeds">
								{analysisState.analysis.seeds.provisions.slice(0, 2).map(p => `§${p.split(':')[1]}`).join(', ')}
								{#if analysisState.analysis.seeds.ftsTerms.length > 0}
									, «{analysisState.analysis.seeds.ftsTerms[0]}»
								{/if}
							</span>
							<span class="round-count">{analysisState.nodes.filter(n => n.iteration === 1).length}</span>
						</button>
						{#each analysisState.analysis.iterationHistory as entry}
							<button
								class="round-row"
								class:active={analysisState.filterIteration === entry.iteration}
								onclick={() => analysisState.toggleFilterIteration(entry.iteration)}
							>
								<span class="round-num">{entry.iteration}</span>
								<span class="round-seeds">
									+ {entry.addedSeeds.map(s => s.includes(':') ? `§${s.split(':')[1]}` : `«${s}»`).join(', ') || '—'}
								</span>
								<span class="round-count">+{entry.newNodeCount}</span>
							</button>
						{/each}
						{#if analysisState.filterIteration !== null}
							<div class="filter-active-notice">
								Viser kun runde {analysisState.filterIteration}
								<button class="clear-filter" onclick={() => analysisState.filterIteration = null}>Vis alle</button>
							</div>
						{/if}
					</div>
				{/if}
```

- [ ] **Step 2: Add styles for round-row and filter notice**

Add after the existing `.iter-info` styles (after line 434):

```css
	.round-row {
		all: unset;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
		color: var(--p-ink2);
		border: 1px solid transparent;
		width: 100%;
		box-sizing: border-box;
	}
	.round-row:hover {
		background: var(--p-hover);
	}
	.round-row.active {
		background: var(--p-active);
		border-color: var(--p-border-m);
	}
	.round-num {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--p-input);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink3);
		flex-shrink: 0;
	}
	.round-row.active .round-num {
		background: var(--p-ink);
		color: var(--p-panel);
	}
	.round-seeds {
		flex: 1;
		font-family: var(--font-data);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.round-count {
		font-family: var(--font-data);
		font-size: 11px;
		font-weight: 600;
		color: var(--p-ink3);
		flex-shrink: 0;
	}
	.filter-active-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 5px 8px;
		border-radius: 4px;
		background: var(--p-active);
		font-size: 10px;
		color: var(--p-ink3);
	}
	.clear-filter {
		all: unset;
		cursor: pointer;
		font-size: 10px;
		font-weight: 600;
		color: var(--p-ink2);
		text-decoration: underline;
	}
	.clear-filter:hover {
		color: var(--p-ink);
	}
```

- [ ] **Step 3: Also update the section subtitle**

Change the Kartlegging section subtitle (line 115):

```svelte
subtitle="Iter. {analysisState.analysis.iteration}"
```

To:

```svelte
subtitle="Runde {analysisState.analysis.iteration}"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/LeftPanel.svelte
git commit -m "feat: clickable iteration history (Søkerunder) with filter"
```

---

### Task 6: Wire iteration filter to list view

**Files:**
- Modify: `src/routes/+page.svelte` (or wherever the list filtering happens)

The iteration filter should dim nodes not matching the selected iteration (consistent with the existing dimming pattern — §15 in design spec).

- [ ] **Step 1: Find where list nodes are filtered/rendered**

Check `+page.svelte` for where `analysisState.nodes` is passed to the list. The filter should be applied as a derived value alongside existing filters (regulation, category, search).

- [ ] **Step 2: Add iteration filter to the node list**

In the component that renders the list, add iteration filtering alongside existing filters. Nodes from other iterations should be dimmed (15-25% opacity), NOT removed — following the spec's dimming pattern.

If the list component has a `dimmed` or `filtered` prop per node, add the iteration check there. If not, compute a `isIterationDimmed` flag:

```typescript
let isIterationDimmed = $derived((nodeId: string) => {
	if (analysisState.filterIteration === null) return false;
	const node = analysisState.nodes.find(n => n.id === nodeId);
	return node ? node.iteration !== analysisState.filterIteration : false;
});
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte src/lib/components/NodeRow.svelte
git commit -m "feat: iteration filter dims non-matching nodes in list"
```

---

### Task 7: Verify end-to-end

- [ ] **Step 1: Start backend**

Run: `cd backend && python app.py`

- [ ] **Step 2: Start frontend**

Run: `npm run dev`

- [ ] **Step 3: Manual verification checklist**

1. Enter provisions `FOA §16-10` and `FOA §17-1` with FTS term `forpliktelseserklæring`
2. Run search — verify A/B/C results appear with reasonable ordering
3. Check gap matrix — verify ∅ rows are clickable
4. Click a ∅ gap row — verify provisions appear as new chips in seed input
5. Remove one of the added provisions with × — verify it disappears
6. Start new iteration (click button) — verify "Søkerunder" section shows round 1 and round 2
7. Run search again — verify new nodes appear
8. Click "1" in Søkerunder — verify non-round-1 nodes are dimmed
9. Click "Vis alle" — verify all nodes return to full opacity

- [ ] **Step 4: Final commit if any fixes needed**
