# ADR-006: Kategorisering og signalmodell

**Dato:** 2026-03-24
**Status:** Foreslått
**Kontekst:** Oppfølging av ADR-005 (Haiku-triage, bestemmelsesscreening). Formaliserer kategoriserings- og signalmodellen som grunnlag for triage, screening, syntese og metodekalibrering.

---

## Problemstilling

Pipelinen opererer med to konseptuelt ulike kategoriseringer — en mekanisk (basert på discovery-signaler) og en innholdsbasert (basert på AI-screening) — men lagrer begge i ett `category`-felt. Signalformatet (boolean) mister granulariteten som triage, prioritering og metodekalibrering trenger.

### Identifiserte problemer

**1. Signalformat-kaos mellom pipelines**
CLI-pipelinen lagret signals som arrays (`{ref: ["16-11"], fts: ["konsortium"], vec: [0.78]}`), mens backend-traversal lagret boolean (`{ref: true, fts: false, vec: true}`). Re-traversal-upsert overskrev array-formatet med boolean — korrupt data. Nå normalisert til boolean, men det er feil format å normalisere til.

**2. Boolean signals mister granularitet**
Med boolean kan vi ikke skille:
- Hvilke bestemmelser som ga ref-treff (primær vs sekundær)
- Hvilke FTS-termer som matchet
- Vektorsøkets similarity-score
- Antall treff per signaltype (3 ref-treff er sterkere enn 1)

**3. Ingen C-saker med boolean-format**
Alle kandidater har minst 1 signal (ellers hadde de ikke blitt oppdaget). Med boolean gir signal-counting: A = 2+ signaltyper → 11 saker, B = 1 signaltype → 90 saker, C = 0 → 0 saker. Haiku-triage (ADR-005, designet for C-saker) ble meningsløs. 90 B-saker er for mange å fullscreene uten triage.

**4. Ett felt for to kategoriseringer**
`category` starter som mekanisk klassifisering (fra traversal), kan overskrives av innholdsbasert (fra screening). Etter overskrivning er den mekaniske klassifiseringen tapt. Det gjør det umulig å:
- Beregne presisjon per signalmønster (grunnlaget for å forbedre søkestrategien)
- Sammenligne discovery-prediksjon med innholdsvurdering over tid
- Reprodusere metodikkens valideringstabell (A-presisjon 100%, B-presisjon 63%)

**5. CLAUDE.md-inkonistens**
CLAUDE.md sier «A/B/C-kategori = signaldekning (R+F+V), IKKE kvalitetsvurdering», mens screening-agenten setter `relevance: A/B/C` som kvalitetsvurdering. Etter denne ADR-en betyr A/B/C alltid innholdsrelevans.

### Hva metodikken definerer

`docs/design/metode-rettslig-analyse.md` opererer med to ulike kategoriseringer:

**Mekanisk kategorisering** (Steg 2, Fase 1 — før lesing):
```
A = referansetabell(primær) ∩ referansetabell(sekundær) ∩ FTS(nøkkelbegrep)  → trippel interseksjon
B = referansetabell(primær) ∩ FTS(nøkkelbegrep)                              → dobbel interseksjon
C = FTS(nøkkelbegrep) alene                                                  → variabel relevans
```

**Innholdsbasert kategorisering** (Steg 3 — etter screening):
```
A = Direkte relevant, behandler problemstillingen inngående
B = Utfyllende, berører problemstillingen som del av en bredere vurdering
C = Perifer, nevner relevante begreper uten å analysere dem
```

Metodikken sier eksplisitt: *«innholdsbasert kategorisering kan avvike vesentlig fra interseksjonsrangeringen»* og *«Kategori C-saker er verdifulle — avgrensningspraksis.»*

### Validert presisjonstabell (fra 6 historiske analyser + 2 DB-analyser)

**Presisjon** (andel mekanisk A/B som forblir relevant etter screening):

