-- Paragraf: Complete database schema
-- Run this on a fresh Supabase project to set up all tables, indexes,
-- functions, triggers, and RLS policies needed by Paragraf.
--
-- Prerequisites: Supabase project (PostgreSQL 15+)
-- Data source: api.lovdata.no (NLOD 2.0 license)

-- =============================================================================
-- Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- trigram matching for fuzzy search

-- =============================================================================
-- 1. Documents table - law/regulation metadata
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT UNIQUE NOT NULL,           -- e.g., "lov/1992-07-03-93"
    ref_id TEXT,                           -- FRBR work reference
    title TEXT,                            -- Full title
    short_title TEXT,                      -- e.g., "avhendingslova"
    date_in_force DATE,                    -- When the law took effect
    ministry TEXT,                         -- Responsible ministry
    doc_type TEXT NOT NULL CHECK (doc_type IN ('lov', 'forskrift')),

    -- Full-text search vector (auto-populated by trigger)
    search_vector TSVECTOR,

    -- Timestamps
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_search
    ON lovdata_documents USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_dok_id
    ON lovdata_documents(dok_id);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_short_title
    ON lovdata_documents(short_title);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_short_title_trgm
    ON lovdata_documents USING GIN (short_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lovdata_documents_doc_type
    ON lovdata_documents(doc_type);

-- =============================================================================
-- 2. Sections table - individual paragraphs/sections
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,              -- e.g., "3-9", "Artikkel 6"
    title TEXT,                            -- Section title (optional)
    content TEXT NOT NULL,                 -- The actual law text
    address TEXT,                          -- data-absoluteaddress from XML
    char_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,

    -- Full-text search vector (auto-populated by trigger)
    search_vector TSVECTOR,

    -- Vector embedding for semantic search (populated by embed script)
    embedding vector(1536),

    -- Incremental sync support
    content_hash TEXT,

    -- Foreign key to structure (added after structure table is created)
    structure_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(dok_id, section_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_dok_section
    ON lovdata_sections(dok_id, section_id);
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_search
    ON lovdata_sections USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_lovdata_sections_structure
    ON lovdata_sections(structure_id);
CREATE INDEX IF NOT EXISTS lovdata_sections_embedding_ivfflat_idx
    ON lovdata_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- 3. Structure table - hierarchical elements (Del, Kapittel, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dok_id TEXT NOT NULL REFERENCES lovdata_documents(dok_id) ON DELETE CASCADE,

    structure_type TEXT NOT NULL CHECK (structure_type IN (
        'del', 'kapittel', 'avsnitt', 'vedlegg'
    )),
    structure_id TEXT NOT NULL,            -- "1", "I", "8a"
    title TEXT NOT NULL,                   -- Full heading
    sort_order INTEGER NOT NULL,           -- Display order within document

    parent_id UUID REFERENCES lovdata_structure(id) ON DELETE CASCADE,
    address TEXT,                          -- data-absoluteaddress from XML
    heading_level INTEGER,                 -- h2=2, h3=3, etc.

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(dok_id, structure_type, structure_id)
);

-- Add foreign key constraint from sections to structure
ALTER TABLE lovdata_sections
    ADD CONSTRAINT lovdata_sections_structure_id_fkey
    FOREIGN KEY (structure_id) REFERENCES lovdata_structure(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_dok_id
    ON lovdata_structure(dok_id);
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_parent
    ON lovdata_structure(parent_id);
CREATE INDEX IF NOT EXISTS idx_lovdata_structure_type
    ON lovdata_structure(dok_id, structure_type);

-- =============================================================================
-- 4. Sync metadata table
-- =============================================================================

CREATE TABLE IF NOT EXISTS lovdata_sync_meta (
    dataset TEXT PRIMARY KEY,              -- 'lover' or 'forskrifter'
    last_modified TIMESTAMPTZ,             -- From HTTP Last-Modified header
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error'))
);

-- =============================================================================
-- 5. Trigger functions - auto-populate search vectors
-- =============================================================================

CREATE OR REPLACE FUNCTION lovdata_documents_search_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('norwegian', COALESCE(NEW.short_title, '')), 'B');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lovdata_sections_search_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('norwegian', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS trigger_lovdata_documents_search ON lovdata_documents;
CREATE TRIGGER trigger_lovdata_documents_search
    BEFORE INSERT OR UPDATE ON lovdata_documents
    FOR EACH ROW EXECUTE FUNCTION lovdata_documents_search_trigger();

DROP TRIGGER IF EXISTS trigger_lovdata_sections_search ON lovdata_sections;
CREATE TRIGGER trigger_lovdata_sections_search
    BEFORE INSERT OR UPDATE ON lovdata_sections
    FOR EACH ROW EXECUTE FUNCTION lovdata_sections_search_trigger();

-- =============================================================================
-- 6. Search functions
-- =============================================================================

-- Basic full-text search across documents and sections
CREATE OR REPLACE FUNCTION search_lovdata(
    query_text TEXT,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    dok_id TEXT,
    title TEXT,
    short_title TEXT,
    doc_type TEXT,
    snippet TEXT,
    rank REAL
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    tsquery_val TSQUERY;
BEGIN
    tsquery_val := websearch_to_tsquery('norwegian', query_text);

    RETURN QUERY
    SELECT DISTINCT ON (d.dok_id)
        d.dok_id,
        d.title,
        d.short_title,
        d.doc_type,
        ts_headline('norwegian', COALESCE(s.content, d.title), tsquery_val,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') as snippet,
        ts_rank(COALESCE(s.search_vector, d.search_vector), tsquery_val) as rank
    FROM public.lovdata_documents d
    LEFT JOIN public.lovdata_sections s ON d.dok_id = s.dok_id
    WHERE d.search_vector @@ tsquery_val
       OR s.search_vector @@ tsquery_val
    ORDER BY d.dok_id, rank DESC
    LIMIT max_results;
END;
$$;

-- Fast section-level search with automatic AND→OR fallback
CREATE OR REPLACE FUNCTION search_lovdata_fast(
    query_text TEXT,
    max_results INTEGER DEFAULT 20
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
        WHERE s.search_vector @@ websearch_to_tsquery('norwegian', query_text)
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
            WHERE s.search_vector @@ websearch_to_tsquery('norwegian', or_query)
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

-- Pure vector search (requires embeddings)
CREATE OR REPLACE FUNCTION search_lovdata_vector(
    query_embedding vector,
    match_count INTEGER DEFAULT 10,
    ivfflat_probes INTEGER DEFAULT 10
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
    similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM set_config('ivfflat.probes', ivfflat_probes::TEXT, true);

    RETURN QUERY
    SELECT
        s.id,
        s.dok_id,
        s.section_id,
        s.title,
        s.content,
        d.short_title,
        d.doc_type,
        d.ministry,
        (1 - (s.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.lovdata_sections s
    JOIN public.lovdata_documents d ON s.dok_id = d.dok_id
    WHERE s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Hybrid FTS + vector search with optional filters
CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector,
    match_count INTEGER DEFAULT 10,
    fts_weight DOUBLE PRECISION DEFAULT 0.5,
    ivfflat_probes INTEGER DEFAULT 10,
    doc_type_filter TEXT DEFAULT NULL,
    ministry_filter TEXT DEFAULT NULL
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
          AND (doc_type_filter IS NULL AND ministry_filter IS NULL
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
-- 7. Row Level Security
-- =============================================================================

ALTER TABLE lovdata_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovdata_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovdata_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovdata_sync_meta ENABLE ROW LEVEL SECURITY;

-- Public read access (data is public under NLOD 2.0)
CREATE POLICY "Public read access for lovdata_documents"
    ON lovdata_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access for lovdata_sections"
    ON lovdata_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access for lovdata_structure"
    ON lovdata_structure FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access for lovdata_sync_meta"
    ON lovdata_sync_meta FOR SELECT TO anon, authenticated USING (true);

-- Service role write access (for sync operations)
CREATE POLICY "Service role can insert lovdata_documents"
    ON lovdata_documents FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update lovdata_documents"
    ON lovdata_documents FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can delete lovdata_documents"
    ON lovdata_documents FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can insert lovdata_sections"
    ON lovdata_sections FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update lovdata_sections"
    ON lovdata_sections FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can delete lovdata_sections"
    ON lovdata_sections FOR DELETE TO service_role USING (true);

CREATE POLICY "Service role can manage lovdata_structure"
    ON lovdata_structure FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage lovdata_sync_meta"
    ON lovdata_sync_meta FOR ALL TO service_role USING (true);

-- =============================================================================
-- 8. Comments
-- =============================================================================

COMMENT ON TABLE lovdata_documents IS 'Norwegian laws and regulations from Lovdata Public API';
COMMENT ON TABLE lovdata_sections IS 'Individual paragraphs/sections of laws';
COMMENT ON TABLE lovdata_structure IS 'Hierarchical structure (Del, Kapittel, Avsnitt, Vedlegg) for laws and regulations';
COMMENT ON TABLE lovdata_sync_meta IS 'Sync status for Lovdata datasets';

COMMENT ON COLUMN lovdata_structure.structure_type IS 'Type: del, kapittel, avsnitt, vedlegg';
COMMENT ON COLUMN lovdata_structure.structure_id IS 'ID within type, e.g., "1", "I", "8a"';
COMMENT ON COLUMN lovdata_structure.parent_id IS 'Parent in hierarchy (NULL = top level)';
COMMENT ON COLUMN lovdata_structure.sort_order IS 'Order within document for correct display';

COMMENT ON FUNCTION search_lovdata IS 'Full-text search across all Lovdata documents';
COMMENT ON FUNCTION search_lovdata_fast IS 'Fast section-level FTS with automatic AND→OR fallback';
COMMENT ON FUNCTION search_lovdata_vector IS 'Pure vector similarity search (requires embeddings)';
COMMENT ON FUNCTION search_lovdata_hybrid IS 'Hybrid FTS + vector search with optional doc_type/ministry filters';
