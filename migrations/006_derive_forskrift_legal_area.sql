-- 006: Derive legal_area for forskrifter from their hjemmelslov
-- Forskrifter don't have legalArea in the Lovdata public API XML,
-- but they always reference their hjemmelslov via based_on.
-- We can derive legal_area by joining to the parent law.
-- Depends on: 005_legal_area_in_search_results.sql
--
-- Coverage improvement: forskrift 0.7% → ~83%, total 17% → ~86%

-- =============================================================================
-- 1. Reusable function (called by sync_all after each sync)
-- =============================================================================

CREATE OR REPLACE FUNCTION derive_forskrift_legal_area()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE lovdata_documents f
    SET legal_area = l.legal_area
    FROM lovdata_documents l
    WHERE f.doc_type = 'forskrift'
      AND f.legal_area IS NULL
      AND f.based_on IS NOT NULL
      AND l.dok_id = (regexp_match(f.based_on, '(lov/\d{4}-\d{2}-\d{2}-\d+)'))[1]
      AND l.legal_area IS NOT NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- =============================================================================
-- 2. Backfill existing data
-- =============================================================================

SELECT derive_forskrift_legal_area();
