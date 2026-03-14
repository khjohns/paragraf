# Guidet analyse — overordnet sprintplan

**Dato:** 2026-03-11
**Referanser:** `docs/design/paragraf-guidet-analyse.md`, `docs/design/paragraf-designspesifikasjon.md`, `docs/design/SKILL.md`
**Mockups:** `paragraf-scoping-concept.jsx`, `paragraf-screening-concept.jsx`, `paragraf-portfolio-concept.jsx`, `paragraf-chat-concept.jsx`

---

## Nåtilstand

Paragraf er i dag et single-analysis-verktøy:
- Én analyse om gangen, tilstand i `localStorage` via `AnalysisState`
- Seed-input → traversal API → liste/graf → detaljpanel
- Backend: Flask med `traverse`, `cases`, `provisions`, `curation`, `eu_cases`, `forarbeider`
- Claude API-integrasjon i backend for scoping (Sprint 11) og kuratering; delt via `llm_utils.py`
- Ingen autentisering; analyser persistert i Supabase (Sprint 10)

## Arkitekturbeslutning: routing

Paragraf får to routes:

| Route | Visning | Når |
|-------|---------|-----|
| `/` | **Portefølje** — liste over analyser med detalj-panel | Startside, mellom analyser |
| `/analyse/[id]` | **Workspace** — tre-panel med liste/graf, scoping-flow som oppstart | Inne i en analyse |

Scoping-flyten (steg 0) er *innebygd i workspace-ruten* som en modal/fullskjerm-overlay når analysen er i `scoping`-status. Når juristen godkjenner scopet, glir overlay vekk og workspace vises med kandidatlisten.

## Sprints

### Sprint 10: Fundament — DB + portefølje + routing

**Mål:** Flere analyser, persistert i Supabase, navigerbar portefølje.

**DB-migrering (Supabase):**
- `analyses` — id, title, problem, refined_problem, sub_problems (jsonb), context (jsonb), status (enum), iteration, created_at, updated_at
- `analysis_seeds` — id, analysis_id, seed_type, value, iteration, source, confirmed
- `analysis_candidates` — id, analysis_id, sak_nr, category, signals (jsonb), iteration, screening_status, ai_screening (jsonb), user_notes, is_delimitation
- `analysis_propositions` — id, analysis_id, proposition_text, theme, source_case, source_paragraph, evolution_type, source, confirmed, tension_with_id
- `analysis_documents` — id, analysis_id, doc_type, content, version, created_at

**Backend:**
- CRUD-endepunkter: `POST /api/analyses`, `GET /api/analyses`, `GET /api/analyses/:id`, `PATCH /api/analyses/:id`
- Migrere `readStatus`, `notes`, `delimitations` fra localStorage-format til `analysis_candidates`-rader

**Frontend:**
- SvelteKit route `/` → porteføljevisning (fra mock). Single-user men UI klar for team (eier-felt, team-tab synlig men dimmet)
- SvelteKit route `/analyse/[id]` → eksisterende workspace, men nå lastet fra DB
- `AnalysisState` refaktoreres: DB-persistering erstatter localStorage, men beholder rune-basert reaktivitet
- Fremdriftsindikator i venstepanel (7-stegs fra guidet-analyse doc) erstatter dagens faste seksjoner

**Leveranse:** Bruker kan opprette, åpne, og navigere mellom analyser. Eksisterende workspace fungerer som før, men tilstand overlever refresh via DB.

---

### Sprint 11: Scoping — Claude-assistert problemdefinisjon (steg 0)

**Status:** ✅ Implementert

**Mål:** Juristen skriver fritt, Claude foreslår struktur, juristen godkjenner.

**Backend:**
- `POST /api/analyses/:id/scope` — sender problemstilling til Claude, returnerer strukturert JSON (refined_problem, sub_problems, provisions, search_strategy, reasoning)
- System-prompt basert på SKILL.md scoping-regler, strukturert med XML-tags (`<instructions>`, `<task>`, `<formatting_rules>`) per Claude prompting best practices
- Bestemmelsesverifisering: hent ordlyd fra `lovdata_sections` for alle foreslåtte bestemmelser
- ~8-12K tokens per kall, synkront
- `ScopeError`-exception for feilhåndtering (ikke in-band error-dict)

**Claude API-features brukt:**
- **Structured outputs** (`output_config.format.json_schema`): Garanterer valid JSON som matcher `SCOPING_SCHEMA` — ingen regex-fallback nødvendig
- **Effort** (`output_config.effort: "medium"`): Reduserer Sonnet-kostnader uten vesentlig kvalitetstap for denne oppgaven
- **Prompt caching** (`cache_control: {"type": "ephemeral"}`): ~90% rabatt på system-prompt tokens ved gjentatte kall

