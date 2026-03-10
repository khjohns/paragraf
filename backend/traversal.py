from __future__ import annotations

from db import get_client


def _section_filter(query, column: str, law_section: str):
    """Match exact section OR section with sub-section suffix (space-separated).

    Prevents '16-1' from matching '16-10' — only matches '16-1' or '16-1 (1)'.
    """
    return query.or_(f"{column}.eq.{law_section},{column}.like.{law_section} %")


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

        result = _section_filter(
            client.table("kofa_law_references")
            .select("sak_nr, regulation_version")
            .eq("law_name", law_name),
            "law_section", law_section,
        ).execute()

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
            "iteration": 1,
            "isSeed": True,
            "isDelimitation": False,
        })

    return nodes


def _build_edges(
    client, case_sak_nrs: set[str], provisions: list[str],
    law_refs_data: list[dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Build edges and collect EU + forarbeider nodes.

    Returns (edges, eu_nodes, prep_nodes).
    law_refs_data is pre-fetched from kofa_law_references (avoids duplicate query).
    """
    sak_list = list(case_sak_nrs)
    edges: list[dict] = []
    seen_edges: set[tuple[str, str]] = set()
    eu_nodes: list[dict] = []
    prep_nodes: list[dict] = []
    seen_eu: set[str] = set()
    seen_prep: set[str] = set()

    # --- Case → Provision edges (from pre-fetched law references) ---
    provision_set = set(provisions)
    for ref in law_refs_data:
        for prov_id in provision_set:
            law_name, law_section = parse_provision(prov_id)
            ref_section = ref.get("law_section") or ""
            if ref["law_name"] == law_name and (ref_section == law_section or ref_section.startswith(law_section + " ")):
                key = (f"kofa:{ref['sak_nr']}", prov_id)
                if key not in seen_edges:
                    seen_edges.add(key)
                    edges.append({"from": key[0], "to": key[1], "valence": "unknown"})
                break

    # --- Case → Case edges ---
    case_refs = (
        client.table("kofa_case_references")
        .select("from_sak_nr, to_sak_nr, context")
        .in_("from_sak_nr", sak_list)
        .execute()
    )
    for ref in case_refs.data or []:
        if ref["to_sak_nr"] in case_sak_nrs:
            key = (f"kofa:{ref['from_sak_nr']}", f"kofa:{ref['to_sak_nr']}")
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append({
                    "from": key[0],
                    "to": key[1],
                    "valence": "unknown",
                    "context": ref.get("context"),
                })

    # --- Case → EU edges ---
    eu_refs = (
        client.table("kofa_eu_references")
        .select("sak_nr, eu_case_id, eu_case_name, context")
        .in_("sak_nr", sak_list)
        .execute()
    )
    eu_ids = set()
    eu_cite_count: dict[str, int] = {}
    for ref in eu_refs.data or []:
        eu_id = ref["eu_case_id"]
        eu_ids.add(eu_id)
        eu_cite_count[eu_id] = eu_cite_count.get(eu_id, 0) + 1
        key = (f"kofa:{ref['sak_nr']}", f"eu:{eu_id}")
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({"from": key[0], "to": key[1], "valence": "unknown"})

    # Batch-fetch EU case metadata
    if eu_ids:
        eu_data = (
            client.table("kofa_eu_case_law")
            .select("eu_case_id, case_name, judgment_date, subject")
            .in_("eu_case_id", list(eu_ids))
            .execute()
        )
        for eu in eu_data.data or []:
            node_id = f"eu:{eu['eu_case_id']}"
            if node_id not in seen_eu:
                seen_eu.add(node_id)
                eu_nodes.append({
                    "id": node_id,
                    "type": "eu_case",
                    "label": eu["eu_case_id"],
                    "subtitle": eu.get("case_name") or "",
                    "date": str(eu["judgment_date"]) if eu.get("judgment_date") else None,
                    "citations": eu_cite_count.get(eu["eu_case_id"], 0),
                    "iteration": 1,
                    "isSeed": False,
                    "isDelimitation": False,
                })

    # --- Forarbeider → Provision edges (one node per document) ---
    all_prep_doc_ids: set[str] = set()
    for prov_id in provisions:
        law_name, law_section = parse_provision(prov_id)
        prep_refs = _section_filter(
            client.table("kofa_forarbeider_law_refs")
            .select("doc_id, section_number")
            .eq("law_name", law_name),
            "law_section", law_section,
        ).execute()
        for ref in prep_refs.data or []:
            doc_id = ref["doc_id"]
            all_prep_doc_ids.add(doc_id)
            node_id = f"forarbeid:{doc_id}"
            key = (node_id, prov_id)
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append({"from": key[0], "to": key[1], "valence": "unknown"})

    # Batch-fetch forarbeider metadata (single query for all provisions)
    if all_prep_doc_ids:
        prep_data = (
            client.table("kofa_forarbeider")
            .select("doc_id, title, full_title")
            .in_("doc_id", list(all_prep_doc_ids))
            .execute()
        )
        prep_map = {p["doc_id"]: p for p in (prep_data.data or [])}
        for did in all_prep_doc_ids:
            node_id = f"forarbeid:{did}"
            if node_id not in seen_prep:
                seen_prep.add(node_id)
                meta = prep_map.get(did, {})
                prep_nodes.append({
                    "id": node_id,
                    "type": "prep_work",
                    "label": meta.get("title") or did,
                    "subtitle": meta.get("full_title") or "",
                    "citations": 0,
                    "iteration": 1,
                    "isSeed": False,
                    "isDelimitation": False,
                })

    return edges, eu_nodes, prep_nodes


def _compute_gaps(
    provisions: list[str], ref_cases: dict[str, set[str]]
) -> list[dict]:
    """Compute gap matrix — provision pairs with shared case counts.

    For each pair of provisions, count cases that reference both.
    Gaps (count=0) are the interesting analytical finding.
    """
    if len(provisions) < 2:
        return []

    # Invert: provision → set of sak_nrs
    prov_to_cases: dict[str, set[str]] = {}
    for sak_nr, prov_set in ref_cases.items():
        for prov_id in prov_set:
            prov_to_cases.setdefault(prov_id, set()).add(sak_nr)

    for prov_id in provisions:
        prov_to_cases.setdefault(prov_id, set())

    gaps = []
    for i, p1 in enumerate(provisions):
        for p2 in provisions[i + 1:]:
            shared = prov_to_cases.get(p1, set()) & prov_to_cases.get(p2, set())
            _, s1 = parse_provision(p1)
            _, s2 = parse_provision(p2)
            gaps.append({
                "provision1": f"§{s1}",
                "provision2": f"§{s2}",
                "count": len(shared),
            })

    return gaps


def build_traversal_response(
    provisions: list[str],
    fts_terms: list[str],
    vector_query: str,
    seed_cases: list[str],
    regulation_filter: str,  # TODO: apply filter to exclude old-regulation cases
) -> dict:
    """Core traversal algorithm. Returns full TraversalResponse dict."""
    client = get_client()

    # --- 1. Collect signals ---
    ref_cases = collect_reference_signal(provisions)
    fts_cases = collect_fts_signal(fts_terms)
    from vector_seed import search_vector_cases
    vec_cases = search_vector_cases(vector_query)

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

    # --- 4. Batch-fetch law references for all discovered cases ---
    # Used for both regulation version detection AND edge building (avoids duplicate query)
    all_law_refs = (
        client.table("kofa_law_references")
        .select("sak_nr, law_name, law_section, regulation_version")
        .in_("sak_nr", sak_list)
        .execute()
    )
    all_law_refs_data = all_law_refs.data or []

    # A case's regulation = 'new' if ANY of its references are 'new'
    case_reg: dict[str, str] = {}
    for row in all_law_refs_data:
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

        node: dict = {
            "id": f"kofa:{sak_nr}",
            "type": "kofa_case",
            "label": sak_nr,
            "subtitle": case.get("saken_gjelder") or "",
            "date": str(case["avsluttet"]) if case.get("avsluttet") else None,
            "outcome": simplify_outcome(case.get("avgjoerelse")),
            "category": category,
            "signals": signals,
            "citations": 0,  # Filled in edge-building step
            "iteration": 1,
            "isSeed": sak_nr in seed_cases,
            "isDelimitation": False,
        }
        if reg:
            node["regulation"] = reg
        case_nodes.append(node)

    # --- 6. Build provision nodes ---
    provision_nodes = _build_provision_nodes(client, provisions)

    # --- 7. Build edges + compute citations ---
    edges, eu_nodes, prep_nodes = _build_edges(client, all_sak_nrs, provisions, all_law_refs_data)

    # Count how many OTHER cases cite each case (from full DB, not just graph)
    sak_list = [n["label"] for n in case_nodes]
    if sak_list:
        cite_result = (
            client.table("kofa_case_references")
            .select("to_sak_nr")
            .in_("to_sak_nr", sak_list)
            .limit(5000)
            .execute()
        )
        # Group by to_sak_nr to get per-case citation counts
        cite_by_sak: dict[str, int] = {}
        for row in cite_result.data or []:
            sak = row["to_sak_nr"]
            cite_by_sak[sak] = cite_by_sak.get(sak, 0) + 1
        for node in case_nodes:
            node["citations"] = cite_by_sak.get(node["label"], 0)

    # Provision citations: count incoming graph edges
    provision_id_set = {n["id"] for n in provision_nodes}
    prov_citation_counts: dict[str, int] = {}
    for edge in edges:
        if edge["to"] in provision_id_set:
            prov_citation_counts[edge["to"]] = prov_citation_counts.get(edge["to"], 0) + 1
    for node in provision_nodes:
        node["citations"] = prov_citation_counts.get(node["id"], 0)

    # --- 8. Gap matrix ---
    gaps = _compute_gaps(provisions, ref_cases)

    # --- 9. Suggested provisions ---
    # Find provisions frequently referenced by discovered cases but not in seed list
    seed_set = set(provisions)
    prov_counts: dict[str, int] = {}
    for row in all_law_refs_data:
        ref_section = row.get("law_section") or ""
        base = ref_section.split(" ")[0]  # strip "tredje ledd" etc
        prov_id = f"{row['law_name']}:{base}"
        if prov_id not in seed_set and row.get("regulation_version") == "new":
            prov_counts[prov_id] = prov_counts.get(prov_id, 0) + 1
    suggested = [
        {"id": pid, "count": cnt}
        for pid, cnt in sorted(prov_counts.items(), key=lambda x: -x[1])[:5]
    ]

    # --- 10. Stats ---
    all_nodes = provision_nodes + case_nodes + eu_nodes + prep_nodes
    stats = {
        "total": len(case_nodes),
        "categoryA": sum(1 for n in case_nodes if n.get("category") == "A"),
        "categoryB": sum(1 for n in case_nodes if n.get("category") == "B"),
        "categoryC": sum(1 for n in case_nodes if n.get("category") == "C"),
        "delimitations": sum(1 for n in case_nodes if n.get("isDelimitation")),
    }

    return {
        "nodes": all_nodes,
        "edges": edges,
        "gaps": gaps,
        "stats": stats,
        "suggestedProvisions": suggested,
    }
