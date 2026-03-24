---
name: pipeline:verify-citations
description: Verifiser sitater fra screening mot kildetekst. Subagent-versjon av backend qa.py citation QA.
user-invocable: false
---

# Sitatverifisering — Subagent

## Input
`analysis_id`

## Steg

1. Hent screenede saker med sitater: `analysis_candidates WHERE ai_screening->'quotes' IS NOT NULL`
2. For hver sak — hent originalavsnittene: `kofa_decision_text WHERE sak_nr = ? AND paragraph_number IN (?)`
3. Verifiser hvert sitat mot kildeteksten med prompten under
4. Lagre: oppdater `ai_screening` med `quote_verification`-array per sak
5. Oppdater `analyses.citation_summary` med teller

## Prompt

Bruk eksakt system-prompt fra `backend/qa.py` (CITATION_QA_SYSTEM_PROMPT, linje 164-178). Les filen.

User-melding per batch (3-5 saker): kildetekst + sitater å verifisere.

## Output per sitat
`{sak_nr, paragraph, status: verified|truncated|inaccurate|not_found, issue: string|null}`

## Dry-run
Vis verifiseringsresultater uten å oppdatere `ai_screening`.
