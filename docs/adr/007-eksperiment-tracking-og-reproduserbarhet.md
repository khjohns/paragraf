# ADR-007: Eksperiment-tracking og reproduserbarhet

**Dato:** 2026-03-26
**Status:** Foreslått
**Kontekst:** Oppfølging av ADR-006 (kategorisering og signalmodell). Formaliserer pipeline-logging for reproduserbarhet, metodekalibrering og akademisk etterprøvbarhet.

---

## Problemstilling

Pipeline-kjøringer muterer state (kandidater, screening, kategorier, syntese) uten å logge prosessen som produserte dem. Vi kan se *hva* resultatet er, men ikke *hvordan* det ble til — hvilken prompt, hvilken modell, hvilken rekkefølge, med hvilke terskler.

### Identifiserte hull

1. **Ingen prompt-versjonering:** Hvilken prompt-versjon produserte hvilket screening-resultat?
2. **Ingen modell-versjonering:** Claude Sonnet 4.6 vs Opus 4.6 — hva ble brukt for hvert steg?
3. **Ingen kjøringshistorikk:** Umulig å sammenligne to kjøringer av samme analyse med ulike parametre.
4. **Ingen bruker-korrektiver:** Når juristen overstyrer AI-kategorisering — hva endret de, og hvorfor?
5. **Ingen eksplisitt eksperiment-struktur:** A/B-testing av triage-prompts krever manuell sammenstilling.

### Kravdrivere

**Tre roller med ulike behov:**

| Rolle | Behov |
|---|---|
| **Jurist** (bruker) | Proveniens: "Hvorfor er denne saken med?" — kjeden signal → triage → screening → syntese |
| **Forsker** (avhandling) | Kontrollerte eksperimenter: reproduserbarhet, presisjonsmåling, statistisk robusthet |
| **Produktutvikler** | A/B-testing: "Ny triage-prompt ga 12% bedre recall over 3 analyser" — regresjonsdeteksjon |

**Akademisk kontekst:** Dataen skal kunne brukes i en juridisk avhandling om kartleggingsmetodikk og AI som juridisk verktøy. Opponenter må kunne inspisere eksperimenter og verifisere resultater.

### Hvorfor ikke event sourcing?

LLM-replay er ikke deterministisk: `same input + same prompt + same model ≠ same output`. Event sourcing sin kjerneverdi (deterministisk replay) gjelder ikke. Det vi trenger er **eksperiment-tracking** — dokumenterte, sammenlignbare kjøringer der ikke-determinisme behandles som et datapunkt ("92% overlapp over 5 runs"), ikke skjules bak en replay-illusjon.

Inspirert av MLflow/Weights & Biases, ikke EventStoreDB.

---

## Beslutning

### Eksperiment-tracking med immutable runs

Fire nye tabeller: `pipeline_runs`, `pipeline_steps`, `user_corrections`, `prompt_registry`.

Eksisterende mutable state (analysis_candidates, analysis_documents, etc.) forblir source of truth for UI. Pipeline-tracking er en parallell, append-only logg for analyse og reproduserbarhet.

#### 1. pipeline_runs — kjøringer

En run er én gjennomkjøring av pipelinen (hel eller delvis) for en analyse.

```sql
CREATE TABLE paragraf_pipeline_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   uuid NOT NULL REFERENCES paragraf_analyses(id),
  parent_run_id uuid REFERENCES paragraf_pipeline_runs(id),  -- for kontrollerte variasjoner
  variation     jsonb,          -- hva endret seg fra parent: {model: "opus-4-6", step: "screening"}
  status        text NOT NULL DEFAULT 'running',  -- running | completed | failed | partial
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz,
  metadata      jsonb           -- pipeline-versjon, git SHA, env-info
);

CREATE INDEX idx_paragraf_pipeline_runs_analysis ON pipeline_runs(analysis_id);
CREATE INDEX idx_paragraf_pipeline_runs_parent ON pipeline_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
```

**Livssyklus:**
- Ny kjøring: `INSERT` med `status = 'running'`
- Fullført: `UPDATE status = 'completed', completed_at = now()`
- Feilet: `UPDATE status = 'failed'` — delvis fullførte steg er bevart
- Variasjon: `INSERT` med `parent_run_id` + `variation` som beskriver endringen

**Eksempel — kontrollert eksperiment:**
```sql
-- Opprinnelig kjøring
INSERT INTO pipeline_runs (analysis_id, status) VALUES ('a93ce729...', 'completed');
-- Re-kjøring med annen modell for screening
INSERT INTO pipeline_runs (analysis_id, parent_run_id, variation, status)
VALUES ('a93ce729...', 'run-001', '{"step": "screening", "model": "claude-opus-4-6"}', 'completed');
```