| Metrikk | Verdi | Kilde |
|---|---|---|
| A-presisjon (trippel interseksjon) | 100% | 3/3, 15/17, 4/4, 9/9 (historiske) |
| B-presisjon (dobbel interseksjon) | ~63% | 15/24, 2/3, 8/8, 4/8, 4/5 (historiske) |
| Ettersøk øker dekning med | ~28% | 7/25 i første notat |
| Vektorsøk avgjørende for konseptuelle | 100% recall | FTS 14% presisjon vs hybrid 100% |

**Recall** (andel av screening-A funnet per discovery_rank — ny metrikk fra DB-validering):

| Metrikk | Verdi | Kilde |
|---|---|---|
| Recall for discovery_rank ≥ 2 | **24%** (4/17) | DB-analyser `8c2c8b4d` + `0dccaab9` |
| Recall for discovery_rank = 1 | **76%** (13/17) | Flertallet av kjernesaker har kun 1 signal |
| Vec-only → screening A | **12/17** (71%) | Dominerende kanal for kjernesaker i konseptuelle søk |

**Konfusjonsmatrise** (134 kandidater, 2 DB-analyser):

| | Screening A (Kjernesak) | Screening B (Støttesak) | Screening C (Kontekstsak) | Ikke screenet | **Sum** |
|---|---|---|---|---|---|
| **discovery_rank ≥ 2** | 4 | 5 | 2 | 1 | **12** |
| **discovery_rank = 1** | 13 | 7 | 50 | 52 | **122** |
| **Sum** | **17** | **12** | **52** | **53** | **134** |

**Kritisk funn:** I analyse `0dccaab9` (kunngjøringskrav — konseptuelt tema) var 11 av 12 kjernesaker vec-only med star=true. Vec-only er ikke støy — det er den primære discovery-kanalen for konseptuelle problemstillinger der terminologien varierer.

Denne tabellen er en sentral metodisk ressurs som bare kan akkumuleres hvis discovery-mønster og innholdskategori begge er bevart.

---

## Beslutning

### Rikere signals, ett kategori-felt, fryst discovery-rank

#### 1. Signals: Fra boolean til arrays

`signals` endres fra boolean-format til arrays som bevarer søkedetaljene:

```jsonc
// Nåværende (boolean) — mister granularitet
{"ref": true, "fts": false, "vec": true}

// Nytt (arrays) — bevarer hva som traff
{
  "ref": ["16-11", "16-10"],       // Hvilke bestemmelser som ga ref-treff
  "fts": ["konsortium", "gruppering"],  // Hvilke FTS-termer som matchet
  "vec": [0.78],                   // Similarity-score fra vektorsøk
  "discovery_rank": 2              // Fryst: antall signaltyper ved oppdagelse
}
```

**Array-semantikk:**
- Tom array `[]` = ingen treff for denne signaltypen
- Ref: bestemmelsesnummer som ga treff (strenger)
- FTS: søketermer som ga treff (strenger)
- Vec: similarity-scores for vektorsøk-treff (tall, 0.0-1.0)
- Boolean-kompatibel: `bool(signals["ref"])` gir `true`/`false` som før

#### 2. discovery_rank: Fryst øyeblikksbilde i signals-objektet

`discovery_rank` (int, 1-3) lagres som en del av `signals`-objektet ved første insert. Den representerer pipelinens mekaniske vurdering på oppdagelsestidspunktet — antall signaltyper som traff.

**Beregning:**
```python
discovery_rank = sum(1 for s in [signals["ref"], signals["fts"], signals["vec"]] if s)
```

**Begrunnelse for å fryse (ikke beregne on-demand):**
- Hvis beregningslogikken endres (f.eks. ny signaltype, endret terskel), vil on-demand-beregning gi retroaktivt andre verdier for historiske kandidater
- Presisjonstabellen krever at discovery-ranken reflekterer hva pipelinen *faktisk trodde* da saken ble oppdaget
- Kostnad: ett heltall per kandidat — neglisjerbar
- Alternativet (versjonert beregningslogikk per analyse) er mer komplekst uten gevinst

**Invariant:** `signals` (inkl. `discovery_rank`) settes av scope/traversal-steget og overskrives aldri av downstream-steg (triage, screening, syntese). Håndheves av backend-sjekk i `persist_candidates()`. En eksplisitt `force`-parameter tillater re-scope ved behov — men dette er en bevisst operasjon, ikke en sideeffekt.

