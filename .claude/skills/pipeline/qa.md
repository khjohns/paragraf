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
bash scripts/pipeline-cli.sh note <analysis_id>

# Kandidat-oversikt:
bash scripts/pipeline-cli.sh candidates <analysis_id>

# Verifiser avsnitt:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent notat + kandidater via CLI
2. Kvalitetssikre med prompten under — verifiser 3-8 referanser via CLI
3. Lagre rapport via CLI:
   ```bash
   echo '<qa_json>' | bash scripts/pipeline-cli.sh save-document <id> qa_report
   ```
4. Oppdater status via CLI:
   ```bash
   bash scripts/pipeline-cli.sh update-status <id> qa
   ```

## Prompt

Bruk eksakt system-prompt fra `backend/qa.py` (COMBINED_QA_SYSTEM_PROMPT, linje ~620-670). Les filen.

## Output-format
JSON: `{reference_issues, logic_flags, untreated_cases, overall_assessment, total_flags}`

## Iterativ revisjon (hvis forespurt av orchestrator)

1. Les KS-rapporten og notatet
2. For hvert funn: revider seksjonen (hent korrekt avsnitt via CLI)
3. Skriv oppdatert notat via CLI:
   ```bash
   cat revidert-notat.md | bash scripts/pipeline-cli.sh save-document <id> note
   ```
4. Kjør KS på nytt (steg 1-4). Maks 2 runder.

## Dry-run
Vis rapport-JSON uten å skrive til DB.