#### 2. pipeline_steps — steg i en kjøring

Hvert steg i pipelinen er en immutable rad med fryst input og output.

```sql
CREATE TABLE paragraf_pipeline_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES paragraf_pipeline_runs(id),
  step_type     text NOT NULL,  -- scope | provisions | triage | screen | verify | cross | synthesize | qa
  step_input    jsonb NOT NULL, -- fryst input-snapshot (se schemas nedenfor)
  step_output   jsonb NOT NULL, -- fryst resultat
  model_id      text,           -- claude-sonnet-4-6, claude-haiku-4-5-20251001, etc.
  prompt_hash   text,           -- SHA-256 av prompt-teksten, kobler til prompt_registry
  prompt_text   text,           -- selve prompten (fryst for reproduserbarhet)
  duration_ms   int,
  cost_usd      numeric(10,4),
  created_at    timestamptz DEFAULT now(),
  metadata      jsonb           -- temperatur, max_tokens, thinking-config, batch_size
);

CREATE INDEX idx_paragraf_pipeline_steps_run ON pipeline_steps(run_id);
CREATE INDEX idx_paragraf_pipeline_steps_type ON pipeline_steps(step_type);
```

**Viktig:** `step_input` og `step_output` er **immutable snapshots**. De dupliserer data som også finnes i mutable tabeller — men det er hele poenget: snapshotet reflekterer tilstanden *da steget kjørte*, ikke nåværende tilstand.

#### 3. user_corrections — juristen som korrektiv

Fanger når brukeren overstyrer AI-vurderinger. Verdifullt for metodeforskning — viser hvor AI feiler systematisk.

```sql
CREATE TABLE paragraf_user_corrections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     uuid NOT NULL REFERENCES paragraf_analyses(id),
  run_id          uuid REFERENCES paragraf_pipeline_runs(id),  -- nullable: korreksjon kan skje utenfor en run
  sak_nr          text,
  correction_type text NOT NULL,  -- category_override | star_toggle | delimitation_toggle | note
  before_value    jsonb,          -- {category: "C"}
  after_value     jsonb,          -- {category: "A"}
  reason          text,           -- valgfritt, men verdifullt: "Saken siterer §24-2 i kontekst AI ikke forstod"
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_paragraf_user_corrections_analysis ON user_corrections(analysis_id);
```

**Friksjon vs verdi:** `reason` er valgfritt (nullable). Frontend viser en kort prompt ("Kort — hvorfor?") ved overstyring. Selv 30% utfyllingsrate gir verdifulle datapunkter for forskning.

#### 4. prompt_registry — indeks for prompt-versjoner

Kobler prompt-hash til lesbar versjon og git-historikk. Muliggjør SQL-basert presisjon-per-prompt-analyse.

```sql
CREATE TABLE paragraf_prompt_registry (
  hash        text PRIMARY KEY,       -- SHA-256 av prompt-teksten
  step_type   text NOT NULL,          -- scope | provisions | triage | screen | verify | cross | synthesize | qa
  version_tag text,                   -- v1, v2, ensemble-v1, etc.
  description text,                   -- kort beskrivelse av hva som endret seg
  git_sha     text,                   -- commit som introduserte denne versjonen
  created_at  timestamptz DEFAULT now()
);
```

**Brukes slik:**
```sql
-- Presisjon per triage-prompt-versjon
SELECT p.version_tag, count(*) as runs,
       avg(m.rank1_screening_a::float / nullif(m.rank1_total, 0)) as avg_precision
FROM pipeline_steps s
JOIN pipeline_runs r ON s.run_id = r.id
JOIN prompt_registry p ON s.prompt_hash = p.hash
JOIN analysis_metrics m ON r.analysis_id = m.analysis_id
WHERE s.step_type = 'triage'
GROUP BY p.version_tag
ORDER BY avg_precision DESC;
```

### Definerte jsonb-schemas per step_type

For konsistens og eksportbarhet defineres faste strukturer for `step_input` og `step_output`.

#### scope

```typescript
// step_input
{
  provisions: string[],       // ["anskaffelsesforskriften:18-1", "anskaffelsesforskriften:14-1"]
  fts_terms: string[],        // ["prisskjema", "handlekurv", "taktisk prising"]
  vector_query: string,       // "Kan oppdragsgiver skjule estimerte mengder..."
  seed_cases: string[]         // ["2016/33"]
}

// step_output
{
  candidates: {
    sak_nr: string,
    signals: { ref: string[], fts: string[], vec: number[], discovery_rank: number }
  }[],
  stats: { total: number, rank1: number, rank2: number, rank3: number }
}
```

