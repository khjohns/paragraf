"""Integration tests against live Supabase.

Run: cd backend && source venv/bin/activate && python -m pytest test_integration.py -v
"""

import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"


def test_traverse_basic(client):
    """Traverse with a single provision seed."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10"],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()

    assert "nodes" in data
    assert "edges" in data
    assert "gaps" in data
    assert "stats" in data

    node_types = {n["type"] for n in data["nodes"]}
    assert "provision" in node_types
    assert "kofa_case" in node_types

    for node in data["nodes"]:
        assert "id" in node
        assert "type" in node
        assert "label" in node
        assert "isSeed" in node

    stats = data["stats"]
    case_nodes = [n for n in data["nodes"] if n["type"] == "kofa_case"]
    assert stats["total"] == len(case_nodes)
    assert stats["categoryA"] + stats["categoryB"] + stats["categoryC"] == stats["total"]


def test_traverse_with_fts(client):
    """Traverse with provision + FTS gives category A hits."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10"],
            "ftsTerms": ["forpliktelseserklæring"],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert data["stats"]["categoryA"] > 0, "Should have A-category hits with both R+F signals"


def test_traverse_gap_matrix(client):
    """Two provisions should produce gap data."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10", "anskaffelsesforskriften:17-1"],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert len(data["gaps"]) >= 1
    assert all("provision1" in g and "provision2" in g and "count" in g for g in data["gaps"])


def test_traverse_empty(client):
    """Empty provisions should return empty results."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": [],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert data["stats"]["total"] == 0


def test_case_detail(client):
    """Fetch a known case."""
    resp = client.get("/api/cases/2025/1456")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["sak_nr"] == "2025/1456"
    assert "paragraphs" in data
    assert "law_references" in data
    assert "case_references" in data
    assert "eu_references" in data


def test_case_not_found(client):
    resp = client.get("/api/cases/9999/9999")
    assert resp.status_code == 404


def test_provision_detail(client):
    """Fetch a known provision using lovdata dok_id."""
    resp = client.get("/api/provisions/forskrift/2016-08-12-974/16-10")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["section_id"] == "16-10"
    assert len(data["content"]) > 0


def test_provision_not_found(client):
    resp = client.get("/api/provisions/nonexistent/99-99")
    assert resp.status_code == 404
