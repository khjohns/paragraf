"""Pipeline integration tests — end-to-end against live backend + Supabase.

Run with:
    cd backend && python -m pytest tests/test_pipeline.py -v -s

Requires:
    - Backend running on localhost:5002 (start with ./scripts/dev-backend.sh)
    - ANTHROPIC_API_KEY set (loaded by dev-backend.sh from gcloud)
    - Supabase accessible

Tests run in order within each class (pytest default: file order).
The test_analysis fixture is session-scoped, so pipeline state accumulates
across test classes: traversal → screening → citation QA → hydration.
"""

import json
import pytest


def parse_sse_events(response):
    """Parse SSE stream from a requests response. Yields parsed JSON dicts."""
    for line in response.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            yield json.loads(line[6:])


# ---------------------------------------------------------------------------
# 1. Traversal persists candidates
# ---------------------------------------------------------------------------
class TestTraversal:
    def test_traversal_returns_200(self, api, test_analysis):
        aid = test_analysis["id"]
        r = api.post(f"/api/analyses/{aid}/traverse", json={"iteration": 1})
        assert r.status_code == 200, f"Traversal failed: {r.text}"
        data = r.json()
        assert "nodes" in data
        assert "edges" in data
        assert data.get("candidateCount", 0) > 0

    def test_candidates_in_db(self, api, test_analysis):
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.status_code == 200
        candidates = r.json().get("candidates", [])
        assert len(candidates) > 0, "No candidates persisted after traversal"

        for c in candidates:
            assert c.get("category") in ("A", "B", "C"), f"Bad category: {c.get('category')}"
            assert c.get("signals") is not None
            assert c.get("iteration") is not None

    def test_status_is_candidates_ready(self, api, test_analysis):
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.json()["status"] == "candidates_ready"


# ---------------------------------------------------------------------------
# 2. Re-traversal preserves screening data (CRITICAL — was the main bug)
# ---------------------------------------------------------------------------
class TestRetraversalPreservesScreening:
    """Verify that persist_candidates upsert does NOT overwrite ai_screening."""

    def test_screen_then_retraverse(self, api, test_analysis):
        aid = test_analysis["id"]

        # Pick first 2 candidates
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        sak_nrs = [c["sak_nr"] for c in candidates[:2]]
        assert len(sak_nrs) >= 1, "Need at least 1 candidate to test"

        # Screen them (SSE)
        r = api.post(
            f"/api/analyses/{aid}/screen",
            json={"sak_nrs": sak_nrs, "max_parallel": 1},
            stream=True,
        )
        assert r.status_code == 200
        events = list(parse_sse_events(r))
        assert any(e.get("done") for e in events), "SSE stream missing done event"
        screening_events = [e for e in events if "factum" in e or "sak_nr" in e]
        assert len(screening_events) >= 1, f"No screening results in SSE: {events}"

        # Verify ai_screening is set in DB
        r = api.get(f"/api/analyses/{aid}")
        candidates_after_screen = {c["sak_nr"]: c for c in r.json()["candidates"]}
        for sak_nr in sak_nrs:
            c = candidates_after_screen.get(sak_nr)
            if c:
                assert c.get("ai_screening") is not None, (
                    f"ai_screening missing after screening for {sak_nr}"
                )

        # Re-traverse (same seeds, same iteration)
        r = api.post(f"/api/analyses/{aid}/traverse", json={"iteration": 1})
        assert r.status_code == 200

        # CRITICAL CHECK: ai_screening must still be present
        r = api.get(f"/api/analyses/{aid}")
        candidates_after_retraverse = {c["sak_nr"]: c for c in r.json()["candidates"]}
        for sak_nr in sak_nrs:
            c = candidates_after_retraverse.get(sak_nr)
            if c:
                assert c.get("ai_screening") is not None, (
                    f"CRITICAL BUG: ai_screening wiped by re-traversal for {sak_nr}"
                )
                assert c.get("screening_status") in ("ai_screened", "both"), (
                    f"screening_status reset for {sak_nr}: {c.get('screening_status')}"
                )


