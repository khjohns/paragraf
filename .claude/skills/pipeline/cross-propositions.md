---
name: pipeline:cross-propositions
description: Kryssanalyse av rettssetninger på tvers av saker. Subagent-versjon av backend cross_propositions.py.
user-invocable: false
---

# Cross-Propositions — Subagent

## Input
`analysis_id`

## Steg

1. Hent kontekst fra `analyses` (problem_statement, scoping_result.sub_problems)
2. Hent screenede saker: `analysis_candidates WHERE ai_screening IS NOT NULL` — ekstraher proposition, factum, assessment, quotes, nuances per sak
3. Analyser med prompten under
4. Lagre rettssetninger: `INSERT INTO analysis_propositions` (per proposition)
5. Lagre komplett resultat: `INSERT INTO analysis_documents (doc_type='cross_propositions')`

## Prompt

Bruk eksakt system-prompt fra `backend/cross_propositions.py` (CROSS_PROPOSITIONS_SYSTEM_PROMPT, linje 89-139). Les filen.

User-melding: XML-formaterte `<case>`-elementer per sak (sak_nr, category, rettssetning, faktum, vurdering, sitater, nyanser) + analysis_context med problemstilling og delspørsmål.

Se `backend/cross_propositions.py` linje 182-204 for eksakt format.

## Output-format
JSON: `{propositions: [{id, theme, proposition, instances: [{caseId, paragraph, date, evolution, quote, suggested}], tension?}], themes: [string]}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
