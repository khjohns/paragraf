# Plan: Drøfting av kategoriseringssystem

## Mål
Komme frem til riktig kategoriseringsmodell for pipeline — basert på metodikken i `metode-rettslig-analyse.md` og erfaringer fra test-run.

## Bakgrunn: Hva vi lærte fra pipeline test-run (2026-03-24)

### Signalformat-kaos
CLI-pipeline lagret signals som arrays: `{"ref": ["16-11"], "fts": ["konsortium"], "vector": [0.78]}`
Traversal (backend) lagret signals som boolean: `{"ref": true, "fts": false, "vec": true}`
Traversal upsert overskrev CLI-formatets signals → korrupt data. Nå normalisert til boolean.

### Konsekvens av boolean-format
Med boolean gir kategori-beregningen (antall true):
- A = 2+ signaltyper → 11 saker (av 101)
- B = 1 signaltype → 90 saker
- C = 0 signaltyper → 0 saker (alle kandidater har minst 1 signal)

**Ingen C-saker i det hele tatt.** Haiku-triage (designet for C) ble meningsløs. 90 B-saker er for mange å fullscreene uten triage.

### Hva metodikken sier (fra `metode-rettslig-analyse.md`)
Metodikken opererer med **to ulike kategoriseringer** på ulike tidspunkt:

**Mekanisk kategorisering** (før lesing — prioritert leseliste):
- A = referansetabell(primær ∩ sekundær) + FTS → trippel interseksjon
- B = referansetabell(primær) ∩ FTS(nøkkelbegrep) → dobbel interseksjon
- C = FTS alene → variabel relevans

**Innholdsbasert kategorisering** (etter screening):
- A = direkte relevant, behandler problemstillingen inngående
- B = utfyllende, berører som del av bredere vurdering
- C = perifer, nevner begreper uten å analysere

Dokumentet sier eksplisitt: *"innholdsbasert kategorisering kan avvike vesentlig fra interseksjonsrangeringen"* og *"Kategori C-saker er verdifulle — avgrensningspraksis."*

### Validerte tall fra historiske analyser
- A-presisjon (mekanisk → innholdsbasert): **100%** — trippel interseksjon treffer alltid
- B-presisjon: **~63%** — en tredjedel faller utenfor etter lesing
- Ettersøk øker dekning med **~28%**
- Vektorsøk avgjørende for konseptuelle spørsmål (14% av FTS-treff, 100% recall for konseptuelle)

### Hva vi gjør feil i dag
1. **Ett felt (`category`)** for begge kategoriseringer — mister mekanisk info etter screening
2. **Boolean signals** mister granularitet — kan ikke skille primær vs sekundær bestemmelse
3. **Ingen C-saker** med boolean → triage-steget har ingenting å filtrere
4. **Traversal og CLI-pipeline** hadde inkompatible formater (nå fikset, men til feil format?)

### To DB-analyser for validering
- `8c2c8b4d` (Leverandørgrupperinger, § 16-11) — 101 kandidater, CC-pipeline
- `0dccaab9` (FDVU) — 33 kandidater, API-pipeline

### Tilnærming
Bruk `/thinking-partner`-skill for å utfordre antakelser og teste designalternativer.

## Foreslått prosess

### Steg 1: Kartlegg nåsituasjonen
- Hva lagres i DB i dag (`category`, `signals`, `ai_screening.relevance`)
- Hva frontend bruker og viser (se `src/lib/types/analysis.ts` → `SignalHits`, `Category`)
- Hva API-pipeline produserer (`backend/traversal.py` → `_classify_category()`)
- Hva CC-pipeline produserer (`pipeline-context.py` → `_normalize_signals()`)
- Hvor de to kategoriseringene allerede eksisterer implisitt:
  - Mekanisk: `category` + `signals` (satt av traversal/scope)
  - Innholdsbasert: `ai_screening.relevance` (satt av screening-agent)
- Sjekk: bruker frontend `category` eller `ai_screening.relevance` for visning?

### Steg 2: Analyser metodikken grundig
- Gå gjennom `metode-rettslig-analyse.md` med fokus på kategorisering
- Trekk ut validerte funn (A-presisjon 100%, B-presisjon 63%, C-verdifulle)
- Identifiser hva som fungerer og hva som mangler

### Steg 3: Formuler designalternativer

**Innsikt fra thinking-partner-analyse:**
Mekanisk kategori er en *prediksjon*, innholdsbasert er en *vurdering*. Etter screening trenger ingen mekanisk kategori. Det egentlige problemet er ikke A/B/C-kategorisering, men at boolean signals mister informasjonen triage og prioritering trenger.

Minst tre alternativer:

**Alt A: To felter, rikere signals** (opprinnelig forslag)
- `signal_category` (A/B/C) — mekanisk, beregnet fra signals
- `relevance` (A/B/C) — innholdsbasert, satt av screening
- Signals tilbake til arrays: `{ref: ["16-11"], fts: ["konsortium"], vec: [0.78]}`
- ⚠️ Risiko: to kategori-felter forvirrer frontend og utviklere

