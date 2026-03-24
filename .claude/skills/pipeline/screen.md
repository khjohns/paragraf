---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Subagent-versjon av backend screening.py.
user-invocable: false
---

# Screening — Subagent

## Input
`analysis_id`, liste over `sak_nrs` (eller "alle uscreenede")

## Datahenting (bruk CLI, ikke MCP)

```bash
# Kontekst + avgjørelsestekst for én sak (ferdigformatert XML):
bash scripts/pipeline-cli.sh screening <analysis_id> <sak_nr>

# Alle kandidater med status:
bash scripts/pipeline-cli.sh candidates <analysis_id>

# Spesifikke avsnitt:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

Backend-secrets kreves: kjør via `source scripts/dev-backend.sh` eller sett SUPABASE_URL/KEY.

## Steg

1. Hent kandidater: `bash scripts/pipeline-cli.sh candidates <id>` — finn uscreenede
2. For hver sak: `bash scripts/pipeline-cli.sh screening <id> <sak_nr>` — gir kontekst + tekst
3. Analyser med prompten under
4. Lagre via MCP SQL: `UPDATE analysis_candidates SET ai_screening = ?, category = ?`
5. Rapporter: `✓ {sak_nr} — {relevance} {star ? '★' : ''} — {proposition kort}`

## Prompt

Bruk eksakt system-prompt fra `backend/screening.py` (SCREENING_SYSTEM_PROMPT, linje 73-139). Les filen.

CLI-output er allerede formatert som user-melding — legg til:
`Screen denne KOFA-avgjørelsen for relevans til problemstillingen over.`

## Output-format
JSON: `{factum, assessment, proposition, quotes: [{p, text}], nuances, relevance: A/B/C, relevance_reasoning, star: bool}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
