---
name: pipeline-run
description: Kjør analyse-pipeline med Claude Code subagenter. Samme prompts og DB-format som API-pipelinen. Null ekstra API-kostnad.
argument-hint: <analyse-id | "ny"> [steg] [problemstilling]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Agent
---

# Pipeline Runner

Kjører hele eller deler av Paragraf analyse-pipelinen med Claude Code subagenter i stedet for Anthropic API. Resultater lagres i samme DB-tabeller som API-pipelinen — frontend ser ingen forskjell.

**Argumenter:** $ARGUMENTS

Parse: første argument er analyse-id (eller "ny"), andre er steg (valgfritt), resten er problemstilling (hvis ny).

**Eksempler:**

```
/pipeline-run ny "Må forpliktelseserklæring foreligge ved tilbudsfrist?"
/pipeline-run 0dccaab9... all
/pipeline-run 0dccaab9... cross
/pipeline-run 0dccaab9... qa
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

Kjør stegene sekvensielt. For hvert steg, les den tilhørende skill-filen og følg instruksjonene:

| # | Steg | Skill-fil | Subagenter | Status etter |
|---|------|-----------|------------|--------------|
| 1 | scope | `pipeline/scope-and-search.md` | 1 | `candidates_ready` |
| 2 | screen | `pipeline/screen.md` | 1 per sak (eller grupper av 3-5) | `screening_complete` |
| 3 | verify | `pipeline/verify-citations.md` | 1 (batcher internt) | `screening_complete` |
| 4 | cross | `pipeline/cross-propositions.md` | 1 | `post_search` |
| 5 | synthesize | `pipeline/synthesize.md` | 1 | `synthesis` |
| 6 | qa | `pipeline/qa.md` | 1 | `qa` |

Etter hvert steg:

```sql
UPDATE analyses SET status = '<ny_status>' WHERE id = '<analyse-id>';
```

## Viktig

- Bruk `mcp__claude_ai_Supabase__execute_sql` for alle DB-operasjoner
- Supabase project_id: `iyetsvrteyzpirygxenu`
- Skriv resultater i **eksakt** samme JSON-format som API-pipelinen
- Ikke hopp over steg — hvert steg bygger på forrige
- For screening: dispatch subagenter sekvensielt (én sak om gangen) for å unngå kontekstvindu-problemer
- Rapporter fremdrift etter hvert steg