#### 3. category: Alltid innholdsrelevans

`category` er ett felt med én semantikk: **innholdsbasert relevans** (A/B/C).

| Verdi | Intern | Frontend-label | Betydning |
|---|---|---|---|
| `null` | — | *(signal-prikker)* | Ikke screenet ennå |
| `A` | `A` | **Kjernesak** | Sentral for problemstillingen — behandler den inngående |
| `B` | `B` | **Støttesak** | Supplerer eller nyanserer — berører som del av bredere vurdering |
| `C` | `C` | **Kontekstsak** | Gir kontekst eller avgrensning — nevner begreper uten å analysere |

**Funksjonelle labels i frontend:** A/B/C er ekspert-shorthand som er meningsfullt for metodeutvikling og kalibrering, men semantisk tomt for brukeren. Frontend viser derfor funksjonelle labels som beskriver hva saken *bidrar med* i analysen:
- «Kjernesak» kommuniserer at saken bærer analysen
- «Støttesak» kommuniserer at saken supplerer uten å bære — klarere enn «utfyllende» som kan leses som «fyller ut tomrom»
- «Kontekstsak» kommuniserer at saken har en rolle (kontekst, avgrensning) uten å konnotere «verdiløs» slik «perifer» gjør — viktig fordi C-saker kan inneholde avgrensningspraksis

A/B/C beholdes som interne verdier (DB, API, screening-schema, presisjonstabeller) for kompakthet og kompatibilitet med metodikkens etablerte vokabular.

**Livssyklus:**
1. Etter traversal: `category = null` (ikke satt av traversal lenger)
2. Etter triage: uendret (`null`) — triage setter `screening_status` til `triage_rejected`/`triage_accepted`
3. Etter screening: `category = A/B/C` (satt av screening-agenten via `ai_screening.relevance`)

**Breaking change fra nåværende system:** I dag settes `category` til A/B/C allerede av traversal (mekanisk). Etter denne endringen er `category = null` inntil screening. Frontend må håndtere `null` eksplisitt.

#### 4. Frontend: Signal-indikatorer pre-screening, A/B/C post-screening

**Før screening** (`category = null`):
- Prioriteringsindikator beregnes fra `signals` — de eksisterende signal-prikkene (●●○) viser antall signaltyper
- Sortering bruker `discovery_rank` (3 → 2 → 1) deretter `score`
- Ingen A/B/C-bokstav vises

**Etter screening** (`category = A/B/C`):
- Funksjonell label-badge vises: «Kjernesak» / «Støttesak» / «Kontekstsak»
- Signal-prikker kan vises i tillegg (tooltip eller detaljvisning) for transparens
- Sortering bruker `category` (A → B → C) deretter `score`

**Metode-/analysemodus** (fremtidig):
- Konfusjonsmatrise: `discovery_rank` × `category` per analyse
- Presisjon per signalkombinasjon
- Saker der discovery og screening divergerer

### Prioriteringsrekkefølge for screening

Rikere signals muliggjør en mer nyansert prioriteringsrekkefølge enn enkel signal-counting. Default-prioritering for screening-kø:

```
ref+fts+vec  (discovery_rank=3)  → screenes først
ref+fts      (discovery_rank=2)  → screenes
ref+vec      (discovery_rank=2)  → screenes
fts+vec      (discovery_rank=2)  → screenes
ref-only     (discovery_rank=1)  → screenes
fts-only     (discovery_rank=1)  → screenes
vec-only     (discovery_rank=1)  → triage-kandidat, deretter screenes
```

**Innenfor** samme `discovery_rank`: `ref > fts > vec` som default, men triage (Haiku) opererer på `signals` + metadata (`saken_gjelder`, `avgjoerelse`), ikke bare denne rangeringen. En ref-only sak med `saken_gjelder: "Frister, Habilitet"` kan triages bort, mens en fts-only sak med matching tema screenes direkte.

