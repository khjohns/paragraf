# ADR-005: Claude Code pipeline med skills og agent teams

**Dato:** 2026-03-24
**Status:** Eksperimentell → Validert (test-run 2026-03-24)
**Kontekst:** Oppfølging av ADR-004 (agentisk syntese). Introduserer en alternativ pipeline som kjører via Claude Code skills/subagenter i stedet for Anthropic API.

---

## Problemstilling

API-pipelinen (ADR-001 → ADR-004) fungerer, men har tre begrensninger:

1. **Kostnad ved iterasjon**: Hver kjøring koster $4-6. Å eksperimentere med prompts, kjøre KS gjentatte ganger, eller teste varianter er dyrt.
2. **Ingen dialog mellom steg**: Syntese og KS kjører sekvensielt uten mulighet for diskusjon. KS-funn krever manuell re-kjøring av syntese.
3. **Begrenset transparens**: Brukeren ser fremdrift (SSE), men kan ikke gripe inn midt i et steg eller styre agenten underveis.

### Observasjon

Claude Code *er* en LLM med tilgang til Supabase MCP. Den kan gjøre alt API-pipelinen gjør — lese fra DB, analysere, skrive tilbake — uten ekstra API-kostnad.

---

## Beslutning

Bygge en parallell pipeline som skills i Claude Code. Ikke erstatte API-pipelinen, men supplere den.

### Arkitektur: To pipelines, samme DB

```
┌─────────────────────────────────────────────────────┐
│                    Supabase DB                       │
│  analyses · analysis_candidates · analysis_documents │
└──────────────┬────────────────────┬──────────────────┘
               │                    │
     ┌─────────┴─────────┐  ┌──────┴───────────┐
     │   API-pipeline     │  │ Claude Code       │
     │   (Flask backend)  │  │ pipeline (skills) │
     │                    │  │                    │
     │ Anthropic API      │  │ Claude Code LLM    │
     │ SSE → frontend     │  │ Terminal-output     │
     │ $4-6 per kjøring   │  │ $0 ekstra           │
     └────────────────────┘  └────────────────────┘
```

Frontend ser ingen forskjell — begge skriver til samme tabeller i samme format.

### Steg-mapping

| Steg | API-pipeline | Claude Code pipeline |
|------|-------------|---------------------|
| Scoping | `scoping.py` → Sonnet | Skill leser prompt fra `scoping.py`, Claude Code gjør analysen |
| Søk | `traversal.py` → Supabase RPC | MCP SQL for ref+FTS, CLI for vektorsøk (Gemini embedding) |
| Triage | *(ikke implementert)* | Haiku-subagenter filtrerer C-saker på metadata |
| Screening | `screening.py` → Sonnet, én SSE per sak | Sonnet-subagenter i parallelle batches |
| Sitatverifisering | `qa.py` → Haiku + Citations API | Skill sammenligner sitater manuelt (ingen Citations API) |
| Cross-propositions | `cross_propositions.py` → Sonnet | Skill med samme prompt |
| Syntese | `synthesis.py` → Opus/Sonnet, agentisk med tools | Skill med DB-oppslag via MCP |
| KS | `qa.py` → Opus/Sonnet, agentisk | Skill med DB-oppslag via MCP |

### Forskjeller fra API-pipeline

| Egenskap | API | Claude Code |
|----------|-----|-------------|
| **Kostnad** | $4-6 per full kjøring | $0 (dekket av abonnement) |
| **Modell** | Konfigurerbar (Opus/Sonnet/Haiku) | Multi-modell: Opus orchestrator, Sonnet screening, Haiku triage |
| **Hastighet** | Raskere (dedikert API) | Tregere (subagent-overhead), men parallellisert |
| **Citations API** | Ja (sitatverifisering) | Nei (manuell sammenligning) |
| **JSON-modus** | Structured output (garantert valid) | Fritekst-JSON (kan feile) |
| **Streaming** | SSE til frontend | Terminal-output |
| **Interaktivitet** | Ingen (fire-and-forget) | Sjekkpunkter mellom steg |
| **Iterasjon** | Manuell re-kjøring | Automatisk KS-loop |
| **Dry-run** | Nei | Ja |
| **Triage** | Nei | Ja (Haiku pre-filter for C-saker) |

### Nye capabilities (kun Claude Code)

**1. Interaktive sjekkpunkter**
Etter hvert steg viser orchestratoren resultater og spør brukeren. Brukeren kan justere, hoppe over steg, eller stoppe.

**2. Iterativ KS-revisjon**
KS-agenten finner problemer → reviderer notatet → kjører KS på nytt. Maks 2 runder. Gratis.

**3. Tørrkjøring**
`--dry-run` kjører hele analysen uten å skrive til DB. Nyttig for prompt-tuning.

**4. Haiku-triage for C-saker**
Se dedikert seksjon under.

