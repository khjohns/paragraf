# Agentisk Syntese (ADR-004 Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-shot synthesis with an agentic tool-use loop that lets Claude fetch additional case paragraphs on-demand, improving synthesis quality without any frontend changes.

**Architecture:** A blocking while-loop in `synthesis.py` sends capsule-compressed context to Claude with tool definitions. When Claude calls a tool (e.g. to read specific case paragraphs), the backend executes the DB query and appends the result as a `tool_result` message. The loop continues until `stop_reason == "end_turn"` or max 5 turns. Structured output (`output_config`) guarantees valid JSON on the final turn. Existing `generate_synthesis()` wraps the agentic loop with a fallback to single-shot on error.

**Tech Stack:** Anthropic Python SDK (`client.messages.create`), Supabase (existing DB queries), `CostTracker` for cumulative cost logging.

**Key API facts (verified via context7):**
- `tools` + `output_config` are compatible in the same call
- `stop_reason == "tool_use"` signals Claude wants to call a tool
- Tool results are sent back as `{"type": "tool_result", "tool_use_id": ..., "content": ...}` in the user role
- `strict: True` on tools guarantees valid tool inputs matching the schema
- Prompt caching with `cache_control: {"type": "ephemeral"}` gives 90% discount on repeated system prompt across turns

**Existing code to read:**
- `backend/synthesis.py` — current synthesis (`generate_synthesis`, `_compress_screening_for_synthesis`, `SYNTHESIS_SCHEMA`, `SYNTHESIS_SYSTEM_PROMPT`)
- `backend/llm_utils.py` — `call_claude_structured`, `CostTracker`, `build_output_config`, `log_usage`, `get_anthropic_client`, `_extract_cache_tokens`, `_calculate_cost`
- `backend/screening.py` — `_fetch_case_text` (fetches paragraphs by section), `_fetch_case_texts_batch`
- `backend/provisions.py` — `_fetch_referencing_cases` (fetches cases referencing a provision)
- `backend/app.py:379-387` — synthesis endpoint
- `backend/tests/conftest.py` — test fixtures (`api`, `test_analysis`)
- `backend/tests/test_pipeline.py` — existing integration tests (pattern to follow)
- `docs/adr/004-agentisk-syntese-med-tool-use-og-streaming.md` — full design

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/synthesis.py` | Modify | Add `SYNTHESIS_TOOLS`, `_fetch_paragraphs`, `_execute_tool`, `_run_agentic_loop`, update `generate_synthesis` |
| `backend/llm_utils.py` | Modify | Extend `CostTracker.add` to pass `elapsed_ms` through to `log_usage` |
| `backend/app.py` | No change | Existing endpoint already calls `generate_synthesis()` — no wiring needed |
| `backend/tests/test_synthesis.py` | Create | Integration tests for synthesis (requires backend running + screened candidates) |

---

### Task 1: Define SYNTHESIS_TOOLS and update system prompt

**Files:**
- Modify: `backend/synthesis.py:1-20` (imports) and add constant after `SYNTHESIS_SYSTEM_PROMPT`

**Context:** `strict: True` requires all properties to be in `required` and all objects to have `additionalProperties: False`. For `paragraph_nrs` which is semantically optional, we use `"type": ["array", "null"]` and make it required — Claude sends `null` when it wants all paragraphs.

- [ ] **Step 1: Add SYNTHESIS_TOOLS constant**

Add after `SYNTHESIS_SYSTEM_PROMPT` (around line 139):

```python
SYNTHESIS_TOOLS = [
    {
        "name": "fetch_case_paragraphs",
        "description": (
            "Hent spesifikke avsnitt fra en KOFA-avgjørelse. Bruk dette når "
            "capsule-sammendraget ikke gir nok detaljer — f.eks. for å verifisere "
            "et juridisk poeng, sammenligne faktum, eller forstå nyanser i "
            "klagenemndas resonnement. Send null for paragraph_nrs for å "
            "hente alle avsnitt (maks 50)."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "sak_nr": {
                    "type": "string",
                    "description": "Saksnummer, f.eks. '2023/456'",
                },
                "paragraph_nrs": {
                    "type": ["array", "null"],
                    "items": {"type": "integer"},
                    "description": (
                        "Spesifikke avsnittsnumre å hente. "
                        "Null for å hente alle avsnitt (maks 50)."
                    ),
                },
            },
            "required": ["sak_nr", "paragraph_nrs"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fetch_provision_cases",
        "description": (
            "Hent liste over KOFA-saker som refererer til en spesifikk "
            "lovbestemmelse. Bruk for å sjekke om det finnes relevante saker "
            "du ikke har sett i capsule-dataene."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "dok_id": {
                    "type": "string",
                    "description": "Lovnavn/alias, f.eks. 'anskaffelsesforskriften'",
                },
                "section_id": {
                    "type": "string",
                    "description": "Paragraf-ID, f.eks. '§ 7-9'",
                },
            },
            "required": ["dok_id", "section_id"],
            "additionalProperties": False,
        },
    },
]

