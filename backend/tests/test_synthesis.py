"""Synthesis integration tests — requires backend + screened candidates.

Run with:
    cd backend && python -m pytest tests/test_synthesis.py -v -s

Requires:
    - Backend running on localhost:5002
    - ANTHROPIC_API_KEY set
    - An existing PYTEST analysis with screened candidates in DB
      (created by a previous test_pipeline.py run)
"""


class TestSynthesis:
    def test_synthesis_produces_note(self, api, screened_analysis):
        """Synthesis returns valid JSON with title/sections/tensions."""
        aid = screened_analysis["id"]

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

    def test_synthesis_persists_document(self, api, screened_analysis):
        """Synthesis result is persisted as a document in analysis_documents."""
        aid = screened_analysis["id"]

        r = api.get(f"/api/analyses/{aid}/documents")
        assert r.status_code == 200
        docs = r.json()

        # Endpoint returns {"note": {...}, "qa_report": {...}} keyed by doc_type
        note = docs.get("note")
        assert note is not None, f"No note document found. Keys: {list(docs.keys())}"
        assert len(note.get("content", "")) > 100, "Note content too short"

    def test_synthesis_llm_meta(self, api, screened_analysis):
        """Synthesis response includes _llm_meta with agentic info."""
        aid = screened_analysis["id"]

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

    def test_synthesis_cost_tracked(self, api, screened_analysis):
        """total_cost_usd should not decrease after synthesis.

        Note: If the synthesis result is cached, no LLM call is made and
        cost stays the same. The >= assertion handles both cases.
        """
        aid = screened_analysis["id"]

        # Get cost before
        r = api.get(f"/api/analyses/{aid}")
        cost_before = r.json().get("total_cost_usd", 0)

        r = api.post(f"/api/analyses/{aid}/synthesize")
        assert r.status_code == 200

        # Get cost after
        r = api.get(f"/api/analyses/{aid}")
        cost_after = r.json().get("total_cost_usd", 0)
        assert cost_after >= cost_before, (
            f"Cost should not decrease: {cost_before} -> {cost_after}"
        )
