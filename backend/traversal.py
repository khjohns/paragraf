from __future__ import annotations

from db import get_client

# Eckhoff-based authority weight per node type (§34 in design spec)
AUTHORITY_WEIGHT: dict[str, float] = {
    "provision": 1.0,
    "kofa_case": 0.4,
    "eu_case": 0.9,
    "court_case": 1.0,  # HR; lagmannsrett would be 0.7
    "prep_work": 0.6,
}


def compute_case_score(
    signal_count: int,
    citation_count: int,
    max_citations: int,
    authority_weight: float,
) -> float:
    """Compute final_score for ranking within each category.

    signal_score: normalized 0-1 from signal_count (1-3)
    centrality: normalized citation_count / max_citations
    authority: static per node type
    """
    signal_score = signal_count / 3.0
    centrality = citation_count / max_citations if max_citations > 0 else 0
    return signal_score * 0.4 + centrality * 0.3 + authority_weight * 0.3


def _section_filter(query, column: str, law_section: str):
    """Match exact section OR section with sub-section suffix (space-separated).

    Prevents '16-1' from matching '16-10' — only matches '16-1' or '16-1 (1)'.
    """
    return query.or_(f"{column}.eq.{law_section},{column}.like.{law_section} %")


def _matches_provision(ref: dict, law_name: str, law_section: str) -> bool:
    """Check if a law reference row matches a given provision."""
    ref_section = ref.get("law_section") or ""
    return ref["law_name"] == law_name and (
        ref_section == law_section or ref_section.startswith(law_section + " ")
    )


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


def apply_case_meta(record: dict, meta: dict) -> None:
    """Enrich a mutable dict with saken_gjelder/avsluttet/avgjoerelse from a kofa_cases row."""
    record["saken_gjelder"] = meta.get("saken_gjelder") or ""
    record["avsluttet"] = str(meta["avsluttet"]) if meta.get("avsluttet") else None
    record["avgjoerelse"] = simplify_outcome(meta.get("avgjoerelse"))


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


def _add_edge(
    edges: list[dict], seen: set[tuple[str, str]],
    from_id: str, to_id: str, **extra,
) -> None:
    """Append an edge if not already seen."""
    key = (from_id, to_id)
    if key not in seen:
        seen.add(key)
        edges.append({"from": from_id, "to": to_id, "valence": "unknown", **extra})


def _build_case_provision_edges(
    law_refs_data: list[dict], provisions: list[str],
    edges: list[dict], seen_edges: set[tuple[str, str]],
) -> None:
    """Case → Provision edges from pre-fetched law references."""
    by_law: dict[str, list[tuple[str, str]]] = {}
    for pid in provisions:
        law_name, law_section = parse_provision(pid)
        by_law.setdefault(law_name, []).append((pid, law_section))
    for ref in law_refs_data:
        candidates = by_law.get(ref["law_name"])
        if not candidates:
            continue
        for prov_id, law_section in candidates:
            if _matches_provision(ref, ref["law_name"], law_section):
                _add_edge(edges, seen_edges, f"kofa:{ref['sak_nr']}", prov_id)
                break


def _build_case_case_edges(
    client, case_sak_nrs: set[str],
    edges: list[dict], seen_edges: set[tuple[str, str]],
) -> None:
    """Case → Case edges from kofa_case_references."""
    case_refs = (
        client.table("kofa_case_references")
        .select("from_sak_nr, to_sak_nr, context")
        .in_("from_sak_nr", list(case_sak_nrs))
        .execute()
    )
    for ref in case_refs.data or []:
        if ref["to_sak_nr"] in case_sak_nrs:
            _add_edge(
                edges, seen_edges,
                f"kofa:{ref['from_sak_nr']}", f"kofa:{ref['to_sak_nr']}",
                context=ref.get("context"),
            )


