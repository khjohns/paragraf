---
name: pipeline:run
description: Kjør analyse-pipeline med Claude Code subagenter. Samme prompts og DB-format som API-pipelinen. Null ekstra API-kostnad.
user_invocable: true
---

# Pipeline Runner

Kjører hele eller deler av Paragraf analyse-pipelinen med Claude Code subagenter i stedet for Anthropic API. Resultater lagres i samme DB-tabeller som API-pipelinen — frontend ser ingen forskjell.

## Bruk

```
/pipeline:run <analyse-id> [steg]
```

Steg (valgfritt — uten argument kjøres alt fra screening):
- `screen` — Screen alle uscreenede saker
- `cross` — Kryssanalyse av rettssetninger
- `synthesize` — Generer notat
- `qa` — Kvalitetssikring av notat
- `all` — Alt over i rekkefølge (default)

## Forutsetninger

- Analysen må ha kandidater (status >= `candidates_ready`)
- Supabase MCP må være tilgjengelig
- For `synthesize`: screening må være ferdig
- For `qa`: syntese-notat må finnes

## Orkestrering

Parse argumentene. Hent analyse-kontekst:

```sql
SELECT id, problem_statement, seeds, status, scoping_result
FROM analyses WHERE id = '<analyse-id>';
```

Kjør stegene sekvensielt. For hvert steg, følg instruksjonene i den tilhørende skill-filen:

1. **screen** → Les `pipeline/screen.md`, dispatch én subagent per sak (eller grupper av 3-5)
2. **cross** → Les `pipeline/cross-propositions.md`, dispatch én subagent
3. **synthesize** → Les `pipeline/synthesize.md`, dispatch én subagent
4. **qa** → Les `pipeline/qa.md`, dispatch én subagent

Etter hvert steg, oppdater `analyses.status`:
- Etter screening: `screening_complete`
- Etter cross: `post_search`
- Etter syntese: `synthesis`
- Etter QA: `qa`

```sql
UPDATE analyses SET status = '<ny_status>' WHERE id = '<analyse-id>';
```

## Viktig

- Bruk `mcp__claude_ai_Supabase__execute_sql` for alle DB-operasjoner
- Supabase project_id: `iyetsvrteyzpirygxenu`
- Skriv resultater i **eksakt** samme JSON-format som API-pipelinen
- Ikke hopp over steg — hvert steg bygger på forrige
