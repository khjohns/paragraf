from db import get_client
from traversal import _section_filter


def get_forarbeid_detail(doc_id: str, provision: str | None = None) -> dict | None:
    """Fetch forarbeid detail: document metadata and all sections
    referencing the given provision (or all sections if no provision)."""
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

    # 2. Find sections that reference this provision
    sections = []
    if provision:
        law_name, _, law_section = provision.partition(":")
        base_section = law_section.split(" ")[0] if law_section else ""
        if base_section:
            ref_result = _section_filter(
                client.table("kofa_forarbeider_law_refs")
                .select("section_number")
                .eq("doc_id", doc_id)
                .eq("law_name", law_name),
                "law_section", base_section,
            ).execute()
            section_numbers = list({r["section_number"] for r in (ref_result.data or [])})
            if section_numbers:
                sec_result = (
                    client.table("kofa_forarbeider_sections")
                    .select("section_number, title, parent_path, level, sort_order")
                    .eq("doc_id", doc_id)
                    .in_("section_number", section_numbers)
                    .order("sort_order")
                    .execute()
                )
                sections = [
                    {
                        "number": s["section_number"],
                        "title": s.get("title"),
                        "parent_path": s.get("parent_path"),
                    }
                    for s in (sec_result.data or [])
                ]

    return {
        "doc_id": doc["doc_id"],
        "doc_type": doc.get("doc_type"),
        "title": doc.get("title"),
        "full_title": doc.get("full_title"),
        "session": doc.get("session"),
        "source_url": doc.get("source_url"),
        "sections": sections,
    }


def get_forarbeid_section(doc_id: str, section_number: str) -> dict | None:
    """Fetch a single section's text content."""
    client = get_client()

    section_result = (
        client.table("kofa_forarbeider_sections")
        .select("section_number, title, level, text, parent_path")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .limit(1)
        .execute()
    )
    section = (section_result.data or [None])[0]
    if not section:
        return None

    # Law references from this section
    law_refs = (
        client.table("kofa_forarbeider_law_refs")
        .select("law_name, law_section, context")
        .eq("doc_id", doc_id)
        .eq("section_number", section_number)
        .execute()
    )

    return {
        "number": section["section_number"],
        "title": section.get("title"),
        "level": section.get("level"),
        "text": section.get("text"),
        "parent_path": section.get("parent_path"),
        "law_references": [
            {
                "law_name": r["law_name"],
                "law_section": r.get("law_section") or "",
                "context": r.get("context") or "",
            }
            for r in (law_refs.data or [])
        ],
    }
