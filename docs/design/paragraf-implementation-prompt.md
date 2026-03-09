# Paragraf — Implementeringsprompt for Claude Code

## Prosjektbeskrivelse

Du skal implementere **Paragraf** — et interaktivt arbeidsverktøy for juridisk rettskildeanalyse bygget med SvelteKit og Python-backend. Designspesifikasjonen, mock-koden og konseptmockups ligger i `docs/design/`.

**Les disse filene grundig før du planlegger noe:**

- `docs/design/paragraf-designspesifikasjon.md` — Komplett designspesifikasjon (35 seksjoner, ~1500 linjer). Dette er det autoritative dokumentet for alle designbeslutninger. Les hele dokumentet.
- `docs/design/legal-workbench.jsx` — Interaktiv React-mock av hovedgrensesnittet (tre-panel-layout, graf, liste, AI-kuratert høyrepanel). Visuell referanse — designbeslutningene gjelder, men implementasjonen blir Svelte.
- `docs/design/paragraf-chat-concept.jsx` — Konseptmock for sparringspartneren (chatpanel som bunnpanel-skuff).
- `docs/design/paragraf-registry-concept.jsx` — Konseptmock for rettssetningsregisteret.
- `docs/design/paragraf-timeline-concept.jsx` — Konseptmock for tidslinjevisningen.

Mockene er React JSX. Implementasjonen er Svelte/SvelteKit. Designtokens, farger, typografi og interaksjonsmønstre fra mockene skal følges. Komponentstrukturen skal tilpasses Svelte.

---

## Tekniske beslutninger (avgjort)

- **Frontend:** SvelteKit
- **Backend:** Python (Flask blueprint i eksisterende app)
- **Database:** Supabase/Postgres (prosjekt: `unified-timeline`, id: `iyetsvrteyzpirygxenu`)
- **Grafvisualisering:** D3 (layout-beregning) + dagre (hierarkisk layout) + Svelte (SVG-rendering)
- **State management:** Svelte stores (reactivity)
- **Styling:** Designtokens fra spesifikasjonens seksjon 17

---

## Relaterte repositories

Du har tilgang til disse lokale prosjektene — undersøk dem for å forstå eksisterende kode, mønstre og gjenbrukbare komponenter:

- **`~/Projects/Catenda/paragraf`** — Paragraf MCP-server (Node/TypeScript). Eksponerer norsk lovdata og KOFA-praksis via MCP. Inneholder verktøy som `lov`, `forskrift`, `sok`, `semantisk_sok`, `hent_avgjoerelse`, `finn_praksis` osv. Omdøpt til `paragraf-mcp` på GitHub.
- **`~/Projects/Catenda/kofa`** — KOFA MCP-server og tilhørende scraping/parsing-verktøy. Inneholder all logikk for `kofa_*`-tabellene.
- **`~/Projects/codegrasp`** — Rust-basert MCP-verktøy for kodebasegrafindeksering. Strukturelt analogt — se spesifikasjonens seksjon 34 for implementasjonsmønstre herfra (confidence scores, staleness, capsule-mønsteret, FQN-konvensjon).
- **`~/Projects/endringsmeldinger`** — Eksisterende SvelteKit-prosjekt med Flask-backend og Supabase-integrasjon. **Kopier prosjektstruktur, byggsystem, Supabase-klient-oppsett og autentiseringsmønstre herfra.** Dette er den nærmeste referansen for hvordan Paragraf bør settes opp.

---

## Database

Supabase-prosjektet `unified-timeline` (id: `iyetsvrteyzpirygxenu`) inneholder allerede alle nødvendige tabeller. Bruk Supabase MCP for å undersøke skjemaet. De relevante tabellene:

**KOFA:** `kofa_cases`, `kofa_decision_text`, `kofa_law_references`, `kofa_case_references`, `kofa_eu_references`, `kofa_court_references`, `kofa_eu_case_law`, `kofa_forarbeider`, `kofa_forarbeider_sections`, `kofa_forarbeider_law_refs`, `kofa_forarbeider_eu_refs`

