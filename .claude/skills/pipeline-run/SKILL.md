---
name: pipeline-run
description: Kjør analyse-pipeline med Claude Code subagenter. Samme prompts og DB-format som API-pipelinen. Null ekstra API-kostnad.
argument-hint: <analyse-id | "ny"> [steg] [--dry-run] [problemstilling]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Agent, AskUserQuestion
---

# Pipeline Runner

Kjører hele eller deler av Paragraf analyse-pipelinen med Claude Code subagenter i stedet for Anthropic API. Resultater lagres i samme DB-tabeller som API-pipelinen — frontend ser ingen forskjell.

**Argumenter:** $ARGUMENTS

Parse: første argument er analyse-id (eller "ny"), andre er steg (valgfritt), `--dry-run` for tørrkjøring, resten er problemstilling (hvis ny).

**Eksempler:**

```
/pipeline-run ny "Må forpliktelseserklæring foreligge ved tilbudsfrist?"
/pipeline-run 0dccaab9... all
/pipeline-run 0dccaab9... cross
/pipeline-run 0dccaab9... qa
/pipeline-run 0dccaab9... synthesize --dry-run
```

**Steg:**
- `scope` — Scoping + søk (krever problemstilling)
- `screen` — Screen alle uscreenede saker
- `verify` — Verifiser sitater fra screening
- `cross` — Kryssanalyse av rettssetninger
- `synthesize` — Generer notat
- `qa` — Kvalitetssikring av notat
- `all` — Alt fra scope (ny analyse) eller screen (eksisterende) og nedover
- `from:screen` / `from:cross` / `from:synthesize` / `from:qa` — Kjør fra og med dette steget

## Full pipeline-rekkefølge

```
scope → screen → verify → cross → synthesize → qa
```

## Tørrkjøring (--dry-run)

Når `--dry-run` er satt:
- Kjør all analyse som normalt (les fra DB, generer resultater)
- **Ikke skriv til DB** — vis SQL og resultat-JSON til brukeren i stedet
- Marker tydelig: `[DRY RUN] Ville skrevet til analysis_candidates: {...}`
- Nyttig for prompt-tuning og verifisering uten å påvirke data

Implementering: Gi dry-run-flagget videre til hver subagent. Subagentene viser SQL + data i stedet for å kjøre INSERT/UPDATE.

## Orkestrering

Parse argumentene. Bestem startpunkt:

- Hvis `ny` + problemstilling → start fra `scope`
- Hvis analyse-id uten steg → sjekk status, start fra neste logiske steg
- Hvis analyse-id + spesifikt steg → kjør bare det steget

Hent analyse-kontekst:

```sql
SELECT id, problem_statement, seeds, status, scoping_result
FROM analyses WHERE id = '<analyse-id>';
```

Kjør stegene sekvensielt. For hvert steg:

1. Les den tilhørende skill-filen og følg instruksjonene
2. **Etter steget er ferdig: vis oppsummering og spør brukeren** (se Interaktive sjekkpunkter)

| # | Steg | Skill-fil | Subagenter | Status etter |
|---|------|-----------|------------|--------------|
| 1 | scope | `pipeline/scope-and-search.md` | 1 | `candidates_ready` |
| 2 | screen | `pipeline/screen.md` | 1 per sak | `screening_complete` |
| 3 | verify | `pipeline/verify-citations.md` | 1 (batcher internt) | `screening_complete` |
| 4 | cross | `pipeline/cross-propositions.md` | 1 | `post_search` |
| 5 | synthesize | `pipeline/synthesize.md` | 1 | `synthesis` |
| 6 | qa | `pipeline/qa.md` | 1 (med iterativ revisjon) | `qa` |

## Interaktive sjekkpunkter

Etter **hvert steg**, vis en kort oppsummering og spør brukeren om de vil fortsette. Bruk `AskUserQuestion` (eller vis output og vent på svar).

**Etter scope:**
```
Scoping fullført:
  Presisert: {refined_problem}
  {N} bestemmelser, {M} søkeord
  → {total} kandidater funnet

Fortsett med screening? [ja/nei/juster]
```

**Etter screen:**
```
Screening fullført:
  {A_count} A-saker, {B_count} B-saker, {C_count} C-saker
  {star_count} gullkandidater
  Mest relevante: {topp 3 saker med proposition}

Fortsett med sitatverifisering? [ja/hopp til syntese/stopp]
```

**Etter verify:**
```
Sitatverifisering:
  {verified} verifisert, {truncated} trunkert, {inaccurate} unøyaktig

Fortsett med kryssanalyse? [ja/hopp til syntese/stopp]
```

**Etter cross:**
```
Kryssanalyse:
  {N} rettssetninger i {M} temaer
  {tension_count} spenninger identifisert

Fortsett med syntese? [ja/stopp]
```

**Etter synthesize:**
```
Syntese fullført:
  {section_count} seksjoner
  {lawyer_sections} krever juristens vurdering

Fortsett med kvalitetssikring? [ja/stopp]
```

**Etter qa:**
```
KS fullført:
  {total_flags} funn ({high} alvorlige, {medium} middels, {low} lave)

{Vis high-severity funn kort}

Vil du at KS-funnene fikses i notatet? [ja, alle high/ja, alle/nei]
```

Brukeren kan svare fritt — tolke intensjonen. «ja» = fortsett til neste steg. «stopp» = avslutt. «hopp til X» = hopp over mellomsteg.

## Viktig

- Bruk `mcp__claude_ai_Supabase__execute_sql` for alle DB-operasjoner
- Supabase project_id: `iyetsvrteyzpirygxenu`
- Skriv resultater i **eksakt** samme JSON-format som API-pipelinen
- Ikke hopp over steg — hvert steg bygger på forrige (med mindre brukeren eksplisitt ber om det)
- For screening: dispatch subagenter sekvensielt (én sak om gangen)
- Rapporter fremdrift etter hvert steg
- Ved `--dry-run`: aldri skriv til DB, vis alt til brukeren
