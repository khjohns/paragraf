import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


@lru_cache(maxsize=1)
def get_client():
    """Get shared Supabase client (singleton via lru_cache)."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

    return create_client(url, key)
