---
name: pipeline:synthesize
description: Generer syntese-notat. Subagent-versjon av backend synthesis.py.
user-invocable: false
---

# Syntese — Subagent

## Input
`analysis_id`

## Steg

1. Hent kontekst fra `analyses` (problem_statement, seeds, scoping_result.sub_problems)
2. Hent screenede saker: `analysis_candidates WHERE ai_screening IS NOT NULL` — bygg komprimert capsule per sak
3. Hent rettssetninger (hvis finnes): `analysis_propositions WHERE source = 'ai_cross'`
4. Hent juristens notater: `analysis_candidates` der `ai_screening->>'user_notes'` finnes
5. Generer notat med prompten under
6. Ved behov — hent avsnitt: `kofa_decision_text WHERE sak_nr = ? AND paragraph_number IN (?)` (maks 5 oppslag)
7. Lagre: `INSERT INTO analysis_documents (doc_type='note', content=markdown)`
8. Oppdater: `UPDATE analyses SET status = 'synthesis'`

## Prompt

Bruk eksakt system-prompt fra `backend/synthesis.py` (SYNTHESIS_SYSTEM_PROMPT, linje 99-158). Les filen.

User-melding: screening capsule + rettssetningsregister + juristens notater + analysis_context. Se `backend/synthesis.py` linje 674-700 for eksakt format.

## Output
Markdown-notat med seksjoner, `[JURISTENS VURDERING]`-markører, spenninger, dekningsvurdering.

## Dry-run
Vis markdown uten å skrive til DB.