**Vec som ortogonal dimensjon:** Vektorsøk passer ikke inn i metodikkens opprinnelige hierarki (ref ∩ fts). Vec er en selvstendig dimensjon som fanger konseptuelle treff FTS og ref ikke finner. Validering viser 100% recall for konseptuelle spørsmål, men ~25% presisjon for vec-only. Vec-only saker bør derfor ikke triages automatisk bort — de bør screenes med lavere prioritet.

### Triage-regler med rikere signals

Triage opererer på `signals` + metadata, ikke på `category` eller `discovery_rank` alene:

| Regel | Triage-anbefaling | Begrunnelse |
|---|---|---|
| `discovery_rank >= 2` | Alltid screen | Minst to uavhengige signaler |
| `ref-only` + tema-match i `saken_gjelder` | Screen | Strukturelt signal + tematisk kobling |
| `ref-only` + ingen tema-match | Triage-kandidat | Referanse kan være tangentiell |
| `fts-only` + generisk term | Triage-kandidat | Bredt FTS-treff uten strukturell kobling |
| `fts-only` + spesifikk term | Screen | Spesifikk terminologi tyder på relevans |
| `vec-only` + sim >= 0.70 | Screen | **Validert:** 11/12 kjernesaker i analyse `0dccaab9` var vec-only |
| `vec-only` + sim < 0.70 | Triage-kandidat | Svakere semantisk signal — men fortsatt forsiktig |
| Avvist sak (`avgjoerelse` = avvist) | Triage-kandidat | Sjelden substansiell analyse |

Haiku-triage-prompten (ADR-005) ser allerede signals + `saken_gjelder` + `avgjoerelse`. Med rikere signals kan prompten ta bedre beslutninger — f.eks. se at vec-score er 0.91 (sterk) vs. 0.68 (svak).

**Advarsel basert på validering:** Vec-only saker er den *primære* discovery-kanalen for konseptuelle problemstillinger. I analyse `0dccaab9` var 11 av 12 kjernesaker vec-only. Triage-regler som filtrerer aggressivt på vec-only vil tape flertallet av relevante saker for slike temaer. Terskelen 0.70 er foreløpig — bør kalibreres med flere analyser.

---

## Begrunnelse

### Vurderte alternativer

**Alt A: To felter, rikere signals**
- `signal_category` (A/B/C mekanisk) + `relevance` (A/B/C innholdsbasert)
- Gir mest informasjon, men to kategori-felter med samme A/B/C-vokabular forvirrer. Frontend og prompts må konsekvent bruke riktig felt. Utviklerfeil-risiko er høy.
- **Forkastet:** Forvirring > informasjonsgevinst.

**Alt B: Ett felt, rikere signals, signal_strength**
- `category` forblir ett felt (overskrives), `signal_strength` (int) for sortering
- Enklere enn Alt A, men `signal_strength` som count fanger ikke metodikkens interseksjonsmønstre
- **Delvis adoptert:** Prinsippet om ett felt er riktig, men `signal_strength` erstattes av `discovery_rank` inne i signals-objektet.

**Alt C: Nåværende (boolean signals, én kategori)**
- Mister granularitet, ingen C-saker, ingen kalibrering
- **Forkastet:** Utilstrekkelig for juridisk analyse.

**Alt D: Ett synlig felt, discovery_rank som separat kolonne**
- Ren arkitektur, men `discovery_rank` som kolonne dupliserer informasjon som kan utledes fra signals
- **Modifisert til valgt løsning:** `discovery_rank` inn i signals-objektet, ikke egen kolonne.

### Nøkkelargumenter for valgt løsning

1. **Ingen informasjonstap:** Arrays bevarer hvilke bestemmelser/termer/scorer som traff. `discovery_rank` bevarer pipelinens vurdering på oppdagelsestidspunktet.

2. **Én semantikk per felt:** `category` betyr alltid innholdsrelevans. Ingen risiko for forveksling mellom mekanisk og innholdsbasert A/B/C.

