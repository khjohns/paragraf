from db import get_client


def get_eu_case_detail(eu_case_id: str) -> dict | None:
    """Fetch EU case detail: metadata and referencing KOFA cases."""
    client = get_client()

    # 1. EU case metadata
    result = (
        client.table("kofa_eu_case_law")
        .select("eu_case_id, celex, case_name, judgment_date, subject, description, source_url")
        .eq("eu_case_id", eu_case_id)
        .limit(1)
        .execute()
    )
    case = (result.data or [None])[0]
    if not case:
        return None

    # 2. Count referencing KOFA cases
    ref_count = (
        client.table("kofa_eu_references")
        .select("sak_nr", count="exact")
        .eq("eu_case_id", eu_case_id)
        .limit(0)
        .execute()
    )

    # 3. Top 20 referencing cases with context
    refs = (
        client.table("kofa_eu_references")
        .select("sak_nr, context")
        .eq("eu_case_id", eu_case_id)
        .limit(20)
        .execute()
    )

    return {
        "eu_case_id": case["eu_case_id"],
        "celex": case.get("celex"),
        "case_name": case.get("case_name"),
        "judgment_date": str(case["judgment_date"]) if case.get("judgment_date") else None,
        "subject": case.get("subject"),
        "description": case.get("description"),
        "source_url": case.get("source_url"),
        "referencing_cases_count": ref_count.count or 0,
        "referencing_cases": [
            {"sak_nr": r["sak_nr"], "context": r.get("context") or ""}
            for r in (refs.data or [])
        ],
    }
