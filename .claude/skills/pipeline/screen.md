---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Subagent-versjon av backend screening.py.
user-invocable: false
---

# Screening — Subagent

## Input
`analysis_id`, liste over `sak_nrs` (eller "alle uscreenede")

## Steg

1. Hent kontekst fra `analyses` (problem_statement, scoping_result.sub_problems, seeds.provisions)
2. Finn uscreenede saker: `analysis_candidates WHERE ai_screening IS NULL`
3. For hver sak — hent avgjørelsestekst: `kofa_decision_text WHERE sak_nr = ? AND section = 'vurdering'`
4. Analyser med prompten under
5. Lagre: `UPDATE analysis_candidates SET ai_screening = ?, screening_status = 'complete', category = ?`
6. Lagre rettssetning: `INSERT INTO analysis_propositions (analysis_id, proposition_text, source_case, source, confirmed)`
7. Rapporter: `✓ {sak_nr} — {relevance} {star ? '★' : ''} — {proposition kort}`

## Prompt

Bruk eksakt system-prompt fra `backend/screening.py` (SCREENING_SYSTEM_PROMPT, linje 73-139). Les filen.

User-melding:
```
<case><sak_nr>{sak_nr}</sak_nr><avgjørelsestekst>{avsnitt}</avgjørelsestekst></case>
<analysis_context><problemstilling>{problem}</problemstilling><delspørsmål>{sub_problems}</delspørsmål><bestemmelser>{provisions}</bestemmelser></analysis_context>
Screen denne KOFA-avgjørelsen for relevans til problemstillingen over.
```

## Output-format
JSON: `{factum, assessment, proposition, quotes: [{p, text}], nuances, relevance: A/B/C, relevance_reasoning, star: bool}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
