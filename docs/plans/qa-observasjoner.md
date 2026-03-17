# QA-observasjoner — manuell gjennomgang

**Dato:** 2026-03-16
**Miljø:** Backend localhost:5002, Frontend localhost:5175

---

## Steg 0 — Scoping

### Token-budsjett ✅
```
Scoping [sonnet]: 1915 input (0 cache-write, 0 cache-read), 1586 output — $0.0295
```
- Input 1915 tokens — svært lavt, godt innenfor budsjett
- Ingen cache-treff (forventet, første kall)
- 6 lovdata-seksjoner hentet (FOA §§ 16-10, 17-1, 16-11, 23-5, 24-2 + EU dir §63)

### UI-bugs (fix later)
- **Redigering virker ikke**: Siden sier «Alt over kan redigeres» men ingen felter lar seg redigere
- Må undersøkes: er dette en frontend-feil eller manglende backend-støtte?

### UI-spørsmål / vurderingspunkter (ikke bugs)
- **«Be Claude revidere»**: Uklart for bruker hva som skjer — hva sendes til Claude, hva returneres? Bør UI informere om dette?
- **Tilbakemeldingsfelt**: Vurder om det skal være et fritekstfelt der bruker kan gi instruksjoner til Claude som inkluderes i neste steg (scoping-revisjon / søk)

---

## Steg 1 — Traversal / kandidater

### 500-feil ved godkjenning av scope ⚠️ BUG

**Symptom:** Bruker fikk feilmelding etter «Godkjenn scope».

**Rotårsak (fra logg):**
```
PATCH analyses → HTTP/2 400 Bad Request   ← Supabase avviste status-oppdateringen
POST /api/analyses/<id>/traverse → 500
```

`traverse_analysis_route` (app.py:231) forsøker å sette `status: "candidates_ready"` + `gaps: [...]` via `update_analysis()`. Supabase returnerer 400.

**Rotårsak (verifisert):** `gaps`-kolonnen manglet i `analyses`-tabellen. Enum-typen `analysis_status` inneholder alle forventede verdier (scoping, scoping_complete, searching, candidates_ready, screening, screening_complete, post_search, synthesis, qa, complete). Feilen var **ikke** status-verdien, men at `gaps` jsonb ble sendt til en ikke-eksisterende kolonne.

**Fix:** Lagt til `gaps jsonb DEFAULT '[]'` via Supabase-migrasjon `add_gaps_column_to_analyses`. ✅ FIKSET

### Traversal-resultater ✅ (via /api/traverse)
- ~95 kandidater funnet
- Signaler: FOA §§ 16-10, 17-1, 16-11, 23-5, 24-2 + EU dir §63
- FTS: 4 søk via `search_kofa_decision_text`
- Hybrid/vektor: Gemini embeddings brukt → `search_kofa_decision_hybrid`
- Forarbeider-referanser hentet for alle 5 FOA-paragrafer

---

## Steg 2 — Screening

### Kandidatliste ✅
- 94 kandidater totalt: A=26, B=68, **C=0**
- C=0 er ikke feil — betyr alle saker har ≥2 signaler for dette temaet (normalt for FOA §16-10)

### Arbeidsfordeling-UI ✅ (fungerer, med én merknad)

Etter batch-bugfix og restart: kategori-togglene er nå visuelt tydelige (filled svart = valgt). Valgt tilstand: A=Claude screener, B=Jeg leser, C=Velg per sak.

«Velg per sak» aktiverer per-sak AI/menneske-toggle direkte i listen — fungerer som i mockupen. ✅

**Én merknad:** B-kategorien defaulter til «Jeg leser» — er dette alltid riktig default, eller bør B også defaulte til Claude?

### Filter-banner ✅
«Kun gjeldende FOA (2017–) — eldre praksis er filtrert bort» vises øverst. B-saker fra før 2017 er dempet i listen. God UX.

### Frontend-redirect ved backend-restart ⚠️
Ved backend-restart navigerte frontend kort til «ny analyse» før den omdirigerte til riktig side. Sannsynligvis en race condition i initial data-lasting.

### Frontend bruker feil traversal-endepunkt ⚠️ KRITISK BUG

