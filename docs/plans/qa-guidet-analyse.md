# Kvalitetssikring — Guidet analyse-implementering

**Dato:** 2026-03-15
**Referanser:** `docs/plans/guidet-analyse-overordnet-plan.md`, `docs/design/paragraf-guidet-analyse.md`

---

## Bakgrunn

Alle sprints (10–16) fra den overordnede planen er implementert. Denne planen dekker kvalitetssikring på tre akser:

1. **Funksjonell QA** — fungerer alle steg i den guidede analyseprosessen som designet?
2. **Svelte 5 QA** — følger koden Svelte 5 runes-konvensjoner korrekt?
3. **Anthropic API QA** — brukes API-et optimalt mht. kostnad, pålitelighet og kvalitet?

---

## Nåtilstand (kartlagt)

### Build og typesjekk

- `svelte-check`: **0 feil, 15 advarsler**
- `vite build`: **OK** (adapter-static → build/)

### Advarsler fra svelte-check

| Kategori | Antall | Filer |
|----------|--------|-------|
| `a11y_no_static_element_interactions` | 5 | ChatDrawer, LeftPanel, NodeRow, ScopingOverlay |
| `a11y_consider_explicit_label` | 5 | ChatDrawer, NodeDetail, Portfolio, PortfolioDetail, ScopingOverlay |
| `a11y_no_noninteractive_tabindex` | 1 | CaseReader |
| `non_reactive_update` (Svelte 5-bug) | 1 | GraphView:162 — `svgEl` bør være `$state` |
| `state_referenced_locally` | 1 | LeftPanelSection:21 — allerede suppressed med eslint-kommentar (korrekt: intentional initial value) |
| `css_unused_selector` | 1 | LeftPanel:520 — `.iter-info` ubrukt |

### Svelte 5 compliance

Kodebasen er **generelt godt gjennomført** med Svelte 5 runes:
- Alle komponenter bruker `$props()`, `$state()`, `$derived()`, `$effect()`
- Ingen Svelte 4-antipatterns funnet (`export let`, `$:`, `on:click`, `<slot>`, `createEventDispatcher`)
- Class-based stores med riktig mønster (UiState, AnalysisState, ToastState)

**Funn som krever utbedring:**
1. `GraphView.svelte:162` — `svgEl` deklarert uten `$state`, gir `non_reactive_update`-advarsel
2. Ingen bruk av `$state.snapshot()` funnet — bør verifiseres at API-kall ikke sender reactive proxies

### Anthropic API compliance

| Dimensjon | Status | Funn |
|-----------|--------|------|
| Structured outputs | 9/9 endepunkter | ✅ Fullt compliant |
| Prompt caching | Alle system-prompts | ✅ Fullt compliant |
| Effort levels | 7/9 spesifisert | ⚠️ Mangler i `post_search.py`, `cross_propositions.py` |
| Citations API | Implementert i QA | ✅ Compliant |
| Modellbruk (`CLAUDE_MODEL`) | Alle kall | ✅ Compliant |
| XML-strukturerte prompts | 8/9 moduler | ⚠️ `curation.py` mangler XML-tags |
| Feilhåndtering | 9/9 moduler | ✅ Fullt compliant |
| Token-optimalisering | Capsule-komprimering, seksjonsfiltrering | ✅ Godt implementert |

**Funn som krever utbedring:**
1. `post_search.py` — mangler `effort`-parameter, defaulter til `"high"` (bør være `"medium"`)
2. `cross_propositions.py` — mangler eksplisitt `effort`-parameter (bør settes eksplisitt til `"high"`)
3. `curation.py` — bruker `client.messages.create()` direkte, mangler structured output, effort, og cache control
4. `chat.py` — mangler `effort` i `messages.stream()`-kallet (bør være `"medium"`)
5. `scoping.py` — oppretter egen `anthropic.Anthropic()`-klient i stedet for `get_anthropic_client()`

---

## QA-oppgaver

### Fase 1: Bygg og typesjekk (0 feil-mål)

**Oppgave 1.1:** Fiks `non_reactive_update` i GraphView
- `GraphView.svelte:162` — endre `let svgEl: SVGSVGElement` til `let svgEl = $state<SVGSVGElement>()`
- Verifiser at wheel-zoom fortsatt fungerer etter endring