def _build_eu_edges(
    client, case_sak_nrs: set[str],
    edges: list[dict], seen_edges: set[tuple[str, str]],
) -> list[dict]:
    """Case → EU edges. Returns eu_nodes."""
    eu_refs = (
        client.table("kofa_eu_references")
        .select("sak_nr, eu_case_id, eu_case_name, context")
        .in_("sak_nr", list(case_sak_nrs))
        .execute()
    )
    eu_cite_count: dict[str, int] = {}
    eu_ids: set[str] = set()
    for ref in eu_refs.data or []:
        eu_id = ref["eu_case_id"]
        eu_ids.add(eu_id)
        eu_cite_count[eu_id] = eu_cite_count.get(eu_id, 0) + 1
        _add_edge(edges, seen_edges, f"kofa:{ref['sak_nr']}", f"eu:{eu_id}")

    if not eu_ids:
        return []

    eu_data = (
        client.table("kofa_eu_case_law")
        .select("eu_case_id, case_name, judgment_date, subject")
        .in_("eu_case_id", list(eu_ids))
        .execute()
    )
    eu_nodes: list[dict] = []
    seen_eu: set[str] = set()
    for eu in eu_data.data or []:
        node_id = f"eu:{eu['eu_case_id']}"
        if node_id in seen_eu:
            continue
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
    return eu_nodes


def _build_prep_edges(
    client, provisions: list[str],
    edges: list[dict], seen_edges: set[tuple[str, str]],
) -> list[dict]:
    """Forarbeider → Provision edges. Returns prep_nodes."""
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
            _add_edge(edges, seen_edges, f"forarbeid:{doc_id}", prov_id)

    if not all_prep_doc_ids:
        return []

    prep_data = (
        client.table("kofa_forarbeider")
        .select("doc_id, title, full_title")
        .in_("doc_id", list(all_prep_doc_ids))
        .execute()
    )
    prep_map = {p["doc_id"]: p for p in (prep_data.data or [])}
    prep_nodes: list[dict] = []
    seen_prep: set[str] = set()
    for did in all_prep_doc_ids:
        node_id = f"forarbeid:{did}"
        if node_id in seen_prep:
            continue
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
    return prep_nodes


