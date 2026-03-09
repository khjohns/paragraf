# Sprint 4 — Graf & Polish (siste sprint i Fase 1)

> Siste sprint i Phase 1. Mål: grafvisning, persistering, tomme tilstander, toasts, og kobling av frontend til backend.

**Forutsetninger:** Sprint 1 (scaffold), Sprint 2 (backend), Sprint 3/3b (UI-komponenter) er fullført.

## Etter Fase 1 — veien videre til Fase 2

Sprint 4 avslutter Fase 1. Designspesifikasjonen (`docs/design/paragraf-designspesifikasjon.md`) er autoritativ for alle faser — den beskriver Fase 2 (§33: AI-integrasjon), Fase 3 (analytiske utvidelser), og Fase 4 (portefølje). **Det trengs ingen ny referanseplan.** Designdokumentet er detaljert nok (1477 linjer, 35 seksjoner) til å bygge sprint-planer direkte fra det.

**Anbefalt tilnærming for Fase 2:**
1. **Skriv sprint-planer just-in-time** — som i Fase 1, skriv hver sprint-plan rett før utføring
2. **Les relevante designspec-seksjoner** som grunnlag: §10 (AI-kuratert lesemodus), §18-20 (AI-integrasjon lag 1+2), §6 (automatisk avgrensningsforslag)
3. **Verifiser tekniske valg** med context7/Supabase MCP før implementering (spesielt LLM-integrasjon, MCP-protokoll)
4. **Ingen ny phase-reference.md** — `phase1-reference.md` dokumenterer arkitekturbeslutninger som gjelder alle faser (tech stack, stores, styling-tilnærming, backend-struktur)
5. **Oppdater MEMORY.md** etter Sprint 4 med lærdom om grafbibliotek, ytelse, og eventuelle arkitekturendringer

Fase 2 sprint-struktur (forslag):
```
Sprint 5: AI-kuratert lesemodus (§10)
  - LLM-integrasjon for avsnitt-markering
  - Gulmarkerte sitater + AI-kommentarer i lesemodus
  - Kryssreferanselenker mellom saker
  - Lastetilstand for AI-kuratering (progressiv berikelse)

Sprint 6: Lag 1 AI-verktøy (§19)
  - Auto vektor-seed fra problemstilling
  - Bestemmelsesforslag
  - Vinkelrotasjonsbegreper
  - Automatisk avgrensningsforslag

Sprint 7: Sparringspartner / chatpanel (§20)
  - Bunnpanel-skuff i midtpanel
  - Kontekststyring (fast + dynamisk lag)
  - Devil's advocate-mekanisme
  - Klikkbare referanser i chat
```

---

**Referanser:**
- Designspesifikasjon: `docs/design/paragraf-designspesifikasjon.md` (§8b, §9, §12, §15, §33)
- Arkitektur: `docs/plans/phase1-reference.md`
- Backend: `backend/app.py` (Flask, port 5002)

---

## Gjeldende status

### Bygget
- Three-panel layout med 300px | flex | 370px
- Left panel: 5 collapsible sections (problemstilling, utgangspunkt, resultater, kartlegging, om rangeringen)
- List view: sorting (category/citations/date), filtering (all/delimitation/unread), NodeRow med alle badges
- Right panel: tab bar (oversikt/les avgjørelsen), CaseReader, ProvisionDetail, relasjoner, notater, handlinger
- Shared components: NodeTypeIcon, ValencePip, CategoryBadge, DelimBadge
- Toolbar: panel toggle, view switcher (disabled graf-knapp), filtre, sortering, legend
- Backend: Flask endpoints (POST /api/traverse, GET /api/cases/:sak_nr, GET /api/provisions/:dok_id/:section_id)
- Stores: AnalysisState (med save/load), UiState
- API client + tanstack-query wrappers
- NODE_TYPE_ACCENT shared constant

### Mangler (Fase 1 scope, §33)
1. **Grafvisning** — helt fraværende (§8b, §12, §13)
2. **Persistering** — save/load finnes men kalles aldri automatisk
3. **Tomme tilstander** — delvis (list har empty state, resten mangler)
4. **Toasts** — ingen toast-system
5. **Frontend ↔ Backend kobling** — traversal-knapp som trigger søk
6. **Reguleringsfilter** — state finnes, men dimming (§15) og kobling til backend mangler
7. **Siteringsretning i graf** — avhenger av grafvisning
8. **Persistent valgt node på tvers av visninger** — state finnes men graf mangler

