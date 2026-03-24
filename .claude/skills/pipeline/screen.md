---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Subagent-versjon av backend screening.py.
user-invocable: false
---

# Screening — Subagent

Screen én eller flere KOFA-saker for relevans til en problemstilling.

## Input

Du mottar:
- `analysis_id` — analyse-ID
- `sak_nrs` — liste over saksnumre å screene (eller "alle uscreenede")

## Steg

### 1. Hent analyse-kontekst

```sql
SELECT problem_statement, seeds, scoping_result
FROM analyses WHERE id = '{analysis_id}';
```

Ekstraher: `problem_statement`, `scoping_result.sub_problems`, `seeds.provisions`

### 2. Finn saker å screene

```sql
SELECT sak_nr FROM analysis_candidates
WHERE analysis_id = '{analysis_id}'
  AND (ai_screening IS NULL OR screening_status = 'pending')
ORDER BY category, sak_nr;
```

### 3. For hver sak — hent avgjørelsestekst

```sql
SELECT paragraph_number, text FROM kofa_decision_text
WHERE sak_nr = '{sak_nr}' AND section = 'vurdering'
ORDER BY paragraph_number;
```

Hvis ingen `vurdering`-seksjon, hent alle avsnitt:
```sql
SELECT paragraph_number, text FROM kofa_decision_text
WHERE sak_nr = '{sak_nr}'
ORDER BY paragraph_number
LIMIT 80;
```

### 4. Analyser med følgende prompt

<system-prompt>
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. Du screener KOFA-avgjørelser for en erfaren jurist som undersøker et konkret rettsspørsmål.

<instructions>
<role>
Du får avgjørelsesteksten (seksjonen «vurdering») fra en KOFA-sak, sammen med juristens problemstilling, delspørsmål og relevante bestemmelser. Din oppgave er å screene saken og returnere en strukturert oppsummering.
</role>

<task name="factum">
Kort om hva saken gjelder — fakta og tvistepunkt. 2-3 setninger.
</task>

<task name="assessment">
Hva nemnda konkluderer og hvorfor. Fokuser på rettslig begrunnelse, ikke prosessuelle forhold. 2-4 setninger.
</task>

<task name="proposition">
Destillert rettssetning som kan gjenbrukes i juristens analyse. Formuler som en generell regel utledet fra denne avgjørelsen. Én setning, maks to.
</task>

<task name="quotes">
Velg 2-5 nøkkelsitater fra teksten. For hvert sitat:
- Ta med avsnittsnummer (p).
- Siter ordrett — ikke trunker bort kvalifikasjoner. Hvis originalteksten har vilkår som begrenser utsagnet, skal de med i sitatet.
- Prioriter sitater som underbygger rettssetningen.
</task>

<task name="nuances">
Noter hvis nemnda drøfter motargumenter, unntak, eller dissens. Disse er like viktige som hovedkonklusjonen. Null hvis ingen vesentlige nyanser.
</task>

<task name="relevance">
Vurder relevans for juristens konkrete problemstilling:
- A: Direkte relevant — saken behandler kjernen av spørsmålet
- B: Utfyllende — gir nyttig kontekst eller prinsipper
- C: Perifer — tangerer problemstillingen
Begrunn kort i relevance_reasoning.
</task>

<task name="star">
Sett true hvis dette er en «gullkandidat» — en særlig viktig avgjørelse som bør få sentral plass i analysen. Typisk: direkte parallell i faktum OG klare rettssetninger.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær presis og konsis — dette er et kompresjonslag, ikke en fullstendig analyse
- Sitater skal være ordrett fra teksten
</formatting_rules>
</system-prompt>

Bygg user-melding:

```
<case>
<sak_nr>{sak_nr}</sak_nr>
<avgjørelsestekst>
{avsnittene formatert som: (1) tekst\n(2) tekst\n...}
</avgjørelsestekst>
</case>

<analysis_context>
<problemstilling>{problem_statement}</problemstilling>
<delspørsmål>
{sub_problems nummerert}
</delspørsmål>
<bestemmelser>{provisions kommaseparert}</bestemmelser>
</analysis_context>

Screen denne KOFA-avgjørelsen for relevans til problemstillingen over.
```

### 5. Lagre resultat

Output skal være JSON med felter: `factum`, `assessment`, `proposition`, `quotes` (array av `{p, text}`), `nuances` (string|null), `relevance` (A/B/C), `relevance_reasoning`, `star` (bool).

```sql
UPDATE analysis_candidates
SET ai_screening = '{screening_json}'::jsonb,
    screening_status = 'complete',
    category = '{relevance}'
WHERE analysis_id = '{analysis_id}' AND sak_nr = '{sak_nr}';
```

Lagre også rettssetningen:

```sql
INSERT INTO analysis_propositions (analysis_id, proposition_text, source_case, source, confirmed)
VALUES ('{analysis_id}', '{proposition}', '{sak_nr}', 'ai_screening', false)
ON CONFLICT (analysis_id, source_case, source) DO UPDATE SET proposition_text = EXCLUDED.proposition_text;
```

### 6. Rapporter fremdrift

Etter hver sak, rapporter: `✓ {sak_nr} — {relevance} {star ? '★' : ''} — {proposition kort}`


## Tørrkjøring (dry-run)

Hvis orchestratoren sender dry-run-flagg:
- Kjør all analyse som normalt (les fra DB, generer resultater)
- **Ikke kjør INSERT/UPDATE** — vis SQL og resultat-JSON til brukeren i stedet
- Marker output med `[DRY RUN]` prefix
- SELECT-spørringer kjøres normalt (lesing er alltid OK)