def _build_edges(
    client, case_sak_nrs: set[str], provisions: list[str],
    law_refs_data: list[dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Build edges and collect EU + forarbeider nodes.

    Returns (edges, eu_nodes, prep_nodes).
    law_refs_data is pre-fetched from kofa_law_references (avoids duplicate query).
    """
    edges: list[dict] = []
    seen_edges: set[tuple[str, str]] = set()

    _build_case_provision_edges(law_refs_data, provisions, edges, seen_edges)
    _build_case_case_edges(client, case_sak_nrs, edges, seen_edges)
    eu_nodes = _build_eu_edges(client, case_sak_nrs, edges, seen_edges)
    prep_nodes = _build_prep_edges(client, provisions, edges, seen_edges)

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
                "id1": p1,
                "id2": p2,
                "count": len(shared),
            })

    return gaps


def _detect_regulation_versions(law_refs_data: list[dict]) -> dict[str, str]:
    """Detect regulation version per case. 'new' if ANY reference is 'new'."""
    case_reg: dict[str, str] = {}
    for row in law_refs_data:
        sak = row["sak_nr"]
        if row.get("regulation_version") == "new":
            case_reg[sak] = "new"
        elif sak not in case_reg:
            case_reg[sak] = "old"
    return case_reg


def _classify_category(signal_count: int) -> str:
    """Classify case into A/B/C based on signal count."""
    if signal_count >= 2:
        return "A"
    if signal_count == 1:
        return "B"
    return "C"


def _build_case_nodes(
    all_sak_nrs: set[str], case_map: dict[str, dict],
    ref_cases: dict[str, set[str]], fts_cases: set[str], vec_cases: set[str],
    seed_cases: list[str], case_reg: dict[str, str],
) -> list[dict]:
    """Build GraphNode dicts for all discovered KOFA cases."""
    case_nodes = []
    for sak_nr in all_sak_nrs:
        case = case_map.get(sak_nr)
        if not case:
            continue

        # Canonical format: boolean {ref, fts, vec} — must match frontend SignalHits type
        signals = {"ref": sak_nr in ref_cases, "fts": sak_nr in fts_cases, "vec": sak_nr in vec_cases}
        category = _classify_category(sum(signals.values()))
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
            "citations": 0,
            "iteration": 1,
            "isSeed": sak_nr in seed_cases,
            "isDelimitation": False,
        }
        if reg:
            node["regulation"] = reg
        case_nodes.append(node)
    return case_nodes


def _fill_case_citations(client, case_nodes: list[dict]) -> None:
    """Fetch and fill citation counts for case nodes."""
    sak_list = [n["label"] for n in case_nodes]
    if not sak_list:
        return

    cite_result = (
        client.table("kofa_case_references")
        .select("to_sak_nr")
        .in_("to_sak_nr", sak_list)
        .limit(5000)
        .execute()
    )
    cite_by_sak: dict[str, int] = {}
    for row in cite_result.data or []:
        sak = row["to_sak_nr"]
        cite_by_sak[sak] = cite_by_sak.get(sak, 0) + 1
    for node in case_nodes:
        node["citations"] = cite_by_sak.get(node["label"], 0)


def _compute_case_scores(case_nodes: list[dict]) -> None:
    """Compute and set final_score on each case node."""
    max_cite = max((n["citations"] for n in case_nodes), default=0)
    for node in case_nodes:
        signal_count = sum(node.get("signals", {}).values())
        node["score"] = round(compute_case_score(
            signal_count=signal_count,
            citation_count=node["citations"],
            max_citations=max_cite,
            authority_weight=AUTHORITY_WEIGHT.get(node["type"], 0.4),
        ), 4)


def _fill_provision_citations(provision_nodes: list[dict], edges: list[dict]) -> None:
    """Count incoming edges to each provision node and set citations."""
    provision_id_set = {n["id"] for n in provision_nodes}
    prov_citation_counts: dict[str, int] = {}
    for edge in edges:
        if edge["to"] in provision_id_set:
            prov_citation_counts[edge["to"]] = prov_citation_counts.get(edge["to"], 0) + 1
    for node in provision_nodes:
        node["citations"] = prov_citation_counts.get(node["id"], 0)


def _compute_suggested_provisions(
    all_law_refs_data: list[dict], seed_provisions: list[str],
) -> list[dict]:
    """Find provisions frequently referenced by discovered cases but not in seed list."""
    seed_set = set(seed_provisions)
    prov_counts: dict[str, int] = {}
    for row in all_law_refs_data:
        if row.get("regulation_version") != "new":
            continue
        ref_section = row.get("law_section") or ""
        base = ref_section.split(" ")[0]
        prov_id = f"{row['law_name']}:{base}"
        if prov_id not in seed_set:
            prov_counts[prov_id] = prov_counts.get(prov_id, 0) + 1
    return [
        {"id": pid, "count": cnt}
        for pid, cnt in sorted(prov_counts.items(), key=lambda x: -x[1])[:5]
    ]


def _compute_stats(case_nodes: list[dict]) -> dict:
    """Compute category statistics for case nodes."""
    counts = {"A": 0, "B": 0, "C": 0}
    delimitations = 0
    for n in case_nodes:
        cat = n.get("category")
        if cat in counts:
            counts[cat] += 1
        if n.get("isDelimitation"):
            delimitations += 1
    return {
        "total": len(case_nodes),
        "categoryA": counts["A"],
        "categoryB": counts["B"],
        "categoryC": counts["C"],
        "delimitations": delimitations,
    }


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
            "stats": _compute_stats([]),
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
    all_law_refs = (
        client.table("kofa_law_references")
        .select("sak_nr, law_name, law_section, regulation_version")
        .in_("sak_nr", sak_list)
        .execute()
    )
    all_law_refs_data = all_law_refs.data or []

    # --- 5. Build case nodes ---
    case_reg = _detect_regulation_versions(all_law_refs_data)
    case_nodes = _build_case_nodes(
        all_sak_nrs, case_map, ref_cases, fts_cases, vec_cases, seed_cases, case_reg,
    )

    # --- 6. Build provision nodes ---
    provision_nodes = _build_provision_nodes(client, provisions)

    # --- 7. Build edges + citations ---
    edges, eu_nodes, prep_nodes = _build_edges(client, all_sak_nrs, provisions, all_law_refs_data)
    _fill_case_citations(client, case_nodes)
    _compute_case_scores(case_nodes)
    _fill_provision_citations(provision_nodes, edges)

    return {
        "nodes": provision_nodes + case_nodes + eu_nodes + prep_nodes,
        "edges": edges,
        "gaps": _compute_gaps(provisions, ref_cases),
        "stats": _compute_stats(case_nodes),
        "suggestedProvisions": _compute_suggested_provisions(all_law_refs_data, provisions),
    }
