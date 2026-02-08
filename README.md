# Paragraf

MCP-server som gir AI-assistenter tilgang til alle norske lover og forskrifter via [Model Context Protocol](https://modelcontextprotocol.io/).

92 000+ paragrafer fra 770 lover og 3 666 forskrifter — gratis under NLOD 2.0-lisensen.

## Hvorfor

LLM-er hallusinerer lovtekst. Denne serveren gir dem presis, oppdatert norsk rett som verktøykall i stedet for gjetting.

```
Bruker:  "Kan utleier si meg opp?"
AI:      sok("oppsigelse leie") → 4 treff
         lov("husleieloven", "9-7") → full tekst
Svar:    "Etter husleieloven § 9-7 skal oppsigelse fra utleier
          være skriftlig og begrunnet..."
```

## Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Lovoppslag** | Slå opp enhver lov/forskrift med kortnavn eller full ID |
| **Fulltekstsøk (FTS)** | PostgreSQL tsvector med norsk stemming, ~6ms |
| **Semantisk søk** | Hybrid vektor+FTS med Gemini embeddings for naturlig språk |
| **Batch-henting** | Hent flere paragrafer i ett kall (~80% raskere) |
| **Innholdsfortegnelse** | Hierarkisk oversikt (Del → Kapittel → §) med token-estimat |
| **Alias-oppløsning** | `aml`, `avhl`, `pbl` + fuzzy matching for stavefeil |
| **OR-fallback** | AND-søk som automatisk faller tilbake til OR ved 0 treff |

## Arkitektur

```
┌──────────────────┐     HTTPS/JSON-RPC      ┌──────────────────────────┐
│  Claude.ai       │ ──────────────────────►  │  Flask Backend           │
│  Copilot Studio  │                          │                          │
│  Gemini AI       │                          │  ┌────────────────────┐  │
│  (MCP-klient)    │ ◄──────────────────────  │  │  MCP Server        │  │
└──────────────────┘                          │  │  (JSON-RPC router) │  │
                                              │  └────────┬───────────┘  │
                                              │           │              │
                                              │  ┌────────▼───────────┐  │
                                              │  │  LovdataService    │  │
                                              │  │  (alias, validering│  │
                                              │  │   formatering)     │  │
                                              │  └────────┬───────────┘  │
                                              │           │              │
                                              └───────────┼──────────────┘
                                                          │
                                        ┌─────────────────┴──────────────────┐
                                        │                                    │
                                        ▼                                    ▼
                              ┌───────────────────┐              ┌───────────────────┐
                              │  Supabase         │              │  Lovdata API       │
                              │  PostgreSQL       │              │  api.lovdata.no    │
                              │                   │              │                    │
                              │  • FTS (GIN)      │              │  Bulk tar.bz2      │
                              │  • pgvector       │              │  (kun ved sync)    │
                              │  • pg_trgm        │              │                    │
                              └───────────────────┘              └───────────────────┘
```

## Hurtigstart

### Forutsetninger

- Python 3.11+
- PostgreSQL med `pgvector` og `pg_trgm` (Supabase anbefalt)
- Valgfritt: Gemini API-nøkkel for semantisk søk

### Installasjon

```bash
pip install paragraf            # Minimal (SQLite backend)
pip install paragraf[supabase]  # Med Supabase PostgreSQL
pip install paragraf[all]       # Alt (Supabase + vektorsøk + HTTP)
```

Eller fra kildekode:

```bash
git clone https://github.com/khjohns/paragraf.git
cd paragraf
pip install -e ".[all]"
```

### Konfigurasjon

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Valgfritt: for semantisk søk
GEMINI_API_KEY=AIza...
```

Uten Supabase brukes SQLite som lokal fallback.

### Kjør databasemigreringer

```bash
# Kjør mot Supabase (i rekkefølge)
supabase db push
```

Migreringene oppretter:
- `lovdata_documents` — lover og forskrifter
- `lovdata_sections` — paragrafer med FTS og embedding
- `lovdata_structure` — hierarkisk struktur (del/kapittel/avsnitt)
- `lovdata_sync_meta` — sync-metadata
- SQL-funksjoner for søk og fuzzy matching

### Synkroniser lovdata

```bash
paragraf sync                   # Første gang (tar 5-10 min)
```

### Start serveren

```bash
paragraf serve                  # stdio MCP (for Claude Desktop, Cursor)
paragraf serve --http           # HTTP MCP (for claude.ai connector)
paragraf serve --http --port 8000
```

### Koble til Claude.ai

1. Gå til **Settings → Connectors → Add custom connector**
2. URL: `https://api.paragraf.dev/mcp/`
3. Ferdig — ingen autentisering kreves

## MCP-verktøy

| Verktøy | Beskrivelse | Eksempel |
|---------|-------------|----------|
| `lov` | Slå opp lov | `lov("aml", "14-9")` |
| `forskrift` | Slå opp forskrift | `forskrift("foa", "25-2")` |
| `sok` | Fulltekstsøk | `sok("mangel bolig")` |
| `semantisk_sok` | AI-drevet søk | `semantisk_sok("skjulte feil i boligen")` |
| `hent_flere` | Batch-henting | `hent_flere("aml", ["14-9", "15-6"])` |
| `sjekk_storrelse` | Token-estimat | `sjekk_storrelse("skatteloven", "5-1")` |
| `liste` | Vis aliaser | `liste()` |
| `status` | Sync-status | `status()` |
| `sync` | Synkroniser | `sync(force=True)` |

### Alias-oppløsning

Fire nivåer for å finne riktig lov:

| Nivå | Eksempel |
|------|----------|
| 1. Hardkodet alias | `aml` → `LOV-2005-06-17-62` |
| 2. Database (short_title) | `husleieloven` → `lov/1999-03-26-17` |
| 3. Fuzzy (pg_trgm) | `husleielova` → husleieloven (similarity: 0.59) |
| 4. Direkte ID | `lov/1999-03-26-17` → brukes som-er |

### Søkesyntaks (FTS)

| Syntaks | Eksempel | Betydning |
|---------|----------|-----------|
| Standard | `mangel bolig` | AND (begge ord) |
| OR | `miljø OR klima` | Minst ett ord |
| Frase | `"vesentlig mislighold"` | Eksakt frase |
| Ekskludering | `mangel -bil` | mangel, ikke bil |

AND-søk som gir 0 treff faller automatisk tilbake til OR.

## Mappestruktur

```
src/paragraf/
├── __init__.py              # Pakke-eksport (MCPServer, LovdataService)
├── server.py                # MCP JSON-RPC server (9 verktøy)
├── service.py               # Forretningslogikk, aliaser, validering
├── supabase_backend.py      # Supabase PostgreSQL backend
├── sqlite_backend.py        # SQLite fallback + sync fra API
├── structure_parser.py      # XML → hierarkisk struktur
├── vector_search.py         # Hybrid vektor+FTS søk
├── cli.py                   # CLI (serve, sync, status)
└── web.py                   # Flask blueprint factory

web/
└── app.py                   # Full Flask blueprint (OAuth, SSE, HTTP)

scripts/
└── embed.py                 # Generer embeddings for vektorsøk

migrations/
├── 20260203_create_lovdata_tables.sql
└── 20260206_add_lovdata_structure.sql
```

## API-endepunkter

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/mcp/` | MCP JSON-RPC (hovedendepunkt) |
| `HEAD` | `/mcp/` | Protokollversjon-sjekk |
| `GET`  | `/mcp/` | SSE-stream (bakoverkompatibilitet) |
| `GET`  | `/mcp/health` | Helsesjekk |
| `GET`  | `/mcp/info` | Serverinfo og verktøyliste |

## Ytelse

| Metrikk | Verdi |
|---------|-------|
| FTS-søk (warm cache) | ~6ms |
| FTS-søk (cold cache) | ~600ms |
| Lovoppslag | ~50-200ms |
| Batch 3 paragrafer | ~100ms (vs 491ms separat) |
| Database-størrelse | ~160MB tabell + 42MB TOAST + 37MB GIN |
| Vektorsøk (hybrid) | ~200-500ms (inkl. embedding) |

## Datamodell

### Tabeller

```
lovdata_documents (4 439 rader)
├── dok_id TEXT UNIQUE        "lov/2005-05-20-28"
├── title TEXT                "Lov om arbeidsmiljø..."
├── short_title TEXT          "Arbeidsmiljøloven"
├── doc_type TEXT             "lov" | "forskrift"
├── ministry TEXT             "Arbeids- og inkluderingsdepartementet"
└── search_vector TSVECTOR

lovdata_sections (92 130 rader)
├── dok_id + section_id       UNIQUE
├── content TEXT               Paragraftekst
├── search_vector TSVECTOR     Norsk stemming
├── embedding VECTOR(1536)     Gemini embedding
├── char_count INTEGER         GENERATED ALWAYS
└── structure_id UUID FK       → lovdata_structure

lovdata_structure (13 909 rader)
├── structure_type TEXT        "del" | "kapittel" | "avsnitt" | "vedlegg"
├── title TEXT                 "Kapittel 2. Arbeidsgivers plikter"
├── parent_id UUID FK          Hierarkisk (self-ref)
└── sort_order INTEGER
```

### Indekser

- **GIN** på `search_vector` — fulltekstsøk
- **GIN** på `short_title` med `pg_trgm` — fuzzy matching
- **IVFFlat** på `embedding` (lists=100) — vektorsøk
- **B-tree** på `dok_id`, `section_id`, `structure_id` — oppslag

## Sikkerhet

- **Ingen brukerdata lagres** — authless design
- **Parameteriserte queries** — ingen SQL injection
- **Input-validering** på alle MCP-verktøy
- **Rate limiting** anbefalt i produksjon (flask-limiter)
- **NLOD 2.0-lisens** — alle data er offentlige

### Testet mot

| Angrep | Resultat |
|--------|----------|
| SQL injection (`'; DROP TABLE--`) | Blokkert |
| Path traversal (`../../../etc/passwd`) | Ingen filsystem-tilgang |
| XSS (`<script>alert('xss')</script>`) | Behandlet som tekst |

## Begrensninger

### Inkludert (gratis via Lovdata Public API)

- Gjeldende lover (770+)
- Sentrale forskrifter (3 666+)
- Lokale forskrifter, delegeringer, instrukser

### IKKE inkludert

- Rettsavgjørelser (Høyesterett, lagmannsrett) — krever Lovdata Pro
- Forarbeider (NOU, Prop., Ot.prp.) — krever Lovdata Pro
- Juridiske artikler

## Deploy

### Render

```yaml
# render.yaml
services:
  - type: web
    name: paragraf
    runtime: python
    buildCommand: pip install paragraf[all]
    startCommand: paragraf serve --http
    healthCheckPath: /mcp/health
```

### Miljøvariabler

| Variabel | Påkrevd | Beskrivelse |
|----------|---------|-------------|
| `SUPABASE_URL` | Ja* | Supabase prosjekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja* | Service role nøkkel |
| `GEMINI_API_KEY` | Nei | For semantisk søk |
| `MCP_REQUIRE_AUTH` | Nei | `true` for OAuth 2.1 |
| `LOVDATA_CACHE_DIR` | Nei | SQLite cache-sti (default: `/tmp/lovdata-cache`) |

\* SQLite brukes som fallback uten Supabase.

## Utvikling

```bash
# Generer embeddings (krever GEMINI_API_KEY)
python scripts/embed.py

# Helsesjekk
curl http://localhost:8000/mcp/health

# Test MCP-kall
curl -X POST http://localhost:8000/mcp/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "lov",
      "arguments": {"lov_id": "aml", "paragraf": "14-9"}
    }
  }'
```

## Teknologi

| Komponent | Teknologi |
|-----------|-----------|
| Server | Flask + Python 3.11 |
| Database | Supabase PostgreSQL (SQLite fallback) |
| Fulltekstsøk | PostgreSQL tsvector + GIN |
| Vektorsøk | pgvector IVFFlat + Gemini embeddings |
| Fuzzy matching | pg_trgm |
| Protokoll | MCP 2025-06-18, Streamable HTTP |
| Datakilde | Lovdata Public API (NLOD 2.0) |

## Lisens

Inneholder data under Norsk lisens for offentlige data ([NLOD 2.0](https://data.norge.no/nlod/no/2.0)) tilgjengeliggjort av [Lovdata](https://lovdata.no).

## Relatert dokumentasjon

- [ADR-001: Arkitekturbeslutninger](docs/ADR-001.md) — alle arkitekturbeslutninger
- [Dataflyt](docs/dataflow.md) — sikkerhet og nettverksmodell
- [Roadmap](docs/roadmap.md) — veien videre
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [Lovdata Public API](https://api.lovdata.no/)