---

## Prioriteter

### P1: Grafvisning (§8b, §9, §12)
Mest komplekse enkelttillegg. Dagre layout + Svelte SVG rendering.

### P2: Frontend ↔ Backend kobling
Uten dette er appen et tomt skall med mock-data.

### P3: Persistering (localStorage)
Krav fra §33: "lesestatus og notater med persistering".

### P4: Toasts + tomme tilstander + reguleringsfilter
UX polish som gjør appen komplett.

---

## Oppgaver

### Oppgave 1: dagre layout-modul (`src/lib/utils/layout.ts`)

Beregner hierarkisk graf-layout fra nodes + edges.

**Steg:**
1. `npm install @dagrejs/dagre`
2. Opprett `src/lib/utils/layout.ts` med `computeLayout(nodes, edges)` funksjon
3. Konfigurer dagre:
   - `rankdir: 'TB'` (top-to-bottom)
   - `ranksep: 80` (mellom lag)
   - `nodesep: 30` (mellom noder i samme lag)
   - `marginx: 40, marginy: 40`
4. Map nodetyper til ranks via usynlige constraint-edges (ref. phase1-reference.md §3):
   - `provision` → øverste lag
   - `kofa_case` → midtlag
   - `eu_case`, `court_case`, `prep_work` → nedre lag
5. Nodestørrelser etter siteringsantall (§8b): base 22px, +5 ved 5+ sit., +10 ved 10+ sit.
6. Returner `Map<nodeId, { x, y, width, height }>` + viewport bounds
7. Eksporter også `NODE_SHAPES` konstant: provision→rect, kofa_case→circle, eu_case→diamond, court_case→circle, prep_work→rect-low

**Verifiser:** Enkel test med 10 noder → korrekte y-nivåer per type.

---

### Oppgave 2: GraphView-komponent (`src/lib/components/GraphView.svelte`)

SVG container med zoom/pan og noderedering.

**Steg:**
1. Opprett `src/lib/components/GraphView.svelte`
2. Importer `computeLayout` fra utils/layout.ts
3. Reactive layout: `let layout = $derived.by(() => computeLayout(analysisState.nodes, analysisState.edges))`
4. SVG med `viewBox` basert på layout bounds
5. Zoom/pan via `svelte:wheel` + `svelte:pointerdown/move/up`:
   - Track `viewBox` state (x, y, width, height)
   - Wheel → zoom (scale viewBox width/height)
   - Pointer drag → pan (translate viewBox x/y)
   - Clamp zoom 0.3x–3x
6. Lag-etiketter i venstre margin (§8b): «BESTEMMELSER», «PRAKSIS», «EU / FORARBEIDER» — dempet, uppercase, 10px

**Verifiser:** Vises i midtpanelet når viewMode === 'graph'. Zoom og pan fungerer.

---

### Oppgave 3: GraphNode-komponent (`src/lib/components/GraphNode.svelte`)

SVG-gruppe per node med form, label, og overlays.

**Steg:**
1. Opprett `src/lib/components/GraphNode.svelte`
2. Props: `node: GraphNode`, `x: number`, `y: number`, `width: number`, `height: number`
3. Nodeform per type (§8b):
   - `provision`: `<rect>` (bred, rx=3)
   - `kofa_case`: `<circle>` (r = height/2)
   - `eu_case`: `<rect>` rotert 45° (diamant)
   - `court_case`: `<circle>` (r = height/2)
   - `prep_work`: `<rect>` (lav, rx=2, opacity 0.5)
4. Bakgrunnsfarge fra `NODE_TYPE_ACCENT` (bg-varianter fra app.css)
5. Label: saksnummer/paragrafnummer i monospace, bold, accent-farge (§8b)
6. Undertittel under noden: dempet sans-serif, 10px, max 20 tegn + ellipsis
7. Overlays (§8b):
   - A/B/C badge (øvre høyre): liten hvit boks med bokstav → bruk CategoryBadge small
   - Lest-markering: grønn sirkel med hake (checkmark) øvre venstre
   - Avgrensning ∅-ikon: oransje, ved siden av kategori
   - Seed-markering: liten fylt prikk i accent-farge (venstre)
   - Iteration 2+: grønn pill under noden «iter. N»
