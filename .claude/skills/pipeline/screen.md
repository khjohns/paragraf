---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Haiku-triage for C-saker, Sonnet full-screening.
user-invocable: false
---

# Screening — Subagent

## Input
`analysis_id`, liste over `sak_nrs` (eller "alle uscreenede")

## Datahenting (bruk CLI, ikke MCP)

```bash
# Kontekst + avgjørelsestekst for én sak (ferdigformatert XML):
bash scripts/pipeline-cli.sh screening <analysis_id> <sak_nr>

# Alle kandidater med status:
bash scripts/pipeline-cli.sh candidates <analysis_id>

# Spesifikke avsnitt:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

## Steg

### Steg 0: Haiku-triage (discovery_rank=1 saker)

ADR-006: Triage opererer på signals + metadata, ikke på A/B/C-kategori (som nå er null inntil screening).
Saker med discovery_rank ≥ 2 hopper over triage og går rett til full screening.
Saker med discovery_rank = 1 triages basert på signaltype + metadata.

Dispatch Haiku-subagenter (model: haiku) i batches à 20-25 saker med denne prompten:

```
Du er en STRENG juridisk triage-assistent. Vurder om hver sak er relevant for denne problemstillingen:

**Problemstilling:** {refined_problem}

For HVER sak, svar BARE med: sak_nr | JA eller NEI | 1 setning

## Regler

Vurder KUN basert på signaltype + signalverdi + avgjørelse (utfall).
**IKKE bruk `saken_gjelder`** — den beskriver prosessuelt tema, ikke substansielt innhold,
og introduserer falske negativer (validert i E2E a93ce729: 1A + 4B tapt pga saken_gjelder-filtrering).

En sak er JA hvis:
- FTS-termen er spesifikk for problemstillingen (f.eks. "prisskjema", "taktisk prising", "handlekurv")
- FTS-termen er evalueringsrelatert (f.eks. "evalueringsmodell", "enhetspris") OG problemstillingen gjelder evaluering/pris
- Vec sim ≥ 0.70 — vektorsøk fanger konseptuelle temaer der terminologien varierer
- Ref til bestemmelse som er primærbestemmelse for problemstillingen

En sak er NEI hvis:
- Ref-only til en generell bestemmelse (f.eks. §18-1, §14-1) som brukes i mange kontekster — UTEN FTS- eller vec-bekreftelse
- Saken er avvist/ubegrunnet (avgjoerelse inneholder "avvist")
- Vec sim < 0.70 uten FTS/ref-støtte

**Vec-only er IKKE støy.** Vec-only er primær discovery-kanal for konseptuelle temaer.
I E2E-validering hadde 75% av kjernesakene kun vec-signal.
```

Input per sak: `sak_nr | signal: {type}[{value}] sim:{score} | {avgjoerelse}`

Hent metadata via CLI:
```bash
bash scripts/pipeline-cli.sh triage <analysis_id>
# Returnerer alle pending rank-1 saker med signals + saken_gjelder + avgjoerelse
```

NEI-saker: lagre med prompt-versjon for historikk:
```bash
echo '["2023/123","2023/456"]' | bash scripts/pipeline-cli.sh save-triage-reject <id> v2
```

NEI-saker: lagre via CLI:
```bash
echo '["2023/123","2023/456"]' | bash scripts/pipeline-cli.sh save-triage-reject <id>
```
JA-saker: fortsett til full screening (steg 1-4).

Saker med discovery_rank ≥ 2 hopper over triage og går rett til full screening.

### Steg 1-4: Full Sonnet-screening

1. Hent kandidater + bestemmelseskapsel:
   ```bash
   bash scripts/pipeline-cli.sh candidates <id>
   bash scripts/pipeline-cli.sh propositions <id>   # provision_screening hvis tilgjengelig
   ```
   Bestemmelseskapselen (provision_screening) gir screening-agenten kunnskap om hva
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
   echo '{"factum":"...","proposition":"...","relevance":"A","star":true}' | bash scripts/pipeline-cli.sh save-screening <id> <sak_nr>
   ```
5. Rapporter: `✓ {sak_nr} — {relevance} {★ hvis star} — {proposition kort}`

Dispatch Sonnet-subagenter i batches à 7-12 saker (parallelt).

## Output-format
JSON: `{factum, assessment, proposition, quotes: [{p, text}], nuances, relevance: A/B/C, relevance_reasoning, star: bool}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.
