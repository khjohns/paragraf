---
name: pipeline:screen
description: Full Sonnet-screening av KOFA-saker for relevans. Kjøres etter triage.
user-invocable: false
---

# Screening — Subagent (Sonnet)

## Input
`analysis_id`, liste over `sak_nrs` (eller "alle uscreenede")

## Datahenting (bruk CLI, ikke MCP)

```bash
# Kontekst + avgjørelsestekst for én sak (ferdigformatert XML):
bash scripts/pipeline-cli.sh screening <analysis_id> <sak_nr>

# Bestemmelseskapsel (provision screening):
bash scripts/pipeline-cli.sh provision-capsule <analysis_id>

# Alle kandidater med status:
bash scripts/pipeline-cli.sh candidates <analysis_id>

# Spesifikke avsnitt:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

## Steg

1. Hent bestemmelseskapsel (kun én gang, gjenbruk for alle saker):
   ```bash
   bash scripts/pipeline-cli.sh provision-capsule <id>
   ```
   Bestemmelseskapselen gir screening-agenten kunnskap om hva
   bestemmelsene faktisk sier — ikke bare hva KOFA-avgjørelser sier om dem.
   Inkluder kapselen som kontekst i subagent-prompten.

2. For hver sak: `bash scripts/pipeline-cli.sh screening <id> <sak_nr>` — gir kontekst + tekst
3. Analyser med prompten fra `backend/screening.py` (SCREENING_SYSTEM_PROMPT, linje 90-142).
   CLI-output inkluderer `<regelverksnotat>` for pre-2017 saker. Når denne finnes:
   - Bruk korrekte paragrafnumre fra den forskriften saken ble avgjort under
   - Angi i `proposition` om rettssetningen er fra gammel eller ny forskrift
   - Vurder i `nuances` om prinsippet er videreført i gjeldende FOA
4. Lagre via CLI:
   ```bash
   echo '{"factum":"...","proposition":"...","relevance":"A","star":true}' \
     | bash scripts/pipeline-cli.sh save-screening <id> <sak_nr>
   ```
5. Rapporter: `✓ {sak_nr} — {relevance} {★ hvis star} — {proposition kort}`

Dispatch Sonnet-subagenter i batches à 7-12 saker (parallelt).

## Rekkefølge

Screen prioriterte saker (fra anførsler-prioritering) først, deretter lavpri.
Rank ≥ 2 saker screenes alltid — de hoppet over triage.

## Output-format
JSON: `{factum, assessment, proposition, quotes: [{p, text}], nuances, relevance: A/B/C, relevance_reasoning, star: bool}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
