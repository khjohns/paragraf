# ADR-002: Haiku-agenter for sitatverifisering og batch-oppdeling av deterministiske oppgaver

**Dato:** 2026-03-16
**Status:** Foreslått
**Kontekst:** Oppfølging av ADR-001, seksjon 4 (Citations API) og seksjon 5 (Batch API)

---

## Problemstilling

ADR-001 konkluderer med å beholde Citations API kun i `qa.py` og ikke utvide til screening. Men den vurderer ikke:

1. Kan sitatverifisering gjøres av **Haiku** i stedet for Sonnet — med tilsvarende kvalitet?
2. Kan sitatverifisering kjøres som **batch** med Citations API?
3. Finnes det **flere oppgaver** i pipelinen som er tilstrekkelig deterministiske til å delegeres til Haiku i batch?

---

## Analyse: Citations API + Haiku for sitatverifisering

### Hvorfor Haiku er egnet for sitatverifisering

Sitatverifisering (`_verify_citations_with_api`) er en **nesten deterministisk** oppgave:

1. **Input**: Kildetekst (avgjørelsestekst) + liste av sitater fra screening
2. **Oppgave**: For hvert sitat — finn det i kildeteksten, klassifiser som `verified`/`truncated`/`inaccurate`/`not_found`
3. **Output**: Strukturert JSON med status per sitat

Dette er i praksis **strengsammenligning med kontekst**. Oppgaven krever:
- Nøyaktig tekstmatching (Citations API håndterer dette maskinelt)
- Vurdering av om trunkering fjerner kvalifikasjoner (krever noe forståelse, men er mønstergjenkjenning)
- Ingen kreativ resonnering eller juridisk analyse

### Kvalitetsvurdering: Haiku vs Sonnet for denne oppgaven

| Dimensjon | Haiku 4.5 | Sonnet 4.6 | Vurdering |
|-----------|-----------|------------|-----------|
| Tekstmatching (ordrett) | Utmerket | Utmerket | Citations API gjør tung-løftet — modellen klassifiserer |
| Trunkering-deteksjon | Meget god | Utmerket | Haiku kan identifisere utelatte kvalifikasjoner fra kontekst |
| Klassifisering (4 kategorier) | Utmerket | Utmerket | Enkel kategorisering med tydelig instruksjon |
| Structured output | Støttet | Støttet | Begge støtter json_schema |
| Citations API | Støttet (4.5+) | Støttet | Begge kan bruke document-blokker med citations |

**Konklusjon**: Haiku 4.5 vil levere **tilnærmet identisk kvalitet** som Sonnet for denne oppgaven. Citations API gjør den vanskeligste delen (eksakt tekstlokalisering) — modellen trenger bare å klassifisere matchene.

### Kostnadsgevinst

| | Sonnet 4.6 | Haiku 4.5 | Besparelse |
|---|---|---|---|
| Input | $3/MTok | $1/MTok | 67% |
| Output | $15/MTok | $5/MTok | 67% |
| Med batch (50%) | $1.5/$7.5 | $0.50/$2.50 | 83% vs Sonnet standard |
| Med batch + cache (90% read) | ~$0.30/$7.5 | ~$0.10/$2.50 | 95% vs Sonnet standard |

Typisk sitatverifisering sender ~15K input-tokens (kildetekster) og ~2K output-tokens. Per analyse:
- **Sonnet standard**: ~$0.075
- **Haiku batch + cache**: ~$0.012
- **Besparelse**: ~84% per QA-kjøring

### Begrensning: Citations API er ikke tilgjengelig i Batch API

**Viktig funn**: ADR-001 sin eksisterende batch-implementering for QA (`_build_citation_batch_request`) bruker allerede **ikke** Citations API — den faller tilbake til structured output med kildetekst i XML-blokker. Dette er fordi Batch API og Citations API ikke nødvendigvis er kompatible i samme request.

Det betyr at det allerede finnes **to kodestier**:
1. **Sanntid**: Citations API med document-blokker (bedre verifisering)
2. **Batch**: Structured output med XML-kildetekst (billigere, men ingen maskinell sitatmatching)

For Haiku-delegering er begge stier aktuelle:
- **Sanntidskall med Haiku**: Bruk Citations API, bytt kun modell → 67% besparelse
- **Batch med Haiku**: Bruk eksisterende batch-sti, bytt modell → 83% besparelse

---

## Analyse: Flere oppgaver egnet for Haiku-batch

### Klassifisering av alle LLM-oppgaver etter determinisme

