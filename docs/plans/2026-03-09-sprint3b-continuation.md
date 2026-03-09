# Sprint 3b Continuation Prompt

## Context

You're continuing the Paragraf project — a legal research workbench for Norwegian procurement law (KOFA decisions). Sprint 3a built the basic UI shell. Your job is to close the remaining gaps between the current implementation and the design mock (`docs/design/legal-workbench.jsx`).

**Work on `main` branch. No feature branches.**

## Tech Stack
- SvelteKit 2 SPA (adapter-static, ssr: false), Svelte 5 runes
- Stores: class-based with `$state`/`$derived` (see `src/lib/stores/`)
- Design tokens: CSS custom properties `--p-*` in `src/app.css`
- Queries: `@tanstack/svelte-query` v6, thunk syntax
- Backend: Flask on port 5002 (POST /api/traverse, GET /api/cases/:sak_nr, GET /api/provisions/:dok_id/:section_id)

## What Exists (Sprint 3a — committed)

9 components in `src/lib/components/`:

| Component | Status | Notes |
|---|---|---|
| `AppShell.svelte` | Done | 3-panel layout with Svelte 5 Snippets, 300px/flex/370px |
| `WorkspaceHeader.svelte` | Done | Brand strip with read progress |
| `SeedInput.svelte` | Done | Chip inputs for provisions + FTS terms |
| `Toolbar.svelte` | Done | View switcher, filters (Alle/Avgrensning/Ulest), sort, legend |
| `NodeList.svelte` | Done | Filtered/sorted list, empty states |
| `NodeRow.svelte` | Done | Checkbox, type dot, label, badges, signal dots, subtitle, date/outcome/citations |
| `NodeDetail.svelte` | Done | Right panel: header, actions, notes, basic CaseReader/ProvisionDetail integration |
| `CaseReader.svelte` | Done | Full decision text with numbered paragraphs + grouped references |
| `ProvisionDetail.svelte` | Done | Law text viewer (hardcoded to anskaffelsesforskriften) |

Stores:
- `ui.svelte.ts`: selectedNodeId, viewMode, leftPanelOpen, listFilter, listSort, regulationFilter
- `analysis.svelte.ts`: nodes, edges, gaps, analysis (seeds, readStatus, notes, delimitations), persistence with debounced localStorage

Page: `+page.svelte` wires everything together — traversal query from seeds, syncs results to store, left panel has SeedInput + stats box.

## What to Build (Sprint 3b)

### Priority 1: Left Panel — Collapsible Sections

The mock (`LeftPanel` function, lines 160-236 of legal-workbench.jsx) has 5 numbered, collapsible sections with expand/collapse chevrons:

1. **Problemstilling** — editable text area for the problem statement. Currently missing entirely. Use `analysisState.setProblemStatement()`.
2. **Utgangspunkt** — SeedInput already exists but needs to be wrapped as a collapsible section. Also add vector query input (currently missing — `analysis.seeds.vectorQuery` exists in the type but no UI).
3. **Resultater** — Stats box exists in `+page.svelte` but should move into this collapsible section structure. Add delimitation count + regulation filter warning ("Kun gjeldende FOA").
4. **Kartlegging** — The big one. Needs:
   - Read progress bars per category (A/B/C) with `X/Y` counts
   - Gap matrix: provision pairs with intersection counts, `∅` for zero-count pairs (highlighted purple with `--p-gap-*` tokens)
   - Iteration badge + "Ny iterasjon" button
5. **Om rangeringen** — Static explanatory text about citation bias + valence legend

**Implementation approach:** Create a `LeftPanelSection.svelte` wrapper component (numbered circle, title, subtitle, chevron, expand/collapse state). Then create individual section content components or inline them. Move the left panel content from `+page.svelte` snippets into a dedicated `LeftPanel.svelte` component.

### Priority 2: Right Panel — Tab Bar + Relations

The mock's right panel (lines 418-541) has features our `NodeDetail.svelte` lacks:

1. **Tab bar** (Oversikt / Les avgjørelsen) — The mock shows a segmented control in the header switching between overview and reading mode. Our current implementation has a text link "Les avgjørelsen →" instead. Replace with proper tab bar matching the view switcher style.