**Oppgave 1.2:** Fjern ubrukt CSS-selektor
- `LeftPanel.svelte:520` — fjern `.iter-info`-regelen

**Oppgave 1.3:** Fiks a11y-advarsler
- Legg til `role="button"` på klikkbare `<div>`-er (ChatDrawer, LeftPanel, NodeRow, ScopingOverlay)
- Legg til `aria-label` på knapper uten tekst (ChatDrawer, NodeDetail, Portfolio, PortfolioDetail, ScopingOverlay)
- Fjern `tabindex` fra ikke-interaktiv `<div>` i CaseReader, eller endre til `<button>`

**Mål:** `svelte-check` returnerer 0 advarsler.

---

### Fase 2: Svelte 5 dybde-QA

**Oppgave 2.1:** Verifiser `$state.snapshot()` ved API-kall
- Gå gjennom alle steder der reactive state sendes til `fetch()`/`apiFetch()` i `src/lib/api/analyses.ts`
- Sjekk om `$state.snapshot()` trengs (Svelte 5 proxies sendes potensielt til `JSON.stringify()` — fungerer, men snapshot er best practice)
- Spesielt viktig: `analysisState.seeds`, `analysisState.screeningResults`, `analysisState.propositions`

**Oppgave 2.2:** Verifiser at `$effect` ikke brukes for beregninger
- Gå gjennom alle `$effect()`-kall og verifiser at de er ekte sideeffekter (DOM, API, event listeners)
- Spesielt sjekk `analyse/[id]/+page.svelte` (linjer 40-52) — synker query-resultater til store, som er en grensetilfelle

**Oppgave 2.3:** Verifiser `onMount` for data-henting
- Sjekk at ingen `$effect()` gjør data-henting (fetch-kall)
- Verifiser at TanStack Query bruker thunk-syntaks (`() => ({...})`) konsekvent

**Oppgave 2.4:** Verifiser `browser`-guard for localStorage
- `analysis.svelte.ts` bruker `typeof window !== 'undefined'` — bør bruke `import { browser } from '$app/environment'` per CLAUDE.md
- Sjekk at alle localStorage-tilganger er beskyttet

**Oppgave 2.5:** Sjekk store-mutasjon via metoder
- Verifiser at ingen komponent muterer `uiState.*` eller `analysisState.*` direkte (uten metode)
- Alle tilstandsendringer bør gå via eksponerte metoder

---

### Fase 3: Anthropic API-optimalisering

**Oppgave 3.1:** Sett korrekte effort-nivåer
- `post_search.py` — legg til `effort="medium"` (ettersøk-forslag er rutineoppgave)
- `cross_propositions.py` — legg til eksplisitt `effort="high"` (kompleks tematisk analyse)
- `chat.py` — legg til `effort="medium"` i `messages.stream()`-kallet

**Oppgave 3.2:** Konsolider klient-instansiering
- `scoping.py` — refaktorer til å bruke `get_anthropic_client()` fra `llm_utils.py`
- Vurder om `scoping.py` kan bruke `call_claude_structured()` (den bruker allerede structured output direkte)

**Oppgave 3.3:** Moderniser `curation.py`
- Refaktorer `_call_claude()` til å bruke `call_claude_structured()` med schema
- Legg til XML-tags i system-prompt (`<instructions>`, `<task>`, `<formatting_rules>`)
- Legg til `effort="medium"` og `cache_control`
- Fjern manuell JSON-parsing (regex-fallback)

**Oppgave 3.4:** Verifiser token-budsjetter
- Sjekk at syntese-kall faktisk holder seg innenfor ~35K input-tokens
- Verifiser at capsule-komprimering i `synthesis.py` (linje 150–224) fungerer korrekt for ulike analysestørrelser
- Sjekk at screening-kall faktisk filtrerer til `section='vurdering'`

---

### Fase 4: Funksjonell gjennomgang