**5. Adversarial KS med Agent Teams** *(eksperimentell)*
I stedet for sekvensiell syntese→KS: to agenter (syntese + KS) diskuterer notatet i sanntid. KS-agenten utfordrer, syntese-agenten forsvarer eller reviderer. Resultatet er et notat der svakhetene er adressert *under* skrivingen.

---

## Haiku-triage — beslutning og validering

### Problemstilling

Ved søk etter kandidater gir ref+FTS+vector typisk 80-100 C-saker (kun 1 signal). Full Sonnet-screening av alle er dyrt i tid (~5 min/sak). De fleste C-saker er irrelevante — FTS-termer som «fellesskap leverandør» treffer bredt.

### Beslutning

Bruk Haiku som pre-filter for C-saker basert på metadata (signal + `saken_gjelder` + `avgjoerelse`). A- og B-saker hopper over triage.

### Validering (test-run 2026-03-24)

Problemstilling: Leverandørgrupperinger/konsortier (FOA § 16-11).
87 C-saker ble triagert, deretter full-screenet av Sonnet for ground truth.

**Ground truth:** 2 av 87 C-saker var faktisk relevante (2024/1792 A★, 2021/997 B).

| Prompt-variant | JA (passerte) | Falske positiver | Presisjon | Recall |
|---------------|--------------|-----------------|-----------|--------|
| v1 (liberal) | 35 | 33 | 6% | 100% |
| v2 (streng) | ~15 | ~13 | ~13% | **100%** |

**Nøkkelinnsikt:**
- Begge varianter beholdt de 2 viktige sakene (100% recall)
- Streng prompt halverte falske positiver (33 → ~13)
- Selv v2 har lav presisjon — men det er akseptabelt fordi formålet er å **redusere** Sonnet-screening, ikke eliminere den
- Triage på metadata alene har en naturlig grense; saker med generiske FTS-treff og ukjente kategorier er vanskelige å filtrere

### Streng prompt (v2) — kjerneprinsipper

1. **Dual-krav:** Signal OG `saken_gjelder` må begge indikere relevans
2. **Vector-only = NEI:** Uten FTS-bekreftelse er vector-treff for usikre
3. **Avviste saker = NEI:** Ubegrunnede/avviste saker har sjelden substansiell analyse
4. **Ref uten tema-match = NEI:** Mange § 16-10-referanser handler om ren dokumentasjon, ikke gruppering

### Konsekvens for pipeline

- **87 → 15 C-saker** for full screening (83% reduksjon)
- **Totalt 14 A+B + 15 C = 29 saker** vs. 101 uten triage (71% reduksjon)
- **Tid:** Haiku-triage ~30 sekunder for alle 87 saker
- **Risiko:** Lav — recall er 100% i testen. Verste fall: noen relevante C-saker med uvanlig metadata-mønster filtreres bort

### Mulig utvidelse til API-pipeline

Haiku-triage kan implementeres i API-pipelinen som et mellomsteg mellom søk og screening:
1. `traversal.py` returnerer kandidater med signals + metadata
2. Nytt steg: `triage.py` → Haiku vurderer C-saker → markerer `triage: rejected/accepted`
3. `screening.py` screener kun accepted + A + B

Kostnad: ~$0.01 for triage vs. ~$0.05-0.10 per full screening → vesentlig besparelse ved 80+ C-saker.

---

## Data-tilgang: CLI vs. MCP

### Beslutning

Lesing av data skjer via `scripts/pipeline-cli.sh` (wrapper for `pipeline-context.py`), ikke rå Supabase MCP JSON. Skriving skjer via `mcp__claude_ai_Supabase__execute_sql`.

### Begrunnelse

| | CLI (pipeline-cli.sh) | Supabase MCP |
|--|----------------------|--------------|
| **Token-størrelse** | Komprimert XML (~500 tokens/sak) | Rå JSON (~2000 tokens/sak) |
| **Format** | Ferdig LLM-prompt | Krever parsing |
| **Secrets** | Automatisk via gcloud | Krever manuell env-setup |
| **Skriving** | Ikke støttet | INSERT/UPDATE |

CLI-skriptet har 10 kommandoer: `context`, `candidates`, `screening`, `screening-results`, `propositions`, `note`, `qa-report`, `case-text`, `paragraphs`, `vector-search`.

### Wrapper-skript

`scripts/pipeline-cli.sh` laster GCP secrets automatisk:
```bash
#!/bin/bash
if [ -z "${SUPABASE_URL:-}" ]; then
  export SUPABASE_URL=$(gcloud secrets versions access latest --secret=SUPABASE_URL --project=procurement-mcp)
  export SUPABASE_KEY=$(gcloud secrets versions access latest --secret=SUPABASE_KEY --project=procurement-mcp)
fi
exec backend/venv/bin/python3 scripts/pipeline-context.py "$@"
```

Bash-permissions i `.claude/settings.json` tillater subagenter å kjøre dette uten bruker-prompt.

---

## Feil funnet under test-run (2026-03-24)