MAX_TOOL_TURNS = 5
```

- [ ] **Step 2: Update SYNTHESIS_SYSTEM_PROMPT with tool-use instructions**

Add a `<tools_guidance>` block before the closing `</formatting_rules>` tag in `SYNTHESIS_SYSTEM_PROMPT`:

```python
# Append to SYNTHESIS_SYSTEM_PROMPT, before </formatting_rules>:

<tools_guidance>
Du har tilgang til verktøy for å hente mer kontekst ved behov. Bruk dem sparsomt:
- Hent avsnitt kun når capsule-sammendraget mangler nyanser du trenger for analysen
- Prioriter B- og C-saker der du ser potensielt viktige poenger i komprimeringen
- Maks 3-5 tool-kall per syntese — start med det du har, hent kun det som mangler
</tools_guidance>
```

- [ ] **Step 3: Verify the constant is syntactically correct**

Run: `cd backend && python -c "from synthesis import SYNTHESIS_TOOLS, MAX_TOOL_TURNS; print(f'{len(SYNTHESIS_TOOLS)} tools, max {MAX_TOOL_TURNS} turns')"`
Expected: `2 tools, max 5 turns`

- [ ] **Step 4: Commit**

```bash
git add backend/synthesis.py
git commit -m "feat(synthesis): add tool definitions for agentic loop"
```

---

### Task 2: Implement tool dispatch helpers

**Files:**
- Modify: `backend/synthesis.py` — add `_fetch_paragraphs`, `_fetch_provision_cases_tool`, `_execute_tool`

**Context:** `_fetch_case_text` in `screening.py` fetches by section name. We need a new helper that fetches by paragraph number. For provisions, reuse `_fetch_referencing_cases` from `provisions.py`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_synthesis.py`:

```python
"""Synthesis integration tests — requires backend running on :5002.

Run with:
    cd backend && python -m pytest tests/test_synthesis.py -v -s

Requires:
    - Backend running on localhost:5002 (start with ./scripts/dev-backend.sh)
    - ANTHROPIC_API_KEY set
    - At least one analysis with screened candidates in Supabase
"""

import json
import pytest


class TestSynthesisToolDispatch:
    """Test the tool dispatch helpers directly via the synthesis endpoint."""

    def test_synthesis_produces_note(self, api, test_analysis):
        """Synthesis returns valid JSON with title/sections/tensions."""
        aid = test_analysis["id"]

        # Ensure we have screened candidates (pipeline tests run first)
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json().get("candidates", [])
        screened = [c for c in candidates if c.get("ai_screening")]
        if len(screened) < 2:
            pytest.skip("Need at least 2 screened candidates for synthesis")

        r = api.post(f"/api/analyses/{aid}/synthesize")
        assert r.status_code == 200, f"Synthesis failed: {r.text}"
        data = r.json()

        assert data.get("title"), "Missing title"
        assert len(data.get("sections", [])) >= 1, "No sections"
        assert "unresolved_tensions" in data, "Missing unresolved_tensions"
        assert "coverage_notes" in data, "Missing coverage_notes"
```