#### triage

```typescript
// step_input
{
  candidates: { sak_nr: string, signals: object, saken_gjelder: string, avgjoerelse: string }[],
  prompt_version: string      // "ensemble-v1"
}

// step_output
{
  accepted: string[],          // sak_nr-liste
  rejected: string[],
  pass_rate: number,           // 0.0-1.0
  variant_results?: {          // for ensemble: resultat per variant
    [variant: string]: { accepted: string[], rejected: string[] }
  }
}
```

#### screen

```typescript
// step_input
{
  sak_nr: string,
  provision_screening: object | null,  // bestemmelseskapsel
  problem_statement: string
}

// step_output
{
  relevance: "A" | "B" | "C",
  star: boolean,
  factum: string,
  assessment: string,            // nemndas vurdering
  proposition: string,
  quotes: { p: number, text: string }[],  // nøkkelsitater med avsnittsnummer
  nuances: string | null,        // motargumenter, unntak, dissens
  relevance_reasoning: string
}
```

#### provisions

```typescript
// step_input
{
  provisions: string[],          // ["anskaffelsesforskriften:18-1"]
  provision_texts: { id: string, text: string }[]  // lovtekst per bestemmelse
}

// step_output
{
  screened_provisions: {
    id: string,
    key_qualifications: string[],  // vilkår/unntak som lett overses
    cross_references: string[],    // kryss-referanser til andre bestemmelser
    interactions: string[]         // der ledd i én bestemmelse kvalifiserer en annen
  }[]
}
```

#### verify

```typescript
// step_input
{
  candidates: { sak_nr: string, quotes: { p: number, text: string }[] }[]
}

// step_output
{
  verified_quotes: {
    sak_nr: string,
    quote_index: number,
    status: "verified" | "truncated" | "inaccurate" | "not_found",
    original: string,
    found_text?: string
  }[],
  stats: { verified: number, truncated: number, inaccurate: number, not_found: number }
}
```

#### cross

```typescript
// step_input
{
  screened_candidates: { sak_nr: string, category: string, proposition: string }[],
  provisions: string[]
}

// step_output
{
  propositions: {
    id: string,
    text: string,
    supporting_cases: string[],
    contradicting_cases: string[],
    evolution_type: "established" | "confirmed" | "qualified" | "consolidating"
  }[]
}
```

#### synthesize

```typescript
// step_input
{
  screened_candidates: { sak_nr: string, category: string, proposition: string, star: boolean }[],
  cross_propositions: object | null,
  provision_screening: object | null,
  problem_statement: string
}

// step_output
{
  note_text: string,
  word_count: number,
  sections: string[],          // overskrifter
  cases_cited: string[]        // sak_nr referert i notatet
}
```

#### qa

```typescript
// step_input
{
  note_text: string,
  candidates: { sak_nr: string, quotes: object[] }[]
}

// step_output
{
  flags: { severity: string, description: string, section: string }[],
  citation_verification: { verified: number, truncated: number, inaccurate: number },
  revisions_made: boolean
}
```

---

## Begrunnelse

### Vurderte alternativer

**Event sourcing (full CQRS)**
- Derive all state from events. Deterministisk replay.
- **Forkastet:** LLM-output er ikke deterministisk. `same input ≠ same output`. Replay gir illusjon av reproduserbarhet. Eksperiment-tracking er ærligere — behandler variasjon som datapunkt.

**Append-only audit log (én flat tabell)**
- Enkel hendelseslogg uten kjøringskonsept.
- **Forkastet:** Umulig å gruppere hendelser i kjøringer. Kan ikke uttrykke "dette er en variasjon av den kjøringen." Mangler hierarkisk struktur for eksperiment-sammenligning.

**Ingen logging (nåværende)**
- Resultater lagres, prosessen ikke.
- **Forkastet:** Utilstrekkelig for akademisk reproduserbarhet, produktkalibrering og feilsøking.

### Nøkkelargumenter for valgt løsning

1. **Run som førsteklasses entitet:** Hver pipeline-kjøring er et isolert, immutabelt eksperiment. Sammenligning mellom runs er en enkel join.
2. **Kontrollerte variasjoner:** `parent_run_id + variation` uttrykker eksplisitt "dette er samme analyse med endret modell/prompt/terskel."
3. **Akademisk rigor:** Strukturerte jsonb-schemas muliggjør eksport til CSV/JSON for ekstern verifikasjon.
4. **Produktutvikling:** Presisjon per prompt-versjon, kostnad per modell, regresjonsdeteksjon — alt i SQL.
5. **Ikke-determinisme som datapunkt:** Flere runs med samme input gir konfidensintervaller, ikke illusorisk determinisme.

