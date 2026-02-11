"""
Vector search for Lovdata with hybrid FTS+embedding search.

Combines semantic vector search with PostgreSQL full-text search
for best results on both natural language and legal terminology.
"""

import logging
import math
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from paragraf._supabase_utils import get_shared_client, with_retry

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 1536
DEFAULT_FTS_WEIGHT = 0.5  # Configurable starting point
TASK_TYPE_QUERY = "RETRIEVAL_QUERY"  # Optimized for search queries


@dataclass
class VectorSearchResult:
    """Result from hybrid vector search."""

    dok_id: str
    section_id: str
    title: str | None
    content: str
    short_title: str
    doc_type: str
    ministry: str | None
    based_on: str | None
    legal_area: str | None
    similarity: float
    fts_rank: float
    combined_score: float

    @property
    def reference(self) -> str:
        """Format as legal reference."""
        return f"{self.short_title} § {self.section_id}"

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "dok_id": self.dok_id,
            "section_id": self.section_id,
            "title": self.title,
            "content": self.content,
            "short_title": self.short_title,
            "doc_type": self.doc_type,
            "ministry": self.ministry,
            "based_on": self.based_on,
            "legal_area": self.legal_area,
            "similarity": self.similarity,
            "fts_rank": self.fts_rank,
            "combined_score": self.combined_score,
            "reference": self.reference,
        }


