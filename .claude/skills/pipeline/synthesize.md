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
python scripts/pipeline-context.py context <analysis_id>

# Alle screening-resultater (capsule-format):
python scripts/pipeline-context.py screening-results <analysis_id>

# Rettssetninger (hvis finnes):
python scripts/pipeline-context.py propositions <analysis_id>

# Hent avsnitt ved behov under skriving:
python scripts/pipeline-context.py paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent kontekst + screening-resultater + rettssetninger via CLI
2. Generer notat med prompten under (maks 5 avsnitt-oppslag via CLI)
3. Lagre via MCP SQL: `INSERT INTO analysis_documents (doc_type='note', content=markdown)`
4. Oppdater status: `UPDATE analyses SET status = 'synthesis'`

## Prompt

Bruk eksakt system-prompt fra `backend/synthesis.py` (SYNTHESIS_SYSTEM_PROMPT, linje 99-158). Les filen.

CLI-output er allerede formatert som XML — bruk direkte som user-melding. Se `backend/synthesis.py` linje 674-700 for meldingsstruktur.

## Output
Markdown-notat med seksjoner, `[JURISTENS VURDERING]`-markører, spenninger, dekningsvurdering.

## Dry-run
Vis markdown uten å skrive til DB.
