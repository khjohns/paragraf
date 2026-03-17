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

## Tester

Eksisterende tester i `backend/tests/test_pipeline.py` (14 stk) må utvides. Kjør med:
```bash
cd backend && python -m pytest tests/test_pipeline.py -v -s  # Krever backend på :5002 med secrets
```

### Nye tester for denne sprinten

| Test | Hva den verifiserer |
|------|---------------------|
| `test_citation_qa_llm_meta` | `_llm_meta` (model=haiku, tokens, cost) lagret etter verify-citations |
| `test_cumulative_cost` | `analyses.total_cost_usd` oppdateres inkrementelt etter screening + QA |
| `test_quote_verification_linked` | Hvert quote-objekt i `ai_screening.quotes` har `verification.status` direkte (ikke separat array) |
| `test_citation_summary_on_analysis` | `analyses.citation_summary` inneholder aggregert status-fordeling |

### Oppdater eksisterende tester

- `test_verify_citations` — sjekk at responsen inkluderer `_llm_meta`
- `test_quote_verification_persisted` — sjekk at verification er på quote-objektet, ikke i separat array

## Eksisterende kode å lese

- `backend/llm_utils.py` — `call_claude_structured`, `_extract_cache_tokens`, `log_usage`
- `backend/qa.py` — `verify_screening_citations`, `_verify_citations_with_api`
- `backend/screening.py` — `_persist_screening_result`
- `backend/tests/test_pipeline.py` — integrasjonstester (14 stk)

## Bruk av codegrasp MCP

Codegrasp skal brukes aktivt — sparer tokens og bygger kumulativ kunnskap mellom sesjoner.

### Før du begynner

```
mcp__codegrasp__reindex                    # Oppdater indeksen
mcp__codegrasp__get_session_context        # Hent alle 6 observasjoner fra forrige sesjon
```

### Under arbeid

- **`get_skeleton(file_path)`** — Les filer uten implementasjonsdetaljer (70-90% token-reduksjon). Bruk dette FØR `Read` for å forstå struktur.
- **`get_context_capsule(symbol_fqns)`** — Hent relevant kode for et symbol med avhengigheter. Bedre enn å lese hele filer.
- **`get_session_context(symbol_fqns)`** — Sjekk observasjoner før du endrer en funksjon. Flagges som `stale` hvis koden er endret.
- **`get_impact_graph(symbol_fqn)`** — Se hva som påvirkes av en endring (NB: kun 9 edges, Python-imports fanges dårlig).

### Etter endringer

- **`save_observation`** — Dokumenter invarianter, subtile bugs, og design-valg. Lenk til symboler (`linked_symbols`) slik at de spores mot kodeendringer.
- **`get_diff_impact`** — Kjør etter endringer for å se påvirkede symboler.
- **`find_dead_code`** — Identifiser ubrukt kode etter refaktorering.

### Eksisterende observasjoner (6 stk)

| # | Tema | Nøkkelsymboler |
|---|------|----------------|
| 1 | `persist_candidates` upsert-invariant | `analyses.py::persist_candidates` |
| 2 | To traversal-endepunkter (gammel bør fjernes) | `app.py::traverse`, `app.py::traverse_analysis_route` |
| 3 | Adaptive thinking + Haiku-begrensning | `llm_utils.py::call_claude_structured` |
| 4 | `screeningStarted` hydration-begrensning | `screening.svelte.ts::ScreeningState` |
| 5 | Pipeline smoke test (14/14) — seed-format, SSE, upsert | `traversal.py`, `screening.py`, `qa.py` |
| 6 | `_llm_meta` struktur, cache-format, thinking | `llm_utils.py::call_claude_structured` |

### Vurdering av verktøyene

| Verktøy | Nytte | Bruk når |
|---------|-------|----------|
| `get_skeleton` | **Høy** — 70-90% token-sparing | Forstå fil-struktur uten å lese alt |
| `save_observation` + `get_session_context` | **Høy** — overlever mellom sesjoner | Kommunisere invarianter og subtile bugs |
| `get_context_capsule` | **Middels** — avhenger av edge-graf | Hente kode med kontekst |
| `find_dead_code` | **Middels** — mange false positives (Flask-ruter) | Opprydding etter refaktorering |
| `get_diff_impact` / `search_logic_flow` | **Lav** — sparsom edge-graf (9 edges) | Begrenset verdi foreløpig |

## ADR-004: Agentisk syntese

`docs/adr/004-agentisk-syntese-med-tool-use-og-streaming.md` — 546 linjer, komplett design. Implementeres separat etter observability-oppgavene. Fase 1 (agentisk loop uten streaming) er lavest risiko.