# ---------------------------------------------------------------------------
# 3. Screening via SSE
# ---------------------------------------------------------------------------
class TestScreening:
    def test_screening_sse_format(self, api, test_analysis):
        """SSE events contain screening results with expected fields."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        unscreened = [c for c in candidates if not c.get("ai_screening")]
        target = unscreened[:1] if unscreened else candidates[:1]
        if not target:
            pytest.skip("No candidates available")
        sak_nrs = [c["sak_nr"] for c in target]

        r = api.post(
            f"/api/analyses/{aid}/screen",
            json={"sak_nrs": sak_nrs, "max_parallel": 1},
            stream=True,
        )
        assert r.status_code == 200

        events = list(parse_sse_events(r))
        done = [e for e in events if e.get("done")]
        assert len(done) == 1, "Should have exactly one done event"

        results = [e for e in events if not e.get("done") and not e.get("error")]
        for result in results:
            assert "factum" in result or "sak_nr" in result, f"Unexpected event: {result}"

    def test_screening_persists_to_db(self, api, test_analysis):
        """After screening, candidates have ai_screening and screening_status."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        screened = [c for c in candidates if c.get("ai_screening")]
        assert len(screened) >= 1, "Expected at least 1 screened candidate"

        for c in screened:
            screening = c["ai_screening"]
            assert "factum" in screening
            assert "assessment" in screening
            assert "proposition" in screening
            assert "quotes" in screening
            assert isinstance(screening["quotes"], list)
            assert c["screening_status"] in ("ai_screened", "both")

    def test_llm_metadata_persisted(self, api, test_analysis):
        """Screening results should include _llm_meta with usage and thinking data."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        screened = [c for c in candidates if c.get("ai_screening")]
        assert len(screened) >= 1

        for c in screened:
            meta = c["ai_screening"].get("_llm_meta")
            assert meta is not None, f"Missing _llm_meta for {c['sak_nr']}"
            assert meta.get("model"), "Missing model in _llm_meta"
            assert meta.get("input_tokens", 0) > 0, "Missing input_tokens"
            assert meta.get("output_tokens", 0) > 0, "Missing output_tokens"
            assert "cost_usd" in meta, "Missing cost_usd"
            assert meta.get("stop_reason") == "end_turn", (
                f"Unexpected stop_reason: {meta.get('stop_reason')}"
            )
            # Adaptive thinking should produce thinking at effort=high
            assert meta.get("has_thinking") is True, (
                f"No thinking for {c['sak_nr']} — "
                "adaptive thinking should be active at effort=high"
            )
            assert meta.get("thinking_summary"), (
                f"Empty thinking_summary for {c['sak_nr']}"
            )

    def test_propositions_created(self, api, test_analysis):
        """Screening should upsert propositions.

        We verify via GET /api/analyses/<id> — candidates with ai_screening
        should have a proposition field, and the screening persists to
        analysis_propositions table (checked indirectly via cross-propositions later).
        """
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        screened = [c for c in candidates if c.get("ai_screening")]
        assert len(screened) >= 1

        # Each screened candidate should have a proposition in ai_screening
        for c in screened:
            assert c["ai_screening"].get("proposition"), (
                f"Missing proposition in screening for {c['sak_nr']}"
            )


# ---------------------------------------------------------------------------
# 4. Citation verification
# ---------------------------------------------------------------------------
class TestCitationVerification:
    VALID_STATUSES = {"verified", "truncated", "inaccurate", "not_found"}

    def test_verify_citations(self, api, test_analysis):
        aid = test_analysis["id"]
        r = api.post(f"/api/analyses/{aid}/verify-citations")
        assert r.status_code == 200, f"Citation verification failed: {r.text}"
        data = r.json()
        assert "verified_quotes" in data, f"Missing verified_quotes: {list(data.keys())}"
        assert "summary" in data, "Missing summary in citation response"

        # Each verified quote should have required fields
        for vq in data["verified_quotes"]:
            assert vq.get("sak_nr"), f"Missing sak_nr in verified quote: {vq}"
            assert vq.get("status") in self.VALID_STATUSES, (
                f"Invalid citation status '{vq.get('status')}' for {vq.get('sak_nr')}"
            )
            assert "issue" in vq, f"Missing issue field: {vq}"

    def test_quote_verification_linked(self, api, test_analysis):
        """After citation QA, each quote in ai_screening.quotes should have verification.status."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        candidates = r.json()["candidates"]
        screened = [c for c in candidates if c.get("ai_screening")]

        # Find candidates where at least one quote has verification
        verified = [
            c for c in screened
            if any(
                q.get("verification") is not None
                for q in c["ai_screening"].get("quotes", [])
            )
        ]
        assert len(verified) > 0, "No candidates got quote verification linked to quotes"

        for c in verified:
            for q in c["ai_screening"]["quotes"]:
                if q.get("verification"):
                    assert q["verification"].get("status") in self.VALID_STATUSES, (
                        f"Invalid verification status on quote for {c['sak_nr']}: {q['verification']}"
                    )
            # Legacy quote_verification array should NOT be present
            assert "quote_verification" not in c["ai_screening"], (
                f"Legacy quote_verification array still present for {c['sak_nr']}"
            )

    def test_citation_qa_llm_meta(self, api, test_analysis):
        """Citation QA response should include _llm_meta with model/tokens/cost."""
        aid = test_analysis["id"]
        r = api.post(f"/api/analyses/{aid}/verify-citations")
        assert r.status_code == 200
        data = r.json()
        meta = data.get("_llm_meta")
        assert meta is not None, f"Missing _llm_meta in citation QA response: {list(data.keys())}"
        assert meta.get("model") == "claude-haiku-4-5-20251001", f"Unexpected model: {meta.get('model')}"
        assert meta.get("input_tokens", 0) > 0, "Missing input_tokens"
        assert meta.get("output_tokens", 0) > 0, "Missing output_tokens"
        assert "cost_usd" in meta, "Missing cost_usd"
        assert meta.get("has_thinking") is False, "Haiku should not have thinking"

    def test_citation_summary_on_analysis(self, api, test_analysis):
        """After verify-citations, analyses.citation_summary should have aggregated counts."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        data = r.json()
        summary = data.get("citation_summary")
        assert summary is not None, "Missing citation_summary on analysis"
        assert summary.get("total", 0) > 0, f"citation_summary.total should be > 0: {summary}"
        # Should have at least one status key
        status_keys = {"verified", "truncated", "inaccurate", "not_found"}
        found = [k for k in status_keys if k in summary]
        assert len(found) > 0, f"No status keys in citation_summary: {summary}"

    def test_cumulative_cost(self, api, test_analysis):
        """After screening + citation QA, analyses.total_cost_usd should be > 0."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        data = r.json()
        total_cost = data.get("total_cost_usd", 0)
        assert total_cost > 0, f"total_cost_usd should be > 0 after screening + QA: {total_cost}"


