# Plan: Drøfting av kategoriseringssystem

## Mål
Komme frem til riktig kategoriseringsmodell for pipeline — basert på metodikken i `metode-rettslig-analyse.md` og erfaringer fra test-run.

## Foreslått prosess

### Steg 1: Kartlegg nåsituasjonen
- Hva lagres i DB i dag (`category`, `signals`, `ai_screening.relevance`)
- Hva frontend bruker og viser
- Hva API-pipeline og CC-pipeline produserer
- Hvor de to kategoriseringene allerede eksisterer implisitt (mekanisk i `category`, innholdsbasert i `ai_screening.relevance`)

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
- Kjør valgt modell mot de 4 analysene som er gjennomført
- Sammenlign mekanisk vs innholdsbasert kategori — bekrefter vi 100%/63% presisjon?
- Sjekk om C-saker som ble innholdsmessig A ville blitt triaged out

### Steg 6: ADR + implementeringsplan
- Skriv ADR-006 med beslutning og begrunnelse
- Implementeringsplan: DB-migrering, backend, frontend, skills

## Hvem gjør hva
- Steg 1-2: Kan gjøres av Claude med DB-tilgang og fillesing
- Steg 3-4: Drøftes med bruker (sjekkpunkt)
- Steg 5: Claude med DB-tilgang
- Steg 6: Claude skriver, bruker godkjenner

## Avhengigheter
- Krever tilgang til historiske analyser i DB for validering
- Bør gjøres FØR API-pipeline-forbedringer implementeres
