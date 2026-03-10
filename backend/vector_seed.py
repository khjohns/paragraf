"""
Vector search for KOFA decision text using Gemini embeddings.

Generates embeddings via Google Gemini (gemini-embedding-001),
then calls search_kofa_decision_hybrid RPC for hybrid FTS+vector search.
"""

import logging
import math
import os
from functools import lru_cache

from db import get_client

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 1536
TASK_TYPE_QUERY = "RETRIEVAL_QUERY"

_genai_client = None


def _get_genai_client():
    """Get or create Gemini API client lazily."""
    global _genai_client
    if _genai_client is not None:
        return _genai_client

    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY must be set for vector search")
    _genai_client = genai.Client(api_key=api_key)
    return _genai_client


def _normalize(embedding: list[float]) -> list[float]:
    """Normalize embedding to unit length."""
    norm = math.sqrt(sum(x * x for x in embedding))
    return [x / norm for x in embedding] if norm > 0 else embedding


@lru_cache(maxsize=256)
def _generate_query_embedding(query: str) -> tuple[float, ...]:
    """Generate embedding for search query with caching."""
    from google.genai import types

    client = _get_genai_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config=types.EmbedContentConfig(
            task_type=TASK_TYPE_QUERY,
            output_dimensionality=EMBEDDING_DIM,
        ),
    )
    embedding = result.embeddings[0]  # type: ignore[index]
    normalized = _normalize(list(embedding.values))  # type: ignore[arg-type]
    return tuple(normalized)


def search_vector_cases(query: str, max_results: int = 50) -> set[str]:
    """Search KOFA decisions by vector similarity.

    Returns set of sak_nr found via hybrid vector+FTS search.
    Falls back to empty set if embedding API fails.
    """
    if not query.strip():
        return set()

    try:
        query_embedding = list(_generate_query_embedding(query))
    except Exception as e:
        logger.error(f"Gemini embedding failed, skipping V signal: {e}")
        return set()

    client = get_client()
    result = client.rpc(
        "search_kofa_decision_hybrid",
        {
            "query_text": query,
            "query_embedding": query_embedding,
            "match_count": max_results,
        },
    ).execute()

    return {row["sak_nr"] for row in (result.data or [])}
