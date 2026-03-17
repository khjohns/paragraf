# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Prosjekt

Paragraf — interaktiv juridisk forskningsarbeidsbenk for norsk anskaffelsesrett (KOFA-avgjørelser). SvelteKit-frontend med Python Flask-backend og Supabase database.

All UI-tekst er på **norsk (bokmål)**.

## Kommandoer

### Frontend (SvelteKit)

```bash
npm run dev          # Dev server på :5174 (proxy /api → Flask :5002)
npm run build        # Produksjonsbuild (adapter-static → build/)
npm run check        # Type-check (svelte-kit sync + svelte-check)
npm run test:e2e     # Playwright e2e-tester
npm run format       # Prettier (100 char, 2-space tabs)
```

### Backend (Python Flask)

```bash
cd backend
source venv/bin/activate
python app.py            # Dev server på :5002
```

### Deploy

Push til main auto-deployer via Cloud Build → Cloud Run.

## Arkitektur

SvelteKit 2 SPA (`adapter-static`, `ssr: false`) med Svelte 5 runes. Flask-backend (port 5002) håndterer graf-traversering og Supabase-spørringer. Docker multi-stage: Node 22 bygger frontend → Python 3.11 serverer begge.

### Rutingstruktur

```
/                     → Portfoliovisning (analyseliste)
/analyse/[id]         → Analysearbeidsbenk (graf + liste + detaljpanel)
```

### Dataflyt

Frontend sender `TraversalRequest` med seeds (provisions, ftsTerms, vectorQuery, cases) → backend `/api/traverse` → returnerer `TraversalResponse` med graf-noder/kanter, gaps og statistikk.

### Backend-endepunkter

- `/api/traverse` (POST) — bygger graf via traverseringsalgoritme
- `/api/cases/<sak_nr>` — saksdetaljer (avsnitt, referanser)
- `/api/provisions/<dok_id>/<section_id>` — lovdata-detaljer + refererende saker
- `/api/analyses` (CRUD) — liste/opprett/oppdater analyser
- `/api/analyses/<id>/candidates/<sak_nr>` (PATCH) — oppdater read_at, notes, delimitation

### Signaler og kategorier

- **R** (Reference): Saker som matcher seed-bestemmelser via `kofa_law_references`
- **F** (FTS): Saker fra fulltekstsøk via `search_kofa_decision_text` RPC
- **V** (Vector): Semantisk søk (fase 2)
- **A/B/C-kategori**: A = alle tre signaler, B = to, C = ett. Ikke kvalitetsvurdering — kun signaldekning.

## Svelte 5 — VIKTIG

Claude er ikke trent på Svelte 5 runes-syntaks. Bruk context7 MCP (`/llmstxt/svelte_dev_llms-small_txt`) for oppdatert dokumentasjon ved behov.

### Hva som endret seg fra Svelte 4

| Svelte 4 (IKKE bruk) | Svelte 5 (BRUK) |
|---|---|
| `let count = 0` | `let count = $state(0)` |
| `$: double = count * 2` | `const double = $derived(count * 2)` |
| `$: console.log(x)` | `$effect(() => console.log(x))` |
| `export let foo` | `let { foo } = $props()` |
| `<slot />` / `<slot name="x">` | `{#snippet x()}{/snippet}` + `{@render x()}` |
| `on:click={handler}` | `onclick={handler}` |
| `createEventDispatcher()` | callback-props |

Template-blokker (`{#if}`, `{#each}`, `{#await}`) er **uendret** fra Svelte 4.

### Obligatoriske regler

```
- Bruk $state.snapshot() ved sending til API
- Bruk onMount eller +page.ts load for data-henting, IKKE $effect
- Bruk import { browser } from '$app/environment' for localStorage-guard
- IKKE bruk $effect for beregninger — kun $derived. $effect kun for ekte side-effekter (API, DOM)
```

### Store-mønster (class-based singleton)

```ts
// src/lib/stores/ui.svelte.ts
class UiState {
  selectedNodeId = $state<string | null>(null);
  viewMode = $state<'list' | 'graph'>('list');
  isGraphExpanded = $derived(this.viewMode === 'graph');
  selectNode(id: string) { this.selectedNodeId = id; }
}
export const uiState = new UiState();
```

Mutasjon via metoder, aldri direkte state-tildeling utenfra.

### Query-mønster (@tanstack/svelte-query v6)

```ts
// Thunk-syntaks (påkrevd for Svelte 5 runes)
createQuery(() => ({
  queryKey: ['traversal', request],
  queryFn: () => fetchTraversal(request),
  enabled: request.provisions.length > 0,
}))
```

### Komponent-mønster

```svelte
<script lang="ts">
  let { node, dimmed = false }: { node: GraphNode; dimmed?: boolean } = $props();
  let isSelected = $derived(uiState.selectedNodeId === node.id);
</script>
```

## Designsystem — Varm papirpalett

- Light theme med tokens i `src/app.css` (`@theme inline`)
- Spacing: 4px grid (spacing-1=4, spacing-2=8, ..., spacing-8=32)
- Radius: sm=2px, md=4px, lg=6px (skarpere enn standard)
- Typografi: Inter (UI), JetBrains Mono (data/tall)
- Farger: `--p-*` CSS-variabler (bg/panel/surface/ink/border-hierarki)
- Node-farger: provision (blå-grå), kofa_case (gull), eu_case (teal), court_case (lilla)
- AI-tillitsgrense: DB-tekst umarkert, AI-tekst har gull-brun venstre-border (`--p-ai-border`)
- INGEN skygger — borders-only + surface shifts

## Konvensjoner

- Tailwind v4 med `@theme inline`-tokens, scoped `<style>` der nødvendig
- Graf: D3 + dagre (hierarkisk layout TB) + Svelte SVG-rendering
- Backend-kanter peker **case→provision** (ikke provision→case)
- Listevisning er default (ikke graf)
- Filtrering dimmer noder (15-25% opacity), fjerner dem ikke
- Form er primærsignal (rect/circle/diamond), farge er sekundær
- Persistering: localStorage (debounced 500ms) + Supabase DB (debounced 1s)
- UI-tilstand i `uiState`, innholdstilstand i `analysisState` — to separate stores

## Kvalitetssikring

Kjør `/simplify` når det er hensiktsmessig — typisk etter en større implementeringsoppgave, refaktorering, eller når en fil har vokst vesentlig. Vurder selv når det gir verdi.

## Codegrasp

Bruk `mcp__codegrasp__get_session_context` ved start av ny sesjon for å hente observasjoner fra forrige sesjon. Bruk `mcp__codegrasp__save_observation` for å dokumentere invarianter, subtile bugs og design-valg — lenk til symboler med `linked_symbols`.

## Deployment

- GCP Cloud Run: `paragraf` service, `europe-north1`, min-instances=0
- CI/CD: Cloud Build trigger `paragraf-git` — push til main auto-deployer via `cloudbuild.yaml`
- Docker: Multi-stage Node 22 → Python 3.11, serverer statisk frontend + Flask API
