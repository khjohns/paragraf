---
name: pipeline-analyst
description: Analyserer pipeline-presisjon, triage-effektivitet, signalkvalitet, prompt-evolusjon, kostnader og brukerkorrektiver. Per-analyse kvalitetsrapport eller cross-analyse trendrapport.
argument-hint: <analyse-id | "siste"> [--sammenlign] [--oppdater-metrikker] [--prompt-evolution] [--cost] [--corrections] [--regression]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Bash, Agent
---

# Pipeline Analyst

To moduser: **per-analyse** (kvalitetsrapport for én kjøring) og **cross-analyse** (pipeline-trender over tid).

**Per-analyse:** `/pipeline-analyst <id>` — presisjon, triage, signaler
**Cross-analyse:** `/pipeline-analyst --prompt-evolution` — trender, kostnader, regresjoner

## Per-analyse modus

### 1. Hent data

```sql
SELECT id, problem, status, created_at FROM paragraf_analyses WHERE id = '<ID>';

SELECT sak_nr, category, signals, screening_status,
       ai_screening->>'relevance' as screening_relevance,
       ai_screening->>'star' as star
FROM paragraf_analysis_candidates
WHERE analysis_id = '<ID>'
ORDER BY (signals->>'discovery_rank')::int DESC NULLS LAST, sak_nr;
```

### 2. Konfusjonsmatrise

Grupper etter `discovery_rank` x `screening_relevance`:

```
             | Kjerne (A) | Støtte (B) | Kontekst (C) | Uscreenet |
rank 3       |            |            |               |           |
rank 2       |            |            |               |           |
rank 1       |            |            |               |           |
```

Beregn presisjon per rank (A+B / total) og recall per rank (A i rank / alle A).

### 3. Signal-kanal-diagnose

Grupper screenede kandidater etter signalkombinasjon (ref+fts+vec, ref+fts, ref-only, vec-only, osv.). Beregn presisjon per kombinasjon.

**Flagg:** vec-only > 30% av A → konseptuelt tema. ref+fts presisjon < 80% → brede søkeord.

### 4. Triage-evaluering

```sql
SELECT sak_nr, signals, screening_status
FROM paragraf_analysis_candidates
WHERE analysis_id = '<ID>' AND screening_status = 'triage_rejected';
```

Rapporter falske negativer hvis triagede saker senere ble screenet som A/B.

### 5. Problemstillingstype

- > 50% A har ref → `paragraf`
- > 50% A er vec-only → `konseptuell`
- Ellers → `tverrgående`

### 6. Run-info (hvis tilgjengelig)

```sql
SELECT r.id, r.status, r.variation, r.created_at,
       count(s.id) as steps, sum(s.cost_usd) as cost, sum(s.duration_ms) as duration_ms
FROM paragraf_pipeline_runs r
LEFT JOIN paragraf_pipeline_steps s ON s.run_id = r.id
WHERE r.analysis_id = '<ID>'
GROUP BY r.id ORDER BY r.created_at;
```

Vis kostnad og varighet per run. Hvis flere runs: sammenlign kort.

### 7. Lagre metrikker (--oppdater-metrikker)

```sql
INSERT INTO paragraf_analysis_metrics (
  analysis_id, total_candidates, screened_candidates,
  rank3_total, rank3_screening_a, rank3_screening_b, rank3_screening_c,
  rank2_total, rank2_screening_a, rank2_screening_b, rank2_screening_c,
  rank1_total, rank1_screening_a, rank1_screening_b, rank1_screening_c,
  vec_only_total, vec_only_screening_a,
  ref_fts_total, ref_fts_screening_a,
  triage_rejected, triage_rejected_was_relevant,
  problem_type
) VALUES (...);
```

### 8. Rapport (per-analyse)

```
Pipeline-analyse: {problem_kort}
Kandidater: {total} totalt, {screened} screenet
Kjernesaker: {A} ({pct}%)  Støttesaker: {B}  Kontekstsaker: {C}

-- Konfusjonsmatrise --
             Kjerne  Støtte  Kontekst
rank 3          {n}     {n}       {n}   presisjon: {pct}%
rank 2          {n}     {n}       {n}   presisjon: {pct}%
rank 1          {n}     {n}       {n}   presisjon: {pct}%

-- Signal-kanaler --
{tabell}

-- Vurdering --
Type: {paragraf|konseptuell|tverrgående}
{2-4 observasjoner}

-- Anbefalinger --
{konkrete forslag}
```