### CLI-bugs (rettet)

| Bug | Årsak | Fiks |
|-----|-------|------|
| `problem_statement` kolonne finnes ikke | DB-kolonne heter `problem` | Rettet i CLI |
| `seeds` kolonne finnes ikke | Data ligger i `scoping_result` JSONB | Rewrote context-kommando |
| `ai_screening` None-guard | `.get("ai_screening", {}).get("star")` krasjer når None | Endret til `(x or {}).get()` |

### Søke-bugs (rettet)

| Bug | Årsak | Fiks |
|-----|-------|------|
| Ref-søk brukte eksakt match | `WHERE law_section = '16-11'` misset `16-11 (1)` | Endret til `LIKE '16-11%'` i skill |
| Vektorsøk ga 0 treff | Skill refererte `search_kofa_decision_text` (ren FTS) | La til `vector-search` CLI-kommando med `search_kofa_decision_hybrid` |

### Observasjon: API-pipeline hadde allerede riktig

| Problem | API-pipeline | CC-pipeline (før fiks) |
|---------|-------------|----------------------|
| Ref ledd-varianter | `_section_filter()` med LIKE | Eksakt match |
| Vektorsøk | `search_kofa_decision_hybrid` via `vector_seed.py` | Manglet helt |

**Læring:** Skill-filene må referere til eksisterende backend-kode mer presist. Subagenter som gjesser SQL uten å lese backend-koden gjør feil.

---

## Agent Teams — adversarial KS

### Konsept

```
Lead (orchestrator)
  ├── Teammate: synth-agent
  │     Skriver/reviderer notatet
  │     Henter avsnitt fra DB ved behov
  │     Svarer på KS-agentens innvendinger
  │
  └── Teammate: ks-agent
        Leser notatet fortløpende
        Slår opp referanser i DB
        Sender innvendinger til synth-agent
        Vurderer synth-agentens revisjoner
```

### Flyten

1. Lead spawner to teammates med problemstilling + screening-data
2. synth-agent starter notat-generering
3. Når synth-agent har et første utkast → sender til ks-agent
4. ks-agent verifiserer referanser, sjekker logikk, sender innvendinger
5. synth-agent reviderer basert på innvendingene
6. Etter 2-3 runder: lead samler inn ferdig notat + KS-rapport, lagrer til DB

### Forventet gevinst

- Notat med færre KS-merknader fra start (problemer fanget under skriving)
- Mer robust argumentasjon (synth-agent må forsvare poengene sine)
- Transparens: hele dialogen er synlig for brukeren

### Risiko

- Token-tungt (~2x normal pipeline)
- Eksperimentell feature i Claude Code
- Agentene kan «bli enige for fort» uten reell utfordring

---

## Implementasjon

### Skills-struktur

```
.claude/skills/
  pipeline-run/SKILL.md          ← Orchestrator (/pipeline-run)
  pipeline/
    scope-and-search.md          ← Scoping + søk
    screen.md                    ← Haiku-triage + Sonnet-screening
    verify-citations.md          ← Sitatverifisering
    cross-propositions.md        ← Kryssanalyse
    synthesize.md                ← Syntese
    qa.md                        ← KS (med iterativ revisjon)
    adversarial-qa.md            ← Adversarial KS med agent teams
```

Alle sub-skills refererer til eksakte prompts i backend-filene (fil + linjenummer) for å holde seg synkronisert.

### Prompt-gjenbruk

Skills bruker **eksakt** samme prompts som API-pipelinen. Forskjellen er kun orkestrering:
- API: Python-kode kaller Anthropic API med prompt + schema
- Claude Code: Skill instruerer Claude Code til å følge samme prompt, lese/skrive via CLI/MCP

### Multi-modell strategi

| Modell | Rolle | Begrunnelse |
|--------|-------|-------------|
| **Opus** | Orchestrator, syntese, KS | Sterkest resonnering, styrer pipeline |
| **Sonnet** | Screening (full), scoping | God balanse kvalitet/hastighet for analyse |
| **Haiku** | Triage, sitatverifisering | Rask og billig for metadata-baserte vurderinger |

---

## Konsekvenser

### Positiv
- Gratis iterasjon for prompt-utvikling og testing
- Interaktiv pipeline med bruker-i-loopen
- Adversarial KS kan gi bedre notater
- Dry-run for sikker testing
- Haiku-triage reduserer screening-omfang med 70%+
- Multi-modell: riktig modell for riktig oppgave

### Negativ
- Tregere enn API-pipeline (subagent-overhead)
- Ingen Citations API (manuell sitatverifisering)
- Ingen garantert JSON-output (kan kreve re-parsing)
- Agent Teams er eksperimentelt — kan endre seg

### Nøytral
- To pipelines å vedlikeholde (men deler prompts og DB-format)
- Frontend trenger ingen endringer (samme DB-format)
- Haiku-triage kan porteres til API-pipeline som eget steg
