"""Shared fixtures for pipeline integration tests.

All communication goes through HTTP — no direct DB imports needed.
Backend must be started separately (./scripts/dev-backend.sh).
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("PARAGRAF_BASE_URL", "http://localhost:5002")


class ApiClient:
    """Thin wrapper around requests.Session with a base URL."""

    def __init__(self, base_url):
        self.base_url = base_url
        self._session = requests.Session()

    def get(self, path, **kwargs):
        return self._session.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path, **kwargs):
        return self._session.post(f"{self.base_url}{path}", **kwargs)

    def patch(self, path, **kwargs):
        return self._session.patch(f"{self.base_url}{path}", **kwargs)

    def delete(self, path, **kwargs):
        return self._session.delete(f"{self.base_url}{path}", **kwargs)


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api(base_url):
    """API client pointed at the backend."""
    client = ApiClient(base_url)
    try:
        r = client.get("/api/health", timeout=5)
        r.raise_for_status()
    except requests.ConnectionError:
        pytest.skip(f"Backend not running at {base_url}")
    return client


@pytest.fixture(scope="session")
def test_analysis(api):
    """Create a test analysis, yield it, then delete it after all tests.

    Teardown uses the API endpoint. If that fails, the analysis stays in DB
    with a recognizable PYTEST prefix for manual cleanup.
    """
    r = api.post("/api/analyses", json={
        "title": "PYTEST: tildelingskriterier FOA § 16-10",
        "problem": "Test: tildelingskriterier FOA § 16-10",
    })
    assert r.status_code == 201, f"Failed to create analysis: {r.text}"
    analysis = r.json()
    analysis_id = analysis["id"]

    # Upsert seeds: FOA § 16-10 as sole provision
    api.patch(
        f"/api/analyses/{analysis_id}",
        json={"seeds": {"provisions": ["anskaffelsesforskriften:16-10"], "ftsTerms": [], "vectorQuery": "", "cases": []}},
    )

    yield analysis

    # Teardown via dedicated cleanup endpoint (DELETE cascade)
    # If no DELETE endpoint exists, we leave it — PYTEST prefix makes it identifiable
    api.delete(f"/api/analyses/{analysis_id}")
