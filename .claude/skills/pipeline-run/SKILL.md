---
name: pipeline-run
description: Kjør analyse-pipeline med Claude Code subagenter. Samme prompts og DB-format som API-pipelinen. Null ekstra API-kostnad.
argument-hint: <analyse-id | "ny"> [steg] [--dry-run] [problemstilling]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Agent, AskUserQuestion
---

# Pipeline Runner

**Argumenter:** $ARGUMENTS — første=analyse-id (eller "ny"), andre=steg, `--dry-run` for tørrkjøring.

**Steg:** `scope` · `provisions` · `screen` · `verify` · `cross` · `synthesize` · `qa` · `adversarial-qa` · `all` · `from:<steg>`

**Full rekkefølge:** scope → provisions → screen → verify → cross → synthesize → qa

## Orkestrering

1. Parse argumenter. Hent kontekst: `bash scripts/pipeline-cli.sh context <id>`
2. Bestem startpunkt (ny → scope, eksisterende uten steg → neste logiske, spesifikt steg → bare det)
3. For hvert steg: les skill-filen fra `pipeline/`, dispatch subagent, oppdater status
4. **Etter hvert steg: vis oppsummering og spør brukeren** (fortsett/hopp/stopp)

| Steg | Skill-fil | Modell | Status etter |
|------|-----------|--------|--------------|
| scope | `pipeline/scope-and-search.md` | Sonnet | `candidates_ready` |
| provisions | `pipeline/screen-provisions.md` | Haiku | `candidates_ready` |
| screen | `pipeline/screen.md` (triage + full) | Haiku+Sonnet | `screening_complete` |
| verify | `pipeline/verify-citations.md` | Haiku | `screening_complete` |
| cross | `pipeline/cross-propositions.md` | Sonnet | `post_search` |
| synthesize | `pipeline/synthesize.md` | Opus | `synthesis` |
| qa | `pipeline/qa.md` (med iterativ revisjon) | Opus | `qa` |
| adversarial-qa | `pipeline/adversarial-qa.md` (agent teams) | Opus | `qa` |

`adversarial-qa` erstatter `synthesize` + `qa` med en agent teams-variant der synth-agent og ks-agent diskuterer notatet i sanntid. Krever `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

## Sjekkpunkter

Etter hvert steg, vis kort oppsummering (antall funn/saker/seksjoner) og spør:
- Etter provisions: «{N} bestemmelser kartlagt, {M} interaksjoner funnet. Fortsett?»
- Etter screen: «{A} kjernesaker, {B} støttesaker, {stars} gullkandidater. Fortsett?»
- Etter screen: **Kjør `/pipeline-analyst <id> --oppdater-metrikker`** — logg metrikker og vis presisjon/recall. Flagg triage false negatives.
- Etter qa: «{flags} funn ({high} alvorlige). Vil du at funnene fikses i notatet? [ja, alle high / ja, alle / nei]»

## Dry-run (--dry-run)

Kjør analyse, men erstatt INSERT/UPDATE med visning av SQL + resultat-JSON. Flagget propageres til subagenter.

## Viktig

- **All datahenting via CLI**: `bash scripts/pipeline-cli.sh <cmd> <args>` — token-effektivt, ferdigformatert
- **All skriving via CLI**: `bash scripts/pipeline-cli.sh save-* / update-status` — via stdin for JSON/content
- Eneste unntak: `create-analysis` (opprett ny analyse)
- Eksakt samme JSON-format som API-pipelinen
- Screening: Haiku-triage for discovery_rank=1 saker (ADR-006), Sonnet full-screening i parallelle batches