3. **Presisjonstabellen kan akkumulere:** Med `discovery_rank` (fryst) og `category` (satt av screening) kan vi beregne presisjon per signalmønster over alle analyser — grunnlaget for å forbedre søkestrategien.

4. **Minimal skjema-endring:** Ingen nye kolonner. `signals` endrer type fra boolean-verdier til array-verdier. `category` endrer semantikk (fra mekanisk til innholdsbasert) og er `null` inntil screening.

5. **Bakoverkompatibel signals-sjekk:** `bool(signals["ref"])` fungerer identisk for `true` og `["16-11"]`.

### Thinking-partner-innsikter som formet beslutningen

Drøftingsprosessen (dokumentert i `docs/plans/kategorisering-drøfting.md`) brukte structured thinking for å utfordre antakelser:

- **Chesterton's Fence:** «Hvem bruker mekanisk kategori etter screening?» — svaret er *metodikken selv*, for kalibrering. Ikke runtime-konsumenter. Derfor: bevar informasjonen, men ikke som eget synlig felt.
- **Pre-mortem:** To kategori-felter med A/B/C forvirrer garantert. Én feil i en prompt eller komponent som bruker feil felt kan gi subtile feil i screening eller syntese.
- **Reframing:** «Problemet er signalformat, ikke kategorisering» — delvis riktig (boolean ER hovedproblemet), men utilstrekkelig. Systemet manglet også en klar separasjon mellom discovery og assessment.
- **Informasjonsteori:** Overskriving av mekanisk kategori er informasjonsdestruksjon. `discovery_rank` inne i signals-objektet gir det frosne øyeblikksbildet uten ekstra kolonner.

---

## Handlingsplan

### Fase 1: Backend (signals + category-semantikk)

**`backend/traversal.py`:**
- `_build_case_nodes()`: Endre signals fra boolean til arrays. Legg til `discovery_rank`.
- `_classify_category()`: Fjernes — traversal setter ikke lenger `category`.
- Case nodes returneres med `"category": None` (ikke beregnet fra signals).

**`backend/analyses.py`:**
- `persist_candidates()`: Legg til invariant-sjekk — hvis `signals` allerede finnes for en kandidat og `force` ikke er satt, behold eksisterende signals.

**`scripts/pipeline-context.py`:**
- `_normalize_signals()`: Oppdater til å håndtere nytt array-format i tillegg til legacy boolean.

**`backend/screening.py`:**
- Screening-resultatet setter `category` (via `ai_screening.relevance`) — dette er allerede delvis implementert, men persistering av `relevance` til `category`-kolonnen må gjøres eksplisitt.

### Fase 2: Frontend (type-endringer + null-håndtering)

**`src/lib/types/graph.ts`:**
```typescript
// Fra:
export interface SignalHits { ref: boolean; fts: boolean; vec: boolean; }
// Til:
export interface SignalHits {
  ref: string[];     // Bestemmelser som ga ref-treff
  fts: string[];     // FTS-termer som matchet
  vec: number[];     // Similarity-scores fra vektorsøk
  discovery_rank: number;  // Fryst: antall signaltyper (1-3)
}
```

**`src/lib/types/analysis.ts`:**
```typescript
// category endres til nullable:
category: 'A' | 'B' | 'C' | null;  // null = ikke screenet ennå
```

**Komponenter:**
- `NodeRow.svelte`: Signal-prikker beregnes fra `signals.ref.length > 0` etc. (kompatibelt). Etter screening: vis funksjonell label-badge («Kjernesak» / «Støttesak» / «Kontekstsak») i stedet for A/B/C-bokstav.
- `NodeList.svelte`: Sortering håndterer `category = null` — sorter etter `discovery_rank` når category mangler.
- `analysis.svelte.ts`: `catCounts` og `coverageStats` oppdateres for nytt format. Label-mapping: `const CATEGORY_LABELS = { A: 'Kjernesak', B: 'Støttesak', C: 'Kontekstsak' } as const`.

### Fase 3: Migrering av eksisterende data

