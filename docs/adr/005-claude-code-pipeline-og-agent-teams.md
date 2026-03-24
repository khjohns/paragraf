# ADR-005: Claude Code pipeline med skills og agent teams

**Dato:** 2026-03-24
**Status:** Eksperimentell
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
| Søk | `traversal.py` → Supabase RPC | Skill kjører samme RPC via MCP |
| Screening | `screening.py` → Sonnet, én SSE per sak | Skill per sak, sekvensiell |
| Sitatverifisering | `qa.py` → Haiku + Citations API | Skill sammenligner sitater manuelt (ingen Citations API) |
| Cross-propositions | `cross_propositions.py` → Sonnet | Skill med samme prompt |
| Syntese | `synthesis.py` → Opus/Sonnet, agentisk med tools | Skill med DB-oppslag via MCP |
| KS | `qa.py` → Opus/Sonnet, agentisk | Skill med DB-oppslag via MCP |

### Forskjeller fra API-pipeline

| Egenskap | API | Claude Code |
|----------|-----|-------------|
| **Kostnad** | $4-6 per full kjøring | $0 (dekket av abonnement) |
| **Modell** | Konfigurerbar (Opus/Sonnet/Haiku) | Claude Code-modellen (Opus) |
| **Hastighet** | Raskere (dedikert API) | Tregere (subagent-overhead) |
| **Citations API** | Ja (sitatverifisering) | Nei (manuell sammenligning) |
| **JSON-modus** | Structured output (garantert valid) | Fritekst-JSON (kan feile) |
| **Streaming** | SSE til frontend | Terminal-output |
| **Interaktivitet** | Ingen (fire-and-forget) | Sjekkpunkter mellom steg |
| **Iterasjon** | Manuell re-kjøring | Automatisk KS-loop |
| **Dry-run** | Nei | Ja |

### Nye capabilities (kun Claude Code)

**1. Interaktive sjekkpunkter**
Etter hvert steg viser orchestratoren resultater og spør brukeren. Brukeren kan justere, hoppe over steg, eller stoppe.

**2. Iterativ KS-revisjon**
KS-agenten finner problemer → reviderer notatet → kjører KS på nytt. Maks 2 runder. Gratis.

**3. Tørrkjøring**
`--dry-run` kjører hele analysen uten å skrive til DB. Nyttig for prompt-tuning.

**4. Adversarial KS med Agent Teams** *(eksperimentell)*
I stedet for sekvensiell syntese→KS: to agenter (syntese + KS) diskuterer notatet i sanntid. KS-agenten utfordrer, syntese-agenten forsvarer eller reviderer. Resultatet er et notat der svakhetene er adressert *under* skrivingen.

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
6. ks-agent vurderer revisjonene, sender eventuelle gjenstående funn
7. Etter 2-3 runder: lead samler inn ferdig notat + KS-rapport, lagrer til DB

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
    screen.md                    ← Screening per sak
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
- Claude Code: Skill instruerer Claude Code til å følge samme prompt, lese/skrive via Supabase MCP

---

## Konsekvenser

### Positiv
- Gratis iterasjon for prompt-utvikling og testing
- Interaktiv pipeline med bruker-i-loopen
- Adversarial KS kan gi bedre notater
- Dry-run for sikker testing

### Negativ
- Tregere enn API-pipeline (subagent-overhead)
- Ingen Citations API (manuell sitatverifisering)
- Ingen garantert JSON-output (kan kreve re-parsing)
- Agent Teams er eksperimentelt — kan endre seg

### Nøytral
- To pipelines å vedlikeholde (men deler prompts)
- Frontend trenger ingen endringer (samme DB-format)
