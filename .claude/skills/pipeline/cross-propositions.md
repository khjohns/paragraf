---
name: pipeline:cross-propositions
description: Kryssanalyse av rettssetninger på tvers av saker. Subagent-versjon av backend cross_propositions.py.
user-invocable: false
---

# Cross-Propositions — Subagent

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Alle screening-resultater (ferdigformatert XML med rettssetninger, sitater):
bash scripts/pipeline-cli.sh screening-results <analysis_id>

# Analyse-kontekst:
bash scripts/pipeline-cli.sh context <analysis_id>
```

## Steg

1. Hent screening-resultater + kontekst via CLI
2. Analyser med prompten under
3. Lagre via CLI:
   ```bash
   echo '<json>' | bash scripts/pipeline-cli.sh save-document <id> cross_propositions
   ```

## Prompt

Bruk eksakt system-prompt fra `backend/cross_propositions.py` (CROSS_PROPOSITIONS_SYSTEM_PROMPT, linje 89-139). Les filen.

CLI-output er allerede XML-formatert — bruk direkte. Legg til:
`Analyser rettssetningene tverrgående. Grupper tematisk, spor utvikling over tid, og identifiser spenninger mellom rettssetninger.`

## Output-format
JSON: `{propositions: [{id, theme, proposition, instances: [{caseId, paragraph, date, evolution, quote, suggested}], tension?}], themes: [string]}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
