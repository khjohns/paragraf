# Sprint 5 — AI-kuratert lesemodus

> Fase 2 starter. Mål: LLM-kuratert leseopplevelse i høyrepanelet — gulmarkeringer, AI-kommentarer med gullbrun venstrekant, kryssreferanselenker, og progressiv berikelse.

**Designspec-referanser:** §10 (guidet leseopplevelse), §9 (kantvalens — visuell stil), §33 (fase 2 prioritet)

**Forutsetninger:** Sprint 1-4 fullført (backend API, UI shell, list/graph view, persistence, toast).

---

## Arkitekturbeslutninger

### LLM-integrasjon
- **Claude API** via Anthropic SDK (Python) i Flask-backend
- Ny `/api/curate` endpoint: tar `sak_nr` + `problem_statement` + `seed_provisions` → returnerer strukturert JSON med highlights, kommentarer, kryssreferanser
- **Caching:** Supabase-tabell `ai_curations` (sak_nr + problem_hash → JSON). Cache invalideres ved endring i problemstilling
- **Progressiv berikelse:** Frontend viser tekst umiddelbart, AI-markeringer laster asynkront (1-3s)

### Trust boundary (§10 ufravikelig regel)
- Databasetekst: normal svart tekst, ingen markering
- AI-gulmarkering: `--p-highlight` bakgrunn på databasetekst (AI velger *hva* som markeres, teksten er verbatim)
- AI-kommentar: gullbrun venstrekant (`--p-ai-border`), svak bakgrunn (`--p-ai-bg`), litt mindre font

### Frontend-arkitektur
- `CaseReader.svelte` utvides med AI-overlay (ny prop: `curation`)
- Ny `createCurationQuery` i `$lib/queries/curation.ts` (@tanstack/svelte-query)
- Highlight-rendering: wrap paragraph-tekst i `<mark>` basert på char-offsets fra AI
- AI-kommentarer rendres som separate blokker etter markerte avsnitt

---

## Oppgaver

### 21. Design tokens for AI-kuratering

**Mål:** CSS-variabler for trust-boundary-styling.

**Steg:**
1. Legg til i `app.css` under `:root`:
   ```css
   --p-highlight: #FBF5E8;
   --p-highlight-strong: #F5EBD6;
   --p-ai-border: #A68B5B;
   --p-ai-bg: rgba(166,139,91,0.06);
   --p-ai-text: #7A6B4F;
   ```
2. Verifiser at disse ikke kolliderer med eksisterende tokens

**Verifikasjon:** `npx vite build` passerer, tokens synlige i devtools.

---

### 22. Backend: AI curation endpoint

**Mål:** `/api/curate` endpoint som kaller Claude API og returnerer strukturert kuratering.

**Steg:**
1. Opprett `backend/curation.py` med:
   - `generate_curation(sak_nr, problem_statement, seed_provisions)` funksjon
   - System prompt som instruerer Claude til å returnere strukturert JSON:
     ```json
     {
       "highlights": [{
         "paragraph": 42,
         "start_char": 0,
         "end_char": 147,
         "relevance": "Sentral rettssetning om tidspunkt for representasjonserklæring",
         "cross_references": [{
           "target_case": "2022/789",
           "target_paragraph": 38,
           "relation": "contradicting",
           "note": "Nemnda aksepterte ettersending her"
         }]
       }],
       "summary_note": "Saken fastslår at ESPD alene ikke er tilstrekkelig..."
     }
     ```
   - Claude API-kall med `response_format` for JSON-output
   - Kontekst: beslutnings-tekst + problemstilling + seed-bestemmelser
   - Token-grense: max ~4000 tokens input (trunkering av lange avgjørelser)

2. Opprett `backend/curation_cache.py`:
   - `get_cached_curation(sak_nr, problem_hash)` — sjekk Supabase
   - `cache_curation(sak_nr, problem_hash, curation_data)` — lagre i Supabase
   - `problem_hash` = SHA-256 av `problem_statement + seed_provisions`
   - Supabase-tabell: `ai_curations(id, sak_nr, problem_hash, curation_json, model, created_at)`

