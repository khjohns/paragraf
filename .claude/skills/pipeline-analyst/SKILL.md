---
name: pipeline-analyst
description: Analyser pipeline-presisjon, triage-effektivitet og signalkvalitet for en analyse. Beregner metrikker, sammenligner med historikk, og foreslår justeringer.
argument-hint: <analyse-id | "siste"> [--sammenlign] [--oppdater-metrikker]
allowed-tools: mcp__claude_ai_Supabase__execute_sql, Read, Bash, Agent
---

# Pipeline Analyst

Evaluerer kvaliteten på en analyse-pipeline-kjøring. Beregner presisjon/recall per signalmønster, evaluerer triage-effektivitet, og foreslår metodeforbedringer.

**Argumenter:** $ARGUMENTS — analyse-id (eller "siste"), `--sammenlign` for historisk sammenligning, `--oppdater-metrikker` for å skrive til `analysis_metrics`.

## Når brukes denne?

- Etter en fullført pipeline-kjøring (`/pipeline-analyst <id>`)
- For å evaluere historiske analyser retroaktivt
- For å kalibrere triage-terskler
- For å oppdatere den akkumulerende presisjonstabellen

## Forutsetninger

Analysen må ha gjennomført screening (minst noen kandidater med `ai_screening`). Kan kjøres på delvis screenede analyser — rapporterer da bare for screenede kandidater.

## Steg

### 1. Hent data

```sql
-- Analysekontekst
SELECT id, problem, status, created_at FROM analyses WHERE id = '<ID>';

-- Alle kandidater med signals og screening
SELECT
  sak_nr,
  category,
  signals,
  screening_status,
  ai_screening->>'relevance' as screening_relevance,
  ai_screening->>'star' as star,
  ai_screening->>'relevance_reasoning' as reasoning
FROM analysis_candidates
WHERE analysis_id = '<ID>'
ORDER BY (signals->>'discovery_rank')::int DESC NULLS LAST, sak_nr;
```

### 2. Beregn konfusjonsmatrise

Grupper kandidater etter `discovery_rank` (fra signals) × `screening_relevance`:

```
             | Kjerne (A) | Støtte (B) | Kontekst (C) | none/null | Uscreenet |
rank 3       |     ?      |     ?      |      ?        |     ?     |     ?     |
rank 2       |     ?      |     ?      |      ?        |     ?     |     ?     |
rank 1       |     ?      |     ?      |      ?        |     ?     |     ?     |
```

Beregn:
- **Presisjon per rank:** Andel screening A+B av total per rank
- **Recall per rank:** Andel av alle screening-A funnet i denne ranken
- **Totalt:** Presisjon og recall for hele analysen

### 3. Signal-kanal-diagnose

Grupper screenede kandidater etter signalkombinasjon:

| Kombinsjon | Total | Kjerne | Støtte | Kontekst | Presisjon |
|---|---|---|---|---|---|
| ref+fts+vec | ? | ? | ? | ? | ?% |
| ref+fts | ? | ? | ? | ? | ?% |
| ref+vec | ? | ? | ? | ? | ?% |
| fts+vec | ? | ? | ? | ? | ?% |
| ref-only | ? | ? | ? | ? | ?% |
| fts-only | ? | ? | ? | ? | ?% |
| vec-only | ? | ? | ? | ? | ?% |

**Flagg:**
- Hvis vec-only har > 30% av kjernesakene → konseptuelt tema, triage må være forsiktig
- Hvis ref+fts presisjon < 80% → søketermene er for brede
- Hvis en signalkanal har 0 kjernesaker → kanalen bidrar ikke for dette temaet

### 4. Triage-evaluering

```sql
-- Finn triagede saker og sjekk om noen ble feilaktig filtrert
SELECT sak_nr, signals, screening_status,
       ai_screening->>'relevance' as relevance
FROM analysis_candidates
WHERE analysis_id = '<ID>'
  AND screening_status = 'triage_rejected';
```

Hvis noen triagede saker likevel ble screenet (f.eks. manuelt) og viste seg relevante:
- **Falsk negativ:** Triage filtrerte en sak som var A eller B
- Rapporter: «{N} saker triaged bort, {M} av disse var faktisk relevante — triage-reglene er for aggressive»

Hvis ingen triagede saker ble re-screenet, kan vi ikke beregne falske negativer direkte. Rapporter dette som en begrensning.

### 5. Problemstillingstype-klassifisering

Basert på signaldistribusjonen, klassifiser:

| Type | Kjennetegn | Implikasjon |
|---|---|---|
| `paragraf` | Flertallet ref-treff, FTS supplerer | Standard triage-regler fungerer |
| `konseptuell` | Vec-only dominerer, få ref | Triage må være forsiktig med vec-only |
| `tverrgående` | Jevn fordeling, mange signalkombinasjoner | Bred fangst nødvendig |

Heuristikk:
- > 50% av kjernesaker har ref → `paragraf`
- > 50% av kjernesaker er vec-only → `konseptuell`
- Ellers → `tverrgående`

### 6. Historisk sammenligning (--sammenlign)

Kun hvis flagget er satt:

```sql
SELECT * FROM analysis_metrics ORDER BY computed_at DESC LIMIT 10;
```

Sammenlign denne analysens metrikker med historisk snitt:
- Er presisjonen per rank bedre eller verre enn gjennomsnittet?
- Er vec-only recall høyere enn vanlig? (Indikerer konseptuelt tema)
- Har triage blitt bedre eller verre over tid?

### 7. Lagre metrikker (--oppdater-metrikker)

Kun hvis flagget er satt:

```sql
INSERT INTO analysis_metrics (
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

### 8. Rapporter

Skriv en strukturert rapport til terminal:

```
═══ Pipeline-analyse: {problem_kort} ═══

Kandidater:  {total} totalt, {screened} screenet
Kjernesaker: {A} ({A_pct}%)  Støttesaker: {B}  Kontekstsaker: {C}

── Konfusjonsmatrise ──
             Kjerne  Støtte  Kontekst  none
rank 3          {n}     {n}       {n}   {n}    presisjon: {pct}%
rank 2          {n}     {n}       {n}   {n}    presisjon: {pct}%
rank 1          {n}     {n}       {n}   {n}    presisjon: {pct}%

── Signal-kanaler ──
{tabell}

── Vurdering ──
Type: {paragraf|konseptuell|tverrgående}
{observasjoner — 2-4 bullet points}

── Anbefalinger ──
{konkrete forslag — triage-justeringer, terskel-endringer, søkestrategi}
```

## Viktige prinsipper

1. **Ikke overfitt til én analyse.** Anbefalinger bør baseres på mønster, ikke enkeltstående tall.
2. **Rapporten forholde seg til fakta.** Presisjon og recall er objektive — tolkninger bør markeres som vurderinger.
3. **Triage false negatives er det viktigste signalet.** En filtrert kjernesak er verre enn 10 falske positiver som screenes unødig.
4. **Vec-only er ikke støy.** ADR-006 validering viste at vec-only er primærkanal for konseptuelle temaer.

## Referanser

- `docs/adr/006-kategorisering-og-signalmodell.md` — Konfusjonsmatrise, triage-regler, metrikk-tabell
- `docs/design/metode-rettslig-analyse.md` seksjon 7 — Historisk presisjonstabell
- `analysis_metrics` tabell — Akkumulerende metrikker
