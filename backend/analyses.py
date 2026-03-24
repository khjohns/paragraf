"""CRUD operations for analyses."""
from db import get_client
from traversal import apply_case_meta


def list_analyses(user_id=None):
    """List all analyses with provision seeds and candidate counts."""
    q = get_client().table("analyses").select(
        "id, title, problem, status, iteration, created_at, updated_at, "
        "analysis_seeds(seed_type, value), "
        "analysis_candidates(id, category, read_at, screening_status)"
    ).order("updated_at", desc=True)
    if user_id:
        q = q.eq("user_id", user_id)
    rows = q.execute().data

    result = []
    for row in rows:
        seeds = row.pop("analysis_seeds", [])
        candidates = row.pop("analysis_candidates", [])
        row["provisions"] = [s["value"] for s in seeds if s["seed_type"] == "provision"]
        row["candidate_count"] = len(candidates)
        row["read_count"] = sum(1 for c in candidates if c.get("read_at"))
        abc = {"A": 0, "B": 0, "C": 0}
        abc_unread = {"A": 0, "B": 0, "C": 0}
        screened = 0
        for c in candidates:
            cat = c.get("category")
            if cat in abc:
                abc[cat] += 1
                if not c.get("read_at"):
                    abc_unread[cat] += 1
            if c.get("screening_status") == "ai_screened":
                screened += 1
        row["abc_counts"] = abc
        row["abc_unread"] = abc_unread
        row["screened_count"] = screened
        result.append(row)

    return result


