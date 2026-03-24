---
name: pipeline:synthesize
description: Generer syntese-notat. Subagent-versjon av backend synthesis.py.
user-invocable: false
---

# Syntese — Subagent

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Analyse-kontekst:
bash scripts/pipeline-cli.sh context <analysis_id>

# Alle screening-resultater (capsule-format):
bash scripts/pipeline-cli.sh screening-results <analysis_id>

# Rettssetninger (hvis finnes):
bash scripts/pipeline-cli.sh propositions <analysis_id>

# Hent avsnitt ved behov under skriving:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent kontekst + screening-resultater + rettssetninger via CLI
2. Generer notat med prompten under (maks 5 avsnitt-oppslag via CLI)
3. Lagre via CLI:
   ```bash
   cat note.md | bash scripts/pipeline-cli.sh save-document <id> note
   ```
4. Oppdater status via CLI:
   ```bash
   bash scripts/pipeline-cli.sh update-status <id> synthesis
   ```

## Prompt

Bruk eksakt system-prompt fra `backend/synthesis.py` (SYNTHESIS_SYSTEM_PROMPT, linje 99-158). Les filen.

CLI-output er allerede formatert som XML — bruk direkte som user-melding. Se `backend/synthesis.py` linje 674-700 for meldingsstruktur.

## Output
Markdown-notat med seksjoner, `[JURISTENS VURDERING]`-markører, spenninger, dekningsvurdering.

## Dry-run
Vis markdown uten å skrive til DB.
