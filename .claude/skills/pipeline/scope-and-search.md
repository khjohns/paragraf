---
name: pipeline:scope-and-search
description: Scoping av problemstilling + søk etter kandidater. For ny analyse fra scratch.
user-invocable: false
---

# Scoping & Søk — Subagent

## Input
`analysis_id` (eller "ny"), `problem_statement`

## Steg

1. Opprett/oppdater analyse via MCP SQL
2. Analyser problemstillingen med scoping-prompten (les `backend/scoping.py` linje 73-138)
3. Verifiser bestemmelser: `python scripts/pipeline-context.py case-text` (sjekk at section_id finnes i lovdata_sections via MCP SQL)
4. Lagre scoping-resultat via MCP SQL: `UPDATE analyses SET seeds = ?, scoping_result = ?`
5. Kjør søk — tre typer via MCP SQL:
   - Ref: `SELECT DISTINCT sak_nr FROM kofa_law_references WHERE law_section = ?`
   - FTS: `SELECT * FROM search_kofa_decision_text(?, 30)`
   - Vektor: `SELECT * FROM search_kofa_decision_text(?, 30)`
6. Hent metadata: `SELECT sak_nr, avgjoerelse, saken_gjelder, avsluttet FROM kofa_cases WHERE sak_nr IN (?)`
7. Lagre kandidater via MCP SQL: `INSERT INTO analysis_candidates`
8. Oppdater: `UPDATE analyses SET status = 'candidates_ready'`

Merk: Søk krever MCP SQL (RPC-funksjoner). CLI brukes for verifisering og kontekst etterpå.

## Prompt

Bruk eksakt system-prompt fra `backend/scoping.py` (SCOPING_SYSTEM_PROMPT, linje 73-138). Les filen.
User-melding: `{problem_statement}`

## Dry-run
Vis scoping-resultat og søketreff uten å opprette analyse.
