# Paragraf — Implementeringsstatus vs. designspesifikasjon

Oppdatert: 2026-03-15 (Sprint 10–16 fullført, ~55+ commits)

## Leseforklaring

- ✅ Implementert og fungerende
- ⚠️ Delvis implementert / trenger verifisering
- ❌ Ikke implementert

---

## Fase 1 — MVP

### Layout og navigasjon (§3)
- ✅ Tre-panel layout (AppShell: venstre 300px, midtpanel flex, høyre 370px)
- ✅ Venstrepanel med 5 nummererte seksjoner (LeftPanel + LeftPanelSection)
- ✅ Midtpanel med liste/graf-toggle
- ✅ Høyrepanel vises ved klikk på node (NodeDetail)
- ✅ Arbeidsstripe/header (WorkspaceHeader)

### Venstepanelet — arbeidsstegveiviser (§4)
- ✅ Seksjon 1: Problemstilling (visning)
- ✅ Seksjon 2: Seeds — bestemmelser, FTS, vektor, saker (SeedInput)
- ✅ Seksjon 3: A/B/C-resultater med antall
- ✅ Seksjon 4: Gap-matrise med ∅-indikatorer
- ✅ Seksjon 5: Om rangeringen (pedagogisk tekst)
- ✅ Seksjon 4: Lesestatus-fremdriftslinjer per kategori
- ✅ Seksjon 4: Iterasjonshistorikk med seed-diff
- ✅ Seksjon 4: "Ny iterasjon med nye seeds"-knapp

### Gap-identifisering (§5)
- ✅ Gap-matrise med bestemmelsespar og interseksjonstall
- ✅ ∅-symbol for null-treff
- ✅ Gap-linjer i grafvisning (stiplede lilla)
- ✅ Klikkbare null-treff (åpne toast med ettersøk-forslag)
- ✅ Kursiv oppsummeringstekst under matrise

### Avgrensningspraksis (§6)
- ✅ Avgrensningsbadge (DelimBadge med sirkel-slash ikon)
- ✅ Manuell avgrensnings-toggle i høyrepanel
- ✅ Filter: "Avgrensning"-knapp i verktøylinje
- ⚠️ Avgrensningsantall i venstepanel under A/B/C
- ❌ Automatisk avgrensningsforslag (regex/NLP med begrunnelse)
- ❌ Stiplet ramme for foreslått (ubekreftet) avgrensning
- ❌ "Bekreft/Avvis"-interaksjon med begrunnelsesvisning

### Reguleringsversjon (§7)
- ✅ Reguleringsfilter (toggle i toolbar, state i UiState)
- ✅ Gul advarselsboks i Resultater-seksjonen
- ✅ Dimming av gammel-regulering-noder til 20% opacity

### Listevisning (§8a)
- ✅ Sortering: Kategori (default), Siteringer, Dato
- ✅ Filtre: Alle, Avgrensning, Ulest
- ✅ Avkrysningsboks for lesestatus med grønn hake
- ✅ Nodetypeikon + saksnummer + A/B/C-badge + signalprikker
- ✅ Undertittel, dato, utfall, siteringer
- ✅ Valensindikatorer (ValencePip: ✓/↔/✕)
- ✅ Inline-advarsel ved "Siteringer"-sortering
- ✅ Dimming i stedet for fjerning (dimmede noder sortert sist)
- ⚠️ Avgrensningsbadge inline i rad (implementert men verifiser plassering)

### Grafvisning (§8b)
- ✅ Hierarkisk layout med tre lag (D3 + dagre)
- ✅ Nodeform koder type (rekt/sirkel/diamant)
- ✅ Lagetiketter i venstre margin
- ✅ Zoom/pan (scroll + kontroller med slider)
- ✅ GraphTooltip ved hover
- ✅ GraphLegend
- ✅ Progressiv ekspansjon med aggregatbokser (§12)
- ✅ "Reorganiser"-knapp
- ✅ Seed-markering (fylt prikk) på noder
- ✅ Iterasjonspill under noder ("iter. 2")
- ✅ A/B/C-badge overlegg på noder
- ✅ Lest-markering (grønn sirkel) på noder
- ✅ Søk/filtrering i graf-toolbar (saksnr, bestemmelse)
- ✅ Type-filterpills (Best., KOFA, EU, Forarb.)
- ✅ Kategori-filterpills (A, B, C)
- ⚠️ Nodestørrelse koder siteringer (layout.ts har nodeSize())