Run: `cd backend && python -m pytest tests/test_synthesis.py::TestSynthesisToolDispatch::test_synthesis_produces_note -v -s`
Expected: FAIL (test file doesn't exist yet until we create it, but synthesis may already work with single-shot — this test validates the shape, not the agentic behavior)

- [ ] **Step 2: Add `_fetch_paragraphs` helper**

Add to `backend/synthesis.py` after the constants:

```python
def _fetch_paragraphs(sak_nr: str, paragraph_nrs: list[int] | None) -> dict:
    """Fetch specific paragraphs from a KOFA decision. Tool handler.

    Returns {"sak_nr": ..., "paragraphs": [{"nr": int, "text": str}, ...]}.
    paragraph_nrs=None means all paragraphs (max 50).
    """
    client = get_client()
    q = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
        .limit(50)
    )
    if paragraph_nrs:
        q = q.in_("paragraph_number", paragraph_nrs)
    rows = q.execute().data or []
    return {
        "sak_nr": sak_nr,
        "paragraphs": [{"nr": r["paragraph_number"], "text": r["text"]} for r in rows],
    }
```

- [ ] **Step 3: Add `_fetch_provision_cases_tool` helper**

```python
def _fetch_provision_cases_tool(dok_id: str, section_id: str) -> dict:
    """Fetch cases referencing a provision. Tool handler.

    Returns {"dok_id": ..., "section_id": ..., "total": int, "cases": [...]}.
    Reuses _fetch_referencing_cases from provisions.py.
    """
    from provisions import _fetch_referencing_cases
    client = get_client()
    total, cases = _fetch_referencing_cases(client, dok_id, section_id)
    return {
        "dok_id": dok_id,
        "section_id": section_id,
        "total": total,
        "cases": cases,
    }
```

- [ ] **Step 4: Add `_execute_tool` dispatcher**

```python
def _execute_tool(name: str, tool_input: dict) -> dict:
    """Dispatch a tool call to the appropriate handler."""
    if name == "fetch_case_paragraphs":
        return _fetch_paragraphs(tool_input["sak_nr"], tool_input["paragraph_nrs"])
    elif name == "fetch_provision_cases":
        return _fetch_provision_cases_tool(tool_input["dok_id"], tool_input["section_id"])
    raise ValueError(f"Unknown tool: {name}")
```

- [ ] **Step 5: Verify imports work**

Run: `cd backend && python -c "from synthesis import _execute_tool; print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/synthesis.py backend/tests/test_synthesis.py
git commit -m "feat(synthesis): add tool dispatch helpers for agentic loop"
```

---

### Task 3: Implement the agentic loop

**Files:**
- Modify: `backend/synthesis.py` — add `_run_agentic_loop`

**Context:** The loop calls `client.messages.create()` repeatedly. Each turn either produces the final structured JSON (`stop_reason == "end_turn"`) or tool calls (`stop_reason == "tool_use"`). We track cost cumulatively with `CostTracker` and build `_llm_meta` with agentic-specific fields (turns, tools_called).

Important: `thinking={"type": "adaptive"}` is NOT used in the agentic loop — tool use + structured output + thinking in one call is complex and not needed. The tools provide the adaptivity.

- [ ] **Step 1: Add imports**

At the top of `backend/synthesis.py`, add:

```python
import json as json_module
import time

from llm_utils import (
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
    get_anthropic_client,
    build_output_config,
    log_usage,
    CostTracker,
    CLAUDE_MODEL,
)
```

Replace the existing import block. Keep `from db import get_client` and `from llm_cache import ...`.

- [ ] **Step 2: Extend `CostTracker.add` to accept `elapsed_ms`**

In `backend/llm_utils.py`, update `CostTracker.add` (line 194):

```python
def add(self, label: str, model: str, usage, is_batch: bool = False, elapsed_ms: int | None = None) -> float:
    """Log usage and track cost. Returns cost in USD."""
    cost = log_usage(usage, model, label, is_batch, elapsed_ms=elapsed_ms)
```

- [ ] **Step 3: Implement `_run_agentic_loop`**

Add after `_execute_tool`:

```python
def _run_agentic_loop(
    user_message: str,
    analysis_id: str,
) -> dict:
    """Run an agentic synthesis loop with tool use.

    Returns the structured synthesis result dict with _llm_meta.
    Raises SynthesisError on failure.
    """
    client = get_anthropic_client()
    messages = [{"role": "user", "content": user_message}]
    cost_tracker = CostTracker()
    tools_called = []
    t0 = time.monotonic()

    for turn in range(1, MAX_TOOL_TURNS + 1):
        t_turn = time.monotonic()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=12000,
            output_config=build_output_config(
                schema=SYNTHESIS_SCHEMA, effort="high", model=CLAUDE_MODEL,
            ),
            tools=SYNTHESIS_TOOLS,
            system=[{
                "type": "text",
                "text": SYNTHESIS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        )
        elapsed_turn = int((time.monotonic() - t_turn) * 1000)

        cost_tracker.add(
            f"Synthesis/{analysis_id}/turn-{turn}",
            CLAUDE_MODEL,
            response.usage,
            elapsed_ms=elapsed_turn,
        )

        # Append assistant response to message history
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            # Extract structured JSON from the last text block
            text = next(
                (b.text for b in response.content if hasattr(b, "text")),
                None,
            )
            if not text:
                raise SynthesisError("Agentisk loop ga ingen tekst-output")

            result = json_module.loads(text)

            # Build _llm_meta with agentic-specific info
            total_elapsed = int((time.monotonic() - t0) * 1000)
            result["_llm_meta"] = {
                "model": CLAUDE_MODEL,
                "total_turns": turn,
                "tools_called": tools_called,
                "cost_usd": round(cost_tracker.total_cost, 6),
                "elapsed_ms": total_elapsed,
                "agentic": True,
            }
            logger.info(
                "Agentic synthesis complete: %d turns, %d tool calls, $%.4f, %.1fs",
                turn, len(tools_called), cost_tracker.total_cost,
                total_elapsed / 1000,
            )
            return result

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info(
                        "Synthesis tool call: %s(%s)",
                        block.name,
                        json_module.dumps(block.input, ensure_ascii=False)[:200],
                    )
                    try:
                        result = _execute_tool(block.name, block.input)
                        content = json_module.dumps(result, ensure_ascii=False)
                    except Exception as e:
                        logger.error("Tool execution failed: %s", e)
                        content = json_module.dumps({"error": str(e)})

                    tools_called.append({
                        "turn": turn,
                        "tool": block.name,
                        "input": block.input,
                    })
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": content,
                    })

            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop_reason
        logger.warning("Unexpected stop_reason: %s", response.stop_reason)
        raise SynthesisError(f"Uventet stop_reason: {response.stop_reason}")

    # Exhausted max turns without end_turn
    raise SynthesisError(f"Agentisk loop nådde maks {MAX_TOOL_TURNS} turns uten sluttresultat")
```

- [ ] **Step 4: Verify syntax**

Run: `cd backend && python -c "from synthesis import _run_agentic_loop; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/synthesis.py backend/llm_utils.py
git commit -m "feat(synthesis): implement agentic tool-use loop"
```

---

### Task 4: Wire agentic loop into `generate_synthesis` with fallback

**Files:**
- Modify: `backend/synthesis.py:273-377` — update `generate_synthesis`

**Context:** The existing `generate_synthesis` builds the user message and calls `call_claude_structured`. We replace the LLM call with `_run_agentic_loop`, keeping single-shot as fallback. The user_message building, caching, and persistence logic stays the same.

- [ ] **Step 1: Update `generate_synthesis` to use agentic loop**

Replace the try/except block in `generate_synthesis` (lines ~348-359) with:

```python
    # Try agentic loop, fall back to single-shot on failure
    try:
        result = _run_agentic_loop(user_message, analysis_id)
    except Exception as e:
        logger.warning(
            "Agentic synthesis failed for %s, falling back to single-shot: %s",
            analysis_id, e,
        )
        try:
            result = call_claude_structured(
                system_prompt=SYNTHESIS_SYSTEM_PROMPT,
                user_message=user_message,
                schema=SYNTHESIS_SCHEMA,
                max_tokens=12000,
                effort="high",
                log_label=f"Synthesis fallback for {analysis_id}",
            )
        except Exception as e2:
            logger.error("Synthesis fallback also failed for %s: %s", analysis_id, e2)
            raise SynthesisError(f"Syntese feilet: {e2}") from e2
```

- [ ] **Step 2: Add cost tracking — increment `total_cost_usd` after synthesis**

After the `result["markdown"] = markdown` line and before `set_cached(...)`, add:

```python
    # Increment total_cost_usd on the analysis
    cost = (result.get("_llm_meta") or {}).get("cost_usd", 0)
    if cost:
        client.rpc("increment_total_cost", {
            "analysis_id_input": analysis_id,
            "cost_increment": cost,
        }).execute()
```

- [ ] **Step 3: Verify the endpoint still works (manual smoke test)**

Run: `cd backend && python -c "from synthesis import generate_synthesis; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/synthesis.py
git commit -m "feat(synthesis): wire agentic loop with single-shot fallback"
```

---

### Task 5: Integration tests

**Files:**
- Create: `backend/tests/test_synthesis.py`

**Context:** Tests run against live backend (like `test_pipeline.py`). They require screened candidates. The test_analysis fixture from conftest.py creates a fresh analysis — but synthesis needs screening to have run first. We reuse the session-scoped fixture, which means these tests must run AFTER the pipeline tests (traversal → screening).

- [ ] **Step 1: Write all synthesis tests**

Create `backend/tests/test_synthesis.py`:

```python
"""Synthesis integration tests — requires backend + screened candidates.

Run with:
    cd backend && python -m pytest tests/test_synthesis.py -v -s

Requires:
    - Backend running on localhost:5002
    - ANTHROPIC_API_KEY set
    - Pipeline tests (test_pipeline.py) should run first to create
      screened candidates via the session-scoped test_analysis fixture.
"""

import pytest


def _ensure_screened(api, analysis_id, min_screened=2):
    """Verify we have enough screened candidates, skip otherwise."""
    r = api.get(f"/api/analyses/{analysis_id}")
    candidates = r.json().get("candidates", [])
    screened = [c for c in candidates if c.get("ai_screening")]
    if len(screened) < min_screened:
        pytest.skip(f"Need {min_screened}+ screened candidates, have {len(screened)}")
    return screened


class TestSynthesis:
    def test_synthesis_produces_note(self, api, test_analysis):
        """Synthesis returns valid JSON with title/sections/tensions."""
        aid = test_analysis["id"]
        _ensure_screened(api, aid)

        r = api.post(f"/api/analyses/{aid}/synthesize")
        assert r.status_code == 200, f"Synthesis failed: {r.text}"
        data = r.json()

        assert data.get("title"), "Missing title"
        assert len(data.get("sections", [])) >= 1, "No sections"
        for section in data["sections"]:
            assert section.get("heading"), "Section missing heading"
            assert section.get("content"), "Section missing content"
            assert "requires_lawyer_input" in section
        assert "unresolved_tensions" in data
        assert "coverage_notes" in data

    def test_synthesis_persists_document(self, api, test_analysis):
        """Synthesis result is persisted as a document in analysis_documents."""
        aid = test_analysis["id"]

        r = api.get(f"/api/analyses/{aid}/documents")
        assert r.status_code == 200
        docs = r.json()

        # Find the note document
        note = next((d for d in docs if d.get("doc_type") == "note"), None)
        assert note is not None, f"No note document found. Docs: {[d.get('doc_type') for d in docs]}"
        assert len(note.get("content", "")) > 100, "Note content too short"

    def test_synthesis_llm_meta(self, api, test_analysis):
        """Synthesis response includes _llm_meta with agentic info."""
        aid = test_analysis["id"]
        _ensure_screened(api, aid)

        r = api.post(f"/api/analyses/{aid}/synthesize")
        assert r.status_code == 200
        data = r.json()

        meta = data.get("_llm_meta")
        assert meta is not None, f"Missing _llm_meta: {list(data.keys())}"
        assert meta.get("model"), "Missing model"
        assert meta.get("cost_usd", 0) > 0, "Missing cost_usd"
        assert meta.get("elapsed_ms", 0) > 0, "Missing elapsed_ms"

        # Agentic-specific fields (present if agentic path was used)
        if meta.get("agentic"):
            assert meta.get("total_turns", 0) >= 1, "total_turns should be >= 1"
            assert isinstance(meta.get("tools_called"), list), "tools_called should be a list"

    def test_synthesis_cost_tracked(self, api, test_analysis):
        """total_cost_usd should not decrease after synthesis.

        Note: If the synthesis result is cached, no LLM call is made and
        cost stays the same. The >= assertion handles both cases.
        """
        aid = test_analysis["id"]

        # Get cost before
        r = api.get(f"/api/analyses/{aid}")
        cost_before = r.json().get("total_cost_usd", 0)

        _ensure_screened(api, aid)
        r = api.post(f"/api/analyses/{aid}/synthesize")
        assert r.status_code == 200

        # Get cost after
        r = api.get(f"/api/analyses/{aid}")
        cost_after = r.json().get("total_cost_usd", 0)
        assert cost_after >= cost_before, (
            f"Cost should not decrease: {cost_before} -> {cost_after}"
        )
```

- [ ] **Step 2: Run the tests (expect pass if backend is running)**

Run: `cd backend && python -m pytest tests/test_synthesis.py -v -s`
Expected: All 4 tests PASS (assuming backend is running with screened candidates)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_synthesis.py
git commit -m "test(synthesis): add integration tests for agentic synthesis"
```

---

### Task 6: Run full pipeline test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all pipeline tests together**

Run: `cd backend && python -m pytest tests/ -v -s`
Expected: All existing tests pass + new synthesis tests pass

- [ ] **Step 2: Check backend logs for agentic loop output**

Look for log lines like:
```
Synthesis tool call: fetch_case_paragraphs({"sak_nr": "2024/1234", "paragraph_nrs": [27, 28]})
Synthesis/test-id/turn-1 [sonnet] — 10.2k in, 0.5k out — $0.0380
Synthesis/test-id/turn-2 [sonnet] — 13.1k in, 4.0k out — $0.0990
Agentic synthesis complete: 2 turns, 1 tool calls, $0.1370, 24.5s
```

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix(synthesis): adjustments from integration testing"
```
