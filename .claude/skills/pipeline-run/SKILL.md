---
name: pipeline-run
description: Kjør analyse-pipeline med Claude Code subagenter. Samme prompts og DB-format som API-pipelinen. Null ekstra API-kostnad.
argument-hint: <analyse-id | "ny"> [steg] [--dry-run] [problemstilling]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Agent, AskUserQuestion
---

# Pipeline Runner

**Argumenter:** $ARGUMENTS — første=analyse-id (eller "ny"), andre=steg, `--dry-run` for tørrkjøring.

**Steg:** `scope` · `screen` · `verify` · `cross` · `synthesize` · `qa` · `all` · `from:<steg>`

**Full rekkefølge:** scope → screen → verify → cross → synthesize → qa

## Orkestrering

1. Parse argumenter. Hent kontekst: `SELECT id, problem_statement, seeds, status FROM analyses WHERE id = '<id>'`
2. Bestem startpunkt (ny → scope, eksisterende uten steg → neste logiske, spesifikt steg → bare det)
3. For hvert steg: les skill-filen fra `pipeline/`, dispatch subagent, oppdater status
4. **Etter hvert steg: vis oppsummering og spør brukeren** (fortsett/hopp/stopp)

| Steg | Skill-fil | Status etter |
|------|-----------|--------------|
| scope | `pipeline/scope-and-search.md` | `candidates_ready` |
| screen | `pipeline/screen.md` (1 per sak) | `screening_complete` |
| verify | `pipeline/verify-citations.md` | `screening_complete` |
| cross | `pipeline/cross-propositions.md` | `post_search` |
| synthesize | `pipeline/synthesize.md` | `synthesis` |
| qa | `pipeline/qa.md` (med iterativ revisjon) | `qa` |

## Sjekkpunkter

Etter hvert steg, vis kort oppsummering (antall funn/saker/seksjoner) og spør:
- Etter screen: «{A} A-saker, {B} B, {stars} gullkandidater. Fortsett?»
- Etter qa: «{flags} funn ({high} alvorlige). Vil du at funnene fikses i notatet? [ja, alle high / ja, alle / nei]»

## Dry-run (--dry-run)

Kjør analyse, men erstatt INSERT/UPDATE med visning av SQL + resultat-JSON. Flagget propageres til subagenter.

## Viktig

- Supabase project_id: `iyetsvrteyzpirygxenu`
- Eksakt samme JSON-format som API-pipelinen
- Screening: én sak om gangen (sekvensielt)
