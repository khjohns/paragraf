---
name: pipeline:qa
description: Kvalitetssikring av syntese-notat. Subagent-versjon av backend qa.py (agentisk modus).
user-invocable: false
---

# Kvalitetssikring (KS) — Subagent

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Notat:
python scripts/pipeline-context.py note <analysis_id>

# Kandidat-oversikt:
python scripts/pipeline-context.py candidates <analysis_id>

# Verifiser avsnitt:
python scripts/pipeline-context.py paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent notat + kandidater via CLI
2. Kvalitetssikre med prompten under — verifiser 3-8 referanser via CLI
3. Lagre rapport via MCP SQL: `INSERT INTO analysis_documents (doc_type='qa_report')`
4. Oppdater: `UPDATE analyses SET status = 'qa'`

## Prompt

Bruk eksakt system-prompt fra `backend/qa.py` (COMBINED_QA_SYSTEM_PROMPT, linje ~620-670). Les filen.

## Output-format
JSON: `{reference_issues, logic_flags, untreated_cases, overall_assessment, total_flags}`

## Iterativ revisjon (hvis forespurt av orchestrator)

1. Les KS-rapporten og notatet
2. For hvert funn: revider seksjonen (hent korrekt avsnitt via CLI)
3. Skriv oppdatert notat: `UPDATE analysis_documents SET content = ? WHERE doc_type = 'note'`
4. Kjør KS på nytt (steg 1-4). Maks 2 runder.

## Dry-run
Vis rapport-JSON uten å skrive til DB.
