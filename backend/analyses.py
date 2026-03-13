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
        .select("*, analysis_seeds(*), analysis_candidates(id, sak_nr, category, signals, iteration, screening_status, user_notes, is_delimitation, read_at)")
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
    allowed = {"title", "problem", "refined_problem", "sub_problems", "context", "status", "iteration"}
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


def update_candidate(analysis_id, sak_nr, updates):
    """Update a candidate's user_notes, is_delimitation, read_at, or screening_status."""
    allowed = {"user_notes", "is_delimitation", "read_at", "screening_status"}
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
