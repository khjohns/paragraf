"""Generic hash-based output cache for LLM results.

Stores results in Supabase keyed by (analysis_id, cache_type, content_hash).
Used by synthesis, cross-propositions, and post-search to avoid redundant
LLM calls when inputs haven't changed.
"""
import hashlib
import json
import logging

from db import get_client

logger = logging.getLogger(__name__)

TABLE = "paragraf_llm_output_cache"


def _make_hash(*parts: str) -> str:
    """SHA-256 hash of concatenated parts."""
    content = json.dumps(parts, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


def get_cached(analysis_id: str, cache_type: str, content_hash: str) -> dict | None:
    """Look up a cached LLM result.

    Returns the cached result dict, or None if not found.
    """
    try:
        client = get_client()
        result = (
            client.table(TABLE)
            .select("result_json")
            .eq("analysis_id", analysis_id)
            .eq("cache_type", cache_type)
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if rows:
            logger.info("Cache HIT for %s/%s", cache_type, analysis_id[:8])
            return rows[0]["result_json"]
    except Exception as e:
        logger.warning("Cache lookup feilet (fortsetter uten cache): %s", e)
    return None


def set_cached(
    analysis_id: str, cache_type: str, content_hash: str, result: dict
) -> None:
    """Store an LLM result in cache."""
    try:
        client = get_client()
        client.table(TABLE).upsert(
            {
                "analysis_id": analysis_id,
                "cache_type": cache_type,
                "content_hash": content_hash,
                "result_json": result,
            },
            on_conflict="analysis_id,cache_type,content_hash",
        ).execute()
    except Exception as e:
        logger.warning("Cache write feilet (ikke kritisk): %s", e)


def make_synthesis_hash(problem: str, candidates: list[dict], provisions: list[str]) -> str:
    """Hash for synthesis cache — changes when problem, candidates, screening, or provisions change."""
    candidate_keys = sorted(
        f"{c.get('sak_nr', '')}:{c.get('category', '')}:{c.get('ai_screening', {}).get('proposition', '')}"
        for c in candidates
    )
    return _make_hash(problem, json.dumps(candidate_keys), json.dumps(sorted(provisions)))


def make_cross_props_hash(problem: str, candidates: list[dict]) -> str:
    """Hash for cross-propositions cache."""
    candidate_data = sorted(
        f"{c.get('sak_nr', '')}:{c.get('ai_screening', {}).get('proposition', '')}"
        for c in candidates
    )
    return _make_hash(problem, json.dumps(candidate_data))


def make_post_search_hash(problem: str, provisions: list[str], screening_summary: str) -> str:
    """Hash for post-search cache."""
    return _make_hash(problem, json.dumps(sorted(provisions)), screening_summary)