3. Registrer endpoint i `backend/app.py`:
   ```python
   @app.route('/api/curate/<sak_nr>', methods=['POST'])
   def curate_case(sak_nr):
       # body: { problem_statement, seed_provisions }
       # returnerer cached eller genererer ny kuratering
   ```

**Verifikasjon:** `curl -X POST http://localhost:5002/api/curate/2023-123 -d '{"problem_statement":"test","seed_provisions":["foa-§8-11"]}' -H 'Content-Type: application/json'` returnerer gyldig JSON.

---

### 23. Supabase migration: ai_curations tabell

**Mål:** Opprett cache-tabell for AI-kurateringer.

**Steg:**
1. Bruk Supabase MCP `apply_migration` med SQL:
   ```sql
   CREATE TABLE ai_curations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     sak_nr TEXT NOT NULL,
     problem_hash TEXT NOT NULL,
     curation_json JSONB NOT NULL,
     model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE(sak_nr, problem_hash)
   );
   CREATE INDEX idx_ai_curations_lookup ON ai_curations(sak_nr, problem_hash);
   ```

**Verifikasjon:** `execute_sql('SELECT * FROM ai_curations LIMIT 1')` fungerer uten feil.

---

### 24. Frontend: curation query + typer

**Mål:** TanStack Query for å hente AI-kuratering, med typer.

**Steg:**
1. Opprett `src/lib/types/curation.ts`:
   ```ts
   export interface CrossReference {
     target_case: string;
     target_paragraph: number;
     relation: 'confirming' | 'contradicting' | 'distinguishing';
     note: string;
   }

   export interface Highlight {
     paragraph: number;
     start_char: number;
     end_char: number;
     relevance: string;
     cross_references: CrossReference[];
   }

   export interface Curation {
     highlights: Highlight[];
     summary_note: string;
   }
   ```

2. Opprett `src/lib/queries/curation.ts`:
   ```ts
   export function createCurationQuery(params: () => {
     sakNr: string | null;
     problemStatement: string;
     seedProvisions: string[];
   }) {
     return createQuery(() => {
       const p = params();
       return {
         queryKey: ['curation', p.sakNr, p.problemStatement],
         queryFn: () => fetch(`/api/curate/${p.sakNr}`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             problem_statement: p.problemStatement,
             seed_provisions: p.seedProvisions,
           }),
         }).then(r => r.json()),
         enabled: !!p.sakNr && p.problemStatement.length > 0,
         staleTime: Infinity, // cached per session
       };
     });
   }
   ```

**Verifikasjon:** Build passerer, query-hook kan importeres.

---

### 25. CaseReader: AI-markerte avsnitt med gulmarkering

**Mål:** Paragraf-tekst med gul bakgrunn på AI-identifiserte passasjer.

**Steg:**
1. CaseReader mottar ny prop `curation: Curation | null`
2. For hvert avsnitt (`paragraph`):
   - Sjekk om det finnes en highlight for dette avsnittsnummeret
   - Hvis ja: wrap tekst-segmentet (`start_char` til `end_char`) i `<mark class="ai-highlight">`
   - Resten av teksten rendres normalt
3. Opprett hjelpefunksjon `applyHighlights(text: string, highlights: Highlight[]): HighlightedSegment[]` som returnerer segmenter med `highlighted: boolean`
4. CSS:
   ```css
   .ai-highlight {
     background: var(--p-highlight);
     padding: 1px 2px;
     border-radius: 2px;
   }
   ```
5. Avsnitt med minst én highlight får subtil venstre-border:
   ```css
   .paragraph.has-highlight {
     border-left: 2px solid var(--p-highlight-strong);
     padding-left: 12px;
   }
   ```
6. Ikke-markerte avsnitt: normal opasitet (1.0). Toggle "Vis bare markerte" dimmer dem til 0.5

**Verifikasjon:** Med mock curation-data, gulmarkeringer synlige i lesemodus.

---