Frontend kaller `/api/traverse` (gammel rute, app.py:55) — **ikke** `/api/analyses/<id>/traverse` (ny rute, app.py:204). Den gamle ruten returnerer traversal-data men **persisterer ingenting** (ingen `persist_candidates`, ingen `update_analysis`).

**Konsekvenser:**
1. Kandidater lagres aldri i `analysis_candidates` → DB har 0 rader
2. Screening PATCH-er 0 rader (candidates finnes ikke) → screening-resultater kastes
3. Ved reload: hydrate finner ingenting i DB → tilbake til start
4. Screening kjører mot Anthropic API og kaster bort pengene — resultatet lagres kun i frontend-minne

**Fix:** Frontend må bruke `/api/analyses/<id>/traverse` i stedet for `/api/traverse`.

### Full traversal kjøres 3 ganger ved sideload ⚠️ Ytelse

Backend-loggen viser at `/api/traverse` kalles **tre separate ganger** ved én enkelt sideload. Hver kjøring utfører ~20 Supabase-spørringer (lovdata, FTS ×4, hybrid search, kofa_cases, law_refs, case_refs, eu_refs, eu_case_law, forarbeider ×5, lovdata_sections ×5).

**Må fikses:** Traversal bør kun kjøres ved eksplisitt brukerhandling, ikke ved sideload. Kandidater skal hentes fra DB (som allerede er persistert via `/api/analyses/<id>/traverse`).

### Fremdriftsindikator ⚠️ (viser feil steg)
- Steg 0 «Fremdrift» vises som fullført (svart fylt sirkel)
- Steg 1 «Problemstilling» vises som aktivt (gull sirkel)
- Men vi er faktisk klar for steg 3 (Screening)
- **Årsak:** Direkte konsekvens av 400-feilen — `status: "candidates_ready"` ble aldri satt i DB
- **Steg 0 «Fremdrift»:** Litt forvirrende navn — dette er selve indikatoren, ikke et prosesssteg. Vurder «Oversikt» eller fjern som eget steg.

### «Utenfor aktivt filter»-tooltip ✅
Tooltip på dimmet sak (2022/909) forklarer hvorfor den er nedtonet. God UX.

### Scoping-resultat ikke lenger tilgjengelig ⚠️ UX-gap

Etter godkjenning av scope er scoping-resonnemanget borte — ingen vei tilbake for å se hva Claude foreslo og hvorfor.

**Konkrete behov:**
- Bruker vil kanskje forstå *hvorfor* akkurat disse bestemmelsene ble valgt som seeds
- Bruker vil kanskje forstå *hvorfor* 94 kandidater dukket opp (hvilke søk slo til)

**Mulige løsninger (ikke prioritert ennå):**
- **Steg 1 «Problemstilling» i fremdriftsindikatoren** kan gjøres klikkbar og vise scoping-resultatet i panelet (bestemmelser, FTS-termer, sub-problems) — allerede klikbar ifølge QA-plan, men viser det riktig innhold?
- **Deterministisk søk-oppsummering**: Etter traversal kan backend (eller frontend) generere en kort tekst som forklarer hva som skjedde: «Fant X saker via referansetabell på §16-10, Y saker via fulltekstsøk på [termer], Z saker via semantisk søk» — ingen LLM nødvendig
- **Chat-panel**: Kan svare på «Hvorfor disse sakene?» ved å ha tilgang til seeds og traversal-statistikk

### Batch API brukes for screening ✅ (etter tre bugfikser)

**Bugfikser som måtte til:**
1. `effort=` i `build_batch_request()` — parameter fjernet fra signaturen (Batch API støtter ikke effort)
2. `effort=` i kallsteder (`screening.py`, `qa.py`, `eu_screening.py`) — fjernet fra alle
3. `custom_id` med `/` i saksnummer (`2022/31`) — ugyldig tegn, byttet til `_`

**Disse ville blitt fanget av unit-tester.** Se testplan nedenfor.

### Batch API brukes for screening, hadde feil ⚠️ (historisk)

«Start screening» kaller faktisk `/screen-batch` (batch API). Men Anthropic returnerer 400:
```
POST https://api.anthropic.com/v1/messages/batches → HTTP/1.1 400 Bad Request
POST /api/analyses/<id>/screen-batch → 500
```