### Kantvalens (§9)
- ✅ Linjestil: heltrukket (bekreftende), lang-stiplet (avgrensende), kort-stiplet (fravikende)
- ✅ Fargekoding per valens
- ✅ Valenslegende i graf
- ✅ Valensindikatorer i listevisning (ValencePip)
- ✅ Valens i høyrepanel relasjoner
- ⚠️ Data: all valens er "ukjent" (NLP ikke implementert)

### Høyrepanelet (§10)
- ✅ Oversiktsmodus: header, metadata, relasjoner, notater, handlinger
- ✅ Lesemodus: full avgjørelsestekst med AI-kuratering (CaseReader)
- ✅ "Les avgjørelsen →" / "← Tilbake til oversikt" toggle
- ✅ Gulmarkerte sitater (dempet gul bakgrunn)
- ✅ AI-kommentarer med gullbrun venstekant (trust boundary)
- ✅ Avsnittnavigering (klikkbare pills)
- ✅ Kryssreferanse-navigasjon ("→ Gå til 2022/789 §38")
- ✅ Mine notater
- ✅ "Marker som lest" toggle
- ✅ Kuratert modus som default (bare markerte avsnitt med full opacity)
- ✅ Klikk på dimmet avsnitt for å ekspandere
- ✅ Toggle "Vis all tekst / Vis bare markerte"
- ✅ Lesesti / brødsmulesti for kryssreferanse-navigasjon
- ⚠️ AI-kuraterte avsnitt i oversiktsmodus (forhåndsvisning med "Les i kontekst →")
- ❌ ProvisionDetail: direktivgrunnlag med implementeringstype
- ❌ EU-dom detaljer (partsnavn størst, direktivartikkel-kobling)
- ❌ Forarbeid-detaljer (proposisjonsnummer, relevant seksjon)

### Signalprikker R/F/V (§11)
- ✅ Tre-prikks indikator med fylt/tom
- ✅ I listevisning inline etter badge
- ✅ I høyrepanelets header
- ✅ Hover/title-tekst ("R: Referansetabell F: Fulltekst V: Vektor")

### Filtrering — dimming (§15)
- ✅ Dimming i graf (regulasjon, søk, type, kategori)
- ✅ Dimming i listevisning (15-25% opacity i stedet for fjerning)
- ✅ Dimmede noder forblir klikkbare
- ✅ Aggregatbokser dimmes ved filter

### Designtokens (§17)
- ✅ Varm papirpalett (bakgrunn, tekst, rammer)
- ✅ Nodetypefarer (blågrå, gullbrun, sjøgrønn, fiolett, varm grå)
- ✅ Semantiske farger (success, warn, danger, gap, delim)
- ✅ AI-kuratering farger (highlight, aiComment, aiCommentBg)

### Interaksjonsdetaljer (§32)
- ✅ Persistent valgt node på tvers av visninger (selectedNodeId i global state)
- ✅ Hover-forhåndsvisning i graf (GraphTooltip)
- ✅ Subtil tilbakemelding / toasts (Toast.svelte)
- ✅ Tomme tilstander med handlingshenvisning
- ✅ Lesesti / brødsmulesti i høyrepanel
- ❌ Metodefase i arbeidsstripe ("Screening · 4 av 8 lest")
- ❌ Tastatursnarveier (↓/↑, M, R, Esc, S, 1-4, ?)
- ❌ Drag-to-select i graf
- ❌ Lastetilstand for AI-kuratering (pulserende gullbrun venstekant)

---

## Fase 2 — Guidet analyse (Sprint 10–16)

### Sprint 10: Portefølje, routing og fundament
- ✅ Portefølje-rute `/` med liste over analyser (Portfolio.svelte)
- ✅ Analyse-rute `/analyse/[id]` laster fra DB (ikke bare localStorage)
- ✅ CRUD-endepunkter: GET/POST `/api/analyses`, GET/PATCH `/api/analyses/<id>`
- ✅ PATCH `/api/analyses/<id>/candidates/<sak_nr>` for read_at, notes, delimitation
- ✅ DB-tabeller: `analyses`, `analysis_seeds`, `analysis_candidates`, `analysis_documents`
- ✅ `AnalysisState.loadFromDb()` og `saveToDb()` med 1s debounce
- ✅ Hybrid persistering: localStorage (500ms) + Supabase DB (1s), `flushDbSave()` på beforeunload
- ✅ 7-stegs fremdriftsindikator i venstepanel (ProgressIndicator.svelte)
- ✅ Fremdrift utledes fra `analysis.status` enum

