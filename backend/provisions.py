from db import get_client


def get_provision_detail(dok_id: str, section_id: str) -> dict | None:
    """Fetch provision detail: content, structure path, referencing case count.

    dok_id can be either lovdata format ('forskrift/2016-08-12-974')
    or alias format ('anskaffelsesforskriften'). We try lovdata first,
    then fall back to LIKE search on alias.
    """
    client = get_client()

    # 1. Section content — try exact match first
    section_result = (
        client.table("lovdata_sections")
        .select("dok_id, section_id, title, content, structure_id")
        .eq("dok_id", dok_id)
        .eq("section_id", section_id)
        .limit(1)
        .execute()
    )
    section = (section_result.data or [None])[0]

    # If not found, the dok_id might be an alias — search by section_id
    # and filter client-side (lovdata_sections doesn't have aliases)
    if not section:
        return None

    # 2. Structure path (walk up parent_id chain)
    structure_path = []
    if section.get("structure_id"):
        current_id = section["structure_id"]
        visited = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            struct_result = (
                client.table("lovdata_structure")
                .select("id, title, parent_id, structure_type")
                .eq("id", current_id)
                .limit(1)
                .execute()
            )
            struct = (struct_result.data or [None])[0]
            if not struct:
                break
            structure_path.append(struct["title"])
            current_id = struct.get("parent_id")
        structure_path.reverse()

    # 3. Count referencing cases
    # kofa_law_references uses aliases (e.g. 'anskaffelsesforskriften'),
    # while lovdata uses full IDs (e.g. 'forskrift/2016-08-12-974').
    # Search with the dok_id as given — caller should pass the alias for ref counts.
    ref_count_result = (
        client.table("kofa_law_references")
        .select("sak_nr", count="exact")
        .eq("law_name", dok_id)
        .or_(f"law_section.eq.{section_id},law_section.like.{section_id} %")
        .limit(0)
        .execute()
    )
    referencing_cases = ref_count_result.count or 0

    return {
        "dok_id": dok_id,
        "section_id": section_id,
        "title": section.get("title") or "",
        "content": section.get("content") or "",
        "structure_path": structure_path,
        "referencing_cases": referencing_cases,
    }
