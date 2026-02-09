-- 002: Document metadata enrichment
-- Adds: is_amendment flag, ministry filter for FTS, new metadata columns
-- Depends on: 001_complete_schema.sql

-- =============================================================================
-- 1. is_amendment column - identify amendment laws/regulations
-- =============================================================================

ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS is_amendment BOOLEAN DEFAULT FALSE;

-- Populate from existing data (title-based heuristic)
UPDATE lovdata_documents SET is_amendment = TRUE
WHERE title ILIKE '%endring i %'
   OR title ILIKE '%endringer i %'
   OR title ILIKE '%endringslov%'
   OR title ILIKE '%endr. i %';

CREATE INDEX IF NOT EXISTS idx_lovdata_documents_is_amendment
    ON lovdata_documents(is_amendment);

-- =============================================================================
-- 2. New metadata columns from XML header
-- =============================================================================

ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS legal_area TEXT;
ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS based_on TEXT;
ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS date_end DATE;
ALTER TABLE lovdata_documents ADD COLUMN IF NOT EXISTS keywords TEXT;

-- =============================================================================
-- 3. Updated search_lovdata_fast with amendment + ministry filter
-- =============================================================================

CREATE OR REPLACE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INTEGER DEFAULT 20,
    exclude_amendments BOOLEAN DEFAULT TRUE,
    ministry_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL,
    search_mode TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
    has_special_operators BOOLEAN;
    and_count INT;
    or_query TEXT;
BEGIN
    -- Check if query has special operators (OR, quotes, exclusion)
    has_special_operators := (
        query_text ~* '\mOR\M' OR
        query_text ~ '"' OR
        query_text ~ '-\w'
    );

    -- First try AND search (default websearch behavior)
    RETURN QUERY
    WITH ranked AS (
        SELECT
            s.dok_id,
            s.section_id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) as rk
        FROM public.lovdata_sections s
        JOIN public.lovdata_documents d ON d.dok_id = s.dok_id
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
          AND (NOT exclude_amendments OR COALESCE(d.is_amendment, FALSE) = FALSE)
          AND (ministry_filter IS NULL OR d.ministry ILIKE '%' || ministry_filter || '%')
        ORDER BY rk DESC
        LIMIT max_results
    )
    SELECT
        r.dok_id,
        r.section_id,
        d.title,
        d.short_title,
        d.doc_type,
        LEFT(s.content, 500) as snippet,
        r.rk as rank,
        'and'::TEXT as search_mode
    FROM ranked r
    JOIN public.lovdata_documents d ON d.dok_id = r.dok_id
    JOIN public.lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;

    -- Check if AND search returned results
    GET DIAGNOSTICS and_count = ROW_COUNT;

    -- If no results AND no special operators, try OR fallback
    IF and_count = 0 AND NOT has_special_operators THEN
        or_query := regexp_replace(query_text, '\s+', ' OR ', 'g');

        RETURN QUERY
        WITH ranked AS (
            SELECT
                s.dok_id,
                s.section_id,
                ts_rank(s.search_vector, websearch_to_tsquery('norwegian', or_query)) as rk
            FROM public.lovdata_sections s
            JOIN public.lovdata_documents d ON d.dok_id = s.dok_id
            WHERE s.search_vector @@ websearch_to_tsquery('norwegian', or_query)
              AND (NOT exclude_amendments OR COALESCE(d.is_amendment, FALSE) = FALSE)
              AND (ministry_filter IS NULL OR d.ministry ILIKE '%' || ministry_filter || '%')
            ORDER BY rk DESC
            LIMIT max_results
        )
        SELECT
            r.dok_id,
            r.section_id,
            d.title,
            d.short_title,
            d.doc_type,
            LEFT(s.content, 500) as snippet,
            r.rk as rank,
            'or_fallback'::TEXT as search_mode
        FROM ranked r
        JOIN public.lovdata_documents d ON d.dok_id = r.dok_id
        JOIN public.lovdata_sections s ON s.dok_id = r.dok_id AND s.section_id = r.section_id;
    END IF;
END;
$$;

-- =============================================================================
-- 4. Updated search_lovdata_hybrid with amendment filter
-- =============================================================================

CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector,
    match_count INTEGER DEFAULT 10,
    fts_weight DOUBLE PRECISION DEFAULT 0.5,
    ivfflat_probes INTEGER DEFAULT 10,
    doc_type_filter TEXT DEFAULT NULL,
    ministry_filter TEXT DEFAULT NULL,
    exclude_amendments BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    ministry TEXT,
    similarity DOUBLE PRECISION,
    fts_rank DOUBLE PRECISION,
    combined_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM set_config('ivfflat.probes', ivfflat_probes::TEXT, true);

    RETURN QUERY
    WITH
    filtered_docs AS (
        SELECT d.dok_id, d.short_title, d.doc_type, d.ministry
        FROM public.lovdata_documents d
        WHERE (doc_type_filter IS NULL OR d.doc_type = doc_type_filter)
          AND (ministry_filter IS NULL OR d.ministry ILIKE '%' || ministry_filter || '%')
          AND (NOT exclude_amendments OR COALESCE(d.is_amendment, FALSE) = FALSE)
    ),
    vector_search AS (
        SELECT
            s.id,
            s.dok_id,
            s.section_id,
            s.title,
            s.content,
            1 - (s.embedding <=> query_embedding) AS similarity
        FROM public.lovdata_sections s
        WHERE s.embedding IS NOT NULL
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL AND NOT exclude_amendments
               OR EXISTS (SELECT 1 FROM filtered_docs fd WHERE fd.dok_id = s.dok_id))
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    fts_scores AS (
        SELECT
            s.id,
            ts_rank(s.search_vector, websearch_to_tsquery('norwegian', query_text)) AS fts_rank
        FROM public.lovdata_sections s
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
    )
    SELECT
        v.id,
        v.dok_id,
        v.section_id,
        v.title,
        v.content,
        d.short_title,
        d.doc_type,
        d.ministry,
        v.similarity::FLOAT,
        COALESCE(f.fts_rank, 0)::FLOAT AS fts_rank,
        ((1 - fts_weight) * v.similarity + fts_weight * COALESCE(f.fts_rank, 0))::FLOAT AS combined_score
    FROM vector_search v
    LEFT JOIN fts_scores f ON v.id = f.id
    JOIN public.lovdata_documents d ON v.dok_id = d.dok_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- 5. Comments
-- =============================================================================

COMMENT ON COLUMN lovdata_documents.is_amendment IS 'TRUE for amendment laws (endringslover) that modify other laws';
COMMENT ON COLUMN lovdata_documents.language IS 'Document language: Bokmål, Nynorsk, etc.';
COMMENT ON COLUMN lovdata_documents.legal_area IS 'Legal area classification from Lovdata';
COMMENT ON COLUMN lovdata_documents.based_on IS 'Enabling law for regulations (hjemmelslov)';
COMMENT ON COLUMN lovdata_documents.date_end IS 'Expiry date for temporary laws/regulations';
COMMENT ON COLUMN lovdata_documents.keywords IS 'Keywords from Lovdata metadata';
