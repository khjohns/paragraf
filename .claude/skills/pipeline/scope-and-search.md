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
3. Verifiser bestemmelser mot lovdata_sections via MCP SQL:
   `SELECT content, title FROM lovdata_sections WHERE dok_id = ? AND section_id = ? LIMIT 1`
   Alias-mapping: `foa` → `forskrift/2016-08-12-974`, `loa` → `lov/2016-06-17-73` (se `backend/provisions.py`)
4. Lagre scoping-resultat via MCP SQL: `UPDATE analyses SET refined_problem = ?, sub_problems = ?, context = ?, scoping_result = ?`
   (NB: kolonner er `problem`, `refined_problem`, `sub_problems`, `context` — IKKE `seeds` eller `problem_statement`)
5. Kjør søk — tre typer via MCP SQL:
   - Ref: `SELECT DISTINCT sak_nr FROM kofa_law_references WHERE law_section LIKE '<section_id>%'`
     (LIKE med `%` for å fange ledd-varianter, f.eks. `16-11` matcher `16-11` OG `16-11 (1)`)
     NB: `law_section` er UTEN `§`-prefix (bruk `16-11`, ikke `§ 16-11`)
   - FTS: `SELECT * FROM search_kofa_decision_text(?, 30)`
   - Vektor: `python scripts/pipeline-context.py vector-search "<query>" 30` (hybrid Gemini-embedding + FTS)
     Krever GOOGLE_API_KEY. Returnerer sak_nr med similarity-score.
6. Hent metadata: `SELECT sak_nr, avgjoerelse, saken_gjelder, avsluttet FROM kofa_cases WHERE sak_nr = ANY(ARRAY[...])`
7. Lagre kandidater via MCP SQL: `INSERT INTO analysis_candidates`
   Kategori: A = ref+fts (begge signaltyper), B = ref eller fts (én signaltype med 2+ treff), C = enkelt treff
8. Oppdater: `UPDATE analyses SET status = 'candidates_ready'`

Merk: Søk krever MCP SQL (RPC-funksjoner). CLI brukes for verifisering og kontekst etterpå.

## Prompt

Bruk eksakt system-prompt fra `backend/scoping.py` (SCOPING_SYSTEM_PROMPT, linje 73-138). Les filen.
User-melding: `{problem_statement}`

## Dry-run
Vis scoping-resultat og søketreff uten å opprette analyse.
