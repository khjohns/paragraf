---
paths:
  - "src/paragraf/supabase_backend.py"
  - "src/paragraf/vector_search.py"
  - "src/paragraf/service.py"
  - "migrations/**"
---

# Database-kontekst for lovdata-tabeller

Alle tabeller har `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` og `created_at TIMESTAMPTZ DEFAULT NOW()`.

## Tabellskjema

### lovdata_documents
Lover og forskrifter. En rad per dokument.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| dok_id | text UNIQUE NOT NULL | Unik ID fra Lovdata (f.eks. `lov/1814-05-17/nr-00`) |
| ref_id | text | Lovdata-referanse-ID |
| doc_type | text NOT NULL | `lov` eller `forskrift` |
| title | text | Full tittel |
| short_title | text | Korttittel (brukes til fuzzy matching via pg_trgm) |
| ministry | text | Ansvarlig departement |
| date_in_force | date | Ikrafttredelsesdato |
| is_amendment | boolean | Endringslov/-forskrift (default false) |
| is_current | boolean | Gjeldende (default true, settes false av `mark_non_current_docs()`) |
| legal_area | text | Rettsomrade (100% for lov, ~83% for forskrift - utledet fra hjemmelslov) |
| based_on | text | Hjemmelslov for forskrifter |
| search_vector | tsvector | Norsk stemming FTS (ubrukt - sok skjer pa sections) |
| indexed_at | timestamptz | Tidspunkt for siste indeksering |
| updated_at | timestamptz | Siste oppdatering |

### lovdata_sections
Paragrafer med lovtekst og embedding. En rad per paragraf.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| dok_id | text NOT NULL FK | Refererer lovdata_documents(dok_id) ON DELETE CASCADE |
| section_id | text NOT NULL | Paragrafnummer (f.eks. `§1`, `§3-9`) |
| title | text | Paragrafoverskrift |
| content | text NOT NULL | Full paragraftekst |
| address | text | XML id-attributt fra Lovdata |
| char_count | integer | Tekstlengde (for token-estimat) |
| search_vector | tsvector | Norsk stemming FTS - **her skjer soket** |
| embedding | vector(768) | Gemini gemini-embedding-001 (100% dekket) |
| content_hash | text | For a detektere endringer ved re-sync |
| structure_id | uuid FK | Kobling til lovdata_structure(id) |

UNIQUE constraint: `(dok_id, section_id)`

### lovdata_structure
Hierarkisk inndeling (del/kapittel/avsnitt/vedlegg). Brukes til innholdsfortegnelse.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| dok_id | text NOT NULL FK | Refererer lovdata_documents(dok_id) ON DELETE CASCADE |
| structure_type | text NOT NULL | `del`, `kapittel`, `avsnitt`, `vedlegg` |
| structure_id | text NOT NULL | F.eks. "1", "2 A", "I" |
| title | text NOT NULL | Full overskrift |
| sort_order | integer NOT NULL | Rekkefølge innad i dokumentet |
| parent_id | uuid FK | Selvref. til lovdata_structure(id) for hierarki |
| address | text | XML id-attributt fra Lovdata |
| heading_level | integer | Overskriftsniva i XML |

UNIQUE constraint: `(dok_id, structure_type, structure_id)`

### lovdata_sync_meta
To rader: `lover` og `forskrifter`. Sporer sync-tilstand.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| dataset | text PK | `lover` eller `forskrifter` |
| last_modified | timestamptz | Siste endring fra Lovdata API (brukes til inkrementell sync) |
| synced_at | timestamptz | Tidspunkt for siste sync |
| file_count | integer | Antall filer i siste sync (default 0) |
| status | text | `idle`, `syncing`, eller `error` |

## Viktige indekser

- `idx_lovdata_sections_search` - GIN pa sections.search_vector (FTS)
- `idx_lovdata_documents_short_title_trgm` - GIN pg_trgm for fuzzy matching
- `lovdata_sections_embedding_ivfflat_idx` - IVFFlat (lists=100) for vektorsok
- B-tree pa `is_amendment`, `is_current`, `doc_type`, `dok_id`, `short_title`
- B-tree pa sections `(dok_id, section_id)` og `structure_id`
- B-tree pa structure `dok_id`, `parent_id`, `(dok_id, structure_type)`

## Gotchas

- **FTS skjer pa sections, ikke documents.** documents.search_vector er ubrukt.
- **Norsk stemming:** search_vector bruker `norwegian`-konfigurasjonen. Bruk `to_tsquery('norwegian', ...)` i sokefunksjoner.
- **Embedding-dimensjon:** 768 (Gemini). Endre `vector(768)` overalt hvis modell byttes.
- **IVFFlat vs HNSW:** IVFFlat ble valgt fordi HNSW timeout-et ved indeksbygging pa 90k+ vektorer pa Supabase free tier.
- **`is_current` oppdateres etter sync** via `mark_non_current_docs()` RPC - ikke ved upsert.
- **`legal_area` for forskrifter** er utledet fra hjemmelslov (based_on) - ikke direkte fra Lovdata.
- **Endringslover (`is_amendment`)** filtreres bort i sok som default. Brukeren ma eksplisitt be om dem.
- **`dok_id` er UNIQUE, ikke PK.** PK er `id` (uuid) pa alle tabeller. Bruk `dok_id` for oppslag.

## SQL-konvensjoner

- Funksjoner: Alltid `SET search_path = ''` + `public.`-prefiks pa tabeller
- RLS: Separate policies per operasjon - aldri `FOR ALL`
- RLS: `(select auth.role())` - ikke `auth.role()` (unngår re-evaluering per rad)
- Migrasjoner kjores via Supabase MCP (`apply_migration`), lagre kopi i `migrations/`
