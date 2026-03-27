---
name: pipeline:triage
description: Ensemble-triage (deterministisk + Haiku) og anførsler-prioritering for rank-1 kandidater. Kjøres etter scope/provisions, før screen.
user-invocable: false
---

# Triage & Pre-screen — Subagent (Haiku)

## Input
`analysis_id`

## Formål
Sil rank-1 kandidater (svakeste signal) for å redusere antallet som trenger full Sonnet-screening.
Rank ≥ 2 kandidater hopper over triage og går rett til screening.

## Datahenting

```bash
# Triage-kandidater (rank=1, pending):
bash scripts/pipeline-cli.sh triage <analysis_id>

# Analysekontekst (for å bygge prompts):
bash scripts/pipeline-cli.sh context <analysis_id>

# Anførsler for én sak:
bash scripts/pipeline-cli.sh case-text <sak_nr> anfoersler
```

## Steg 1: Ensemble-triage

ADR-006: Triage opererer på signals + metadata, ikke på A/B/C-kategori (som er null inntil screening).
Ensemble av tre parallelle varianter — union av alle JA.

Ensemble-triage ga 100% recall (0 false neg A, 0 false neg B) i E2E-validering (a93ce729, 215 rank-1 saker).

### Variant A: Deterministisk (FTS/vec)
Ingen LLM-kall. Ren signallogikk:
- **FTS-any → JA** (enhver FTS-term)
- **Vec ≥ 0.70 → JA**
- **Ref-only → skip** (vurderes av variant B og C)
- **Avvist + ref-only → NEI**

### Variant B: Haiku + summary (ref-only saker)
Kun for saker der variant A ga «skip» (ref-only). Haiku ser KOFAs emneknagger.

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

### Variant C: Haiku + avgjørelseskontekst (ref-only saker)
Parallelt med variant B, for samme ref-only saker. Haiku ser avgjørelsesbeskrivelse.

Samme template som B, men:
- "Vurder basert på avgjørelsesbeskrivelsen" i stedet for summary
- Input: `sak_nr | signal | avgjoerelse | kort beskrivelse`

### Sammenstilling
**Union** av alle JA fra variant A, B og C → videre til anførsler-prioritering og full screening.

**Lagre per-kandidat triage-resultater:**
```bash
echo '[
  {"sak_nr":"2023/123","variant_a":"JA","variant_b":null,"variant_c":null,"ensemble":"JA"},
  {"sak_nr":"2020/456","variant_a":"skip","variant_b":"NEI","variant_c":"JA","ensemble":"JA"},
  {"sak_nr":"2019/789","variant_a":"skip","variant_b":"NEI","variant_c":"NEI","ensemble":"NEI"}
]' | bash scripts/pipeline-cli.sh save-triage-results <id> <run_id>
```

**Lagre rejected-liste** (oppdaterer screening_status):
```bash
echo '["2019/789"]' | bash scripts/pipeline-cli.sh save-triage-reject <id> ensemble-v1
```

## Steg 2: Anførsler-prioritering (Haiku)

Sonnet (ikke Haiku — Haiku er upålitelig med bash-verktøy) leser partenes anførsler
for triage-JA saker og klassifiserer:
- **Prioritert** (anførsler handler om temaer relatert til problemstillingen)
- **Lavpri** (anførsler handler om noe annet)

Dispatch Sonnet-subagenter i batches à 17 saker:

```
For HVER sak:
1. Hent anførsler: bash scripts/pipeline-cli.sh case-text <sak_nr> anfoersler
2. Les HELE anførselsteksten (ikke bare 2-3 avsnitt — avklaringsspørsmål er
   ofte subsidiære anførsler som kommer etter hovedanførslene)
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

**Lagre anførsler-resultater** (oppdaterer eksisterende triage_results):
```bash
echo '[
  {"sak_nr":"2023/123","anfoersler":"JA","anfoersler_reason":"Avklaring av tilbud"},
  {"sak_nr":"2020/456","anfoersler":"NEI","anfoersler_reason":"Kvalifikasjonskrav kun"}
]' | bash scripts/pipeline-cli.sh update-triage-anfoersler <id> <run_id>
```

## Output

Rapporter til orchestrator:
- Antall rank-1 kandidater
- Variant A: JA/skip fordeling
- Variant B∪C: JA/NEI fordeling (ref-only)
- Ensemble: totalt JA, totalt rejected
- Pass rate
- Anførsler-prioritering: prioritert/lavpri fordeling

## Dry-run
Vis triage-resultater og prioritering uten å skrive til DB.
