---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Ensemble-triage (deterministisk + Haiku) for rank-1, Sonnet full-screening.
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
Kun for saker der variant A ga «skip» (ref-only). Haiku ser KOFAs oppsummering.

Orchestratoren bygger prompten fra scoping-data:

```
Du er en juridisk triage-assistent. Vurder om hver sak KAN være relevant.
Dette er en grov siling — ved tvil → JA.

<problemstilling>{refined_problem}</problemstilling>

<delspørsmål>
{sub_problems}
</delspørsmål>

<relevans_indikatorer>
{utledet fra provisions[].label + search_strategy.fts}
</relevans_indikatorer>

Disse sakene har BARE ref-signal uten FTS eller vec.
Vurder basert på KOFAs oppsummering (summary).

**JA** hvis summary kan relateres til problemstillingen eller delspørsmålene.
**NEI** kun hvis summary klart handler om noe helt annet.
**Ved tvil → JA**

Input per sak: sak_nr | signal | avgjoerelse | summary
Svar: sak_nr | JA eller NEI | 5 ord
```

#### Variant C: Haiku + avgjørelseskontekst (ref-only saker)
Parallelt med variant B, for samme ref-only saker. Haiku ser avgjørelsesbeskrivelse.

Orchestratoren bygger prompten fra scoping-data (samme template som B, men med avgjørelseskontekst):

```
Du er en juridisk triage-assistent. Vurder om ref-only saker KAN være relevante.
Ved tvil → JA.

<problemstilling>{refined_problem}</problemstilling>

<delspørsmål>
{sub_problems}
</delspørsmål>

<relevans_indikatorer>
{utledet fra provisions[].label + search_strategy.fts}
</relevans_indikatorer>

Vurder basert på avgjørelsesbeskrivelsen.

**JA** hvis avgjørelsen kan relateres til problemstillingen eller delspørsmålene.
**NEI** kun hvis avgjørelsen klart handler om noe helt annet.
**Ved tvil → JA**

Input per sak: sak_nr | signal | avgjoerelse | kort beskrivelse
Svar: sak_nr | JA eller NEI | 5 ord
```

#### Sammenstilling
**Union** av alle JA fra variant A, B og C → full screening.
Saker der B og C er uenige logges som «omstridte» i triage_history.

```bash
# Lagre ensemble-resultater med versjon
echo '["sak1","sak2"]' | bash scripts/pipeline-cli.sh save-triage-reject <id> ensemble-v1
```

JA-saker: fortsett til prioritering (steg 0b) og deretter full screening (steg 1-4).

Saker med discovery_rank ≥ 2 hopper over triage og går rett til full screening.

### Steg 0b: Anførsler-prioritering (valgfritt, Haiku)

Haiku leser første 2-3 avsnitt av partenes anførsler for ensemble-JA saker og klassifiserer:
- **Prioritert** (anførsler handler om temaer relatert til problemstillingen)
- **Lavpri** (anførsler handler om noe annet)

Dispatch Haiku-subagenter i batches à 17 saker:

```
For HVER sak:
1. Hent anførsler: bash scripts/pipeline-cli.sh case-text <sak_nr> anfoersler
2. Les de første 2-3 avsnittene
3. Handler anførslene om temaer relatert til problemstillingen eller delspørsmålene?

<problemstilling>{refined_problem}</problemstilling>

<delspørsmål>
{sub_problems}
</delspørsmål>

Svar: sak_nr | JA eller NEI | 5 ord
Ved tvil → JA
```

**VIKTIG:** Dette er PRIORITERING, ikke filtrering. Anførsler-NEI saker screenes også —
bare etter anførsler-JA sakene. Anførsler pre-screen som selvstendig filter mister
kjernesaker (validert: 4/5 A-saker tapt i E2E a93ce729) fordi anførslene bruker sakens
egne termer, ikke problemstillingens.

Typisk resultat (konseptuelt tema): ~55-60% prioritert, ~40-45% lavpri.
I E2E (a93ce729): 77/136 prioritert — inneholdt alle 5 A-saker og 48/58 B-saker.

Screen prioriterte saker først (batches à 7-12), deretter lavpri.

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
