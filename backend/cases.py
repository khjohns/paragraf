from db import get_client


def get_case_detail(sak_nr: str) -> dict | None:
    """Fetch full case detail: metadata, decision text, and all references."""
    client = get_client()

    # 1. Case metadata
    case_result = (
        client.table("kofa_cases")
        .select("sak_nr, avgjoerelse, saken_gjelder, avsluttet, innklaget, klager, sakstype, regelverk, summary")
        .eq("sak_nr", sak_nr)
        .limit(1)
        .execute()
    )
    case = (case_result.data or [None])[0]
    if not case:
        return None

    # 2. Decision text paragraphs (ordered)
    text_result = (
        client.table("kofa_decision_text")
        .select("paragraph_number, section, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
        .execute()
    )

    # 3. Law references
    law_result = (
        client.table("kofa_law_references")
        .select("law_name, law_section, context, regulation_version")
        .eq("sak_nr", sak_nr)
        .execute()
    )

    # 4. Case references
    case_ref_result = (
        client.table("kofa_case_references")
        .select("to_sak_nr, context")
        .eq("from_sak_nr", sak_nr)
        .execute()
    )

    # 5. EU references
    eu_result = (
        client.table("kofa_eu_references")
        .select("eu_case_id, eu_case_name, context")
        .eq("sak_nr", sak_nr)
        .execute()
    )

    return {
        "sak_nr": sak_nr,
        "avgjoerelse": case.get("avgjoerelse"),
        "saken_gjelder": case.get("saken_gjelder"),
        "avsluttet": str(case["avsluttet"]) if case.get("avsluttet") else None,
        "innklaget": case.get("innklaget"),
        "klager": case.get("klager"),
        "sakstype": case.get("sakstype"),
        "regelverk": case.get("regelverk"),
        "summary": case.get("summary"),
        "paragraphs": text_result.data or [],
        "law_references": [
            {
                "law_name": r["law_name"],
                "law_section": r.get("law_section") or "",
                "context": r.get("context") or "",
                "regulation_version": r.get("regulation_version") or "",
            }
            for r in (law_result.data or [])
        ],
        "case_references": [
            {"to_sak_nr": r["to_sak_nr"], "context": r.get("context") or ""}
            for r in (case_ref_result.data or [])
        ],
        "eu_references": [
            {
                "eu_case_id": r["eu_case_id"],
                "eu_case_name": r.get("eu_case_name") or "",
                "context": r.get("context") or "",
            }
            for r in (eu_result.data or [])
        ],
    }