### Thinking-partner-innsikter

- **Satisficing vs Maximizing:** Full event sourcing er overkill. Eksperiment-tracking dekker alle bruksscenarier uten replay-kompleksitet.
- **Pre-mortem:** Avhandlingsopponent angriper reproduserbarhet, ikke arkitektur. Eksperiment-tracking med statistisk overlap-analyse er sterkere evidens enn deterministisk replay.
- **Reframing:** Paragraf er både verktøy og forskningsobjekt. Pipeline-evolusjonen (prompt v1→v2→ensemble) er like viktig som analyseresultatene. `prompt_registry` med `version_tag` fanger dette.

---

## Handlingsplan

### Fase 1: Database-tabeller

Opprett `pipeline_runs`, `pipeline_steps`, `user_corrections`, `prompt_registry` med schemas som definert ovenfor.

### Fase 2: Pipeline-skill-integrasjon

Oppdater pipeline-skill (CC-pipeline, som er den aktive pipelinen) til å logge til nye tabeller:
- `pipeline-run` skill: opprett run ved start, logg steg underveis, lukk run ved slutt
- Hver sub-skill (scope, provisions, screen, verify, cross, synthesize, qa): logg step_input/step_output
- Frontend: logg `user_corrections` ved overstyring (category-endring, star-toggle, delimitation)

**Merk:** API-pipelinen (Flask backend) er utdatert og prioriteres ikke for tracking-integrasjon. Hvis den reaktiveres, kan den bruke samme pipeline_steps-format.

### Fase 3: Analyse-integrasjon

Oppdater `pipeline-analyst` skill til å bruke `pipeline_runs` + `pipeline_steps`:
- Sammenlign presisjon mellom runs med ulik prompt-versjon
- Beregn konfidensintervaller fra multiple runs
- Flagg regresjoner ("ny prompt ga lavere presisjon")

### Fase 4: Eksport

Bygg eksportfunksjon som genererer strukturerte filer fra `pipeline_runs` + `pipeline_steps`:
- JSON med dokumentert schema (for programmatisk analyse)
- CSV med flate rader (for Excel/R/Python)
- Markdown-rapport per analyse (for avhandling)

---

## Konsekvenser

### Positive
- **Reproduserbarhet:** Enhver analyse kan inspiseres steg-for-steg med eksakt input/output
- **Eksperiment-sammenligning:** A/B-testing av prompts, modeller, terskler i SQL
- **Akademisk etterprøvbarhet:** Strukturert data for avhandling og opponenter
- **Produktkalibrering:** Presisjon/recall-trender over prompt-versjoner og tid
- **Bruker-innsikt:** Korrektiver viser hvor AI feiler systematisk

### Negative
- **Lagringskostnad:** `step_input`/`step_output` dupliserer data. Estimat: ~5-10 KB per steg, ~50-100 KB per run. Neglisjerbart for Supabase.
- **Implementeringskostnad:** Pipeline-kode må bli "run-aware". Moderat — hvert steg må vite sin `run_id`.
- **jsonb-schema-disiplin:** Schemas må vedlikeholdes konsistent. Kan brytes av slurvete kode.

### Risiko

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
|---|---|---|---|
| jsonb-strukturer drifter fra schema | Middels | Inkonsistent data, vanskelig eksport | Validering ved insert (backend helper-funksjon) |
| Pipeline glemmer å logge steg | Lav | Ufullstendig run-historikk | Sjekkliste i pipeline-skill + test |
| Ufullstendige runs forurenser metrikker | Lav | Skjeve aggregeringer | Filter på `status = 'completed'` |
| Lagring vokser ukontrollert | Lav | Supabase-kostnad | Monitorering, eventuelt komprimering av gamle runs |

---

## Avhengigheter

- **ADR-006** (kategorisering): `pipeline_steps` logger signals, category, discovery_rank fra ADR-006
- **`pipeline-analyst` skill:** Oppdateres til å bruke runs/steps som input for metrikker
- **`pipeline-run` skill:** Oppdateres til å opprette og lukke runs
- **Frontend:** Legger til user_corrections-logging ved overstyring

---

## Referanser

- `docs/adr/006-kategorisering-og-signalmodell.md` — Signalmodell og metrikker
- `memory/project_event_sourcing.md` — Opprinnelig vurdering av event sourcing
- MLflow / Weights & Biases — Inspirasjon for eksperiment-tracking-mønsteret
- `llm_call_log` tabell — Eksisterende token/kostnad-logging, komplementerer pipeline_steps