### Sprint 11: Scoping — Claude-assistert problemdefinisjon (steg 0)
- ✅ `backend/scoping.py` med `generate_scope()`, `SCOPING_SCHEMA`, `SCOPING_SYSTEM_PROMPT`
- ✅ `_verify_provisions()` — slår opp ordlyd i `lovdata_sections` for alle foreslåtte bestemmelser
- ✅ `backend/llm_utils.py` med `CLAUDE_MODEL`, `call_claude_structured()`, prompt caching, effort
- ✅ POST `/api/analyses/<id>/scope` i app.py
- ✅ `ScopingOverlay.svelte` — 4-fase overlay (input → laster → forslag → søker)
- ✅ Redigerbare felter: refined_problem, sub_problems, provisions, FTS-termer, vektorsøk
- ✅ "Be Claude revidere"-knapp sender oppdatert scope tilbake
- ✅ Godkjenning persisterer seeds og setter status → `candidates_ready`
- ✅ Stegindikator øverst: Problemstilling → Scoping → Søk → Kandidater
- ✅ Claude API: structured outputs, effort=medium, prompt caching (~90% token-rabatt)

### Sprint 12: Utvidet søk og kandidatpersistering (steg 1)
- ✅ POST `/api/analyses/<id>/traverse` — kjører traversal og persisterer kandidater
- ✅ `analyses.py: persist_candidates()` — upsert av kandidater i `analysis_candidates`
- ✅ `traversal.py: _compute_suggested_provisions()` — finner ofte-siterte bestemmelser utenfor seeds
- ✅ Foreslåtte bestemmelser vises som chips med stiplet ramme i SeedInput.svelte
- ✅ `backend/vector_seed.py` — semantisk søk via Gemini embedding-001 + Supabase RPC
- ✅ `backend/post_search.py` med `generate_post_search()` — Claude-drevne ettersøk-forslag
- ✅ POST `/api/analyses/<id>/post-search` endepunkt
- ✅ `PostSearchPanel.svelte` — viser FTS-forslag, nye bestemmelser, mønstre med "Legg til"-knapper

### Sprint 13: Screening-delegering og AI-screening (steg 2)
- ✅ `backend/screening.py` med `screen_cases()`, `rescreen_case()`
- ✅ SSE-streaming: POST `/api/analyses/<id>/screen` via `sse_response()`-wrapper
- ✅ Batch API: `screen_cases_batch()`, `process_screening_batch_results()` (50% token-rabatt)
- ✅ Strukturert output: 5-lag JSON (rettssetning, faktum+vurdering, sitater, nyanser, relevansvurdering)
- ✅ `ScreeningPanel.svelte` — modus-valg per kategori (Claude / Jeg leser / Velg per sak)
- ✅ Per-sak toggle (AI|Person) i NodeRow via `screeningState.getAssignment()`
- ✅ `ScreeningResultCard.svelte` — ekspanderbart resultat med sitater (klikkbare avsnittsnumre)
- ✅ Gullkandidat-markering (`star: boolean`) — `★ Gullkandidat`-badge i NodeRow
- ✅ Rettssetninger ekstraheres til `analysis_propositions` med `source='ai_screening'`, `confirmed=false`
- ⚠️ Fremdrift i venstepanel ("X av Y screenet") — delvis, sjekk ProgressIndicator-integrasjon

### Sprint 14: Ettersøk og tverrgående rettssetninger (steg 2b + 3)
- ✅ `backend/cross_propositions.py` med `generate_cross_propositions()` — tematisk organiserte rettssetninger
- ✅ Rettssetninger persisteres i `analysis_propositions` med evolution-type og spenninger
- ✅ POST `/api/analyses/<id>/cross-propositions` endepunkt
- ✅ `PropositionRegistry.svelte` — tematisk gruppering, evolution-badges, spenningsvisualisering
- ✅ `PostSearchPanel.svelte` — viser ettersøk-forslag fra Claude (FTS-termer, bestemmelser, mønstre)
- ⚠️ Rettssetningsregister som midtpanel-toolbar-tab — komponenter eksisterer, toolbar-integrasjon ikke verifisert