8. Klikk → `uiState.selectNode(node.id)`
9. Valgt node: tykkere border (2px), accent-farge stroke
10. Dimming for filtrerte noder (§15): opacity 0.15–0.25 for noder som ikke matcher filter

**Verifiser:** Alle 5 nodetyper rendres med korrekt form og farge.

---

### Oppgave 4: GraphEdge-komponent (`src/lib/components/GraphEdge.svelte`)

SVG kanter med valensstyling.

**Steg:**
1. Opprett `src/lib/components/GraphEdge.svelte`
2. Props: `edge: GraphEdge`, `fromPos: {x,y}`, `toPos: {x,y}`
3. Linjestil per valens (§9):
   - `confirming` / `unknown`: heltrukket, dempet grå (#borderM), opacity 0.3
   - `distinguishing`: lang-stiplet (`stroke-dasharray: 5,3`), gul/varm (#A67B2E), opacity 0.5
   - `departing`: kort-stiplet (`stroke-dasharray: 2,3`), rød/dempet (#A63D3D), opacity 0.5
4. Rettet pil (arrowhead) via `<marker>` / `<defs>` — liten, dempet
5. Kurvet linje via quadratic bezier for estetikk (unngå rett-linje-kryss)
6. Hover: opacity → 0.7, tooltip med edge context (hvis tilgjengelig)
7. Kanter til/fra dimmede noder dimmes også (§15)

**Verifiser:** Kanter mellom noder vises med korrekt stil per valens-type.

---

### Oppgave 5: GraphTooltip + GraphLegend

**GraphTooltip (`src/lib/components/GraphTooltip.svelte`):**
1. 300ms hover-delay (ikke instant — unngå flicker)
2. 3-linje tooltip: label, subtitle, metadata (dato/utfall/siteringer)
3. Posisjoneres ved node, følger musen ikke
4. Forsvinner ved mouseout

**GraphLegend (`src/lib/components/GraphLegend.svelte`):**
1. Øvre høyre hjørne av graf-viewport (absolutt posisjonert)
2. Nodetyper med form + farge + etikett
3. Valenslinjestiler: heltrukket/lang-stiplet/kort-stiplet med etiketter
4. Kollaperbar (liten toggle)

**Verifiser:** Hover over node → tooltip etter 300ms. Legend synlig i graf.

---

### Oppgave 6: Graf ↔ liste-view switching

**Steg:**
1. I Toolbar.svelte: aktiver graf-knappen (fjern disabled, fjern tooltip)
2. I `+page.svelte` (eller midtpanel-snippet): toggle mellom `<NodeList />` og `<GraphView />` basert på `uiState.viewMode`
3. Persistent valgt node: `uiState.selectedNodeId` beholdes på tvers av view switch — høyrepanelet forblir åpent
4. Dobbelt-klikk på node i graf → bytt til list view med noden synlig (scroll into view)

**Verifiser:** Klikk «Graf» → grafvisning. Klikk node → høyrepanel åpnes. Bytt tilbake → listen med samme node valgt.

---

### Oppgave 7: Frontend ↔ Backend kobling

Koble traversal-søk til backend. Dette er kjernefunksjonaliteten.

**Steg:**
1. I LeftPanel.svelte: legg til «Kjør analyse»-knapp i Utgangspunkt-seksjonen (under SeedInput + vektorsøk)
2. Knappen trigger traversal-mutation:
   ```ts
   const traversalMutation = createMutation(() => ({
     mutationFn: (req: TraversalRequest) => fetchTraversal(req),
     onSuccess: (data) => {
       analysisState.setResults(data.nodes, data.edges, data.gaps);
     },
   }));
   ```
3. Bygg `TraversalRequest` fra `analysisState.analysis.seeds`:
   - `provisions` → seed_provisions
   - `ftsTerms` → fts_terms
   - `vectorQuery` → vector_query
   - `regulationFilter` → `uiState.regulationFilter`
4. Loading state: knappen viser spinner, nodes dimmes
5. Error handling: toast med feilmelding
6. Etter suksess: resultater populerer list/graph + left panel stats oppdateres

**Verifiser:** Legg inn seeds → klikk «Kjør analyse» → backend kalles → resultater vises i liste.

---

### Oppgave 8: Reguleringsfilter kobling (§7, §15)

**Steg:**
1. I Toolbar.svelte: legg til toggle-knapp for reguleringsfilter
   - Aktiv (default): «Kun FOA 2017–» med gul bakgrunn
   - Inaktiv: «Alle FOA-versjoner»
2. Filtrering i NodeList: dimming (opacity 0.15–0.25), ikke fjerning (§15)
   - Legg til `opacity` style på NodeRow basert på `node.regulation === 'old' && uiState.regulationFilter`
3. I GraphView: dimmede noder har opacity 0.15–0.25
4. Dimmede noder forblir klikkbare (§15)
5. Koble til traversal: send `regulationFilter` som parameter

**Verifiser:** Toggle filter → gammel-FOA-noder dimmes i både liste og graf. Klikk på dimmet node → høyrepanel åpner normalt.

---

### Oppgave 9: localStorage persistering

`save()` og `load()` finnes allerede i AnalysisState — de kalles bare aldri.

**Steg:**
1. I `analysis.svelte.ts`: kall `this.debouncedSave()` fra `touch()` (alle mutasjoner trigger allerede `touch()`)
2. I `+layout.svelte` (eller `+page.svelte`): kall `analysisState.load()` ved mount:
   ```ts
   import { onMount } from 'svelte';
   onMount(() => analysisState.load());
   ```
3. Verifiser at `save()` serialiserer korrekt:
   - `analysis` (problemStatement, seeds, readStatus, notes, delimitations, iteration)
   - `nodes`, `edges`, `gaps`
4. Sjekk at `load()` håndterer korrupte/inkompatible data uten å krasje
5. Legg til versjonering: `{ version: 1, ...data }` — fremtidig migrering

**Verifiser:** Marker noder som lest → refresh → lesestatus bevart. Skriv notat → refresh → notat bevart.

---

### Oppgave 10: Toast-system

**Steg:**
1. Opprett `src/lib/stores/toast.svelte.ts`:
   ```ts
   class ToastState {
     toasts = $state<Array<{ id: string; message: string; type: 'info' | 'success' | 'error' }>>([]);

     show(message: string, type: 'info' | 'success' | 'error' = 'info') {
       const id = crypto.randomUUID();
       this.toasts.push({ id, message, type });
       setTimeout(() => this.dismiss(id), 3000);
     }

     dismiss(id: string) {
       this.toasts = this.toasts.filter(t => t.id !== id);
     }
   }
   export const toastState = new ToastState();
   ```
2. Opprett `src/lib/components/Toast.svelte`:
   - Fixed posisjon: bottom center
   - Slide-up animasjon (Svelte transition: `fly`)
   - Subtil stil: dempet bakgrunn, liten tekst (§33: "subtil tilbakemelding")
   - Type-farger: info → ink, success → grønn, error → rød
3. Monter `<Toast />` i `+layout.svelte` (globalt)
4. Bruk toasts der relevant:
   - «Lesestatus oppdatert» ved toggleRead
   - «Analyse lagret» ved save (sjelden, ikke ved hver debounce)
   - «Feil ved lasting av avgjørelse» ved API-feil
   - «Traversal fullført — N treff» ved vellykket søk

**Verifiser:** Marker node som lest → toast vises i bunn → forsvinner etter 3s.

---

### Oppgave 11: Tomme tilstander

**Steg:**
1. **Midtpanel (liste/graf)** — allerede delvis bygget i NodeList:
   - Tom liste: «Definer utgangspunkt — Legg til bestemmelser og søkebegreper i venstrepanelet for å starte søket.»
   - Verifiser at denne er god nok, juster evt. ikonstørrelse/spacing
2. **Midtpanel (graf)** — GraphView tom:
   - «Kjør en analyse for å se grafen» med ikon (graf-silhuett)
   - Pek til seksjon 2 i left panel
3. **Høyrepanel** — ingen node valgt:
   - Trengs ikke (panelet er skjult per AppShell: `{#if uiState.selectedNodeId}`)
4. **Left panel section 3 (Resultater)** — ingen resultater:
   - «Ingen resultater ennå» under A/B/C-radene (vis 0/0/0)
5. **Left panel section 4 (Kartlegging)** — ingen data:
   - Fremdriftslinjer 0/0, gap-matrise tom → tekst «Kjør analyse for å se kartlegging»

**Verifiser:** Åpne appen uten data → alle paneler viser nyttige tomme tilstander, ikke blanke felt.

---

### Oppgave 12: Gap matrix interaktivitet

**Steg:**
1. I LeftPanel.svelte: gap-rader med `count === 0` er allerede klikkbare (cursor: pointer)
2. Legg til onclick-handler: klikk på zero-gap-rad → vis toast «Ingen felles praksis for [prov1] ∩ [prov2]»
3. I GraphView: vis gap-linjer mellom bestemmelsesnoder (§5, grafvisningen):
   - Stiplede, halvgjennomsiktige lilla linjer
   - ∅-etikett på midtpunktet
   - Bare for par med count === 0

**Verifiser:** Klikk gap i left panel → feedback. Graf viser lilla gap-linjer mellom bestemmelser uten felles praksis.

---

### Oppgave 13: Playwright-verifisering

Visuell verifisering av hele Phase 1.

**Steg:**
1. Start dev server + backend
2. Navigate til localhost:5174
3. Screenshot: tom tilstand (alle paneler)
4. Injiser mock-data via page.evaluate (eller kjør traversal mot backend)
5. Screenshot: liste med data, left panel stats, resultater
6. Klikk node → screenshot: høyrepanel åpent
7. Bytt til graf-modus → screenshot: grafvisning
8. Klikk «Les avgjørelsen» tab → screenshot: reading mode
9. Toggle reguleringsfilter → screenshot: dimming
10. Refresh → verifiser persistering (lesestatus bevart)

---

## Oppgaverekkefølge

```
Fase A — Grafvisning (oppgave 1-6, parallelliserbar delvis)
  1 → 2 → [3, 4, 5 parallelt] → 6

Fase B — Backend + persistering (oppgave 7-9)
  9 → 7 → 8

Fase C — Polish (oppgave 10-12)
  [10, 11 parallelt] → 12

Fase D — Verifisering (oppgave 13)
  13
```

**Avhengigheter:**
- Oppgave 2 avhenger av 1 (layout-modul)
- Oppgave 3, 4, 5 avhenger av 2 (SVG container)
- Oppgave 6 avhenger av 2 (GraphView eksisterer)
- Oppgave 7 avhenger av 9 (persistering bør fungere før backend-data lagres)
- Oppgave 8 avhenger av 7 (reguleringsfilter koblet til traversal)
- Oppgave 12 avhenger av 2 (gap-linjer i graf)
- Oppgave 13 avhenger av alt

---

## Scope-avgrensning

### I scope (Fase 1, §33)
- Hierarkisk grafvisning med dagre
- Nodeformer, farger, labels, overlays
- Kantvalens (linjestil) — alle «unknown» inntil NLP
- Zoom/pan
- Tooltip (300ms delay)
- Persistent valgt node på tvers av view modes
- localStorage for lesestatus + notater
- Tomme tilstander
- Subtle toasts
- Reguleringsfilter med dimming
- Gap-linjer i grafvisningen

### Utenfor scope (Fase 2+)
- Progressiv ekspansjon / aggregate badges (§12) — planlagt Fase 2
- AI-kuratert lesemodus (gulmarkering, AI-kommentarer) — Fase 2
- Chatpanel / sparringspartner — Fase 2
- Lag 1 AI-verktøy (vektor-seed, bestemmelsesforslag) — Fase 2
- Rettssetningsregister — Fase 3
- Tidslinje — Fase 3
- Eksport — Fase 3
- Drag-to-select i graf — Fase 4

---

## Tekniske notater

### dagre layout-strategi
Phase 1 reference sier: «Add invisible edges between layers to force ranking». Alternativ: beregn layout per lag og stack med manuelle y-offsets. **Start med invisible edges** — enklere å implementere. Evaluer med reelle data.

### SVG vs Canvas
Designspec anbefaler D3+dagre+SVG (Vei B, §13). SVG gir full DOM-kontroll over noder — viktig for overlays, badges, klikkbarhet. Canvas begrenser presentasjonen. **Bruk SVG.**

### Zoom/pan
Ikke bruk d3-zoom (tung avhengighet). Implementer med viewBox-manipulasjon + pointer events. Enklere, lettere, bedre Svelte-integrasjon.

### Nodestørrelser
Base: 22px (for sirkler: radius 11). Skalering:
- 0-4 siteringer: base
- 5-9: +5px
- 10+: +10px

### Backend proxy
Vite dev server proxyer `/api` til Flask on port 5002. Konfigurert i `vite.config.ts`.
