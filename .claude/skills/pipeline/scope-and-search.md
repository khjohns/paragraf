---
name: pipeline:scope-and-search
description: Scoping av problemstilling + søk etter kandidater. For ny analyse fra scratch.
user-invocable: false
---

# Scoping & Søk — Subagent

Tar en problemstilling, presiserer den, identifiserer bestemmelser og søkestrategi, og kjører søk.

## Input

Du mottar:
- `analysis_id` — eksisterende analyse-ID (eller "ny" for å opprette)
- `problem_statement` — juristens problemstilling

## Steg

### 1. Opprett analyse (hvis ny)

```sql
INSERT INTO analyses (id, title, problem_statement, status, seeds, iteration)
VALUES (gen_random_uuid(), 'Ny analyse', '{problem_statement}', 'scoping', '{"provisions":[],"ftsTerms":[],"vectorQuery":"","cases":[]}', 1)
RETURNING id;
```

Eller oppdater eksisterende:
```sql
UPDATE analyses SET problem_statement = '{problem_statement}', status = 'scoping'
WHERE id = '{analysis_id}';
```

### 2. Scoping — analyser problemstillingen

<system-prompt>
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. Du bistår erfarne jurister med å presisere uformelle problemstillinger til strukturerte forskningsplaner for systematisk søk i KOFA-praksis.

KOFA (Klagenemnda for offentlige anskaffelser) behandler klager på brudd på anskaffelsesregelverket. Databasen inneholder KOFAs avgjørelser med referanser til bestemmelser i anskaffelsesforskriften (FOA), anskaffelsesloven og EU-direktiv 2014/24/EU.

Juristen sender deg en uformell problemstilling. Du skal analysere den og returnere en strukturert forskningsplan.

<instructions>
<task name="refined_problem">
Omformuler problemstillingen til et presist juridisk spørsmål som kan undersøkes systematisk i KOFA-praksis. Behold juristens intensjon, men gjør spørsmålet konkret og avgrenset.
</task>

<task name="sub_problems">
Bryt ned i 2–5 konkrete delspørsmål som til sammen dekker problemstillingen. Hvert delspørsmål skal kunne besvares selvstendig gjennom søk i praksis.
</task>

<task name="context">
Identifiser følgende der det fremgår av problemstillingen:
- procedure: anskaffelsesprosedyre (åpen, begrenset, konkurranse med forhandling, osv.)
- service_area: tjenesteområde/kategori
- market: markedsforhold
- threshold: terskelverdi (nasjonal/EØS)
Sett til null der informasjonen ikke fremgår.
</task>

<task name="provisions">
Identifiser relevante bestemmelser i anskaffelsesforskriften (FOA) og evt. EU-direktiv 2014/24/EU.

For hver bestemmelse, oppgi:
- ref: bestemmelsesreferanse (format: "foa:§-nummer", f.eks. "foa:16-12")
- label: kort beskrivende tittel
- primary: true hvis direkte relevant, false hvis kontekst/ramme
- reason: kort begrunnelse for relevans (1–2 setninger)

Vær konservativ — foreslå kun bestemmelser du er sikker på er relevante.
</task>

<task name="search_strategy">
Foreslå søkestrategi for databasen:
- ref_table: bestemmelsesreferanser å slå opp (samme format som provisions.ref)
- fts: 2–4 korte, presise søketermer for fulltekstsøk
- vector: 1–2 konseptuelle søkesetninger for semantisk søk
- prep_work: relevante forarbeider å sjekke
</task>

<task name="reasoning">
Forklar kort resonnementet bak forslagene.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Bestemmelsesformat FOA: "foa:§-nummer" (f.eks. "foa:16-12", "foa:16-5")
- EU-direktiver: "dir:art-nummer" (f.eks. "dir:65")
</formatting_rules>
</system-prompt>

User-melding: `{problem_statement}`

### 3. Verifiser bestemmelser mot DB

For hver foreslått bestemmelse, sjekk at den finnes:

```sql
SELECT dok_id, section_id, title
FROM lovdata_sections
WHERE section_id = '{section_ref}'
LIMIT 1;
```

Marker `verified: true/false` på hver bestemmelse.

### 4. Lagre scoping-resultat

```sql
UPDATE analyses
SET problem_statement = '{refined_problem}',
    scoping_result = '{scoping_json}'::jsonb,
    seeds = jsonb_build_object(
      'provisions', '{verified_provisions}'::jsonb,
      'ftsTerms', '{fts_terms}'::jsonb,
      'vectorQuery', '{vector_query}',
      'cases', '[]'::jsonb
    ),
    status = 'searching'
WHERE id = '{analysis_id}';
```

### 5. Kjør søk — tre signaltyper

**a) Referansetabell-søk** — finn saker som refererer til bestemmelsene:

```sql
SELECT DISTINCT sak_nr FROM kofa_law_references
WHERE (law_name ILIKE '%anskaffelsesforskriften%' OR law_name ILIKE '%forskrift/2016-08-12-974%')
  AND law_section = '{section_id}'
ORDER BY sak_nr;
```

Gjenta for hver bestemmelse.

**b) Fulltekstsøk:**

```sql
SELECT sak_nr, ts_rank(fts, query) as rank
FROM kofa_decision_text, plainto_tsquery('norwegian', '{fts_term}') query
WHERE fts @@ query
GROUP BY sak_nr
ORDER BY max(ts_rank(fts, query)) DESC
LIMIT 30;
```

Eller bruk RPC: `SELECT * FROM search_kofa_decision_text('{fts_term}', 30);`

**c) Vektorsøk:**

```sql
SELECT * FROM search_kofa_decision_text('{vector_query}', 30);
```

### 6. Slå sammen og lagre kandidater

Slå sammen alle sak_nrs fra de tre søketypene. For hver unik sak, hent metadata:

```sql
SELECT sak_nr, avgjoerelse, saken_gjelder, avsluttet, regelverk, summary
FROM kofa_cases
WHERE sak_nr IN ({alle_sak_nrs});
```

Lagre som kandidater:

```sql
INSERT INTO analysis_candidates (analysis_id, sak_nr, category, signals, screening_status)
VALUES ('{analysis_id}', '{sak_nr}', 'B', '{signals_json}'::jsonb, 'pending')
ON CONFLICT (analysis_id, sak_nr) DO NOTHING;
```

Sett `category = 'B'` som default (screening vil justere).

### 7. Oppdater status

```sql
UPDATE analyses SET status = 'candidates_ready' WHERE id = '{analysis_id}';
```

### 8. Rapporter

```
Scoping fullført:
  Presisert problemstilling: {refined_problem}
  {N} delspørsmål
  {M} bestemmelser ({verified} verifisert)

Søk fullført:
  {ref_count} fra referansetabell
  {fts_count} fra fulltekstsøk
  {vec_count} fra vektorsøk
  {total_unique} unike kandidater lagret
```
