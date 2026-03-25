---
name: pipeline:scope-and-search
description: Scoping av problemstilling + søk etter kandidater. For ny analyse fra scratch.
user-invocable: false
---

# Scoping & Søk — Subagent

## Input
`analysis_id` (eller "ny"), `problem_statement`

## Steg

1. Opprett analyse via CLI:
   ```bash
   echo '<problemstilling>' | bash scripts/pipeline-cli.sh create-analysis "<tittel>"
   # Returnerer analyse-ID (UUID)
   ```
2. Analyser problemstillingen med scoping-prompten (les `backend/scoping.py` linje 73-138)
3. Verifiser bestemmelser via CLI:
   `bash scripts/pipeline-cli.sh verify-provision foa:16-11`
   Returnerer verified=true/false + tittel + utdrag (500 tegn).
4. Lagre scoping-resultat via CLI:
   ```bash
   echo '<json>' | bash scripts/pipeline-cli.sh save-scoping <id>
   ```
   JSON-strukturen følger kolonner `problem`, `refined_problem`, `sub_problems`, `context` — IKKE `seeds` eller `problem_statement`.
5. Kjør søk — tre typer via CLI:
   - Ref: `bash scripts/pipeline-cli.sh ref-search 16-11 50`
     Bruker LIKE for ledd-varianter (16-11 matcher 16-11 OG 16-11 (1)).
     NB: section_id er UTEN `§`-prefix.
   - FTS: `bash scripts/pipeline-cli.sh fts-search "konsortium" 30`
   - Vektor: `bash scripts/pipeline-cli.sh vector-search "<query>" 30`
     Krever GOOGLE_API_KEY. Hybrid Gemini-embedding + FTS.
6. Sammenslå søkeresultater via `merge-search-results`:
   ```bash
   echo '{"ref":{"16-11":["2023/123"]}, "fts":{"konsortium":["2023/123","2024/456"]}, "vec":{"2023/123":0.78}}' \
     | bash scripts/pipeline-cli.sh merge-search-results \
     | bash scripts/pipeline-cli.sh save-candidates <id>
   ```
   Bygger ADR-006-korrekte signals med discovery_rank automatisk.
   Input-format: `ref` = {section_id: [sak_nr]}, `fts` = {term: [sak_nr]}, `vec` = {sak_nr: sim_score}.
7. Oppdater status via CLI:
   ```bash
   bash scripts/pipeline-cli.sh update-status <id> candidates_ready
   ```

## Prompt

Bruk eksakt system-prompt fra `backend/scoping.py` (SCOPING_SYSTEM_PROMPT, linje 73-138). Les filen.
User-melding: `{problem_statement}`

## Dry-run
Vis scoping-resultat og søketreff uten å opprette analyse.