**Trolig årsak:** `build_batch_request()` sender `output_config` med `effort="high"` + JSON schema. `effort`-parameteren er sannsynligvis ikke støttet i Batch API, selv om den fungerer i vanlig Messages API.

**Mangler:** Backend logger ikke Anthropics feilmelding (kun HTTP-status). For å diagnosere trengs logging av responskroppen ved 400-feil.

**Fix:** Fjern `effort` fra `build_batch_request()` / batch-kontekst. Bare structured output (json_schema) uten effort.

**Workaround for QA:** Bruk SSE-streaming (`/screen`) i stedet for batch.

### Polling mister tilstand ved sideload ⚠️ ARKITEKTURPROBLEM
Fanebytte → sideload → frontend mister `batch_id` fra lokal state → polling stopper.
Batchen hos Anthropic fortsetter å kjøre, men frontend vet ikke om den.
**Fix:** Persist `batch_id` til DB (`analyses.batch_id`). Ved sideload: sjekk om aktiv batch finnes og gjenoppta polling automatisk.
**0% fremdrift** i UI er også fordi Batch API kun rapporterer succeeded/processing/errored-tellere, ikke per-request fremgang.

### Batch API er feil løsning for interaktiv analyse ⚠️ ARKITEKTURBESLUTNING

Batch API har SLA på opptil 24 timer (typisk 15-60 min). For 26 A-saker tok det over 1 time uten å fullføre. Dette ødelegger arbeidsflyten — brukeren sitter og venter i stedet for å jobbe iterativt.

**Konklusjon:** Batch API egner seg for bakgrunnsjobber (nattlig prosessering, bulk-migrering), **ikke** for interaktiv analyse der brukeren venter på resultater.

**Anbefaling:** Bruk SSE-streaming (`/screen`) som primærmetode for screening. Parallelle kall (3-5 samtidige) gir resultater innen sekunder per sak, og brukeren ser fremdrift løpende. Batch API kan eventuelt tilbys som opt-in for store analyser brukeren vil kjøre over natten.

### Klikk på sak trigger både screening-ekspansjon og kuratering ⚠️ UX-BUG

Når bruker klikker på en screenet sak i listen skjer to ting samtidig:
1. Screening-resultatet ekspanderes inline (ScreeningResultCard)
2. Høyrepanelet åpnes og Gemini-kuratering starter automatisk

**Problem:** Under screening-fasen bør klikk på en sak vise screening-resultatet — ikke starte en kostbar Gemini-kuratering. Kuratering hører til lese-/vurderings-fasen, ikke screening-fasen.

**Mulig fix:** Deaktiver automatisk kuratering når `status` er `screening` eller `screening_complete`. Alternativt: la kuratering være opt-in (knapp) i stedet for automatisk ved sak-klikk.

### Screening-resultater ✅ (26 A-saker via SSE)

SSE-screening fullført for alle 26 A-saker. Propositions-upsert feilet for de 5 første (constraint manglet), lyktes for de 21 siste (etter migrasjon). **Men:** Ingen resultater lagret i DB — PATCH treffer 0 rader fordi candidates aldri ble INSERT-et (se «Frontend bruker feil traversal-endepunkt»).

**Token-kostnad screening (26 saker):**
| Metrikk | Verdi |
|---------|-------|
| Saker | 26 |
| Totalt input | ~162k tokens |
| Totalt output | ~30k tokens |
| Kostnad | ~$0.92 |
| Gjennomsnitt per sak | ~$0.035 |
| Tid (SSE, 3 parallelle) | ~5 min |

### Neste: Start screening (via SSE)

---

## Steg 3 — Ettersøk

*(ikke kjørt ennå)*

---

## Steg 4-5 — EU-screening og syntese

*(ikke kjørt ennå)*

---

## Steg 6 — QA

*(ikke kjørt ennå)*

---

## Fikser gjennomført denne sesjonen

