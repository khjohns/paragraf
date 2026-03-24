---
name: pipeline:verify-citations
description: Verifiser sitater fra screening mot kildetekst. Subagent-versjon av backend qa.py citation QA.
user-invocable: false
---

# Sitatverifisering — Subagent

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Screening-resultater med sitater:
python scripts/pipeline-context.py screening-results <analysis_id>

# Hent originalavsnitt for verifisering:
python scripts/pipeline-context.py paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent screening-resultater via CLI — ekstraher alle sitater med avsnittsnumre
2. For hver sak: hent originalavsnittene via CLI
3. Verifiser hvert sitat mot kildeteksten med prompten under
4. Lagre via MCP SQL: oppdater `ai_screening` med `quote_verification`-array
5. Oppdater `analyses.citation_summary`

## Prompt

Bruk eksakt system-prompt fra `backend/qa.py` (CITATION_QA_SYSTEM_PROMPT, linje 164-178). Les filen.

## Output per sitat
`{sak_nr, paragraph, status: verified|truncated|inaccurate|not_found, issue: string|null}`

## Dry-run
Vis verifiseringsresultater uten å oppdatere DB.
