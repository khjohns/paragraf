from __future__ import annotations

from db import get_client


def parse_provision(provision_id: str) -> tuple[str, str]:
    """Parse 'anskaffelsesforskriften:16-10' -> ('anskaffelsesforskriften', '16-10')."""
    parts = provision_id.split(":", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid provision ID: {provision_id}")
    return parts[0], parts[1]


def collect_reference_signal(
    provisions: list[str],
) -> dict[str, set[str]]:
    """R signal: find cases that reference seed provisions.

    Returns {sak_nr: set of matched provision IDs}.
    Uses LIKE prefix match to capture sub-sections:
    - parenthesis form: '16-10 (1)', '16-10 (2)'
    - text form: '16-10 første ledd', '16-10 annet ledd'
    One query per provision (seed count is small, typically 2-5).
    """
    client = get_client()
    ref_cases: dict[str, set[str]] = {}

    for provision_id in provisions:
        law_name, law_section = parse_provision(provision_id)

        result = (
            client.table("kofa_law_references")
            .select("sak_nr, regulation_version")
            .eq("law_name", law_name)
            .like("law_section", f"{law_section}%")
            .execute()
        )

        for row in result.data or []:
            ref_cases.setdefault(row["sak_nr"], set()).add(provision_id)

    return ref_cases


def collect_fts_signal(fts_terms: list[str]) -> set[str]:
    """F signal: full-text search on decision text.

    Returns set of sak_nr found via FTS.
    Uses the search_kofa_decision_text RPC (GIN index on search_vector).
    """
    client = get_client()
    fts_cases: set[str] = set()

    for term in fts_terms:
        result = client.rpc(
            "search_kofa_decision_text",
            {"search_query": term, "max_results": 200},
        ).execute()

        for row in result.data or []:
            fts_cases.add(row["sak_nr"])

    return fts_cases