### 26. CaseReader: AI-kommentarer med gullbrun venstrekant

**Mål:** AI-kommentarer rendres etter markerte avsnitt, visuelt tydelig adskilt fra databasetekst.

**Steg:**
1. Etter hvert markert avsnitt, sjekk om highlight har `relevance` eller `cross_references`
2. Render AI-kommentar-blokk:
   ```svelte
   <div class="ai-comment">
     <p class="ai-relevance">{highlight.relevance}</p>
     {#each highlight.cross_references as ref}
       <button class="ai-crossref" onclick={() => navigateTo(ref)}>
         → Gå til {ref.target_case} §{ref.target_paragraph}
       </button>
       <p class="ai-crossref-note">{ref.note}</p>
     {/each}
   </div>
   ```
3. CSS for trust-boundary:
   ```css
   .ai-comment {
     border-left: 3px solid var(--p-ai-border);
     background: var(--p-ai-bg);
     padding: 8px 12px;
     margin: 4px 0 12px;
     font-size: 0.8125rem;
     color: var(--p-ai-text);
   }
   .ai-crossref {
     all: unset;
     cursor: pointer;
     color: var(--p-ai-border);
     font-weight: 500;
     font-size: 0.75rem;
   }
   .ai-crossref:hover {
     text-decoration: underline;
   }
   ```

**Verifikasjon:** AI-kommentarer visuelt distinkte fra databasetekst. Gullbrun venstrekant tydelig.

---

### 27. Kryssreferanse-navigasjon

**Mål:** Klikk på "→ Gå til 2022/789 §38" bytter høyrepanelet til den andre saken.

**Steg:**
1. `navigateTo(ref: CrossReference)` i CaseReader:
   - Finn node-ID for `ref.target_case` i `analysisState.nodes`
   - Kall `uiState.selectNode(nodeId)` for å bytte høyrepanel
   - Lagre `scrollToTarget = ref.target_paragraph` i uiState (ny property)
2. Legg til `scrollToTarget` i `uiState`:
   ```ts
   scrollToTarget = $state<number | null>(null);
   clearScrollTarget() { this.scrollToTarget = null; }
   ```
3. CaseReader lytter på `scrollToTarget`:
   - Etter tekst er lastet, scroll til paragraph med `scrollIntoView({ behavior: 'smooth' })`
   - Clear target etter scroll
4. Fallback: hvis target-saken ikke er i `analysisState.nodes`, vis toast: "Saken er ikke i analysen"

**Verifikasjon:** Klikk på kryssreferanse bytter sak og scroller til riktig avsnitt.

---

### 28. Avsnittnavigering (pills)

**Mål:** Kompakt meny øverst i lesemodus med klikkbare pills for AI-markerte avsnitt.

**Steg:**
1. Øverst i CaseReader (i lesemodus), render pill-bar:
   ```svelte
   {#if curation?.highlights.length}
     <div class="paragraph-pills">
       <span class="pills-label">Markerte avsnitt:</span>
       {#each curation.highlights as hl}
         <button class="pill" onclick={() => scrollToParagraph(hl.paragraph)}>
           §{hl.paragraph}
         </button>
       {/each}
     </div>
   {/if}
   ```
2. `scrollToParagraph` bruker `document.getElementById('p-{nr}')` og `scrollIntoView`
3. CSS: sticky under CaseReader header, myk bakgrunn, runde pills

**Verifikasjon:** Pills synlige, klikk scroller til riktig avsnitt.

---

### 29. Progressiv berikelse (loading state)

**Mål:** Tekst vises umiddelbart, AI-markeringer lastes progressivt med shimmer-effekt.

**Steg:**
1. I NodeDetail/CaseReader: curation query kjører parallelt med case query
2. Mens curation laster:
   - Vis tekst uten markeringer (databaseinnhold først)
   - Vis skeleton/shimmer i pill-bar-area og etter first visible paragraph
   - Subtle toast eller inline tekst: "AI-kuratering laster..."
