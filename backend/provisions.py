from db import get_client
from traversal import _section_filter

# Alias → lovdata dok_id mapping (for section lookup in lovdata_sections)
# kofa_law_references uses aliases, lovdata_sections uses full IDs
_ALIAS_TO_DOK_ID = {
    "anskaffelsesforskriften": "forskrift/2016-08-12-974",
    "foa": "forskrift/2016-08-12-974",
    "anskaffelsesloven": "lov/2016-06-17-73",
    "loa": "lov/2016-06-17-73",
    "forsyningsforskriften": "forskrift/2016-08-12-975",
    "forvaltningsloven": "lov/1967-02-10",
    "fvl": "lov/1967-02-10",
    "offentleglova": "lov/2006-05-19-16",
    "tvisteloven": "lov/2005-06-17-90",
    "avtaleloven": "lov/1918-05-31-4",
    "straffeloven": "lov/2005-05-20-28",
    "konkurranseloven": "lov/2004-03-05-12",
    "klagenemndsforskriften": "forskrift/2016-12-12-1569",
    "konsesjonskontraktforskriften": "forskrift/2017-04-08-449",
    "sikkerhetsloven": "lov/2018-06-01-24",
}


def _resolve_dok_id(alias: str) -> str:
    """Resolve alias to lovdata dok_id. Returns as-is if no alias match."""
    return _ALIAS_TO_DOK_ID.get(alias, alias)


def _walk_structure_path(client, structure_id: str) -> list[str]:
    """Walk up the lovdata_structure parent chain, return titles root-first."""
    path = []
    current_id = structure_id
    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        struct = (
            client.table("lovdata_structure")
            .select("id, title, parent_id")
            .eq("id", current_id)
            .limit(1)
            .execute()
            .data or [None]
        )[0]
        if not struct:
            break
        path.append(struct["title"])
        current_id = struct.get("parent_id")
    path.reverse()
    return path


def _fetch_referencing_cases(client, law_name: str, section_id: str) -> tuple[int, list[dict]]:
    """Count referencing cases and return top 10 with metadata."""
    query = client.table("kofa_law_references").select("sak_nr", count="exact").eq("law_name", law_name)
    query = _section_filter(query, "law_section", section_id)
    ref_result = query.limit(30).execute()

    total = ref_result.count or 0
    if total == 0:
        return 0, []

    ref_sak_nrs = list({r["sak_nr"] for r in (ref_result.data or [])})[:10]
    if not ref_sak_nrs:
        return total, []

    case_result = (
        client.table("kofa_cases")
        .select("sak_nr, saken_gjelder, avsluttet, avgjoerelse")
        .in_("sak_nr", ref_sak_nrs)
        .order("avsluttet", desc=True)
        .execute()
    )
    top_cases = [
        {
            "sak_nr": c["sak_nr"],
            "saken_gjelder": c.get("saken_gjelder") or "",
            "avsluttet": str(c["avsluttet"]) if c.get("avsluttet") else None,
            "avgjoerelse": c.get("avgjoerelse") or "",
        }
        for c in (case_result.data or [])
    ]
    return total, top_cases


def get_provision_detail(dok_id: str, section_id: str) -> dict | None:
    """Fetch provision detail: content, structure path, referencing cases.

    dok_id can be either lovdata format ('forskrift/2016-08-12-974')
    or alias format ('anskaffelsesforskriften'). Alias is resolved for
    lovdata_sections lookup but kept as-is for kofa_law_references.
    """
    client = get_client()
    alias = dok_id  # Keep original for reference counting
    lovdata_id = _resolve_dok_id(dok_id)

    # 1. Section content
    section = (
        client.table("lovdata_sections")
        .select("dok_id, section_id, title, content, structure_id")
        .eq("dok_id", lovdata_id)
        .eq("section_id", section_id)
        .limit(1)
        .execute()
        .data or [None]
    )[0]

    if not section:
        return None

    # 2. Structure path (walk up parent_id chain)
    structure_path = (
        _walk_structure_path(client, section["structure_id"])
        if section.get("structure_id")
        else []
    )

    # 3. Referencing cases
    referencing_cases, top_cases = _fetch_referencing_cases(client, alias, section_id)

    return {
        "dok_id": dok_id,
        "section_id": section_id,
        "title": section.get("title") or "",
        "content": section.get("content") or "",
        "structure_path": structure_path,
        "referencing_cases": referencing_cases,
        "referencing_case_list": top_cases,
    }
