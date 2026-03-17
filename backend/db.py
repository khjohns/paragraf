import logging
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client():
    """Get shared Supabase client (singleton via lru_cache)."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

    return create_client(url, key)


def db_query_with_retry(fn):
    """Execute a DB query function, retrying once with a fresh client on connection errors.

    ``fn`` receives a Supabase client and should return the query result.
    Handles stale HTTP/2 connections in the shared client's connection pool.
    """
    try:
        return fn(get_client())
    except Exception as e:
        err_msg = str(e).lower()
        if "disconnected" in err_msg or "remoteerror" in err_msg or "connection" in err_msg:
            logger.warning("DB connection error, retrying with fresh client: %s", e)
            get_client.cache_clear()
            return fn(get_client())
        raise
