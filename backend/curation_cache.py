import hashlib
import json

from db import get_client


def make_problem_hash(problem_statement: str, seed_provisions: list[str]) -> str:
    """SHA-256 hash of problem statement + seed provisions for cache key."""
    content = json.dumps(
        {"problem_statement": problem_statement, "seed_provisions": sorted(seed_provisions)},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(content.encode()).hexdigest()


def get_cached_curation(sak_nr: str, problem_hash: str) -> dict | None:
    """Check Supabase cache for existing curation."""
    client = get_client()
    result = (
        client.table("paragraf_ai_curations")
        .select("curation_json")
        .eq("sak_nr", sak_nr)
        .eq("problem_hash", problem_hash)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if rows:
        return rows[0]["curation_json"]
    return None


def cache_curation(
    sak_nr: str, problem_hash: str, curation_data: dict, model: str
) -> None:
    """Store curation result in Supabase cache."""
    client = get_client()
    client.table("paragraf_ai_curations").upsert(
        {
            "sak_nr": sak_nr,
            "problem_hash": problem_hash,
            "curation_json": curation_data,
            "model": model,
        },
        on_conflict="sak_nr,problem_hash",
    ).execute()
