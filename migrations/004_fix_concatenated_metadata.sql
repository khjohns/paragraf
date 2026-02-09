-- 004: Fix concatenated metadata values
-- Fixes: based_on and legal_area fields that were stored without delimiters
-- between multiple values due to BeautifulSoup get_text() concatenation.
-- Depends on: 002_document_metadata.sql
--
-- based_on example:
--   Before: 'lov/2005-06-17-62/§1-4lov/2005-06-17-62/§14-12forskrift/2007-05-31-590'
--   After:  'lov/2005-06-17-62/§1-4; lov/2005-06-17-62/§14-12; forskrift/2007-05-31-590'
--
-- legal_area example:
--   Before: 'Pensjons- og trygderettSelskaper, fond og foreninger'
--   After:  'Pensjons- og trygderett; Selskaper, fond og foreninger'

-- =============================================================================
-- 1. Fix based_on: insert "; " before each lov/ or forskrift/ boundary
--    that isn't already preceded by "; " or at the start of the string.
-- =============================================================================

UPDATE lovdata_documents
SET based_on = regexp_replace(
    based_on,
    '(?<!^)(?<!; )((?:lov|forskrift)/\d{4})',
    '; \1',
    'g'
)
WHERE based_on IS NOT NULL
  AND based_on != ''
  AND based_on ~ '(?:lov|forskrift)/\d{4}.+(?:lov|forskrift)/\d{4}';

-- =============================================================================
-- 2. Fix legal_area: split on boundaries where a lowercase/punctuation char
--    is immediately followed by an uppercase letter starting a new category.
--    Pattern: word-ending chars (letter, punctuation) followed by uppercase
--    that starts a known top-level category pattern.
-- =============================================================================

UPDATE lovdata_documents
SET legal_area = regexp_replace(
    legal_area,
    '([a-zæøå.)])([A-ZÆØÅ])',
    '\1; \2',
    'g'
)
WHERE legal_area IS NOT NULL
  AND legal_area ~ '[a-zæøå.)]([A-ZÆØÅ])';

-- =============================================================================
-- 3. Drop columns that are 0% populated.
--    These exist in Lovdata's XML format spec but were never populated during
--    sync.  Whether the public API actually omits them, or our parser missed
--    them, is unverified.  Re-add via migration if future sync finds data.
-- =============================================================================

ALTER TABLE lovdata_documents DROP COLUMN IF EXISTS keywords;
ALTER TABLE lovdata_documents DROP COLUMN IF EXISTS language;
ALTER TABLE lovdata_documents DROP COLUMN IF EXISTS date_end;
