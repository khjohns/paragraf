# Paragraf - Claude Code Context

## Prosjektoversikt

MCP-server (Model Context Protocol) for oppslag i norsk lovdata. Gir Claude/LLM tilgang til 92 000+ paragrafer fra norske lover og forskrifter via fulltekstsok og vektorsok. Landingsside pa paragraf.dev (GitHub Pages).

Data synkroniseres fra Lovdata sitt gratis Public Data API (NLOD 2.0-lisens).

## Tech Stack

| Lag | Teknologi |
|-----|-----------|
| Kjerne | Python 3.11+ |
| MCP | JSON-RPC over stdio eller HTTP (Flask) |
| Database (prod) | Supabase PostgreSQL + pgvector |
| Database (lokal) | SQLite (fallback uten SUPABASE_URL) |
| Fulltekstsok | PostgreSQL tsvector/GIN med norsk stemming (prod), SQLite FTS5 (lokal) |
| Vektorsok | pgvector IVFFlat + Gemini gemini-embedding-001 |
| Sync | Streaming fra Lovdata API (tar.bz2) |
| Hosting | GitHub Pages (paragraf.dev), Cloudflare DNS |
| Linting | Ruff (pre-commit hook) |

## Mappestruktur

```
src/paragraf/
  __init__.py          # Eksporterer MCPServer, LovdataService
  cli.py               # CLI: paragraf serve/sync/status
  service.py           # LovdataService - hovedfasade, velger backend
  supabase_backend.py  # Supabase-implementasjon (sync, sok, oppslag)
  sqlite_backend.py    # SQLite-implementasjon (lokal utvikling)
  server.py            # MCPServer - JSON-RPC handler
  web.py               # Flask blueprint for HTTP-modus
  vector_search.py     # Hybrid vektorsok (Gemini + FTS)
  structure_parser.py  # XML-parsing av Lovdata-dokumenter
  _supabase_utils.py   # Retry/backoff, feilhandtering

scripts/
  embed.py             # Generer embeddings for alle seksjoner

migrations/
  001_complete_schema.sql  # Supabase-skjema (tabeller, indekser, sokefunksjoner)
  002_document_metadata.sql  # is_amendment, metadata-kolonner, oppdaterte sokefunksjoner
  003_search_enhancements.sql  # doc_type/legal_area-filtre, based_on i sok

web/
  app.py               # Standalone Flask-app (hosted deploy)

site/                    # GitHub Pages landingsside (paragraf.dev)

docs/
  ADR-001.md           # Arkitekturbeslutninger (les denne for dypere forstaelse)
```

## Arkitektur

### Dual backend
`service.py` velger backend basert pa `SUPABASE_URL`:
- **Satt:** Bruker `LovdataSupabaseService` (PostgreSQL)
- **Ikke satt:** Bruker `LovdataSyncService` (SQLite)

**Viktig:** Begge backends ma holdes i paritet. Nar du legger til metoder, felt eller endrer
datamodellen i en backend, oppdater den andre. `service.py` bruker `hasattr()`-sjekker for
valgfrie metoder, men kritiske metoder (`get_section`, `search`, `list_sections`, `is_synced`)
ma finnes i begge. Se ADR-001.2 for detaljer.

### Datapipeline
```
Lovdata API (tar.bz2) -> Streaming download -> XML-parsing -> Upsert til DB
                                                                  |
                                                          embed.py (Gemini API)
                                                                  |
                                                          pgvector embeddings
```

### MCP-verktoy

| Verktoy | Beskrivelse |
|---------|-------------|
| `sok(query, departement?, doc_type?, rettsomrade?, inkluder_endringslover?)` | Fulltekstsok med norsk stemming + filtre |
| `semantisk_sok(query, doc_type?, ministry?, rettsomrade?, inkluder_endringslover?)` | Hybrid vektorsok (naturlig sprak) |
| `lov(id, paragraf)` | Hent lovtekst (uten paragraf = innholdsfortegnelse med metadata) |
| `forskrift(id, paragraf)` | Hent forskriftstekst (uten paragraf = innholdsfortegnelse med hjemmelslov) |
| `hent_flere(id, paragrafer)` | Batch-henting (~80% raskere) |
| `relaterte_forskrifter(lov_id)` | Finn forskrifter med hjemmel i en lov |
| `departementer()` | List alle departementer (for filterverdier) |
| `rettsomrader()` | List alle rettsomrader (for filterverdier) |
| `liste()` | List tilgjengelige lover |
| `status()` | Sync-status |
| `sjekk_storrelse(id, paragraf)` | Token-estimat for seksjon |