**Eksisterende analyser:**
- Analyser med boolean signals beholder sine verdier — `_normalize_signals()` håndterer begge formater
- `discovery_rank` kan beregnes retroaktivt fra boolean signals for historiske analyser: `sum(1 for v in [ref, fts, vec] if v)`
- `category` for allerede screenede kandidater beholdes som den er (den ER innholdsbasert fra screening)
- `category` for ikke-screenede kandidater settes til `null` (var mekanisk, nå ugyldig)

**Migreringsscript:** Kjøres én gang for å:
1. Beregne `discovery_rank` fra eksisterende boolean signals
2. Sette `category = null` for kandidater uten `ai_screening`
3. For kandidater med `ai_screening`: sett `category = ai_screening.relevance`

### Fase 4: CLAUDE.md og dokumentasjon

Oppdater CLAUDE.md:
```markdown
- **A/B/C-kategori** = innholdsrelevans etter screening (A=Kjernesak, B=Støttesak, C=Kontekstsak)
- **Frontend-labels:** A→«Kjernesak», B→«Støttesak», C→«Kontekstsak» (A/B/C kun internt)
- **signals** = søke-signaler (ref/fts/vec arrays + discovery_rank), brukes for prioritering og kalibrering
- **category = null** betyr ikke screenet ennå — vis signal-prikker i stedet for kategori-badge
```

### Fase 5: Kontinuerlig metrikk-akkumulering

Presisjons- og recall-tabellen er bare verdifull hvis den vokser med hver analyse. Dette krever at pipelinen logger metrikker automatisk etter screening.

#### DB-tabell: `analysis_metrics`

```sql
CREATE TABLE analysis_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) NOT NULL,
  computed_at timestamptz DEFAULT now(),

  -- Kandidat-statistikk
  total_candidates int NOT NULL,
  screened_candidates int NOT NULL,

  -- Presisjon per discovery_rank
  rank3_total int DEFAULT 0,      -- discovery_rank = 3
  rank3_screening_a int DEFAULT 0,
  rank3_screening_b int DEFAULT 0,
  rank3_screening_c int DEFAULT 0,
  rank2_total int DEFAULT 0,
  rank2_screening_a int DEFAULT 0,
  rank2_screening_b int DEFAULT 0,
  rank2_screening_c int DEFAULT 0,
  rank1_total int DEFAULT 0,
  rank1_screening_a int DEFAULT 0,
  rank1_screening_b int DEFAULT 0,
  rank1_screening_c int DEFAULT 0,

  -- Signal-kanal-statistikk
  vec_only_total int DEFAULT 0,
  vec_only_screening_a int DEFAULT 0,
  ref_fts_total int DEFAULT 0,
  ref_fts_screening_a int DEFAULT 0,

  -- Triage-statistikk
  triage_rejected int DEFAULT 0,
  triage_rejected_was_relevant int DEFAULT 0,  -- Falske negativer (fanger triage-feil)

  -- Problemstillingstype (for segmentering)
  problem_type text  -- 'paragraf' | 'konseptuell' | 'tverrgående'
);
```

**Hvorfor DB fremfor markdown:**
- Pipelinen skriver allerede til Supabase — én ekstra INSERT etter screening
- Aggregering over tid (gjennomsnitt, trend) krever SQL, ikke manuell parsing
- Frontend kan vise metrikk-dashboard direkte fra DB
- Markdown-tabeller (som i `metode-rettslig-analyse.md` seksjon 7) er manuelle og utsatt for drift

#### Pipeline-orchestrator ansvar

Etter at screening er fullført for en analyse, skal orchestratoren (pipeline-run skill eller API-pipeline):

1. **Beregne metrikker** fra `analysis_candidates` for gjeldende `analysis_id`
2. **INSERT i `analysis_metrics`** med alle tellere
3. **Klassifisere `problem_type`** basert på scoping-resultatet (bestemmelsesdrevet → `paragraf`, konseptuelt søk → `konseptuell`, tverrgående → `tverrgående`)
4. **Logge til terminal/SSE** en oppsummering: «Presisjon discovery_rank≥2: 75%, vec-only recall: 3/5, triage false negatives: 0»