# ---------------------------------------------------------------------------
# 5. Status flow
# ---------------------------------------------------------------------------
class TestStatusFlow:
    def test_status_after_citation_qa(self, api, test_analysis):
        """After verify-citations, status should be screening_complete."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.json()["status"] == "screening_complete"


# ---------------------------------------------------------------------------
# 6. Hydration after "reload"
# ---------------------------------------------------------------------------
class TestHydration:
    def test_get_analysis_returns_full_candidates(self, api, test_analysis):
        """GET /api/analyses/<id> returns candidates with ai_screening for hydration."""
        aid = test_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.status_code == 200
        data = r.json()

        assert "candidates" in data
        candidates = data["candidates"]
        assert len(candidates) > 0

        screened = [c for c in candidates if c.get("ai_screening")]
        assert len(screened) > 0, "No screened candidates returned — hydration broken"

        for c in screened:
            s = c["ai_screening"]
            assert "factum" in s
            assert "quotes" in s


# ---------------------------------------------------------------------------
# Edge cases from the brief
# ---------------------------------------------------------------------------
class TestEdgeCases:
    def test_screening_error_does_not_stop_stream(self, api, test_analysis):
        """Screening with a non-existent sak_nr should yield an error event, not crash."""
        aid = test_analysis["id"]
        r = api.post(
            f"/api/analyses/{aid}/screen",
            json={"sak_nrs": ["FAKE/999"], "max_parallel": 1},
            stream=True,
        )
        assert r.status_code == 200  # SSE always returns 200
        events = list(parse_sse_events(r))
        assert any(e.get("done") for e in events), "Stream should complete even with errors"

    def test_sak_nr_with_slash_in_candidate_patch(self, api, test_analysis):
        """Sak_nr with / (e.g., 2022/31) should not break the API."""
        aid = test_analysis["id"]
        r = api.patch(
            f"/api/analyses/{aid}/candidates/2022/31",
            json={"user_notes": "test slash"},
        )
        # 404 is fine (candidate may not exist), but not 500
        assert r.status_code in (200, 404), f"Slash in sak_nr broke the API: {r.status_code}"
