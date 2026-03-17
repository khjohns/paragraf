# Sprint: LLM observability og DB-lagring

**Dato:** 2026-03-17
**Kontekst:** Oppfølging av pipeline-integrasjonstester. `_llm_meta` lagres nå i `ai_screening` for screening-kall, men flere hull gjenstår.

## Bakgrunn

Pipeline-testene (14/14 grønne) avdekket:
1. Adaptive thinking ER aktiv — `thinking_summary` fanges fra response-blokker
2. `usage.thinking_tokens` eksisterer ikke i SDK — feltet er fjernet, erstattet av `has_thinking` + `thinking_summary`
3. Citation QA (Haiku) lagrer resultater men ikke sin egen `_llm_meta`
4. Ingen kumulativ kostnadsrapport per analyse
5. `quote_verification` og `quotes` er i separate arrays — krever manuell join på paragraph-nummer

## Oppgaver

### 1. Citation QA `_llm_meta` (backend/qa.py)

`_verify_citations_with_api` kaller Anthropic direkte (ikke via `call_claude_structured`). Resultatet lagres i `ai_screening.quote_verification` men uten modell/tokens/kostnad.

**Fix:** Fang usage fra `_verify_citations_with_api`-responsen og legg til i resultatet:
```python
result["_llm_meta"] = {
    "model": HAIKU_MODEL,
    "input_tokens": response.usage.input_tokens,
    "output_tokens": response.usage.output_tokens,
    "cost_usd": cost,
    "has_thinking": False,  # Haiku bruker ikke adaptive thinking
}
```

Lagre som `ai_screening.quote_verification_meta` eller som del av selve verification-responsen.

### 2. Kumulativ kostnad per analyse (analyses.total_cost_usd)

Legg til `total_cost_usd numeric DEFAULT 0` på `analyses`-tabellen. Oppdater inkrementelt:
- Etter scoping: `+= scoping_cost`
- Etter hver screening: `+= screening_cost` (fra `_llm_meta.cost_usd`)
- Etter citation QA: `+= qa_cost`
- Etter syntese: `+= synthesis_cost`

Alternativ: beregn on-demand fra `analysis_candidates.ai_screening._llm_meta.cost_usd` via SQL aggregering. Enklere, men treigere.

### 3. Koble quotes til verification direkte

Nåværende:
```json
{
  "quotes": [{"p": 45, "text": "..."}],
  "quote_verification": [{"paragraph": 45, "status": "verified"}]
}
```

Foreslått — legg `verification_status` direkte på hvert quote-objekt:
```json
{
  "quotes": [{"p": 45, "text": "...", "verification": {"status": "verified", "issue": null}}]
}
```

**Endring i `verify_screening_citations`:** Etter verifisering, oppdater hvert quote-objekt i `ai_screening.quotes` med match fra `quote_verification` basert på paragraph-nummer, i stedet for å legge til separat array.

### 4. Citation QA summary i analyses

Lagre aggregert citation-status på analyse-nivå:
```sql
ALTER TABLE analyses ADD COLUMN citation_summary jsonb;
-- Eksempel: {"total": 11, "verified": 9, "truncated": 1, "inaccurate": 1}
```

Settes av `verify_screening_citations` etter logging.

## Eksisterende kode å lese

- `backend/llm_utils.py` — `call_claude_structured`, `_extract_cache_tokens`, `log_usage`
- `backend/qa.py` — `verify_screening_citations`, `_verify_citations_with_api`
- `backend/screening.py` — `_persist_screening_result`
- `backend/tests/test_pipeline.py` — integrasjonstester (14 stk)

## Codegrasp-observasjoner

6 observasjoner lagret — bruk `get_session_context()` for å hente dem. Relevante:
- #5: Pipeline smoke test funn
- #6: _llm_meta og thinking-tokens

## ADR-004: Agentisk syntese

`docs/adr/004-agentisk-syntese-med-tool-use-og-streaming.md` — 546 linjer, komplett design. Implementeres separat etter observability-oppgavene. Fase 1 (agentisk loop uten streaming) er lavest risiko.