### Alias-opplosning
Lover/forskrifter kan slas opp med naturlig navn via fire nivaer:
1. Hardkodede aliaser (`aml` -> arbeidsmiljoloven)
2. Database `short_title`-match
3. Fuzzy matching (`pg_trgm`, min 8 tegn)
4. Direkte dok_id

## Kommandoer

```bash
# Env-oppsett (credentials i .env, gitignored)
set -a && source .env && set +a

# MCP-server
paragraf serve              # stdio-modus
paragraf serve --http       # HTTP-modus (Flask)

# Sync og vedlikehold
paragraf sync               # Inkrementell sync fra Lovdata API
paragraf sync --force       # Tving full re-sync (ignorerer last_modified)
paragraf status             # Vis sync-status

# Embeddings
python3 scripts/embed.py --dry-run    # Sjekk antall manglende + kostnad
python3 scripts/embed.py              # Generer embeddings
python3 scripts/embed.py --max-time 25  # Tidsbegrenset (Supabase free tier)

# Linting (pre-commit hook kjorer automatisk)
ruff check src/ scripts/
ruff format src/ scripts/
```

## Supabase

Prosjektet bruker Supabase-prosjektet **unified-timeline** (`iyetsvrteyzpirygxenu`).

### Tabeller

| Tabell | Innhold | Antall |
|--------|---------|--------|
| `lovdata_documents` | Lover og forskrifter (inkl. is_amendment, legal_area, based_on) | ~4 450 |
| `lovdata_sections` | Paragrafer med tekst + embedding | ~92 000 (100% embedded) |
| `lovdata_structure` | Hierarki (del/kapittel/avsnitt/vedlegg) | ~14 800 |
| `lovdata_sync_meta` | Sync-tidspunkt per datasett | 2 |

### Viktige indekser
- GIN pa `search_vector` (FTS)
- GIN pa `short_title` (pg_trgm fuzzy)
- B-tree pa `is_amendment` (endringslov-filter)
- IVFFlat pa `embedding` (vektorsok, lists=100)

## Viktige filer

| Fil | Innhold |
|-----|---------|
| `src/paragraf/service.py` | Hovedfasade - all forretningslogikk |
| `src/paragraf/supabase_backend.py` | Sync, sok, oppslag mot Supabase |
| `src/paragraf/server.py` | MCP JSON-RPC protokoll |
| `docs/ADR-001.md` | Alle arkitekturbeslutninger |
| `migrations/001_complete_schema.sql` | Database-skjema (tabeller, sokefunksjoner) |
| `migrations/002_document_metadata.sql` | Metadata-kolonner + oppdaterte sokefunksjoner |
| `migrations/003_search_enhancements.sql` | doc_type/legal_area-filtre, based_on i resultater |
| `migrations/004_fix_concatenated_metadata.sql` | Fiks "; "-delimiter i based_on/legal_area, dropp tomme kolonner |
| `migrations/005_legal_area_in_search_results.sql` | legal_area i sokeresultater, stotter rettsomrader-verktoy |
| `scripts/embed.py` | Embedding-generering |
| `tests/test_mcp_tools.sh` | 75 integrasjonstester for alle 11 MCP-verktoy |

## Begrensninger

Kun **gjeldende lover og sentrale forskrifter** er tilgjengelig (gratis Lovdata API). Folgende er IKKE tilgjengelig:
- Rettsavgjorelser (HR, LG, LA)
- Forarbeider (NOU, Prop., Ot.prp.)
- Juridiske artikler
- Lokale forskrifter

## Vedlikehold av denne filen

Nar du gjor endringer som pavirker arkitektur, kommandoer, datamodell eller verktoy, vurder om CLAUDE.md bor oppdateres. Foreslaa endringer til brukeren nar:
- Nye MCP-verktoy legges til eller endres
- Mappestruktur eller viktige filer endres
- Nye scripts eller kommandoer introduseres
- Tech stack eller avhengigheter endres vesentlig
- Begrensninger eller datadekning endres

## Relaterte prosjekter

- `../unified-timeline/` - Hosting-plattform, deler Supabase-prosjekt
- `../unified-timeline/tredjepart-api/lovdata-api.json` - Lovdata API OpenAPI-spec
- `../unified-timeline/tredjepart-api/lovdata-xml.md` - XML-formatdokumentasjon