**Lovdata:** `lovdata_documents`, `lovdata_sections`, `lovdata_structure`

Undersøk tabellene med `list_tables` (verbose=true) og sample-queries for å forstå datamodellen *før* du planlegger.

---

## Implementeringsfaser

Designspesifikasjonen definerer fire faser (seksjon 33). Start med fase 1.

### Fase 1 — MVP (start her)

Tre-panel-layout med listevisning som default. Grafvisning med hierarkisk layout. A/B/C-kategorisering med signalprikker. Reguleringsversjon-filter. Gap-matrise. Lesestatus og notater med persistering. Avgrensning som innholdstag (manuell). Kantvalens (UI klart, data ukjent). Siteringsretning i grafen (rettede piler ved hover). Persistent valgt node på tvers av visninger. Tomme tilstander. Subtile toasts.

---

## Arbeidsprosess

### Steg 1: Forberedelse
1. Les hele `docs/design/paragraf-designspesifikasjon.md`
2. Undersøk `~/Projects/endringsmeldinger` for prosjektstruktur og SvelteKit-mønstre
3. Undersøk databaseskjemaet via Supabase MCP (`list_tables` med verbose=true for kofa_* og lovdata_* tabellene)
4. Bruk context7 eller relevante søkeverktøy for å hente oppdatert dokumentasjon for SvelteKit, Svelte 5 (runes), D3, dagre — *før* du skriver kode

### Steg 2: Oppsett
1. Opprett privat GitHub-repo `paragraf`
2. Sett opp SvelteKit-prosjekt basert på mønstrene fra `endringsmeldinger`
3. Sett opp Flask blueprint for backend-proxy
4. Konfigurer Supabase-klient

### Steg 3: Implementeringsplan
Lag en detaljert implementeringsplan for fase 1 som en markdown-fil (`docs/implementation-plan-phase1.md`). Planen skal:
- Bryte ned i konkrete arbeidsenheter (issues/tasks)
- Definere rekkefølge basert på avhengigheter
- Identifisere komponenter som kan bygges parallelt
- Referere til spesifikke seksjoner i designspesifikasjonen for hvert arbeidsstykke

### Steg 4: Implementering
Bygg fase 1 komponent for komponent. Start med:
1. Layout-skall (tre-panel) med kollapserbart venstrepanel
2. Svelte stores for analysetilstand (seeds, resultater, lesestatus, notater)
3. Backend-endepunkter for graf-traversal og søk
4. Listevisning (default)
5. Grafvisning (D3+dagre+SVG)
6. Høyrepanelet (oversiktsmodus)

---

## Kritiske designbeslutninger å følge

Disse er kontraintuitive og vil bli feil uten kontekst:

- **Listevisning er default, ikke graf.** Juristen er uvant med grafvisualisering.
- **C-saker skal ikke degraderes visuelt.** De inneholder ofte avgrensningspraksis som er like verdifull.
- **A/B/C er oppdagelsessignal, avgrensning er innholdstype.** To ortogonale dimensjoner — ikke kollapser dem.
- **Reguleringsversjon-filter er fremtredende.** En jurist som ikke filtrerer bort gammel FOA risikerer å bygge analyse på ikke-gjeldende rett.
- **Filtrering dimmer noder, fjerner dem ikke.** Juristen må se hva som er filtrert bort.
- **Farge er sekundærsignal. Form er primærsignal** for nodetype.
- **Tekst uten markering er fra databasen. Tekst med gullbrun venstrekant er fra AI.** Aldri forvekselbart.

---

## Kvalitetskrav

- Følg designtokens fra spesifikasjonens seksjon 17 nøyaktig
- Estetisk retning: forskerarbeidssted, rolig autoritet, varme papirnyanser — ikke tech-blått, ikke dashboardy
- Interface-design-skill er tilgjengelig — bruk den for å sikre designkvalitet
- Test med reelle data fra Supabase, ikke bare mock-data
- Alle tomme tilstander skal peke mot neste handling (seksjon 32)