**Alt B: Ett felt, rikere signals** (thinking-partner-alternativ)
- `category` forblir ett felt — starter mekanisk, overskrives av screening
- `signals` tilbake til arrays (rik informasjon bevart for etterprøving)
- Nytt: `signal_strength` (int, 0-3) — antall signaltyper, for sortering/triage
- Triage opererer på `signals` + metadata, ikke kategori
- Screening-prioritering bruker `signal_strength`
- Frontend viser alltid `category` (beste tilgjengelige vurdering)
- ✅ Enklere: ett felt, ingen forvirring, rik signal-historikk

**Alt C: Boolean signals, én kategori** (nåværende)
- `category` ett felt, `signals` boolean `{ref, fts, vec}`
- ⚠️ Mister granularitet: kan ikke skille primær/sekundær bestemmelse
- ⚠️ Ingen C-saker → triage meningsløs

### Steg 4: Vurder mot bruksscenarier
- **Triage:** Hvilken informasjon trenger Haiku for å filtrere?
- **Screening-prioritering:** Hvilken rekkefølge screenes sakene i?
- **Syntese:** Trenger synteseagenten å vite mekanisk kategori?
- **Frontend:** Hva viser bruker — mekanisk, innholdsbasert, eller begge?
- **Ettersøk/gap:** Brukes kategori for å identifisere hull?

### Steg 5: Valider mot historiske data
- Historiske analyser er i `~/Projects/Catenda/kofa/docs/research/` (markdown, ikke DB)
- Parse kandidatlister og screening-resultater fra markdown-filer
- Sammenlign mekanisk vs innholdsbasert kategori — bekrefter vi 100%/63% presisjon?
- Sjekk om C-saker som ble innholdsmessig A ville blitt triaged out
- Kan også validere mot test-run analyse `8c2c8b4d` (denne er i DB)

### Steg 6: ADR + implementeringsplan
- Skriv ADR-006 med beslutning og begrunnelse
- Implementeringsplan: DB-migrering, backend, frontend, skills

## Hvem gjør hva
- Steg 1-2: Kan gjøres av Claude med DB-tilgang og fillesing
- Steg 3-4: Drøftes med bruker (sjekkpunkt)
- Steg 5: Claude med tilgang til `~/Projects/Catenda/kofa` + Supabase
- Steg 6: Claude skriver, bruker godkjenner

## Datakilder
- **Historiske analyser:** `~/Projects/Catenda/kofa/docs/research/` — markdown (kandidatlister, screening, notater)
- **Metodikk:** `~/Projects/Catenda/kofa/docs/design/metode-rettslig-analyse.md` (kilde til sannhet, kopiert til dette repo)
- **Test-run:** Supabase DB analyse `8c2c8b4d-e13c-46d8-9fde-712303f18801`
- **Frontend/backend:** dette repo

## Avhengigheter
- Bør gjøres FØR API-pipeline-forbedringer implementeres

## Nøkkelspørsmål — alle besvart

### Runde 1 (thinking-partner):
1. ~~Er boolean signals riktig?~~ → **Nei.** Arrays bevarer hvilke bestemmelser/termer som traff.
2. ~~Bør mekanisk kategori være A/B/C eller numerisk?~~ → **`discovery_rank` (int 1-3)** fryst i signals-objektet.
3. ~~Gir triage mening når alle har minst 1 signal?~~ → **Ja, triage opererer på signals+metadata, ikke kategori.**
4. ~~Skal innholdsbasert overskrive mekanisk?~~ → **Ja, men mekanisk bevares som `discovery_rank` i signals.**

### Runde 2 (thinking-partner + ekstern Claude):
5. ~~Frontend-UX: Bør discovery_rank vises?~~ → **Signal-prikker pre-screening, A/B/C post-screening.** Metode-dashboard fremtidig.
6. ~~Vec i hierarkiet?~~ → **Ortogonal dimensjon.** `ref+fts+vec > ref+fts > ref+vec > fts+vec > ref-only > fts-only > vec-only`.
7. ~~Triage-regler med rikere signals?~~ → **Operér på signals + metadata.** Se ADR-006 triage-tabell.
8. ~~Distinkte vokabular?~~ → **`category` = alltid innholdsrelevans (A/B/C). `discovery_rank` = int i signals.**
9. ~~CLAUDE.md-inkonistens?~~ → **Oppdateres: A/B/C = innholdsrelevans, ikke signaldekning.**

### Thinking-partner-utfordringer som formet beslutningen:
- **Chesterton's Fence:** Metodikken selv bruker mekanisk kategori for kalibrering → bevar som `discovery_rank`.
- **Pre-mortem:** To kategori-felter med A/B/C forvirrer → ett felt + fryst rank i signals.
- **Reframing:** Problemet er *både* signalformat og kategori-semantikk — ortogonale problemer, begge løst.
- **Informasjonsteori:** Overskriving av mekanisk kategori er destruksjon → `discovery_rank` bevarer øyeblikksbildet.
- **First Principles:** `signal_strength` som count fanger ikke interseksjonsmønstre → `discovery_rank` + arrays.