| Oppgave | Modul | Determinisme | Haiku-egnet? | Begrunnelse |
|---------|-------|-------------|-------------|-------------|
| Sitatverifisering | `qa.py` | **Høy** | **Ja** | Strengmatching + klassifisering |
| Dekningssjekk | `qa.py` | **Høy** | **Ja** | Sjekk om kandidater er behandlet i notat — listesjekk |
| Logikksjekk | `qa.py` | **Middels-høy** | **Ja** | Flagging av logiske gap — mønstergjenkjenning, ikke kreativt |
| Scoping | `scoping.py` | **Middels-høy** | **Mulig** | Strukturert klassifisering, men krever juridisk domenekunnskap |
| Post-search | `post_search.py` | **Middels** | **Mulig** | Gapidentifisering — mønstergjenkjenning med noe kreativitet |
| Curation | `curation.py` | **Middels** | **Mulig** | Relevansvurdering av avsnitt — enklere enn screening |
| Screening | `screening.py` | **Lav** | **Nei** | Krever dyp juridisk analyse, proposisjonsformulering, relevansvurdering |
| Cross-propositions | `cross_propositions.py` | **Lav** | **Nei** | Tverrgående syntese, evolusjonssporing, spenningsdeteksjon |
| Synthesis | `synthesis.py` | **Lav** | **Nei** | Mest komplekse oppgaven — komposisjon og juridisk argumentasjon |
| Chat | `chat.py` | **Lav** | **Nei** | Interaktiv sparring krever resonneringsdybde |

### Tier 1: Klare Haiku-batch-kandidater

#### A. Alle tre QA-oppgaver → Haiku batch

Alle tre QA-oppgaver er verifiseringsoppgaver med tydelige kriterier:

```
Sitatverifisering: "Finnes dette sitatet ordrett i kildeteksten?"
Logikksjekk:       "Følger konklusjon X logisk fra premiss Y?"
Dekningssjekk:     "Er A-kandidat X behandlet i notatet?"
```

**Anbefaling**: Kjør alle 3 som Haiku-batch. Dagens effort er allerede `"medium"` — Sonnet med medium effort tilsvarer omtrent Haiku med high effort for denne typen oppgave.

**Implementering**:
- Legg til `model`-parameter i `build_batch_request()` / `call_claude_structured()`
- QA-modulen sender `model="claude-haiku-4-5-20251001"` for alle 3 kall
- Behold `effort="medium"` (eller vurder `"high"` for Haiku — marginal kostnad)

#### B. Curation → Haiku (sanntid eller batch)

Curation (`generate_curation`) identifiserer relevante avsnitt og markerer dem. Dette er enklere enn screening — ingen proposisjonsformulering, ingen relevansvurdering på tvers av saker.

**Egenskaper**:
- Input: Avsnitt fra én sak + problemstilling
- Output: Max 5 highlights med posisjon og relevansbeskrivelse
- Allerede `effort="medium"`
- Resultater caches i `curation_cache` → feil kan korrigeres ved re-kjøring

**Anbefaling**: Bytt til Haiku for curation. Curation kjøres per sak, så batch er naturlig ved forhåndsgenerering for flere saker.

### Tier 2: Mulige Haiku-kandidater (krever evaluering)

#### C. Scoping → Haiku (mulig)

Scoping transformerer en uformell problemstilling til strukturert forskningsplan. Den krever kjennskap til norske anskaffelsesrettslige bestemmelser (FOA, LOA, EU-direktiver).

**For**: Oppgaven er i bunn og grunn klassifisering — mapp problem til bestemmelser og søkestrategi.
**Mot**: Feil i scoping forplanter seg gjennom hele analysen. Haiku kan ha svakere domene-kunnskap.

**Anbefaling**: Test med eval-sett. Kjør 20 scoping-oppgaver med Haiku vs Sonnet, sammenlign bestemmelsesrefusjoner og sub-problem-kvalitet. Implementer kun hvis kvalitetsforskjellen er neglisjerbar.

#### D. Post-search → Haiku (mulig)

Post-search identifiserer gap i screening-dekningen og foreslår nye søk.

**For**: Allerede `effort="medium"`. Mønstergjenkjenning i gap-matrise.
**Mot**: Dårlige søkeforslag betyr tapt dekning — men brukeren kan alltid legge til egne søk.

**Anbefaling**: Lavere risiko enn scoping. Kan testes sammen med scoping-eval.

### Tier 3: Behold på Sonnet

Screening, cross-propositions, synthesis og chat forblir på Sonnet. Disse krever juridisk resonnering, kreativ syntese, og dybde som Haiku ikke pålitelig leverer.

---

## Batch-arkitektur for Haiku-oppgaver