2. **Relations section** — The mock shows connected nodes with valence pips (✓ confirming, ↔ distinguishing, ✕ departing) and click-to-navigate. Our NodeDetail doesn't show relations at all.
   - Use `node.connectedTo` array + `node.valence` map from `GraphNode` type
   - Each relation: NodeTypeIcon + mono label + ValencePip + truncated subtitle
   - Click navigates to that node (call `uiState.selectNode(id)`)

3. **Signals detail section** — Expanded signal display (Referansetabell / Fulltekstsøk / Vektorsøk) with on/off indicators. Currently only shown as dots.

4. **Detail/summary text** — The mock shows `node.detail` in a "Sammendrag" or "Ordlyd" section. We don't render this.

5. **"Bruk som seed" button** — Action to add a node as seed for next iteration.

### Priority 3: Shared Micro-Components

The mock uses reusable micro-components (lines 115-157) that our code either inlines or skips:

1. **`NodeTypeIcon`** — Shape-based icons per type (rectangle=provision, circle=kofa, diamond=eu, rect=prep). Currently we use a plain colored dot. This is a meaningful visual signal — implement it.

2. **`ValencePip`** — Small badge showing confirming (✓ green), distinguishing (↔ amber), departing (✕ red). Needed for both relations in right panel and valence display in list rows.

3. **`DelimBadge`** — Exists inline but should be extracted. Current version says "Avgr.", mock has an icon + "Avgrensning".

4. **`CategoryBadge`** — Mock uses neutral grey tones (`rgba(26,24,20,0.08/0.05/0.03)`), not success/warn colors. Currently our badges use green for A, amber for B. Match the mock's neutral approach.

### Priority 4: List View Enhancements

1. **NodeTypeIcon in list rows** — Replace the 9px colored dot with the proper shape icon
2. **Valence display in list rows** — The mock shows valence pips + target labels in the bottom meta line
3. **AI-kuratert badge** — Show when AI curation exists (Sprint 4+ data, but add the UI slot now)
4. **Iteration badge** — Show "iter. 2" badge on iteration-2 nodes
5. **Directive display** — Show EU directive reference in meta line for eu_case nodes

## What to Defer (Sprint 4+)

- **Graph view** — Full D3 + dagre graph rendering (disabled "Graf" button stays disabled)
- **AI curation** — Highlights, comments, cross-references in reading mode (requires backend AI pipeline)
- **Iteration system** — "Ny iterasjon med nye seeds" workflow (button can exist, but flow deferred)
- **ProvisionDetail dynamic routing** — Currently hardcoded to `forskrift/2016-08-12-974`, needs to parse from node data
- **Regulation filter toggle** — `uiState.regulationFilter` exists but no toggle UI for old/new regulation dimming

## Key Patterns to Follow

**Svelte 5 runes only** — `$state`, `$derived`, `$derived.by`, `$effect`, `$props`. No `$:` or stores.

**Component snippets** — AppShell uses `{#snippet}` / `{@render}` pattern for panel contents.

**Store mutations** — Always go through store methods: `analysisState.toggleRead()`, `uiState.selectNode()`, etc.

**Scoped styles** — All CSS in `<style>` blocks (Svelte-scoped), using `--p-*` design tokens from app.css.

**Design tokens reference** — The mock's `T` object maps to CSS vars:
```
T.ink → var(--p-ink)           T.ink2 → var(--p-ink2)
T.border → var(--p-border)     T.panel → var(--p-panel)
T.success → var(--p-success)   T.warn → var(--p-warn)
T.gap → var(--p-gap)           T.gapBg → var(--p-gap-bg)
T.delim → var(--p-delim)       T.delimBg → var(--p-delim-bg)
T.prov.accent → var(--p-provision-accent)
T.kofa.accent → var(--p-kofa-accent)
T.eu.accent → var(--p-eu-accent)
```

**Type reference:** `src/lib/types/graph.ts` — GraphNode has `connectedTo?: string[]`, `valence?: Record<string, Valence>`, `detail?: string`, `directive?: string`, `iteration: number`, `isSeed: boolean`.

## Verification

Use `npm run build` to verify no TypeScript/Svelte errors. Use Playwright to visually check rendering. Run `simplify` skill after major chunks.