def get_analysis(analysis_id):
    """Get a single analysis with its seeds and candidates (single query with joins)."""
    result = (
        get_client()
        .table("analyses")
        .select("*, analysis_seeds(*), analysis_candidates(id, sak_nr, category, signals, iteration, screening_status, ai_screening, user_notes, is_delimitation, read_at)")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not result:
        return None

    # Rename joined keys to match API contract
    result["seeds"] = result.pop("analysis_seeds", [])
    result["candidates"] = result.pop("analysis_candidates", [])

    # Enrich candidates with case metadata (subtitle, date, outcome)
    sak_nrs = [c["sak_nr"] for c in result["candidates"]]
    if sak_nrs:
        cases = (
            get_client()
            .table("kofa_cases")
            .select("sak_nr, saken_gjelder, avsluttet, avgjoerelse")
            .in_("sak_nr", sak_nrs)
            .execute()
            .data
        ) or []
        case_meta = {c["sak_nr"]: c for c in cases}
        for candidate in result["candidates"]:
            apply_case_meta(candidate, case_meta.get(candidate["sak_nr"], {}))

    return result


def get_analysis_with_seeds(analysis_id):
    """Get analysis with seeds only (no candidates). Used by traverse endpoint."""
    result = (
        get_client()
        .table("analyses")
        .select("id, status, iteration, analysis_seeds(*)")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not result:
        return None
    result["seeds"] = result.pop("analysis_seeds", [])
    return result


def create_analysis(title, problem=""):
    """Create a new analysis."""
    result = (
        get_client()
        .table("analyses")
        .insert({"title": title, "problem": problem, "status": "scoping"})
        .execute()
        .data
    )
    return result[0] if result else None


def update_analysis(analysis_id, updates):
    """Update analysis fields. Accepts: title, problem, refined_problem, sub_problems, context, status, iteration."""
    allowed = {"title", "problem", "refined_problem", "sub_problems", "context", "status", "iteration", "gaps", "scoping_result"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return None
    result = (
        get_client()
        .table("analyses")
        .update(filtered)
        .eq("id", analysis_id)
        .execute()
        .data
    )
    return result[0] if result else None


def upsert_seeds(analysis_id, seeds_data):
    """Replace all seeds for an analysis. seeds_data is a dict with provisions, ftsTerms, vectorQuery, cases."""
    client = get_client()

    # Delete existing seeds
    client.table("analysis_seeds").delete().eq("analysis_id", analysis_id).execute()

    rows = []
    for prov in seeds_data.get("provisions", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "provision", "value": prov})
    for term in seeds_data.get("ftsTerms", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "fts", "value": term})
    if seeds_data.get("vectorQuery"):
        rows.append({"analysis_id": analysis_id, "seed_type": "vector", "value": seeds_data["vectorQuery"]})
    for case in seeds_data.get("cases", []):
        rows.append({"analysis_id": analysis_id, "seed_type": "case", "value": case})

    if rows:
        client.table("analysis_seeds").insert(rows).execute()


def persist_candidates(analysis_id, case_nodes, iteration, force_signals=False):
    """Persist traversal case nodes as analysis_candidates.

    Uses upsert on (analysis_id, sak_nr) to update iteration
    without overwriting screening results (ai_screening, screening_status, user_notes).

    ADR-006 invariant: signals (incl. discovery_rank) are set by traversal and
    never overwritten by downstream steps. If a candidate already has signals in DB,
    they are preserved unless force_signals=True (explicit re-scope).
    Category is NOT set by traversal (always None) — set later by screening.
    """
    client = get_client()

    sak_nrs_in_nodes = []
    node_by_sak: dict[str, dict] = {}
    for node in case_nodes:
        if node.get("type") != "kofa_case":
            continue
        sak_nr = node.get("label") or node["id"].replace("kofa:", "")
        sak_nrs_in_nodes.append(sak_nr)
        node_by_sak[sak_nr] = node

    if not sak_nrs_in_nodes:
        return 0

    # Fetch existing candidates to check which already have signals or screening
    existing_with_signals: set[str] = set()
    existing_screened: set[str] = set()
    if not force_signals:
        existing = (
            client.table("analysis_candidates")
            .select("sak_nr, signals, screening_status, category")
            .eq("analysis_id", analysis_id)
            .in_("sak_nr", sak_nrs_in_nodes)
            .execute()
            .data
        ) or []
        existing_with_signals = {
            r["sak_nr"] for r in existing
            if r.get("signals") and r["signals"].get("discovery_rank") is not None
        }
        existing_screened = {
            r["sak_nr"] for r in existing
            if r.get("screening_status") == "ai_screened" and r.get("category")
        }

    rows = []
    for sak_nr, node in node_by_sak.items():
        row: dict = {
            "analysis_id": analysis_id,
            "sak_nr": sak_nr,
            "iteration": iteration,
        }
        # ADR-006: preserve existing signals unless force_signals is set
        if sak_nr not in existing_with_signals:
            row["signals"] = node.get("signals", {})
        # ADR-006: don't overwrite screening-set category with None from traversal
        if sak_nr not in existing_screened:
            row["category"] = node.get("category")  # None from traversal
        rows.append(row)

    if rows:
        # Only update traversal-derived fields; preserve screening data
        client.table("analysis_candidates").upsert(
            rows,
            on_conflict="analysis_id,sak_nr",
            default_to_null=False,
        ).execute()

    return len(rows)


def parse_seed_rows(seed_rows):
    """Convert DB seed rows back to {provisions, fts_terms, vector_query, seed_cases}."""
    provisions = [s["value"] for s in seed_rows if s["seed_type"] == "provision"]
    fts_terms = [s["value"] for s in seed_rows if s["seed_type"] == "fts"]
    vector_query = next((s["value"] for s in seed_rows if s["seed_type"] == "vector"), "")
    seed_cases = [s["value"] for s in seed_rows if s["seed_type"] == "case"]
    return {
        "provisions": provisions,
        "fts_terms": fts_terms,
        "vector_query": vector_query,
        "seed_cases": seed_cases,
    }


def get_analysis_documents(analysis_id):
    """Get synthesis note, QA report and cross-propositions for an analysis from analysis_documents."""
    rows = (
        get_client()
        .table("analysis_documents")
        .select("doc_type, content, version")
        .eq("analysis_id", analysis_id)
        .in_("doc_type", ["note", "qa_report", "cross_propositions"])
        .execute()
        .data
    )
    result = {}
    for row in (rows or []):
        result[row["doc_type"]] = row
    return result


def update_candidate(analysis_id, sak_nr, updates):
    """Update a candidate's user_notes, is_delimitation, read_at, or screening_status."""
    allowed = {"user_notes", "is_delimitation", "read_at", "screening_status", "ai_screening"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return None
    result = (
        get_client()
        .table("analysis_candidates")
        .update(filtered)
        .eq("analysis_id", analysis_id)
        .eq("sak_nr", sak_nr)
        .execute()
        .data
    )
    return result[0] if result else None