Hvis triage har falske negativer (`triage_rejected_was_relevant > 0`), skal orchestratoren **flagge dette eksplisitt** — det betyr at triage-reglene filtrerer for aggressivt.

#### Kalibrering over tid

Med ≥5 analyser i `analysis_metrics` kan vi:
- Beregne gjennomsnittlig presisjon per discovery_rank
- Sammenligne `paragraf` vs `konseptuell` problemstillinger (vec-only er viktigere for konseptuelle)
- Justere sim-terskel for vec-only triage (0.70 er foreløpig)
- Oppdage om triage-regler systematisk filtrerer bort relevante saker

Metrikk-tabellen gjør ADR-006 til et **levende system** som forbedrer seg med bruk, i stedet for en statisk beslutning.

---

## Konsekvenser

### Positive
- **Metodekalibrering mulig:** `discovery_rank` × `category` gir presisjonsmatrise per analyse
- **Automatisk akkumulering:** `analysis_metrics`-tabell samler presisjon/recall per analyse — pipelinen logger automatisk
- **Rikere triage:** Haiku ser similarity-score, spesifikke termer, bestemmelsesreferanser
- **Én semantikk:** A/B/C betyr alltid innholdsrelevans — ingen forveksling
- **Lesbare labels:** «Kjernesak»/«Støttesak»/«Kontekstsak» kommuniserer funksjon, ikke bare grad — viktig fordi C-saker (kontekstsaker) har reell verdi (avgrensningspraksis)
- **Validert mot data:** Konfusjonsmatrise fra 134 kandidater bekrefter at discovery_rank=1 inneholder 76% av kjernesakene — rikere signals er nødvendig, ikke nice-to-have
- **Reproduserbarhet:** Signals dokumenterer nøyaktig hvordan hver sak ble funnet

### Negative
- **Breaking change i frontend:** `category = null` før screening krever endringer i alle komponenter som antar at `category` alltid finnes
- **Signalformat-overgang:** To formater (boolean legacy + nye arrays) må støttes i en overgangsperiode
- **Migrering:** Eksisterende analyser trenger retroaktiv `discovery_rank`-beregning

### Risiko

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
|---|---|---|---|
| Frontend krasjer på `category = null` | Middels | UI-feil | Systematisk gjennomgang av alle komponenter som bruker `category` |
| Signals-invariant brytes av ny kode | Lav | Kalibrering blir upålitelig | Backend-sjekk + ADR-dokumentasjon + code review |
| Migrering korrumperer historiske data | Lav | Tap av analyseresultater | Dry-run migrering + backup først |
| Legacy boolean-format i frontend gir feil | Middels | Feil visning | `_normalize_signals()` håndterer begge formater |
| Vec-only triage for aggressiv | **Høy** | Taper kjernesaker for konseptuelle temaer | Sim-terskel 0.70, `triage_rejected_was_relevant` i metrikker, flagging ved falske negativer |
| Orchestrator glemmer å logge metrikker | Lav | Kalibrering stopper | Pipeline-skill sjekkliste + test |

---

## Avhengigheter

- **ADR-005** (Haiku-triage): Triage-prompten oppdateres til å bruke rikere signals
- **ADR-004** (Agentisk syntese): Syntese-agenten trenger ikke endres (bruker `category` + screening-data)
- **Metodikken** (`metode-rettslig-analyse.md`): Presisjonstabellen (seksjon 7) kan nå akkumulere maskinelt

---

## Referanser

- `docs/design/metode-rettslig-analyse.md` — Steg 2 (mekanisk kategorisering) og Steg 3 (innholdsbasert)
- `docs/plans/kategorisering-drøfting.md` — Drøftingsprosessen som ledet til denne beslutningen
- `backend/traversal.py:378-421` — Nåværende `_classify_category()` + `_build_case_nodes()`
- `backend/analyses.py:146-175` — Nåværende `persist_candidates()`
- `backend/screening.py:30-87` — Screening-schema med `relevance: A/B/C`
- `src/lib/types/graph.ts` — Nåværende `SignalHits` type
- `src/lib/types/analysis.ts` — Nåværende `AnalysisCandidate` type
