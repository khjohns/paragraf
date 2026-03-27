---
name: pipeline:cross-propositions
description: Kryssanalyse av rettssetninger på tvers av saker. Subagent-versjon av backend cross_propositions.py.
user-invocable: false
---

# Cross-Propositions — Subagent (Opus)

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Alle screening-resultater (ferdigformatert XML med rettssetninger, sitater):
bash scripts/pipeline-cli.sh screening-results <analysis_id>

# Analyse-kontekst:
bash scripts/pipeline-cli.sh context <analysis_id>

# Bestemmelseskapsel (provision-screening):
bash scripts/pipeline-cli.sh provision-capsule <analysis_id>

# Kildetekst ved behov:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> <p1,p2,...>
```

## Progressiv tilnærming (A → B → C)

Registeret bygges i tre runder med QA-sjekkpunkt etter hver:

1. **A-saker (kjerne):** Bygg temastruktur og kjernerettssetninger
2. **B-saker (støtte):** Legg til instances, nye proposisjoner der nødvendig
3. **C-saker (avgrensning):** Legg til grensemarkører (merk `category: "C"`)

Skriv til lokal fil (`/tmp/cross_propositions_<id>.json`) — IKKE direkte til DB.
Bruk Edit-verktøy for revisjoner (synlig diff). Lagre til DB kun etter final QA.

**VIKTIG for B/C-runder:** Bruk en tenkende agent (Opus) som leser HVER
proposisjon og vurderer plassering — IKKE batch-scripts med keyword-matching.
Kvalitetsforskjellen er markant.

## Retningslinjer

### Splitting
Splitt heller for mye enn for lite. Én proposisjon = én rettsregel.
Hvis instances handler om to forskjellige ting, splitt proposisjonen.

### Screening-kvalitet
Sonnet-screening kan inneholde feil. A/B/C-kategorisering og ★ er veiledende,
ikke autoritative. Vurder HVER proposisjon på egne meritter — en B-sak kan
inneholde en kjernerettssetning som Sonnet undervurderte. Flagg B→A
oppgraderingskandidater for bruker.

### Forskriftsendring
Materialet spenner typisk over gammel og ny forskrift (2017-endring).
Utled paragrafmapping fra dataene — proposisjonene angir selv om prinsipp er
«videreført». IKKE anta mapping.

### Sitater
37% av screening-sitater er trunkert (korrekt innhold, avkortet).
Stol på proposisjoner og factum/assessment. Hent avsnitt via tool ved behov.

### Ratio vs obiter
Vurder om proposisjoner springer ut av ratio decidendi eller obiter dictum.
Merk sistnevnte.

## Prompt

Bruk system-prompt fra `backend/cross_propositions.py` (CROSS_PROPOSITIONS_SYSTEM_PROMPT).

Legg til kontekstnotatene over som `<kontekst>`-blokk i user-meldingen.

## Output-format

```json
{
  "themes": ["Tema 1", "Tema 2"],
  "propositions": [{
    "id": "P01",
    "theme": "Tema 1",
    "proposition": "Rettssetning...",
    "instances": [{
      "caseId": "2024/528",
      "paragraph": "44",
      "date": "2024",
      "evolution": "established|confirmed|qualified|consolidating",
      "quote": "Ordrett sitat...",
      "suggested": false,
      "category": "A",
      "regulation": "FOA"
    }],
    "tension": {
      "withId": "P05",
      "note": "Beskrivelse av spenningen"
    }
  }],
  "boundary_notes": [{
    "caseId": "2021/124",
    "note": "Grensetilfelle: § 25-1(4) retting vs § 23-5 avklaring"
  }]
}
```

Instance-felter:
- `category`: A/B/C — opprinnelig screening-kategori (for transparens)
- `regulation`: FOA/forsyningsforskriften/gammel_FOA (der relevant)
- `evolution`: established (sparsomt), confirmed, qualified, consolidating

## Dry-run
Vis resultat-JSON uten å skrive til DB.