3. Når curation er ferdig:
   - Markeringer fades inn med CSS transition (opacity 0→1, 300ms)
   - Pills dukker opp
   - AI-kommentarer fades inn
4. Hvis curation feiler:
   - Tekst forblir uten markeringer (graceful degradation)
   - Liten feilmelding: "Kunne ikke hente AI-kuratering" under pills-area

**Verifikasjon:** Tekst synlig umiddelbart, markeringer dukker opp progressivt.

---

### 30. Overview-modus: AI-kuratert sammendrag

**Mål:** I overview-modus (før "Les avgjørelsen →"), vis kompakt sammendrag av AI-markerte avsnitt.

**Steg:**
1. I NodeDetail overview, etter metadata-seksjon og før "Les avgjørelsen →":
   - Vis `curation.summary_note` som AI-kommentar (gullbrun venstrekant)
   - Vis opptil 3 markerte avsnitt som kompakte forhåndsvisninger:
     ```
     ▎ Avsnitt 42
     ▎ «Nemnda finner at kravet om representasjonserklæring
     ▎  må foreligge ved tilbudsfrist.»
     ▎                                    Les i kontekst →
     ```
   - "Les i kontekst →" bytter til lesemodus og scroller til avsnittet
2. Forhåndsvisning: maks 150 tegn av highlight-teksten, ellipsis deretter
3. Laster-tilstand: shimmer-blokker mens curation hentes

**Verifikasjon:** Sammendrag synlig i overview, "Les i kontekst" fungerer.

---

### 31. Vis/skjul toggle for ikke-markerte avsnitt

**Mål:** Toggle mellom "Vis all tekst" og "Vis bare markerte" i lesemodus.

**Steg:**
1. Legg til toggle-knapp under pill-bar:
   ```svelte
   <button class="text-toggle" onclick={() => showAllText = !showAllText}>
     {showAllText ? 'Vis bare markerte' : 'Vis all tekst'}
   </button>
   ```
2. Ikke-markerte avsnitt: `opacity: showAllText ? 1 : 0.4`
3. Klikk på dimmet avsnitt setter det til full opacity midlertidig (click-to-reveal)
4. Default: `showAllText = true` (vis alt, men markerte avsnitt stikker ut pga. gul bakgrunn)

**Verifikasjon:** Toggle fungerer, dimming visuelt tydelig.

---

### 32. Playwright-verifikasjon med mock data

**Mål:** Visuell verifikasjon av hele lesemodus med AI-kuratering.

**Steg:**
1. Sett opp mock-curation i test (eller bruk faktisk backend med test-sak)
2. Verifiser:
   - Tekst vises uten AI-markeringer først (progressiv berikelse)
   - Gulmarkeringer synlige på riktige avsnitt
   - AI-kommentarer har gullbrun venstrekant
   - Kryssreferanse-lenker klikkbare
   - Pill-navigering fungerer
   - Toggle vis/skjul fungerer
   - Trust-boundary tydelig (database vs. AI)
3. Ta screenshot for dokumentasjon

**Verifikasjon:** Screenshots dokumenterer alle tilstander.

---

## Batch-inndeling

| Batch | Oppgaver | Fokus |
|-------|----------|-------|
| 1 | 21, 22, 23 | Design tokens, backend endpoint, database |
| 2 | 24, 25, 26 | Frontend typer, query, highlight + kommentar rendering |
| 3 | 27, 28, 29 | Navigasjon, pills, progressiv berikelse |
| 4 | 30, 31, 32 | Overview-sammendrag, toggle, Playwright-verifikasjon |

**Estimat:** 4 batcher × 3 oppgaver. Backend (batch 1) kan delvis paralleliseres med frontend-typer (oppgave 24).

---

## Avhengigheter

- **Anthropic API-nøkkel** må konfigureres i backend (`.env`)
- **Supabase migration** (oppgave 23) må kjøres før backend-caching fungerer
- **Case data** i databasen — trenger minst én reell KOFA-sak for testing
- **Proxy-oppsett** i `vite.config.ts` (allerede konfigurert for `/api` → port 5002)
