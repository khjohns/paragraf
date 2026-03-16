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

### Full traversal kjøres automatisk ved hvert sideload ⚠️ Ytelse
Hver gang siden lastes kjøres `/api/traverse` på nytt — alle DB-spørringer mot kofa_law_references, search_kofa_decision_text (4 kall), Gemini embeddings, kofa_cases, kofa_law_references, kofa_case_references, kofa_eu_references, kofa_eu_case_law, kofa_forarbeider_law_refs. Dette er dyrt i produksjon og kan gi inkonsistente kandidatlister hvis databasen endrer seg. Vurder å cache traversal-resultater eller kun re-kjøre ved eksplisitt brukerhandling.

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

### Neste: Start screening

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

## Aggregert kostnad hittil

| Steg | Modell | Input | Output | Kostnad |
|------|--------|-------|--------|---------|
| Scoping | sonnet | 1 915 | 1 586 | $0.0295 |
| **Total** | | | | **$0.0295** |