---

## Cross-analyse modus

Flagg som aktiverer cross-analyse. Kan kombineres.

### --prompt-evolution

Aggregér presisjon per prompt-versjon over alle analyser.

```sql
-- Triage: pass_rate per prompt-versjon
SELECT p.version_tag, p.step_type,
       count(DISTINCT r.analysis_id) as analyses,
       avg((s.step_output->>'pass_rate')::float) as avg_pass_rate
FROM paragraf_pipeline_steps s
JOIN paragraf_pipeline_runs r ON s.run_id = r.id AND r.status = 'completed'
JOIN paragraf_prompt_registry p ON s.prompt_hash = p.hash
WHERE s.step_type = 'triage'
GROUP BY p.version_tag, p.step_type
ORDER BY p.version_tag;

-- Screening: kategori-fordeling per prompt-versjon
SELECT p.version_tag,
       s.step_output->'categories'->>'A' as avg_a,
       s.step_output->'categories'->>'B' as avg_b,
       s.step_output->'categories'->>'C' as avg_c
FROM paragraf_pipeline_steps s
JOIN paragraf_pipeline_runs r ON s.run_id = r.id AND r.status = 'completed'
JOIN paragraf_prompt_registry p ON s.prompt_hash = p.hash
WHERE s.step_type = 'screen'
ORDER BY r.created_at;
```

**Rapport:**
```
-- Prompt-evolusjon --
Triage:
  ensemble-v1:  94% recall, 63% pass_rate  (over 5 analyser)
  single-v2:    71% recall, 55% pass_rate  (over 3 analyser)
  Δ: +23% recall, +8% pass_rate → ensemble er bedre

Screening:
  sonnet-4-6:   {A}% kjerne, {B}% støtte  (over N analyser)
```

### --cost

Kostnadsattribusjon per pipeline-steg.

```sql
SELECT s.step_type,
       count(*) as executions,
       round(avg(s.cost_usd)::numeric, 4) as avg_cost,
       round(sum(s.cost_usd)::numeric, 2) as total_cost,
       round(avg(s.duration_ms)::numeric, 0) as avg_duration_ms
FROM paragraf_pipeline_steps s
JOIN paragraf_pipeline_runs r ON s.run_id = r.id AND r.status = 'completed'
GROUP BY s.step_type
ORDER BY total_cost DESC;

-- Kostnad per run over tid
SELECT r.id, r.created_at,
       sum(s.cost_usd) as run_cost,
       sum(s.duration_ms) as run_duration_ms,
       count(s.id) as steps
FROM paragraf_pipeline_runs r
JOIN paragraf_pipeline_steps s ON s.run_id = r.id
WHERE r.status = 'completed'
GROUP BY r.id ORDER BY r.created_at;
```

**Rapport:**
```
-- Kostnadsrapport --
Steg          Kjøringer  Snitt     Total    Snitt tid
screen              12   $3.50    $42.00      340s
synthesize           8   $1.20     $9.60      45s
triage              12   $0.30     $3.60      12s
qa                   8   $0.80     $6.40      30s
scope                8   $0.10     $0.80       8s

Total: $62.40 over 8 fullstendige runs
Snitt per run: $7.80 | Snitt varighet: 435s
```

### --corrections

Analyse av brukerkorrektiver — hvor feiler AI systematisk?

```sql
-- Oversikt
SELECT correction_type, count(*) as total,
       count(reason) as with_reason
FROM paragraf_user_corrections
GROUP BY correction_type;

-- Kategori-overstyringer: før → etter
SELECT before_value->>'category' as fra,
       after_value->>'category' as til,
       count(*) as antall
FROM paragraf_user_corrections
WHERE correction_type = 'category_override'
GROUP BY fra, til ORDER BY antall DESC;

-- Korrektiver med begrunnelse (kvalitativ analyse)
SELECT sak_nr, correction_type,
       before_value, after_value, reason, created_at
FROM paragraf_user_corrections
WHERE reason IS NOT NULL
ORDER BY created_at DESC LIMIT 20;

-- Korrelasjon med signals
SELECT c.signals->>'discovery_rank' as rank,
       uc.before_value->>'category' as fra,
       uc.after_value->>'category' as til,
       count(*) as antall
FROM paragraf_user_corrections uc
JOIN paragraf_analysis_candidates c ON c.analysis_id = uc.analysis_id AND c.sak_nr = uc.sak_nr
WHERE uc.correction_type = 'category_override'
GROUP BY rank, fra, til ORDER BY antall DESC;
```