**Oppgave 4.1:** Steg 0 → 1 — Scoping til kandidater
- Verifiser at scoping-godkjenning korrekt persisterer seeds i `analysis_seeds`
- Verifiser at traversal kjøres automatisk etter godkjenning
- Verifiser at kandidater persisteres i `analysis_candidates` med riktig category/signals
- Sjekk at status-overgangen `scoping` → `candidates_ready` fungerer

**Oppgave 4.2:** Steg 2 — Screening
- Verifiser at SSE-streaming fungerer for parallell screening
- Verifiser at kategori-kontroller (Claude/Jeg leser/Velg per sak) oppdaterer korrekt
- Verifiser at screening-resultater persisteres i `analysis_candidates.ai_screening`
- Verifiser at rettssetninger extraheres til `analysis_propositions` med `source='ai_screening'`
- Sjekk at re-screening (`/rescreen`) sender utvidet kontekst

**Oppgave 4.3:** Steg 3 — Ettersøk
- Verifiser at `post-search`-endepunktet returnerer nye seeds
- Verifiser at nye seeds kan godkjennes og utløse nytt søk med `iteration: 2+`

**Oppgave 4.4:** Steg 4-5 — EU-screening og syntese
- Verifiser at EU-saker identifiseres korrekt fra `kofa_eu_references`
- Verifiser at syntese-kallet bruker capsule-komprimering
- Verifiser at notat lagres i `analysis_documents`
- Sjekk at `[JURISTENS VURDERING]`-seksjoner er med i output

**Oppgave 4.5:** Steg 6 — QA
- Verifiser at 3-delt QA kjører (sitatverifisering, logisk konsistens, dekning)
- Verifiser at Citations API brukes korrekt i sitatverifisering
- Sjekk at QA-rapport lagres i `analysis_documents`

**Oppgave 4.6:** Chat-panel
- Verifiser at chat-streaming (SSE) fungerer
- Verifiser at chat har tilgang til analysekontekst fra DB (seeds, kandidater, screening)
- Sjekk at chat-historikk persisteres

---

### Fase 5: Fremdriftsindikator og statusoverganger

**Oppgave 5.1:** Verifiser 7-stegs fremdriftsindikator
- Sjekk at ProgressIndicator viser korrekt status for hvert steg
- Verifiser at steg er klikkbare og navigerer korrekt
- Sjekk at fullførte steg har hake, aktive er markert, hoppede er dempet

**Oppgave 5.2:** Verifiser statusoverganger
- Kartlegg alle `analysis.status`-verdier og verifiser at overgangene er konsistente
- Sjekk at backend-endepunkter oppdaterer status korrekt
- Verifiser at frontend viser riktig UI basert på status

---

### Fase 6: Portefølje og persistering

**Oppgave 6.1:** Porteføljevisning
- Verifiser at analyse-liste lastes fra Supabase
- Verifiser at «Kartlegg ny problemstilling» oppretter ny analyse
- Sjekk at status og metadata vises korrekt i listen

**Oppgave 6.2:** DB-persistering
- Verifiser at localStorage → DB-synkronisering fungerer (debounced)
- Verifiser at tilstand overlever page refresh
- Sjekk at `loadFromDb()` i AnalysisState fungerer korrekt

---

## Prioritering

| Prioritet | Fase | Begrunnelse |
|-----------|------|-------------|
| **1 (Høy)** | Fase 1 | Bygg-advarsler inkl. Svelte 5-bug i GraphView |
| **2 (Høy)** | Fase 3.1–3.2 | Effort-nivåer og klient-konsolidering — direkte kostnadsimpakt |
| **3 (Middels)** | Fase 2 | Svelte 5 dybde-QA — korrekthet og best practices |
| **4 (Middels)** | Fase 3.3–3.4 | Curation-modernisering og token-verifisering |
| **5 (Lav)** | Fase 4–6 | Funksjonell gjennomgang — krever kjørende backend+DB |

---

## Gjennomføringsrekkefølge

Fasene 1–3 kan gjennomføres i kode uten kjørende backend. Fase 4–6 krever integrasjonstesting med Supabase og Claude API, og bør gjennomføres som manuelle test-scenarier eller med integrasjonstester.

**Estimert omfang Fase 1–3:** Én sprint med rene kodeendringer.
