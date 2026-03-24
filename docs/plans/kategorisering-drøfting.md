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
Minst tre:

**Alt A: To felter, rikere signals**
- `signal_category` (A/B/C) — mekanisk, beregnet fra signals
- `relevance` (A/B/C) — innholdsbasert, satt av screening
- Signals tilbake til arrays: `{ref: ["16-11"], fts: ["konsortium"], vec: [0.78]}`
- Mekanisk kategori beregnes fra interseksjon (primær ∩ sekundær ∩ FTS)

**Alt B: To felter, boolean signals**
- Som Alt A, men signals forblir boolean `{ref, fts, vec}`
- Mekanisk kategori basert på antall signaltyper (enklere, mindre presist)

**Alt C: Ett felt, to faser**
- `category` starter mekanisk, overskrives av screening til innholdsbasert
- Enklere, men mister mekanisk informasjon

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

## Nøkkelspørsmål å utfordre (thinking-partner)
1. Er boolean signals riktig? Metodikken bruker interseksjon av *spesifikke* bestemmelser — boolean mister dette
2. Bør mekanisk kategori være A/B/C eller en numerisk score?
3. Gir det mening med triage når alle kandidater har minst 1 signal?
4. Skal innholdsbasert relevans overskrive mekanisk, eller leve ved siden av?
5. Hva skjer med frontend-UX når bruker ser to ulike kategorier for samme sak?
6. Er interseksjon av primær ∩ sekundær bestemmelse realistisk for alle problemstillinger, eller er det spesifikt for § 16-10-type spørsmål?
