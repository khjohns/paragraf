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


def simplify_outcome(avgjoerelse: str | None) -> str | None:
    """Simplify verbose outcome to short label."""
    if not avgjoerelse:
        return None
    if "Ikke brudd" in avgjoerelse:
        return "Ikke brudd"
    if "Brudd" in avgjoerelse:
        return "Brudd"
    return avgjoerelse


def _build_provision_nodes(client, provisions: list[str]) -> list[dict]:
    """Build GraphNode dicts for seed provisions from lovdata_sections."""
    if not provisions:
        return []

    nodes = []
    for provision_id in provisions:
        law_name, law_section = parse_provision(provision_id)

        result = (
            client.table("lovdata_sections")
            .select("dok_id, section_id, title")
            .eq("dok_id", law_name)
            .like("section_id", f"%{law_section}%")
            .limit(1)
            .execute()
        )

        section = (result.data or [None])[0]
        title = section["title"] if section else f"§{law_section}"

        nodes.append({
            "id": provision_id,
            "type": "provision",
            "label": f"§{law_section}",
            "subtitle": title,
            "citations": 0,
            "regulation": "new",
            "iteration": 1,
            "isSeed": True,
            "isDelimitation": False,
        })

    return nodes


def _build_edges(
    client, case_sak_nrs: set[str], provisions: list[str]
) -> tuple[list[dict], list[dict], list[dict]]:
    """Build edges and collect EU + forarbeider nodes. (Stub — Task 4.)"""
    return [], [], []


def _compute_gaps(
    provisions: list[str], ref_cases: dict[str, set[str]]
) -> list[dict]:
    """Compute gap matrix. (Stub — Task 4.)"""
    return []


def build_traversal_response(
    provisions: list[str],
    fts_terms: list[str],
    vector_query: str,
    seed_cases: list[str],
    regulation_filter: str,
) -> dict:
    """Core traversal algorithm. Returns full TraversalResponse dict."""
    client = get_client()

    # --- 1. Collect signals ---
    ref_cases = collect_reference_signal(provisions)
    fts_cases = collect_fts_signal(fts_terms)
    vec_cases: set[str] = set()  # V signal: future

    # --- 2. Merge all discovered case sak_nrs ---
    all_sak_nrs = set(ref_cases.keys()) | fts_cases | vec_cases | set(seed_cases)

    if not all_sak_nrs:
        return {
            "nodes": _build_provision_nodes(client, provisions),
            "edges": [],
            "gaps": _compute_gaps(provisions, {}),
            "stats": {"total": 0, "categoryA": 0, "categoryB": 0, "categoryC": 0, "delimitations": 0},
        }

    # --- 3. Batch-fetch case metadata ---
    sak_list = list(all_sak_nrs)
    case_data = (
        client.table("kofa_cases")
        .select("sak_nr, avgjoerelse, saken_gjelder, avsluttet, regelverk, summary")
        .in_("sak_nr", sak_list)
        .execute()
    )
    case_map = {c["sak_nr"]: c for c in (case_data.data or [])}

    # --- 4. Batch-fetch regulation versions for all discovered cases ---
    reg_result = (
        client.table("kofa_law_references")
        .select("sak_nr, regulation_version")
        .in_("sak_nr", sak_list)
        .execute()
    )
    # A case's regulation = 'new' if ANY of its references are 'new'
    case_reg: dict[str, str] = {}
    for row in reg_result.data or []:
        sak = row["sak_nr"]
        if row.get("regulation_version") == "new":
            case_reg[sak] = "new"
        elif sak not in case_reg:
            case_reg[sak] = "old"

    # --- 5. Build case nodes ---
    case_nodes = []
    for sak_nr in all_sak_nrs:
        case = case_map.get(sak_nr)
        if not case:
            continue  # Case not in DB (broken reference)

        has_ref = sak_nr in ref_cases
        has_fts = sak_nr in fts_cases
        has_vec = sak_nr in vec_cases
        signals = {"ref": has_ref, "fts": has_fts, "vec": has_vec}

        signal_count = sum(signals.values())
        if signal_count >= 2:
            category = "A"
        elif signal_count == 1:
            category = "B"
        else:
            category = "C"  # Seed cases with no signal match

        reg = case_reg.get(sak_nr)

        case_nodes.append({
            "id": f"kofa:{sak_nr}",
            "type": "kofa_case",
            "label": sak_nr,
            "subtitle": case.get("saken_gjelder") or "",
            "date": str(case["avsluttet"]) if case.get("avsluttet") else None,
            "outcome": simplify_outcome(case.get("avgjoerelse")),
            "category": category,
            "signals": signals,
            "citations": 0,  # Filled in edge-building step
            "regulation": reg,
            "iteration": 1,
            "isSeed": sak_nr in seed_cases,
            "isDelimitation": False,
        })

    # --- 6. Build provision nodes ---
    provision_nodes = _build_provision_nodes(client, provisions)

    # --- 7. Build edges + compute citations ---
    edges, eu_nodes, prep_nodes = _build_edges(client, all_sak_nrs, provisions)

    # Count incoming citations per case
    citation_counts: dict[str, int] = {}
    for edge in edges:
        target = edge["to"]
        citation_counts[target] = citation_counts.get(target, 0) + 1
    for node in case_nodes:
        node["citations"] = citation_counts.get(node["id"], 0)
    for node in provision_nodes:
        node["citations"] = citation_counts.get(node["id"], 0)

    # --- 8. Gap matrix ---
    gaps = _compute_gaps(provisions, ref_cases)

    # --- 9. Stats ---
    all_nodes = provision_nodes + case_nodes + eu_nodes + prep_nodes
    stats = {
        "total": len(case_nodes),
        "categoryA": sum(1 for n in case_nodes if n.get("category") == "A"),
        "categoryB": sum(1 for n in case_nodes if n.get("category") == "B"),
        "categoryC": sum(1 for n in case_nodes if n.get("category") == "C"),
        "delimitations": sum(1 for n in case_nodes if n.get("isDelimitation")),
    }

    return {"nodes": all_nodes, "edges": edges, "gaps": gaps, "stats": stats}