### Sprint 15: EU-screening, syntese og QA (steg 4–6)
- ✅ `backend/eu_screening.py` — EU-screening med SSE-streaming og Batch API
- ✅ GET `/api/analyses/<id>/eu-cases` — identifiserer EU-dommer fra `kofa_eu_references`
- ✅ POST `/api/analyses/<id>/eu-screen` og `/eu-screen-batch` endepunkter
- ✅ `backend/synthesis.py` med `generate_synthesis()` — genererer strukturert juridisk notat
- ✅ Syntese-notat med `requires_lawyer_input`-seksjoner og uløste spenninger
- ✅ POST `/api/analyses/<id>/synthesize` endepunkt
- ✅ `SynthesisView.svelte` — visning + redigering av notat med `[JURISTENS VURDERING]`-seksjoner
- ✅ `backend/qa.py` med tre-delt QA: sitatverifisering, logisk konsistens, dekning
- ✅ Citations API i sitatverifisering (maskinell verifisering av quotes-array fra screening)
- ✅ Batch API for QA: `submit_qa_batch()` og `process_qa_batch_results()`
- ✅ POST `/api/analyses/<id>/qa` og `/qa-batch` endepunkter
- ✅ `QAPanel.svelte` — viser sitatfeil, logikkflagg, dekningsmessige gap med alvorlighetsbadger
- ✅ Claude API: effort=high for syntese og QA (kompleks analyse)

### Sprint 16: Chat-panel og sparringspartner (steg 7)
- ✅ `backend/chat.py` med `chat_stream()` — fri samtale med analysekontekst
- ✅ Kontekstkomprimering: laster kandidater, rettssetninger, syntese-notat, gaps fra DB
- ✅ POST `/api/analyses/<id>/chat` — SSE-streaming av chat-svar
- ✅ `ChatDrawer.svelte` — bunnpanel-skuff i midtpanelet (lukket/halvåpen/fullskjerm)
- ✅ Textarea med auto-resize, streaming-visning, scroll-to-bottom
- ⚠️ Klikkbare referanser i chat ({ref:kofa:...} → lenker) — parsing implementert, verifiser rendering
- ❌ Innebygd devil's advocate i alle svar
- ❌ Periodiske ubedde utfordringer (bekreftelsesbias-motgift)
- ❌ Deponering — POST `/api/analyses/<id>/deposit` og `analysis_depositions`-tabell ikke implementert

---

## Fase 2 — AI-integrasjon (opprinnelige §19-§20 elementer)

### Lag 1: Deterministiske verktøy (§19)
- ⚠️ Vektor-seed fra problemstilling — vectorQuery-felt i ScopingOverlay, men ikke auto-generert fra problemtekst; krever manuell innfylling
- ✅ Forslag til relevante bestemmelser (chips med stiplet ramme under seeds) — `_compute_suggested_provisions()` i traversal.py + SeedInput.svelte
- ⚠️ Vinkelrotasjons-begreper (alternative FTS-terms ved lave treff) — PostSearchPanel gir Claude-forslag, men trigger er manuell (ikke automatisk ved lave treff)
- ❌ Automatisk avgrensningsforslag med begrunnelse

### AI-kuratert leseopplevelse (§10, implementert i Sprint 5)
- ✅ Gulmarkerte avsnitt med AI-relevance
- ✅ AI-kommentarer med gullbrun trust boundary
- ✅ Kryssreferanselenker mellom saker
- ✅ Curation cache (curation_cache.py)
- ❌ Progressiv berikelse (tekst vises først, AI fader inn)
- ❌ Konfidensintensitet på gulmarkering (sterk/svak gul)

### Sparringspartner — chatpanel (§20)
- ✅ Bunnpanel-skuff i midtpanelet (lukket/halvåpen/fullskjerm) — ChatDrawer.svelte
- ✅ Fast kontekstlag — chat.py laster analysekontekst (kandidater, rettssetninger, gaps, notat)
- ❌ Dynamisk kontekstlag via MCP-verktøy
- ❌ Innebygd devil's advocate i alle svar
- ❌ Periodiske ubedde utfordringer (bekreftelsesbias-motgift)
- ⚠️ Klikkbare referanser i chat (parsing implementert, verifiser rendering)

### Navigasjon og UX
- ✅ Lesesti/brødsmulesti i høyrepanel
- ❌ Lastetilstand med pulserende border under AI-generering
- ❌ Språkmønster-identifisering (§29)

---

## Fase 3 — Analytiske utvidelser

