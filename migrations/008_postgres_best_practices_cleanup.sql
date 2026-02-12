-- Migration: lovdata_postgres_best_practices_cleanup
-- Applied: 2026-02-12
-- Supabase version: 20260212100557
--
-- Fixes identified by Supabase advisors + postgres best practices:
-- 1. Drop duplicate index (identical to unique constraint)
-- 2. Replace FOR ALL RLS policies with separate per-operation policies
-- 3. Replace low-selectivity boolean indexes with partial index
-- 4. Mark search_lovdata as STABLE

-- 1. Drop duplicate index (identical to unique constraint lovdata_documents_dok_id_key)
DROP INDEX IF EXISTS public.idx_lovdata_documents_dok_id;

-- 2a. Replace FOR ALL policy on lovdata_structure with separate per-operation policies
DROP POLICY IF EXISTS "Service role can manage lovdata_structure" ON public.lovdata_structure;
CREATE POLICY "Service role can insert lovdata_structure"
  ON public.lovdata_structure FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update lovdata_structure"
  ON public.lovdata_structure FOR UPDATE TO service_role
  USING (true);
CREATE POLICY "Service role can delete lovdata_structure"
  ON public.lovdata_structure FOR DELETE TO service_role
  USING (true);

-- 2b. Replace FOR ALL policy on lovdata_sync_meta with separate per-operation policies
DROP POLICY IF EXISTS "Service role can manage lovdata_sync_meta" ON public.lovdata_sync_meta;
CREATE POLICY "Service role can insert lovdata_sync_meta"
  ON public.lovdata_sync_meta FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update lovdata_sync_meta"
  ON public.lovdata_sync_meta FOR UPDATE TO service_role
  USING (true);
CREATE POLICY "Service role can delete lovdata_sync_meta"
  ON public.lovdata_sync_meta FOR DELETE TO service_role
  USING (true);

-- 3. Replace low-selectivity boolean indexes with a partial index
DROP INDEX IF EXISTS public.idx_lovdata_documents_is_amendment;
DROP INDEX IF EXISTS public.idx_lovdata_documents_is_current;
CREATE INDEX idx_lovdata_documents_active
  ON public.lovdata_documents (doc_type, ministry)
  WHERE is_current = TRUE AND (is_amendment IS NULL OR is_amendment = FALSE);

-- 4. Mark search_lovdata as STABLE (read-only search function)
CREATE OR REPLACE FUNCTION public.search_lovdata(query_text text, max_results integer DEFAULT 10)
RETURNS TABLE(dok_id text, title text, short_title text, doc_type text, snippet text, rank real)
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
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
$function$;