| # | Observasjon | Fix | Commit |
|---|-------------|-----|--------|
| 1 | `effort` i Batch API → 400 | Fjernet effort fra `build_batch_request` + alle kallsteder | `8991991` |
| 2 | `custom_id` med `/` → ugyldig | `sak_nr.replace("/", "_")` | `8991991` |
| 3 | `gaps`-kolonne manglet → 500 ved traversal | Supabase-migrasjon `add_gaps_column_to_analyses` | — (DB) |
| 4 | Manglende unique constraint på `analysis_propositions` | Supabase-migrasjon `add_unique_constraint_analysis_propositions` | — (DB) |
| 5 | Propositions-upsert feil krasjet hele screening | Try/catch rundt upsert, logger warning | `5d1f777` |
| 6 | Frontend brukte feil traversal-endepunkt (`/api/traverse`) | Byttet til `/api/analyses/<id>/traverse` | `5d1f777` |
| 7 | Kuratering trigget under screening-fase | Deaktiver kuratering når status=screening/candidates_ready | `5d1f777` |
| 8 | Screening brukte batch (timer) i stedet for SSE (minutter) | Byttet ScreeningPanel til `startScreeningSSE` | `8334517` |
| 9 | Batch cancel-endepunkt manglet | Lagt til `/cancel-batch/<id>` + `cancel_batch()` | `8334517` |
| 10 | Traversal kjøres 3x ved sideload | `enabled: analysisState.nodes.length === 0` på query | `64caf52` |
| 11 | Pre-syntese sitatverifisering mangler | Ny `verify_screening_citations()` + endepunkt | `64caf52` |
| 12 | Adaptive thinking ikke aktivert | `thinking: {"type": "adaptive"}` på Sonnet/Opus-kall | `7fc63df` |
| 13 | Sitatverifisering kjøres automatisk + vises i UI | Auto-trigger etter SSE, badges per sitat | `abcb283` |
| 14 | Infinite loop i traversal-query (effect_update_depth_exceeded) | Fjern syklisk enabled, bruk staleTime: Infinity | `6d1bac0` |
| 15 | «Velg per sak» defaulter til Claude uansett forrige valg | Forsøkt fix (previousModes) — fungerer ikke ennå | `5580466` |

## Gjenstående bugs/forbedringer (ikke fikset)

| # | Observasjon | Type | Prioritet |
|---|-------------|------|-----------|
| 1 | Scoping-redigering virker ikke | UX-design | Medium |
| 2 | Scoping-resultat borte etter godkjenning | UX-design | Medium |
| 3 | Fremdriftsindikator viser feil steg | Konsekvens av statusflyt — bør testes nå | Lav |
| 4 | Frontend-redirect ved backend-restart | Race condition | Lav |
| 5 | Batch polling mister state ved sideload | Nedprioritert (SSE er default nå) | Lav |
| 6 | B-kategori defaulter til «Jeg leser» | Design-valg å vurdere | Lav |
| 7 | «Velg per sak» defaulter alltid til Claude | previousModes-fix fungerte ikke — må undersøkes | Medium |
| 8 | FOA 2017-filter dimmer saker men ekskluderer dem ikke fra screening | Dimmede saker bør ekskluderes fra «Claude screener»-listen | Medium |
| 9 | Adaptive thinking gir 0 thinking-tokens (screening) | Sonnet velger å ikke tenke for screening — mulig riktig oppførsel | Info |
| 10 | Prompt caching gir 0 cache-treff | Mulig inkompatibilitet med adaptive thinking modus | Info |
| 11 | Traversal overskriver screening-resultater | `persist_candidates` DELETE+INSERT fjerner `ai_screening` | **Kritisk** |
| 12 | Ingen «screen flere»-knapp etter screening er fullført | `screeningStarted=true` skjuler knappen permanent | Medium |
| 13 | Kun 2 saker vises som screenet etter reload | Konsekvens av #11 — traversal slettet screenede kandidater | Konsekvens |

## Aggregert kostnad hittil

| Steg | Modell | Input | Output | Kostnad |
|------|--------|-------|--------|---------|
| Scoping | sonnet | 1 915 | 1 586 | $0.0295 |
| Screening (26 A-saker) | sonnet | ~162k | ~30k | ~$0.92 |
| **Total** | | | | **~$0.95** |
