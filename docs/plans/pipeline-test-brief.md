# Pipeline-integrasjonstester — Brief for ny instans

## Mål

Skriv integrasjonstester som tester hele analyse-pipelinen ende-til-ende mot live backend (localhost:5002) og Supabase. Bruk en liten testanalyse med 5 KOFA-saker + 1 EU-sak + forarbeid.

## Pipeline-rekkefølge

```
1. Scoping      POST /api/analyses/<id>/scope
2. Traversal    POST /api/analyses/<id>/traverse
3. Screening    POST /api/analyses/<id>/screen  (SSE)
4. Citation QA  POST /api/analyses/<id>/verify-citations
5. EU Screening POST /api/analyses/<id>/eu-screen (SSE)
6. Cross-props  POST /api/analyses/<id>/cross-propositions
7. Synthesis    POST /api/analyses/<id>/synthesize
8. QA           POST /api/analyses/<id>/qa
```

## Testanalyse — foreslått seeds

Bruk FOA § 16-10 (tildelingskriterier) som eneste provision. Det gir et håndterbart antall kandidater. Begrens til 5 saker for screening.

## Hva testene skal verifisere

### 1. Traversal persisterer kandidater
- `POST /api/analyses/<id>/traverse` → 200
- `analysis_candidates` har rader i DB (sjekk via GET /api/analyses/<id>)
- Kandidatene har `category`, `signals`, `iteration`

### 2. Re-traversal bevarer screening-data
- Screen 1-2 saker først
- Kjør traversal igjen
- Verifiser at `ai_screening` IKKE er slettet fra de screenede sakene
- **KRITISK** — dette var hovedbugen (persist_candidates brukte DELETE+INSERT)

### 3. Screening via SSE
- `POST /api/analyses/<id>/screen` med `{sak_nrs: [...], max_parallel: 1}`
- SSE-events inneholder screening-resultater med `factum`, `assessment`, `proposition`, `quotes`
- Resultater persistert i `analysis_candidates.ai_screening`
- `analysis_candidates.screening_status` = `ai_screened`
- `analysis_propositions` har upserted propositions

### 4. Citation verification
- `POST /api/analyses/<id>/verify-citations` → 200
- Returnerer `verified_quotes` med status per sitat
- `ai_screening.quote_verification` oppdatert på kandidater i DB

### 5. Status-flyt
- Etter traversal: `analyses.status` = `candidates_ready`
- Etter screening start: `analyses.status` = `screening`
- Etter citation QA: `analyses.status` = `screening_complete`

### 6. Hydration etter "reload"
- GET /api/analyses/<id> returnerer candidates med `ai_screening`
- Frontend `loadFromCandidates` kan hydrere `screeningResults` og `screeningStarted`

## DB-skjema (viktige tabeller)

### analyses
- `id` uuid PK
- `status` enum: scoping, scoping_complete, searching, candidates_ready, screening, screening_complete, post_search, synthesis, qa, complete
- `gaps` jsonb DEFAULT '[]'
- `problem`, `refined_problem` text
- `sub_problems`, `context` jsonb

### analysis_candidates
- `id` uuid PK
- `analysis_id` uuid FK → analyses
- `sak_nr` text
- `category` text (A/B/C)
- `signals` jsonb
- `iteration` integer
- `screening_status` text (pending/ai_screened/user_read/both)
- `ai_screening` jsonb (screening result incl. quote_verification)
- `user_notes` text
- `is_delimitation` boolean
- `read_at` timestamptz
- UNIQUE (analysis_id, sak_nr)

### analysis_propositions
- `analysis_id` uuid FK
- `proposition_text` text
- `source_case` text
- `source` text (ai_screening / ai_cross)
- UNIQUE (analysis_id, source_case, source)

### analysis_seeds
- `analysis_id` uuid FK
- `seed_type` text (provision/fts/vector/case)
- `value` text

## Kjente bugs/edge cases å teste for

1. **Propositions upsert** — wrappet i try/catch, men sjekk at det ikke feiler stille
2. **SSE error handling** — screening som feiler for én sak skal ikke stoppe de andre
3. **Adaptive thinking** — response.content kan inneholde thinking-blokker før text
4. **FOA 2017-filter** — dimmed saker inkluderes fortsatt i screening (kjent bug, test at det er slik)
5. **custom_id sanitisering** — sak_nr med `/` (f.eks. `2022/31`) sanitiseres til `_` i batch

## Teknisk oppsett

- Backend: `cd backend && source venv/bin/activate && python app.py` (port 5002)
- Supabase project: `iyetsvrteyzpirygxenu`
- Tester i `backend/tests/` (Python pytest)
- Bruk `requests` for HTTP, `sseclient-py` for SSE
- Kan bruke live Supabase (testdata ryddes opp etter test)
- Anthropic API-nøkkel trengs (env var ANTHROPIC_API_KEY)

## Testdata-strategi

Opprett en dedikert testanalyse i `setUp`:
1. `POST /api/analyses` med problem="Test: tildelingskriterier FOA § 16-10"
2. Kjør pipeline-steg sekvensielt
3. Slett testanalysen i `tearDown`

Alternativt: bruk fixtures med mock av Anthropic API for raskere/billigere tester. Men minst én "smoke test" bør kjøre mot live API.