### Foreslått design

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  QA pipeline     │    │  Curation batch  │    │  Screening      │
│  (3 Haiku-kall)  │    │  (N Haiku-kall)  │    │  (N Sonnet-kall)│
│  sitatsjekk      │    │  per sak i       │    │  (uendret)      │
│  logikksjekk     │    │  analyse         │    │                 │
│  dekningssjekk   │    │                  │    │                 │
└────────┬────────┘    └────────┬─────────┘    └────────┬────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    submit_batch()                                │
│  llm_utils.py — model parameter per request                     │
│  Haiku-batch og Sonnet-batch kan sendes separat eller blandet   │
└─────────────────────────────────────────────────────────────────┘
```

### Implementeringsendringer

1. **`llm_utils.py`**: Legg til `model`-parameter i `build_batch_request()` og `call_claude_structured()` (default: `CLAUDE_MODEL`)
2. **`qa.py`**: Sett `model=HAIKU_MODEL` for alle 3 QA-kall (både sanntid og batch)
3. **`curation.py`**: Sett `model=HAIKU_MODEL`, legg til batch-støtte for bulk-curation
4. **Ny konstant**: `HAIKU_MODEL = "claude-haiku-4-5-20251001"` i `llm_utils.py`

### Kostnadssammendrag

| Oppgave | Nåværende modell | Ny modell | Batch? | Estimert besparelse |
|---------|-----------------|-----------|--------|---------------------|
| Sitatverifisering | Sonnet | **Haiku** | Ja | ~83% |
| Logikksjekk | Sonnet | **Haiku** | Ja | ~83% |
| Dekningssjekk | Sonnet | **Haiku** | Ja | ~83% |
| Curation | Sonnet/Gemini | **Haiku** | Ja (bulk) | ~83% |
| Screening | Sonnet | Sonnet | Ja | ~50% (fra ADR-001) |
| EU-screening | Sonnet | Sonnet | Ja | ~50% (fra ADR-001) |

**Total estimert besparelse for QA + curation**: ~83% vs nåværende.

---

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|-----------|
| Haiku gir lavere kvalitet på logikksjekk | Lav | Middels | Logikksjekk flagger problemer — false negatives betyr færre flagg, ikke feil flagg. Eval-sett for verifisering |
| Haiku misser trunkerte sitater | Lav | Lav | Citations API håndterer matching. Haiku klassifiserer kun — tydelig prompt med eksempler |
| Haiku-curation gir svakere highlights | Middels | Lav | Curation caches og kan re-kjøres. Brukeren ser highlights og vurderer selv |
| Modellbytte krever API-kompatibilitetstesting | Lav | Lav | Haiku 4.5 bruker identisk API-format som Sonnet |
| Batch API + Citations API inkompatibilitet | Middels | Middels | Bruk eksisterende batch-kodesti (XML-basert) for batch. Sanntids-fallback med Citations API |

---

## Handlingsplan

### Prioritet 1 — QA til Haiku (lav risiko, høy gevinst)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 1 | Legg til `HAIKU_MODEL` konstant | `llm_utils.py` | `HAIKU_MODEL = "claude-haiku-4-5-20251001"` |
| 2 | Legg til `model`-parameter | `llm_utils.py` | I `call_claude_structured()` og `build_batch_request()` |
| 3 | QA sitatsjekk → Haiku | `qa.py` | Bruk `HAIKU_MODEL` i `_verify_citations_with_api()` |
| 4 | QA logikk+dekning → Haiku | `qa.py` | Bruk `HAIKU_MODEL` i `_check_logical_consistency()` og `_check_coverage()` |
| 5 | QA batch → Haiku | `qa.py` | Bruk `HAIKU_MODEL` i `_build_*_batch_request()` |

### Prioritet 2 — Curation til Haiku (middels risiko)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 6 | Curation → Haiku | `curation.py` | Bytt modell til `HAIKU_MODEL` |
| 7 | Batch-curation | `curation.py` | Legg til `generate_curation_batch()` for bulk forhåndsgenerering |

### Prioritet 3 — Eval for scoping/post-search (middels risiko)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 8 | Lag eval-sett | `tests/eval/` | 20 scoping- og post-search-oppgaver med fasit |
| 9 | Kjør Haiku vs Sonnet eval | — | Sammenlign bestemmelsesreferanser, sub-problems, søkeforslag |
| 10 | Implementer if eval bestått | `scoping.py`, `post_search.py` | Bytt modell basert på eval-resultater |

---

## Referanser

- [ADR-001: Anthropic API-optimalisering](001-anthropic-api-optimalisering.md)
- [Citations API](https://docs.anthropic.com/en/docs/build-with-claude/citations)
- [Batches API](https://docs.anthropic.com/en/docs/build-with-claude/batches)
- [Claude Haiku 4.5](https://docs.anthropic.com/en/docs/about-claude/models)
- [Introducing Citations API](https://www.anthropic.com/news/introducing-citations-api)
