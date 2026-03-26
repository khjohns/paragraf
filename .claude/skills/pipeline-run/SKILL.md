---
name: pipeline-run
description: Kjører analyse-pipeline med Claude Code subagenter. Orkestrerer scope→provisions→triage→screen→verify→cross→synthesize→qa med run-tracking (ADR-007).
argument-hint: <analyse-id | "ny"> [steg] [--dry-run] [problemstilling]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Agent, AskUserQuestion
---

# Pipeline Runner

**Argumenter:** $ARGUMENTS — første=analyse-id (eller "ny"), andre=steg, `--dry-run` for tørrkjøring.

**Steg:** `scope` · `provisions` · `triage` · `screen` · `verify` · `cross` · `synthesize` · `qa` · `adversarial-qa` · `all` · `from:<steg>`

**Full rekkefølge:** scope → provisions → triage → screen → verify → cross → synthesize → qa

## Run-tracking (ADR-007)

Hver pipeline-kjøring logges som en immutable run med steg-for-steg snapshots.

**Ved start:**
```bash
RUN_ID=$(bash scripts/pipeline-cli.sh start-run <analysis_id>)
```

**Etter hvert steg** — logg input/output som JSON:
```bash
echo '{"step_input":{...},"step_output":{...},"model_id":"claude-sonnet-4-6","duration_ms":1234}' \
  | bash scripts/pipeline-cli.sh log-step $RUN_ID <step_type>
```

**Ved avslutning:**
```bash
bash scripts/pipeline-cli.sh end-run $RUN_ID completed   # eller: failed | partial
```

Se `references/run-tracking.md` for detaljer om hva som logges per steg.

## Orkestrering

1. Parse argumenter. Hent kontekst: `bash scripts/pipeline-cli.sh context <id>`
2. **Start run:** `RUN_ID=$(bash scripts/pipeline-cli.sh start-run <id>)`
3. Bestem startpunkt (ny → scope, eksisterende uten steg → neste logiske, spesifikt steg → bare det)
4. For hvert steg:
   a. Noter starttidspunkt
   b. Les skill-filen fra `pipeline/`, dispatch subagent
   c. Logg steg: `echo '<json>' | bash scripts/pipeline-cli.sh log-step $RUN_ID <step_type>`
   d. Oppdater status
   e. **Vis oppsummering og spør brukeren** (fortsett/hopp/stopp)
5. **Lukk run:** `bash scripts/pipeline-cli.sh end-run $RUN_ID completed`

| Steg | Skill-fil | Modell | Status etter |
|------|-----------|--------|--------------|
| scope | `pipeline/scope-and-search.md` | Sonnet | `candidates_ready` |
| provisions | `pipeline/screen-provisions.md` | Haiku | `candidates_ready` |
| triage | `pipeline/triage.md` (ensemble + anførsler) | Haiku | `candidates_ready` |
| screen | `pipeline/screen.md` (full screening) | Sonnet | `screening_complete` |
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

Kjør analyse, men erstatt INSERT/UPDATE med visning av SQL + resultat-JSON. Run logges IKKE.

## Viktig

- **All datahenting via CLI**: `bash scripts/pipeline-cli.sh <cmd> <args>` — token-effektivt, ferdigformatert
- **All skriving via CLI**: `bash scripts/pipeline-cli.sh save-* / update-status / log-step` — via stdin for JSON/content
- Eneste unntak: `create-analysis` (opprett ny analyse)
- Eksakt samme JSON-format som API-pipelinen
- Screening: Haiku-triage for discovery_rank=1 saker (ADR-006), Sonnet full-screening i parallelle batches
- **Hvis run feiler:** `bash scripts/pipeline-cli.sh end-run $RUN_ID failed` — delvis loggede steg bevares