## Beslutning

**Se [ADR-006: Kategorisering og signalmodell](../adr/006-kategorisering-og-signalmodell.md)** for fullstendig beslutning, begrunnelse og handlingsplan.

### Thinking-partner utfordringer (runde 2 — hardere press):

**1. Overskrivning = informasjonsdestruksjon.**
Tallene 100% A-presisjon og 63% B-presisjon kan KUN beregnes hvis begge kategorier finnes.
Mekanisk kategori er ikke for runtime-brukere — den er for pipeline-kalibrering over tid.
En sak funnet via kun FTS (mekanisk C) som viser seg A (innholdsbasert) forteller deg noe
om søkestrategien. Du trenger konfusjonsmatrisen.

**2. signal_strength (int 0-3) kollapser distinkte mønstre.**
ref+fts er fundamentalt annerledes enn ref+vec (metodikken definerer spesifikke
interseksjonsmønstre). Enkel telling mister dette. Vurder beregnet discovery-kategori
fra signal-mønster i stedet for ren telling.

**3. Signalformat og kategorisering er ortogonale problemer.**
Å fikse signals løser granularitet og triage-input, men løser IKKE at én category-kolonne
kollapser oppdagelse og vurdering. Begge må løses.

### Alt D: "Ett synlig felt, to lagret" (ny favoritt)
- `category` — frontend viser, alltid beste tilgjengelige (mekanisk → innholdsbasert)
- `discovery_category` — beregnet fra signals, satt én gang, aldri overskrevet (pipeline-kalibrering)
- `signals` — arrays med rik informasjon
- Frontend viser KUN `category` — ingen brukerforvirring
- `discovery_category` er backend/analytics-felt, aldri i UI

**Åpent nøkkelspørsmål:** Er pipeline-kalibrering over tid noe vi faktisk vil gjøre,
eller er det hypotetisk? Svaret avgjør om Alt B holder eller om Alt D trengs.
Svar: JA — metodikken har allerede en "søkeeffektivitet per notat"-tabell som
akkumulerer presisjon over analyser. Vi VIL kalibrere.

### Thinking-partner runde 3: Distinkte vokabular + vec-problemet

**Skjult konflikt:** CLAUDE.md sier "A/B/C = signaldekning, IKKE kvalitetsvurdering."
Men category skal bli innholdsbasert (= kvalitetsvurdering). Samme bokstav, to betydninger.

**Løsning — distinkte vokabular:**
- `discovery_category`: beskrivende labels for signalmønster (IKKE A/B/C)
  - Kandidater: `triple` / `double` / `single` / `vec-only` — eller numerisk rank
  - Alternativt: bare lagre signals (arrays) og beregn mønster on-demand
- `category`: A/B/C = alltid innholdsrelevans (direkte/utfyllende/perifer)
  - Settes av screening, A/B/C betyr ALLTID det samme
  - Frontend viser kun dette

**Vec passer ikke i metodikkens hierarki:**
Metodikken ble skrevet før vektorsøk. Vec har 100% recall for konseptuelle spørsmål —
en vec-only sak kan være den eneste veien inn. Kan ikke automatisk rangeres lavere
enn ref+fts uten å systematisk nedprioritere konseptuelle funn.

Tolkningsalternativer:
1. Vec ≈ FTS (tell likt) — enklest, men upresis
2. Vec svakere (vekt ned) — risikerer å miste konseptuelle funn
3. Vec ortogonal (egen dimensjon) — mest korrekt, mest komplekst

**Avgrensning (delimitation) er ortogonal:**
`is_delimitation` er allerede et eget felt i screening. A/B/C trenger ikke fange dette.
En A-sak kan være delimitation (out of scope men relevant for avgrensningsargument).

### Oppdatert Alt D (med distinkte vokabular)

```
analysis_candidates:
  signals        jsonb    — arrays: {ref: ["16-11"], fts: ["konsortium"], vec: [0.78]}
  discovery_rank text     — "triple"/"double"/"single"/"vec-only" (settes av scope, aldri endret)
  category       text     — A/B/C innholdsrelevans (settes av screening, vist i frontend)
  is_delimitation boolean — ortogonalt (allerede eksisterer)
  ai_screening   jsonb    — full screening-data inkl. relevance_reasoning
```

Frontend: viser `category` + `is_delimitation`. Aldri `discovery_rank`.
Pipeline: bruker `discovery_rank` + `signals` for prioritering og triage.
Kalibrering: sammenlign `discovery_rank` med `category` over tid.

### Gjenstående beslutninger for neste sesjon
1. Eksakt discovery_rank-beregning (hvordan vec vektes)
2. Triage-regler basert på signals (ikke discovery_rank)
3. Frontend: vis signal-badges (●●● for triple) eller bare category?
4. Migrering: hvordan konvertere eksisterende boolean signals til arrays
5. Validering mot DB-analyse 0dccaab9 og 8c2c8b4d
