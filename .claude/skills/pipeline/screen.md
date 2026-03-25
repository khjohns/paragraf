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

### Steg 0: Ensemble-triage (discovery_rank=1 saker)

ADR-006: Triage opererer på signals + metadata, ikke på A/B/C-kategori (som er null inntil screening).
Saker med discovery_rank ≥ 2 hopper over triage og går rett til full screening.
Saker med discovery_rank = 1 triages med **ensemble** av tre parallelle varianter.

Ensemble-triage ga 100% recall (0 false neg A, 0 false neg B) i E2E-validering (a93ce729, 215 rank-1 saker).

#### Variant A: Deterministisk (FTS/vec)
Ingen LLM-kall. Ren signallogikk:
- **FTS-any → JA** (enhver FTS-term)
- **Vec ≥ 0.70 → JA**
- **Ref-only → skip** (vurderes av variant B og C)
- **Avvist + ref-only → NEI**

#### Variant B: Haiku + summary (ref-only saker)
Kun for saker der variant A ga «skip» (ref-only). Haiku ser KOFAs oppsummering:

```
Du er en juridisk triage-assistent. Vurder om hver sak KAN være relevant for denne problemstillingen:

**Problemstilling:** {refined_problem}

Disse sakene har BARE ref-signal uten FTS eller vec. Vurder basert på KOFAs oppsummering (summary).

**JA** kun hvis summary beskriver prisskjema, evalueringsmodell, prisberegning, taktisk prising,
mengdeestimater, handlekurv, vekting av tildelingskriterier, eller priskriterier.
**NEI** hvis summary handler om ulovlig direkte anskaffelse, prosedyrevalg, avvisning, habilitet,
frister, innsyn, egenregi, o.l.
```

Input per sak: `sak_nr | signal | avgjoerelse | summary`

#### Variant C: Haiku + avgjørelseskontekst (ref-only saker)
Parallelt med variant B, for samme ref-only saker. Haiku ser avgjørelsesbeskrivelse:

```
Du er en juridisk triage-assistent. Vurder om ref-only saker KAN være relevant.

**Problemstilling:** {refined_problem}

**JA** kun hvis avgjoerelse handler om tildelingsevaluering, evalueringsmodell,
priskriterier, vekting, eller uklart konkurransegrunnlag relatert til pris.
**NEI** hvis ulovlig direkte anskaffelse, overtredelsesgebyr, egenregi, avvisning
uten evaluerings-kontekst, prosedyrevalg, habilitet, frister, innsyn.
```

Input per sak: `sak_nr | signal | avgjoerelse | kort beskrivelse`

#### Sammenstilling
**Union** av alle JA fra variant A, B og C → full screening.
Saker der B og C er uenige logges som «omstridte» i triage_history.

```bash
# Lagre ensemble-resultater med versjon
echo '["sak1","sak2"]' | bash scripts/pipeline-cli.sh save-triage-reject <id> ensemble-v1
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
