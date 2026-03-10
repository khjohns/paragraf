from db import get_client


def get_forarbeid_detail(doc_id: str, section_number: str) -> dict | None:
    """Fetch forarbeid detail: document metadata, section content, law references."""
    client = get_client()

    # 1. Document metadata
    doc_result = (
        client.table("kofa_forarbeider")
        .select("doc_id, doc_type, title, full_title, session, source_url")
        .eq("doc_id", doc_id)
        .limit(1)
        .execute()
    )
    doc = (doc_result.data or [None])[0]
    if not doc:
        return None

    # 2. Section content
    section_result = (
        client.table("kofa_forarbeider_sections")
        .select("section_number, title, level, text, parent_path")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .limit(1)
        .execute()
    )
    section = (section_result.data or [None])[0]

    # 3. Law references from this section
    law_refs = (
        client.table("kofa_forarbeider_law_refs")
        .select("law_name, law_section, context")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .execute()
    )

    return {
        "doc_id": doc["doc_id"],
        "doc_type": doc.get("doc_type"),
        "title": doc.get("title"),
        "full_title": doc.get("full_title"),
        "session": doc.get("session"),
        "source_url": doc.get("source_url"),
        "section": {
            "number": section["section_number"],
            "title": section.get("title"),
            "level": section.get("level"),
            "text": section.get("text"),
            "parent_path": section.get("parent_path"),
        } if section else None,
        "law_references": [
            {
                "law_name": r["law_name"],
                "law_section": r.get("law_section") or "",
                "context": r.get("context") or "",
            }
            for r in (law_refs.data or [])
        ],
    }
