"""CRUD operations for analyses."""
from db import get_client


def list_analyses(user_id=None):
    """List all analyses, optionally filtered by user."""
    q = get_client().table("analyses").select(
        "id, title, problem, status, iteration, created_at, updated_at"
    ).order("updated_at", desc=True)
    if user_id:
        q = q.eq("user_id", user_id)
    return q.execute().data


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
        .insert({"title": title, "problem": problem})
        .execute()
        .data
    )
    return result[0] if result else None


def update_analysis(analysis_id, updates):
    """Update analysis fields. Accepts: title, problem, refined_problem, sub_problems, context, status, iteration."""
    allowed = {"title", "problem", "refined_problem", "sub_problems", "context", "status", "iteration", "gaps"}
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


def persist_candidates(analysis_id, case_nodes, iteration):
    """Persist traversal case nodes as analysis_candidates.

    Uses upsert on (analysis_id, sak_nr) to update category/signals/iteration
    without overwriting screening results (ai_screening, screening_status, user_notes).
    """
    client = get_client()

    rows = []
    for node in case_nodes:
        if node.get("type") != "kofa_case":
            continue
        sak_nr = node.get("label") or node["id"].replace("kofa:", "")
        rows.append({
            "analysis_id": analysis_id,
            "sak_nr": sak_nr,
            "category": node.get("category"),
            "signals": node.get("signals", {}),
            "iteration": iteration,
        })

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
    """Get synthesis note and QA report for an analysis from analysis_documents."""
    rows = (
        get_client()
        .table("analysis_documents")
        .select("doc_type, content, version")
        .eq("analysis_id", analysis_id)
        .in_("doc_type", ["note", "qa_report"])
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
