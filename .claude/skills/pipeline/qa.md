---
name: pipeline:qa
description: Kvalitetssikring av syntese-notat. Subagent-versjon av backend qa.py (agentisk modus).
user-invocable: false
---

# Kvalitetssikring (KS) — Subagent

## Input
`analysis_id`

## Steg

1. Hent notat: `analysis_documents WHERE doc_type = 'note'`
2. Hent screenede saker: `analysis_candidates WHERE ai_screening IS NOT NULL` — bygg oppsummering
3. Kvalitetssikre med prompten under — tre sjekker: referanser, logikk, dekning
4. Verifiser 3-8 referanser via `kofa_decision_text`-oppslag
5. Lagre rapport: `INSERT INTO analysis_documents (doc_type='qa_report')` med `total_flags`
6. Oppdater: `UPDATE analyses SET status = 'qa'`

## Prompt

Bruk eksakt system-prompt fra `backend/qa.py` (COMBINED_QA_SYSTEM_PROMPT, linje ~620-670). Les filen.

User-melding: notat + screenede saker-oppsummering + instruks om å slå opp avsnitt. Se `backend/qa.py` linje 684-699 for eksakt format.

## Output-format
JSON: `{reference_issues: [{sak_nr, paragraph, issue_type, description, severity}], logic_flags: [{type, location, description, severity, suggestion}], untreated_cases: [{sak_nr, category, proposition, justified_omission, reason}], overall_assessment, total_flags}`

## Iterativ revisjon (hvis forespurt av orchestrator)

1. Les KS-rapporten og notatet
2. For hvert funn brukeren vil fikse: revider aktuell seksjon i notatet (hent korrekt avsnitt via SQL om nødvendig)
3. Skriv oppdatert notat: `UPDATE analysis_documents SET content = ? WHERE doc_type = 'note'`
4. Kjør KS på nytt (steg 1-6). Maks 2 revisjonsrunder.

## Dry-run
Vis rapport-JSON uten å skrive til DB.