class LovdataVectorSearch:
    """
    Hybrid vector search for Lovdata.

    Combines semantic vector search with PostgreSQL FTS for
    best results on both natural language and legal terminology.
    """

    _EMBED_URL = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"
    )

    def __init__(self):
        self.supabase = get_shared_client()
        self._api_key: str | None = None
        self._http_client = None

    def _get_api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key
        self._api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY must be set for vector search")
        return self._api_key

    def _get_http_client(self):
        if self._http_client is not None:
            return self._http_client
        import httpx

        self._http_client = httpx.Client(timeout=30.0)
        return self._http_client

    @staticmethod
    def _normalize(embedding: list[float]) -> list[float]:
        """Normalize embedding to unit length."""
        norm = math.sqrt(sum(x * x for x in embedding))
        return [x / norm for x in embedding] if norm > 0 else embedding

    @lru_cache(maxsize=1000)
    def _generate_query_embedding(self, query: str) -> tuple[float, ...]:
        """
        Generate embedding via Gemini REST API (avoids google-genai SDK import issues).

        Caches results to avoid repeated API calls for same query.
        Returns tuple (immutable) for caching compatibility.
        Uses RETRIEVAL_QUERY task type for optimized search quality.
        """
        client = self._get_http_client()
        resp = client.post(
            self._EMBED_URL,
            params={"key": self._get_api_key()},
            json={
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {"parts": [{"text": query}]},
                "taskType": TASK_TYPE_QUERY,
                "outputDimensionality": EMBEDDING_DIM,
            },
        )
        resp.raise_for_status()
        values = resp.json()["embedding"]["values"]
        normalized = self._normalize(values)
        return tuple(normalized)

    def _fallback_fts_search(self, query: str, limit: int) -> list[VectorSearchResult]:
        """Fallback to pure FTS on embedding API error."""
        logger.warning(f"Fallback to FTS for query: {query[:50]}...")

        # Use existing FTS search
        result = self.supabase.rpc(
            "search_lovdata", {"query_text": query, "max_results": limit}
        ).execute()

        if not result.data or not isinstance(result.data, list):
            return []

        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return [
            VectorSearchResult(
                dok_id=row["dok_id"],
                section_id="",  # FTS returns document-level
                title=row.get("title"),
                content=row.get("snippet", ""),
                short_title=row.get("short_title", ""),
                doc_type=row.get("doc_type", ""),
                ministry=row.get("ministry"),
                based_on=row.get("based_on"),
                legal_area=row.get("legal_area"),
                similarity=0.0,
                fts_rank=row.get("rank", 0.0),
                combined_score=row.get("rank", 0.0),
            )
            for row in rows
        ]

    @with_retry()
    def search(
        self,
        query: str,
        limit: int = 10,
        fts_weight: float = DEFAULT_FTS_WEIGHT,
        ivfflat_probes: int = 10,
        doc_type: str | None = None,
        ministry: str | None = None,
        exclude_amendments: bool = True,
        legal_area: str | None = None,
    ) -> list[VectorSearchResult]:
        """
        Perform hybrid search with optional filters.

        Args:
            query: Search query (natural language)
            limit: Max number of results
            fts_weight: Weight for FTS vs vector (0-1, default 0.5)
            ivfflat_probes: IVFFlat probe count (higher = better recall, slower, default 10)
            doc_type: Filter by document type ("lov" or "forskrift")
            ministry: Filter by ministry (partial match, e.g., "Klima" matches "Klima- og miljødepartementet")
            exclude_amendments: Exclude amendment laws from results (default True)
            legal_area: Filter by legal area (partial match)

        Returns:
            List of VectorSearchResult sorted by relevance
        """
        # Generate query embedding with fallback to FTS on error
        try:
            query_embedding = list(self._generate_query_embedding(query))
        except Exception as e:
            logger.error(f"Embedding API error: {e}")
            return self._fallback_fts_search(query, limit)

        # Call hybrid search function with filters
        result = self.supabase.rpc(
            "search_lovdata_hybrid",
            {
                "query_text": query,
                "query_embedding": query_embedding,
                "match_count": limit,
                "fts_weight": fts_weight,
                "ivfflat_probes": ivfflat_probes,
                "doc_type_filter": doc_type,
                "ministry_filter": ministry,
                "exclude_amendments": exclude_amendments,
                "legal_area_filter": legal_area,
            },
        ).execute()

        if not result.data or not isinstance(result.data, list):
            return []

        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return [
            VectorSearchResult(
                dok_id=row["dok_id"],
                section_id=row["section_id"],
                title=row.get("title"),
                content=row["content"],
                short_title=row["short_title"],
                doc_type=row["doc_type"],
                ministry=row.get("ministry"),
                based_on=row.get("based_on"),
                legal_area=row.get("legal_area"),
                similarity=row["similarity"],
                fts_rank=row["fts_rank"],
                combined_score=row["combined_score"],
            )
            for row in rows
        ]

    def search_semantic_only(
        self, query: str, limit: int = 10, ivfflat_probes: int = 10
    ) -> list[VectorSearchResult]:
        """Pure vector search (for testing/comparison)."""
        try:
            query_embedding = list(self._generate_query_embedding(query))
        except Exception as e:
            logger.error(f"Embedding API error: {e}")
            return []

        result = self.supabase.rpc(
            "search_lovdata_vector",
            {
                "query_embedding": query_embedding,
                "match_count": limit,
                "ivfflat_probes": ivfflat_probes,
            },
        ).execute()

        if not result.data or not isinstance(result.data, list):
            return []

        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return [
            VectorSearchResult(
                dok_id=row["dok_id"],
                section_id=row["section_id"],
                title=row.get("title"),
                content=row["content"],
                short_title=row["short_title"],
                doc_type=row["doc_type"],
                ministry=row.get("ministry"),
                based_on=row.get("based_on"),
                legal_area=row.get("legal_area"),
                similarity=row["similarity"],
                fts_rank=0.0,
                combined_score=row["similarity"],
            )
            for row in rows
        ]

    def search_fts_only(self, query: str, limit: int = 10) -> list[VectorSearchResult]:
        """Pure FTS search (for testing/comparison)."""
        return self.search(query, limit, fts_weight=1.0)

    def get_embedding_stats(self) -> dict:
        """Get statistics about embeddings in database."""
        total = self.supabase.table("lovdata_sections").select("id", count="exact").execute()  # type: ignore[arg-type]

        embedded = (
            self.supabase.table("lovdata_sections")
            .select("id", count="exact")  # type: ignore[arg-type]
            .not_.is_("embedding", "null")
            .execute()
        )

        total_count = total.count or 0
        embedded_count = embedded.count or 0
        return {
            "total_sections": total_count,
            "embedded_sections": embedded_count,
            "coverage_pct": (embedded_count / total_count * 100) if total_count > 0 else 0,
        }