**Frontend:**
- Scoping-overlay i workspace-ruten (tre faser fra mock):
  1. Blankt tekstfelt → «Vurder med Claude»
  2. Strukturert forslag med redigerbare felter, verifiserte bestemmelser med ordlyd, søkestrategi i klartekst
  3. Søkefase med fremdriftsindikatorer
- Stegindikator øverst: Problemstilling → Scoping → Søk → Kandidater
- «Be Claude revidere» sender oppdatert scope tilbake til Claude
- Godkjenning persisterer seeds i `analysis_seeds`, status → `candidates_ready`

**Filer opprettet/endret:**
- `backend/scoping.py` — `generate_scope()`, `_verify_provisions()`, `ScopeError`, `SCOPING_SCHEMA`, `SCOPING_SYSTEM_PROMPT`
- `backend/llm_utils.py` — delt `CLAUDE_MODEL` (`claude-sonnet-4-6`), `GEMINI_MODEL`, `parse_json_response`
- `backend/app.py` — ny route `POST /api/analyses/<id>/scope`
- `backend/curation.py` — refaktorert til å bruke `llm_utils`
- `src/lib/components/ScopingOverlay.svelte` — 3-fase overlay med stegindikator
- `src/lib/api/analyses.ts` — `scopeAnalysis()` API-funksjon
- `src/lib/types/analysis.ts` — `ScopingProvision`, `ScopingResult` interfaces
- `src/lib/stores/analysis.svelte.ts` — `setStatus()` metode
- `src/routes/analyse/[id]/+page.svelte` — `showScoping` derived, betinget rendering

**Leveranse:** Komplett steg 0 — fra problemstilling til godkjent scope med verifiserte bestemmelser.

---

### Sprint 12: Utvidet søk (steg 1) + kandidatpersistering

**Mål:** Søket produserer persisterte kandidater med A/B/C og signaler.

**Backend:**
- Refaktorere `build_traversal_response` til å *også* persistere kandidater i `analysis_candidates` med category, signals, iteration
- Gap-matrise persisteres på analysen

**Frontend:**
- Etter scoping-godkjenning: søket kjøres automatisk med fremdriftsvisning (fra scoping mock fase 3)
- Overlay lukkes → workspace vises med kandidatlisten
- Kandidater i listen viser nå `screening_status` per sak (badge-system fra guidet-analyse doc)

**Leveranse:** Sømløs overgang fra scoping til workspace. Kandidater persistert med metadata.

---

### Sprint 13: Screening-delegering + AI-screening (steg 2)

**Mål:** Juristen velger hvem som screener — Claude eller juristen selv — per kategori og per sak.

**Backend:**
- `POST /api/analyses/:id/screen` — tar liste av sak_nr, sender parallelle Claude-kall (3-5)
- Per kall: system-prompt (screening-mal fra SKILL.md) + problemstilling + seeds + avgjørelsestekst (`section='vurdering'`)
- Returnerer strukturert JSON med 5 lag: rettssetning, faktum+vurdering, nøkkelsitater med avsnittsnr, nyanser, relevansvurdering
- SSE-streaming: resultater streames til frontend etter hvert som de er klare
- Re-screening: `POST /api/analyses/:id/screen/:sak_nr/rescreen` med `sections=['vurdering','bakgrunn']`
- Rettssetninger extraheres til `analysis_propositions` med `source='ai_screening'`, `confirmed=false`
- ~12-18K tokens per sak

**Frontend:**
- Screening-delegeringsvisning (fra mock): venstre-panel med kategori-kontroller (Claude/Jeg leser/Velg per sak)
- Per-sak toggle (AI|Person) i listen
- Streaming-visning: pulserende bakgrunn, spinner, «Leser 2024/2019…»
- Screening-resultat ekspanderbart under saksraden: rettssetning (gulmarkert), faktum, sitater (kollaperbare med klikkbare avsnittsnumre), nyanser
- Star-markering for gullkandidater
- Fremdrift i venstepanel: «8 av 12 screenet (3 Claude, 2 deg, 3 gjenstår)»

**Leveranse:** Full steg 2 — fleksibel screening med parallell AI og streaming resultater.

---

### Sprint 14: Ettersøk + tverrgående rettssetninger (steg 2b + 3)

**Mål:** Gap-drevet ettersøk og rettssetningsregister.

**Backend:**
- `POST /api/analyses/:id/post-search` — sender screeningresultater (komprimert) + gap-matrise + seeds til Claude
- Claude returnerer nye FTS-termer, nye vektorsøk, nye bestemmelser, identifiserte mønstre
- `POST /api/analyses/:id/cross-propositions` — sender alle rettssetninger + nøkkelsitater til Claude etter ferdig screening
- Claude returnerer tematisk organiserte tverrgående rettssetninger med spenninger

**Frontend:**
- Ettersøk-forslag vises som AI-markert panel i venstepanel
- Juristen godkjenner nye seeds → nytt søk kjøres → nye kandidater merkes med `iteration: 2+`
- Rettssetningsregister (designspec seksjon 21) vises i venstepanel: gruppert per tema, med spenninger markert
- Iterasjonshistorikk synlig

