---
name: pipeline:scope-and-search
description: Scoping av problemstilling + søk etter kandidater. For ny analyse fra scratch.
user-invocable: false
---

# Scoping & Søk — Subagent

## Input
`analysis_id` (eller "ny"), `problem_statement`

## Steg

1. Opprett/oppdater analyse via MCP SQL (INSERT/UPDATE — eneste MCP-bruk)
2. Analyser problemstillingen med scoping-prompten (les `backend/scoping.py` linje 73-138)
3. Verifiser bestemmelser via CLI:
   `bash scripts/pipeline-cli.sh verify-provision foa:16-11`
   Returnerer verified=true/false + tittel + utdrag (500 tegn).
4. Lagre scoping-resultat via MCP SQL: `UPDATE analyses SET refined_problem = ?, sub_problems = ?, context = ?, scoping_result = ?`
   (NB: kolonner er `problem`, `refined_problem`, `sub_problems`, `context` — IKKE `seeds` eller `problem_statement`)
5. Kjør søk — tre typer via CLI:
   - Ref: `bash scripts/pipeline-cli.sh ref-search 16-11 50`
     Bruker LIKE for ledd-varianter (16-11 matcher 16-11 OG 16-11 (1)).
     NB: section_id er UTEN `§`-prefix.
   - FTS: `bash scripts/pipeline-cli.sh fts-search "konsortium" 30`
   - Vektor: `bash scripts/pipeline-cli.sh vector-search "<query>" 30`
     Krever GOOGLE_API_KEY. Hybrid Gemini-embedding + FTS.
6. Sammenslå unike sak_nr fra alle søk. Beregn signals og kategori:
   - A = ref+fts+vector (3 signaltyper), B = 2 signaltyper, C = 1 signaltype
7. Lagre kandidater via MCP SQL: `INSERT INTO analysis_candidates`
8. Oppdater: `UPDATE analyses SET status = 'candidates_ready'`

Merk: CLI for all lesing, MCP SQL kun for skriving (INSERT/UPDATE).

## Prompt

Bruk eksakt system-prompt fra `backend/scoping.py` (SCOPING_SYSTEM_PROMPT, linje 73-138). Les filen.
User-melding: `{problem_statement}`

## Dry-run
Vis scoping-resultat og søketreff uten å opprette analyse.
