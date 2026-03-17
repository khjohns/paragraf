# Sprint: Agentisk syntese (ADR-004 Fase 1)

**Dato:** 2026-03-17
**Kontekst:** Implementer agentisk syntese-loop med tool use (blocking, ingen streaming). Bygger på ferdig ADR-004 og eksisterende `synthesis.py`.

## Bakgrunn

Dagens syntese komprimerer all kontekst i ett API-kall med capsule-mønster (A=full, B=komprimert, C=minimal). Agentisk syntese lar Claude hente mer kontekst on-demand via tool use, uten å endre frontend.

ADR-004: `docs/adr/004-agentisk-syntese-med-tool-use-og-streaming.md` (546 linjer, komplett design).

## Scope: Kun Fase 1 (blocking loop)

- Agentisk loop med tool use i `synthesis.py`
- Ingen streaming, ingen frontend-endringer
- Brukeren ser fortsatt spinner — men får bedre syntese-kvalitet
- Fallback til enkelt-kall ved feil

## Oppgaver

### 1. Les oppdatert API-dokumentasjon

Før implementering, les disse for å verifisere ADR-004 sine antagelser:

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming

Sjekk spesielt:
- Er `strict: True` + `output_config.format.json_schema` fortsatt kompatibelt?
- Hvordan håndtere `stop_reason: "tool_use"` korrekt?
- Finnes det nye patterns for tool dispatch vi bør bruke?

### 2. Definer tools (`synthesis.py`)

Definer `SYNTHESIS_TOOLS` med:
- `fetch_case_paragraphs(sak_nr, paragraph_nrs?)` — hent avsnitt fra KOFA-sak
- `fetch_provision_cases(dok_id, section_id)` — hent saker som refererer til bestemmelse

Bruk `strict: True` på begge. Se ADR-004 §2 for skjemaer.

### 3. Implementer `_execute_tool()` dispatcher

Router tool-kall til eksisterende DB-funksjoner. `_fetch_case_text` i `screening.py` og lignende kan gjenbrukes.

### 4. Implementer agentisk loop (blocking)

Ny funksjon `generate_synthesis_agentic(analysis_id)` som:
1. Laster kontekst (capsules) — gjenbruk eksisterende `_load_synthesis_context`
2. Kjører while-loop med `client.messages.create()`
3. Håndterer `stop_reason == "tool_use"` → execute → append tool_result
4. Stopper ved `stop_reason == "end_turn"` eller maks 5 turns
5. Returnerer strukturert syntese-JSON

### 5. Integrer med eksisterende endpoint

Oppdater `generate_synthesis()` til å kalle agentisk loop. Behold enkelt-kall som fallback (try/except).

### 6. Logging og observability

- Bruk `CostTracker` for kumulativ kostnad gjennom agentisk loop
- Logg hvert tool-kall med `log_usage` (elapsed_ms, request-ID arves)
- Persist total kostnad via `increment_total_cost` RPC
- Lagre tool-use-historikk i `_llm_meta` (antall turns, tools brukt)
- Vurder om det er annet nyttig å logge i DB (f.eks. hvilke saker Claude hentet ekstra kontekst for)

### 7. Tester

Skriv integrasjonstester — ikke mer enn nødvendig:

| Test | Hva den verifiserer |
|------|---------------------|
| `test_synthesis_produces_note` | Syntese returnerer gyldig JSON med title/sections/tensions |
| `test_synthesis_persists_document` | Resultatet lagres i `analysis_documents` |
| `test_synthesis_tool_use_logged` | `_llm_meta` inkluderer tool-use-info (turns, tools) |
| `test_synthesis_cost_tracked` | `total_cost_usd` øker etter syntese |

Testene krever at screening allerede er kjørt — bruk session-scoped fixture som bygger på eksisterende `test_pipeline.py`.

## Eksisterende kode å lese

- `backend/synthesis.py` — dagens syntese (`generate_synthesis`, `_load_synthesis_context`, `_format_capsules`, `SYNTHESIS_SCHEMA`, `SYNTHESIS_SYSTEM_PROMPT`)
- `backend/llm_utils.py` — `call_claude_structured`, `CostTracker`, `build_output_config`, `log_usage`
- `backend/screening.py` — `_fetch_case_text`, `_fetch_case_texts_batch` (gjenbrukbare for tools)
- `backend/app.py` — syntese-endpoint (for å se hvordan det kalles)
- `docs/adr/004-agentisk-syntese-med-tool-use-og-streaming.md` — komplett design

## Bruk av codegrasp

```
mcp__codegrasp__reindex                    # Oppdater indeksen
mcp__codegrasp__get_session_context        # Hent observasjoner (8 stk per 2026-03-17)
```

Nøkkelobservasjoner fra forrige sesjon:
- #7: LLM observability — `_llm_meta`-struktur, quote verification linking, cost tracking
- #8: Backend logging — request-ID, elapsed_ms, compact format
- #6: `_llm_meta` struktur, cache-format, thinking (fra pipeline-tester)

## Viktige designbeslutninger (fra ADR-004)

- Maks 5 tool-turns (kostnadsbegrensning)
- `strict: True` på tools (garanterer validerte inputs)
- `ephemeral` cache på system-prompt (90% rabatt på påfølgende turns)
- Fallback til enkelt-kall ved feil
- Sonnet 4.6 for syntese (støtter effort + structured output + tools)