**Rapport:**
```
-- Brukerkorrektiver --
Totalt: {N} korrektiver, {M} med begrunnelse ({pct}%)

Kategori-overstyringer:
  B → A:  {n} ({pct}%)  ← AI underkjører
  C → B:  {n} ({pct}%)
  A → B:  {n} ({pct}%)  ← AI overkjører

Signalmønster ved overstyring:
  rank 1 + ref-only:  {n} overstyringer → AI forstår ikke ref-kontekst
  rank 2 + vec-only:  {n} overstyringer → vec-score misleder

Begrunnelser (siste 5):
  "{reason}" — {sak_nr}, {fra}→{til}
  ...
```

### --regression

Sammenlign siste N runs med historisk gjennomsnitt. Flagg signifikante fall.

```sql
-- Siste 5 runs vs alle tidligere
WITH recent AS (
  SELECT s.step_type,
         avg((s.step_output->>'pass_rate')::float) as recent_pass_rate,
         avg(s.cost_usd) as recent_cost
  FROM paragraf_pipeline_steps s
  JOIN paragraf_pipeline_runs r ON s.run_id = r.id AND r.status = 'completed'
  WHERE r.created_at > now() - interval '14 days'
  GROUP BY s.step_type
), historical AS (
  SELECT s.step_type,
         avg((s.step_output->>'pass_rate')::float) as hist_pass_rate,
         avg(s.cost_usd) as hist_cost
  FROM paragraf_pipeline_steps s
  JOIN paragraf_pipeline_runs r ON s.run_id = r.id AND r.status = 'completed'
  WHERE r.created_at <= now() - interval '14 days'
  GROUP BY s.step_type
)
SELECT r.step_type,
       r.recent_pass_rate, h.hist_pass_rate,
       r.recent_cost, h.hist_cost
FROM recent r LEFT JOIN historical h ON r.step_type = h.step_type;

-- Presisjon fra analysis_metrics over tid
SELECT analysis_id, computed_at,
       rank1_screening_a::float / nullif(rank1_total, 0) as rank1_precision,
       triage_rejected_was_relevant
FROM paragraf_analysis_metrics
ORDER BY computed_at DESC LIMIT 10;
```

**Rapport:**
```
-- Regresjonsrapport --
                 Siste 14d    Historisk    Δ        Status
Triage pass_rate    63%          58%      +5%       OK
Triage recall       94%          71%      +23%      FORBEDRET
Screening kostnad   $3.50        $3.20    +9%       OK
Rank-1 presisjon    42%          45%      -3%       OK

Triage false neg:   0 (siste 3 runs) vs 2 (historisk snitt)

FLAGG: Ingen regresjoner detektert.
```

Eller ved regresjon:
```
FLAGG: Rank-1 presisjon falt fra 45% til 28% etter prompt-endring (ensemble-v2).
       Sjekk: 3 siste runs med ensemble-v2 har lavere presisjon enn alle runs med ensemble-v1.
       Anbefaling: Rull tilbake til ensemble-v1 eller juster triage-logikk.
```

---

## Viktige prinsipper

1. **Ikke overfitt til én analyse.** Anbefalinger baseres på mønster over flere analyser.
2. **Fakta først.** Presisjon og recall er objektive — tolkninger markeres som vurderinger.
3. **Triage false negatives er viktigst.** En filtrert kjernesak er verre enn 10 falske positiver.
4. **Vec-only er ikke støy.** ADR-006 viste at vec-only er primærkanal for konseptuelle temaer.
5. **Cross-analyse krever data.** Hvis `paragraf_pipeline_runs` er tom, rapporter det og foreslå å kjøre pipeline med run-tracking.
6. **Ved ikke-opplagte funn:** Foreslå `/thinking-partner` for å vurdere tiltak. Eksempel: regresjon etter prompt-endring — er det prompten, dataen, eller problemstillingstypen? Analyst gir fakta, thinking-partner hjelper med tolkning og beslutning.

## Referanser

- `docs/adr/006-kategorisering-og-signalmodell.md` — Signalmodell, konfusjonsmatrise, metrikk-tabell
- `docs/adr/007-eksperiment-tracking-og-reproduserbarhet.md` — Run-tracking, prompt-registry, jsonb-schemas
- `docs/design/metode-rettslig-analyse.md` seksjon 7 — Historisk presisjonstabell
