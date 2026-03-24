---
name: pipeline:scope-and-search
description: Scoping av problemstilling + søk etter kandidater. For ny analyse fra scratch.
user-invocable: false
---

# Scoping & Søk — Subagent

## Input
`analysis_id` (eller "ny"), `problem_statement`

## Steg

1. Opprett analyse (hvis ny): `INSERT INTO analyses` med problem_statement, status='scoping'
2. Analyser problemstillingen med scoping-prompten under
3. Verifiser bestemmelser mot `lovdata_sections` (sjekk at section_id finnes)
4. Lagre scoping-resultat: `UPDATE analyses SET seeds = ?, scoping_result = ?, status = 'searching'`
5. Kjør tre søketyper:
   - **Referansetabell:** `kofa_law_references WHERE law_section = ?` per bestemmelse
   - **Fulltekstsøk:** `search_kofa_decision_text(term, 30)` per FTS-term
   - **Vektorsøk:** `search_kofa_decision_text(vector_query, 30)`
6. Slå sammen, hent metadata fra `kofa_cases`, lagre: `INSERT INTO analysis_candidates`
7. Oppdater: `UPDATE analyses SET status = 'candidates_ready'`

## Prompt

Bruk eksakt system-prompt fra `backend/scoping.py` (SCOPING_SYSTEM_PROMPT, linje 73-138). Les filen.

User-melding: `{problem_statement}`

## Output
Scoping: `{refined_problem, sub_problems, context, provisions, search_strategy, reasoning}`
Søk: kandidater lagret i DB med signals per sak.

## Dry-run
Vis scoping-resultat og søketreff uten å opprette analyse eller lagre kandidater.
