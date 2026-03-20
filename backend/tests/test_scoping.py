"""Scoping integration tests — scoping + seed persistence + traversal flow.

Run with:
    cd backend && python -m pytest tests/test_scoping.py -v -s

Requires:
    - Backend running on localhost:5002 (start with ./scripts/dev-backend.sh)
    - ANTHROPIC_API_KEY set (loaded by dev-backend.sh from gcloud)
    - Supabase accessible

Tests the full flow: create analysis → scope → persist seeds → traverse.
"""

import pytest


@pytest.fixture(scope="module")
def scoping_analysis(api):
    """Create a fresh analysis for scoping tests, clean up after."""
    r = api.post("/api/analyses", json={
        "title": "PYTEST: scoping fellesanskaffelse",
        "problem": "",
    })
    assert r.status_code == 201, f"Failed to create analysis: {r.text}"
    analysis = r.json()
    yield analysis
    # Cleanup: leave in DB with PYTEST prefix for manual cleanup if needed


class TestAnalysisCreation:
    """Verify that newly created analyses have correct initial state."""

    def test_new_analysis_has_scoping_status(self, scoping_analysis):
        assert scoping_analysis["status"] == "scoping"

    def test_new_analysis_has_no_seeds(self, api, scoping_analysis):
        r = api.get(f"/api/analyses/{scoping_analysis['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["seeds"] == []


class TestScoping:
    """Test Claude scoping endpoint — sends problem, gets structured result."""

    def test_scope_requires_problem(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        r = api.post(f"/api/analyses/{aid}/scope", json={})
        assert r.status_code == 400

    def test_scope_returns_structured_result(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        r = api.post(
            f"/api/analyses/{aid}/scope",
            json={"problem": (
                "Vi (kommunalt foretak) skal gjennomføre en anskaffelse av nytt FDVU-system "
                "(Forvaltning, drift og vedlikehold, utvikling - SaaS) etter forskriftens del III "
                "der det kan være aktuelt for andre oppdragsgivere - andre foretak og etater i "
                "Oslo kommune - å også inngå avtale med leverandøren slik at de får brukt samme "
                "system. Må det fremgå av kunngjøringen at andre foretak og etater i oslo kommune "
                "kan være en aktuell kunde og slik at de har en \"opsjon\" på inngåelse av kontrakt "
                "med leverandøren? Må bestemte navn på disse foretakene og etatene være angitt?"
            )},
            timeout=120,
        )
        assert r.status_code == 200, f"Scoping failed: {r.text}"
        data = r.json()

        # Required fields from SCOPING_SCHEMA
        assert "refined_problem" in data
        assert isinstance(data["refined_problem"], str)
        assert len(data["refined_problem"]) > 10

        assert "sub_problems" in data
        assert isinstance(data["sub_problems"], list)
        assert len(data["sub_problems"]) >= 1

        assert "provisions" in data
        assert isinstance(data["provisions"], list)
        assert len(data["provisions"]) >= 1

        assert "search_strategy" in data
        strategy = data["search_strategy"]
        assert "fts" in strategy
        assert "vector" in strategy

        # Store for downstream tests
        scoping_analysis["_scoping_result"] = data

    def test_provisions_have_required_fields(self, scoping_analysis):
        result = scoping_analysis.get("_scoping_result")
        if not result:
            pytest.skip("Scoping didn't run")

        for prov in result["provisions"]:
            assert "ref" in prov, f"Provision missing ref: {prov}"
            assert "label" in prov
            assert "primary" in prov
            assert isinstance(prov["verified"], bool)

    def test_scoping_persists_to_analysis(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.status_code == 200
        data = r.json()

        # Scoping endpoint should persist refined_problem and scoping_result
        assert data.get("scoping_result") is not None
        assert data.get("refined_problem") or data.get("problem")

    def test_scoping_has_llm_meta(self, scoping_analysis):
        result = scoping_analysis.get("_scoping_result")
        if not result:
            pytest.skip("Scoping didn't run")

        meta = result.get("_llm_meta")
        assert meta is not None, "Missing _llm_meta on scoping result"
        assert "model" in meta
        assert "cost_usd" in meta
        assert meta["cost_usd"] > 0


class TestSeedPersistence:
    """Test that seeds can be persisted and are available for traversal."""

    def test_persist_seeds_via_patch(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        result = scoping_analysis.get("_scoping_result")
        if not result:
            pytest.skip("Scoping didn't run")

        # Extract verified provisions (same logic as ScopingOverlay.approve)
        provisions = [p["ref"] for p in result["provisions"] if p.get("verified")]
        fts_terms = result["search_strategy"]["fts"]
        vector_terms = result["search_strategy"]["vector"]

        r = api.patch(f"/api/analyses/{aid}", json={
            "seeds": {
                "provisions": provisions,
                "ftsTerms": fts_terms,
                "vectorQuery": ". ".join(vector_terms) if vector_terms else "",
                "cases": [],
            },
            "status": "searching",
        })
        assert r.status_code == 200

        # Store for traversal test
        scoping_analysis["_provisions"] = provisions

    def test_seeds_readable_from_db(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        r = api.get(f"/api/analyses/{aid}")
        assert r.status_code == 200
        data = r.json()

        seeds = data["seeds"]
        assert len(seeds) > 0, "Seeds not persisted"

        seed_types = {s["seed_type"] for s in seeds}
        assert "provision" in seed_types, "No provision seeds"


class TestTraversalAfterScoping:
    """Test that traversal works after seeds are persisted."""

    def test_traversal_finds_candidates(self, api, scoping_analysis):
        aid = scoping_analysis["id"]
        provisions = scoping_analysis.get("_provisions")
        if not provisions:
            pytest.skip("Seeds not persisted")

        r = api.post(
            f"/api/analyses/{aid}/traverse",
            json={"iteration": 1},
            timeout=60,
        )
        assert r.status_code == 200, f"Traversal failed: {r.text}"
        data = r.json()

        assert "nodes" in data
        assert "edges" in data
        assert data.get("candidateCount", 0) > 0, "Traversal returned no candidates"