**Leveranse:** Iterativ utforskning med gap-søk og akkumulerende rettssetningsregister.

---

### Sprint 15: EU-screening + syntese + QA (steg 4-6)

**Mål:** Komplette siste steg av analyseprosessen.

**Backend:**
- EU-screening: identifiser EU-dommer fra `kofa_eu_references`, screen med tilpasset mal
- `POST /api/analyses/:id/synthesize` — komprimerte screeningresultater + rettssetningsregister + notater → Claude genererer notatutkast (~25-35K tokens inn)
- Token-estimering og capsule-komprimering (A full, B komprimert, C minimal)
- `POST /api/analyses/:id/qa` — sitatverifisering, logisk konsistens, dekningssjekk (2-3 separate kall)
- QA-rapport som strukturert JSON

**Frontend:**
- EU-dom-screening integrert i eksisterende screening-flow
- Syntese: «Generer notat»-knapp → visning av markdown-notat med `[JURISTENS VURDERING]`-seksjoner
- QA-rapport som flagg-liste i venstepanel
- Notatredigering (markdown-editor eller enkel textarea)

**Leveranse:** Analyseprosessen fra start til ferdig notat med QA.

---

### Sprint 16: Deponering + chat-panel (steg 7 + sparring)

**Mål:** Lovkommentar-oppdatering og fri samtale under hele prosessen.

**Backend:**
- `POST /api/analyses/:id/deposit` — Claude genererer deponeringsbidrag per bestemmelse
- `POST /api/chat` — fri samtale med analysekontekst (seeds, kandidater, screeningresultater, notater) fra DB. Capsule-mønster.
- Chat-historikk persistert per analyse

**Frontend:**
- Deponering: liste over bestemmelser → generert bidrag → godkjenn per bestemmelse
- Chat-panel som bunnpanel-skuff i midtpanelet (fra mock): lukket/halv/full
- Referanse-parsing i chat ({ref:kofa:2024/2019:§42} → klikkbar lenke)
- Proaktive forslag (ubedte observasjoner basert på analysestatus)
- «Mulige motargumenter»-blokk med visuell differensiering

**Leveranse:** Komplett guidet analyse inkl. deponering og sparringspartner.

---

## Tverrgående hensyn

### Auth (utenfor sprint-scope, men forberedt)
- `analyses`-tabellen har `user_id`-felt fra dag 1
- Frontend viser eier-feltet
- Team-tab i portefølje synlig men dimmet — aktiveres når auth er på plass
- Overlapp-beregning (portefølje-mock) forutsetter team-data — implementeres med auth

### Token-økonomi
- Screening-kall: ~12-18K inn, ~3K ut (per sak)
- Syntese: ~25-35K inn, ~8-12K ut (per analyse)
- Typisk analyse (12 saker, 2 EU-dommer): ~200-280K tokens totalt
- Capsule-komprimering er nøkkelen — screening er komprimeringslaget

### Backend-evolusjon
- Sprint 10: CRUD + eksisterende traversal
- Sprint 11: Claude API-integrasjon (structured outputs, effort, prompt caching) via `anthropic`-SDK
- Sprint 12: kandidatpersistering
- Sprint 13+: parallelle Claude-kall, SSE-streaming
- Alternativ: vurder om Claude-kall bør gå via edge functions (Supabase) for bedre skalerbarhet

### Implementeringsprinsipper

Disse gjelder for alle sprints og skal følges konsekvent:

**Commits:**
- Commit regelmessig — etter hver logisk enhet (ny komponent, nytt endepunkt, refaktorering). Ikke samle opp store diffar.

**Forenkling:**
- Kjør `/simplify` etter hver oppgave der det er hensiktsmessig. Fang opp duplisering, ubrukt kode og unødvendig kompleksitet mens koden er fersk.

**Design-kvalitet:**
- Kjør `interface-design:init` *før* store UI-endringer — etabler designretning og tokens først.
- **Les mockups** (`docs/design/paragraf-*-concept.jsx`) før implementering av tilhørende UI. Mockupene er den visuelle sannheten.
- Kjør `interface-design:critique` etter de fleste UI-endringer — fang avvik fra designsystemet, spacing-feil, fargemisbruk.

**Kodeforståelse:**
- Bruk `codegrasp` MCP (get_context_capsule, get_impact_graph, get_skeleton) når det gir verdi — spesielt ved refaktorering av AnalysisState, når du skal forstå avhengigheter mellom komponenter, eller ved endringer som kan ha utilsiktet spredning.

### Hva som IKKE er med
- Autentisering/autorisasjon
- Team-samarbeid (overlapp, deling)
- Vinkelrotasjon som AI-drevet forslag (Fase 2 backlog)
- Recursive CTE
- Språkmønster som seed-forslag
