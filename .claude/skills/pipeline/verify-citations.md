---
name: pipeline:verify-citations
description: Verifiser sitater fra screening mot kildetekst. Subagent-versjon av backend qa.py citation QA.
user-invocable: false
---

# Sitatverifisering — Subagent

Verifiser at sitater fra screening er korrekt gjengitt ved å slå opp originalavsnittene.

## Input

Du mottar: `analysis_id`

## Steg

### 1. Hent alle screenede saker med sitater

```sql
SELECT sak_nr, ai_screening
FROM analysis_candidates
WHERE analysis_id = '{analysis_id}'
  AND ai_screening IS NOT NULL
  AND ai_screening->'quotes' IS NOT NULL
ORDER BY category, sak_nr;
```

### 2. For hver sak — hent originalavsnittene

Ekstraher avsnittsnumre fra `ai_screening.quotes[].p`, deretter:

```sql
SELECT paragraph_number, text FROM kofa_decision_text
WHERE sak_nr = '{sak_nr}'
  AND paragraph_number IN ({avsnittsnumre})
ORDER BY paragraph_number;
```

### 3. Verifiser med følgende prompt

For hver sak, bygg en verifiseringsmelding med originalavsnittene og sitatene.

<system-prompt>
Du er en juridisk kvalitetssikrer. Din oppgave er å verifisere sitater fra KOFA-avgjørelser.

<instructions>
Du mottar sitater fra en rettslig analyse sammen med originalteksten de er hentet fra. For hvert sitat, vurder:
- **verified**: Sitatet er korrekt gjengitt
- **truncated**: Sitatet er trunkert på en måte som fjerner kvalifikasjoner
- **inaccurate**: Sitatet avviker vesentlig fra originalteksten
- **not_found**: Sitatet finnes ikke i den oppgitte teksten

Trunkering som fjerner «men»/«under forutsetning av»/«med mindre» er særlig problematisk og skal flagges.
</instructions>
</system-prompt>

User-melding per sak (eller batch med 3-5 saker):

```
<kildetekst sak_nr="{sak_nr}">
({paragraph_number}) {text}
...
</kildetekst>

<sitater_å_verifisere>
- {sak_nr} §{p}: «{quote_text}»
...
</sitater_å_verifisere>

Verifiser hvert sitat mot kildeteksten. For hvert sitat, angi status (verified/truncated/inaccurate/not_found) og beskriv eventuelle problemer.
```

### 4. Lagre resultater

For hvert verifisert sitat, oppdater screening-resultatet med verifiseringsstatus.
Bygg `quote_verification`-array og merge inn i `ai_screening`:

```sql
UPDATE analysis_candidates
SET ai_screening = ai_screening || jsonb_build_object(
  'quote_verification',
  '{verification_array}'::jsonb
)
WHERE analysis_id = '{analysis_id}' AND sak_nr = '{sak_nr}';
```

Verifiserings-array format:
```json
[
  {"sak_nr": "2024/408", "paragraph": 51, "status": "verified", "issue": null},
  {"sak_nr": "2024/408", "paragraph": 54, "status": "truncated", "issue": "Sitatet utelater kvalifikasjonen «under forutsetning av at...»"}
]
```

### 5. Oppdater oppsummering på analysen

Tell opp resultater og lagre oppsummering:

```sql
UPDATE analyses
SET citation_summary = '{summary_json}'::jsonb
WHERE id = '{analysis_id}';
```

Summary format: `{"verified": N, "truncated": N, "inaccurate": N, "not_found": N}`

### 6. Rapporter

Oppsummer: `✓ {verified} verifisert · ⚠ {truncated} trunkert · ✗ {inaccurate + not_found} feil`

List opp alle ikke-verifiserte sitater med beskrivelse.