- ✅ Rettssetningsregister (§21) — PropositionRegistry.svelte med tematisk gruppering og evolution-badges
- ❌ Tidslinjevisning (§22) — horisontal tidslinje gruppert per bestemmelse
- ❌ Eksport som arbeidsnotat (§23) — Markdown/docx med struktur (syntese-notat eksisterer, men eksport mangler)
- ❌ Sammenligningsmodus (§24) — side-by-side i høyrepanel
- ❌ Sesjonslogg (§26) — "hvor var jeg?" med AI-foreslått neste steg
- ❌ Direktivartikkel-overlay i graf (§30)
- ❌ Tastatursnarveier (§32)
- ❌ Metodefase i arbeidsstripe (§32)

---

## Fase 4 — Portefølje og avansert

- ✅ Porteføljevisning (§25) — Portfolio.svelte med alle aktive analyser og statusindikator
- ❌ Krysspollinering mellom analyser
- ❌ Mønstergjenkjenning på tvers av saker (§28)
- ❌ Datakvalitetsindikatorer (§27) — confidence per kant
- ❌ Bekreftelsesbias-motgift — periodiske ubedde utfordringer
- ❌ Drag-to-select i graf

---

## Backend / Data

- ✅ Traversal med 3-signal (R/F/V) og A/B/C-kategorisering
- ✅ Case detail med avgjørelsestekst, referanser
- ✅ Provision detail med lovtekst, struktur, referansesaker
- ✅ AI-kuratering (Claude Sonnet 4.6) med highlights + cross-references
- ✅ Kuratering-cache
- ✅ Supabase-integrasjon
- ✅ `llm_utils.py`: CLAUDE_MODEL, call_claude_structured(), prompt caching, Batch API
- ✅ Kandidatpersistering i `analysis_candidates` etter traversal
- ✅ AI-screening med SSE-streaming og Batch API
- ✅ EU-screening med SSE-streaming og Batch API
- ✅ Syntese: `generate_synthesis()` → `analysis_documents`
- ✅ QA: 3-delt (sitater, logikk, dekning) med Citations API og Batch API
- ✅ Chat: `chat_stream()` med analysekontekst og SSE
- ✅ Post-search: Claude-drevne ettersøk-forslag
- ✅ Cross-propositions: tverrgående rettssetningsregister
- ⚠️ Vektor-søk signal (V) — trenger verifisering av search_kofa_decision_text RPC
- ❌ Valens-NLP på kofa_case_references.context
- ❌ Confidence-scoring på kanter
- ❌ Forarbeider-embeddings (1.186 seksjoner uten)
- ❌ Broken edge-håndtering (kofa_case_references uten FK)
- ❌ Deponering — `POST /api/analyses/<id>/deposit` ikke implementert

---

## Oppsummering

| Fase | Totalt | ✅ | ⚠️ | ❌ |
|------|--------|----|----|------|
| Fase 1 — MVP | ~58 | ~48 | ~5 | ~5 |
| Fase 2 — Sprint 10–12 | ~20 | ~19 | 0 | ~1 |
| Fase 2 — Sprint 13 | ~8 | ~7 | ~1 | 0 |
| Fase 2 — Sprint 14 | ~5 | ~4 | ~1 | 0 |
| Fase 2 — Sprint 15 | ~11 | ~11 | 0 | 0 |
| Fase 2 — Sprint 16 | ~7 | ~3 | ~1 | ~3 |
| Fase 2 — §19-§20 | ~12 | ~5 | ~3 | ~4 |
| Fase 3 | 8 | 1 | 0 | 7 |
| Fase 4 | 6 | 1 | 0 | 5 |

**Fase 1 er ~90% komplett.** Gjenværende hull:
1. Nodedetaljer for EU-dommer, forarbeider, bestemmelser (ProvisionDetail, EuCaseDetail)
2. Automatisk avgrensningsforslag (avhenger av NLP/AI)
3. Tastatursnarveier
4. Lastetilstand for AI-kuratering
5. Metodefase i arbeidsstripe

**Fase 2 (guidet analyse, Sprint 10–16) er ~90% komplett.** Gjenværende hull:
1. Deponering (Sprint 16) — backend + frontend ikke implementert
2. Devil's advocate og ubedde utfordringer i chat
3. Auto-trigget vinkelrotasjon ved lave treff (i dag: manuell post-search)
4. Automatisk avgrensningsforslag med begrunnelse

**Rettssetningsregister (§21) er implementert** som en Fase 3-leveranse allerede nå.
**Portefølje (§25)** er implementert og fungerende.
