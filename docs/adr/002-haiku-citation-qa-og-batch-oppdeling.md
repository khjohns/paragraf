# ADR-002: Haiku-agenter for sitatverifisering og batch-oppdeling av deterministiske oppgaver

**Dato:** 2026-03-16
**Status:** Implementert (P0–P2 fullført; P3 — eval for scoping/post-search — gjenstår)
**Kontekst:** Oppfølging av ADR-001, seksjon 4 (Citations API) og seksjon 5 (Batch API)

---

## Problemstilling

ADR-001 konkluderer med å beholde Citations API kun i `qa.py` og ikke utvide til screening. Men den vurderer ikke:

1. Kan sitatverifisering gjøres av **Haiku** i stedet for Sonnet — med tilsvarende kvalitet?
2. Kan sitatverifisering kjøres som **batch** med Citations API?
3. Finnes det **flere oppgaver** i pipelinen som er tilstrekkelig deterministiske til å delegeres til Haiku i batch?

---

## Kritisk funn: API-kompatibilitet

### Citations API + Structured Output = Inkompatibelt

Anthropic-dokumentasjonen er eksplisitt: **Citations og structured output (`json_schema`) kan ikke kombineres** i samme API-kall. Forsøk returnerer 400-feil.

> "Structured outputs don't work with citations (returns 400) or message prefilling with JSON outputs mode."
> — [Structured outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

**Bug i eksisterende kode**: `qa.py:_verify_citations_with_api()` (linje 285–303) kombinerer `citations: {"enabled": True}` på document-blokker med `output_config.format: json_schema`. Dette kallet ville feilt med 400 ved kjøring — koden er tydeligvis ikke testet mot API-et.

### Citations API + Batch API = Kompatibelt

Citations-parametere er del av Batch API-skjemaet. Document-blokker med `citations: {"enabled": True}` kan sendes i batch-forespørsler.

> Batch API request parameters include `TextBlockParam` with `citations` field, and defines `CitationSearchResultLocationParam`.
> — [Create a Message Batch](https://docs.anthropic.com/en/api/creating-message-batches)

### Structured Output + Batch API = Kompatibelt

Bekreftet i dokumentasjonen: structured outputs fungerer med batch processing.

### Oppsummert kompatibilitetsmatrise

| | Structured Output | Batch API | Citations API |
|---|---|---|---|
| **Structured Output** | — | Kompatibelt | **Inkompatibelt (400)** |
| **Batch API** | Kompatibelt | — | Kompatibelt |
| **Citations API** | **Inkompatibelt (400)** | Kompatibelt | — |

---

## Analyse: Tilnærminger for sitatverifisering

Gitt inkompatibiliteten mellom citations og structured output, finnes det fire reelle tilnærminger:

### Tilnærming A: Haiku + Citations API + Batch (anbefalt for sitatsjekk)

| Egenskap | Verdi |
|----------|-------|
| Modell | Haiku 4.5 |
| Citations | Ja — maskinell tekstmatching |
| Structured output | **Nei** — parse citation-blokker fra respons |
| Batch | Ja — 50% rabatt |
| JSON-garanti | Nei — men citation-blokker er allerede strukturert data |
| Kostnad | ~83% besparelse vs Sonnet standard |

**Hvorfor dette fungerer**: Citations API returnerer strukturerte `cite`-blokker med `cited_text`, `document_index`, `start_char_offset` og `end_char_offset`. Disse blokkene *er* verifiseringsresultatet — de viser nøyaktig hvilken tekst modellen fant. Modellens fritekst-respons klassifiserer bare matchene. Vi trenger ikke json_schema fordi:

1. Cite-blokkene gir oss maskinelt verifiserte posisjoner (strukturert av API-et selv)
2. Modellens klassifisering (verified/truncated/inaccurate/not_found) kan parses fra fritekst med enkel logikk
3. Alternativt kan vi be modellen returnere JSON uten grammatisk tvang (`"Returner JSON"` i prompt) — Haiku følger instruksjoner godt for enkle formater

**Implementering**:
```python
# Fjern output_config.format (inkompatibelt med citations)
# Behold document-blokker med citations enabled
# Parse citation-blokker fra response.content
response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=4000,
    system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
    messages=[{"role": "user", "content": content_blocks}],
    # INGEN output_config.format — inkompatibelt med citations
)

# Respons inneholder cite-blokker:
# {"type": "cite", "cited_text": "...", "document_index": 0,
#  "start_char_offset": 1234, "end_char_offset": 1456}
```

### Tilnærming B: Haiku + Structured Output + Batch (anbefalt for logikk/dekning)

| Egenskap | Verdi |
|----------|-------|
| Modell | Haiku 4.5 |
| Citations | Nei — ingen kildetekst å sitere |
| Structured output | Ja — garantert JSON |
| Batch | Ja — 50% rabatt |
| Kostnad | ~83% besparelse vs Sonnet standard |

Logikksjekk og dekningssjekk bruker ikke Citations API uansett — de opererer på notatmarkdown og screeningsammendrag, ikke kildetekster. Her er structured output + batch den naturlige kombinasjonen.

### Tilnærming C: Sonnet + Structured Output + Batch (fallback)

Hvis Haiku-kvaliteten viser seg utilstrekkelig for logikk/dekning, faller vi tilbake til Sonnet med batch — 50% besparelse, garantert JSON.

### Tilnærming D: Sonnet + Structured Output uten Batch (nåværende, minus buggen)

Dagens tilnærming, men med bugfiks: fjern enten citations eller structured output fra `_verify_citations_with_api()`.

---

## Anbefalt strategi per QA-oppgave

| QA-oppgave | Tilnærming | Modell | Citations | Structured | Batch | Besparelse |
|------------|-----------|--------|-----------|-----------|-------|------------|
| **Sitatverifisering** | A | Haiku | **Ja** | Nei | Ja | ~83% |
| **Logikksjekk** | B | Haiku | Nei | **Ja** | Ja | ~83% |
| **Dekningssjekk** | B | Haiku | Nei | **Ja** | Ja | ~83% |

Nøkkelinnsikten: **ulike QA-oppgaver trenger ulike API-strategier**. Sitatsjekk trenger citations (maskinell matching), mens logikk/dekning trenger structured output (garantert JSON-klassifisering). Disse er gjensidig utelukkende per API-kall, men kan sendes som separate requests i samme batch.

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

### Tier 1: Klare Haiku-kandidater

#### A. QA-oppgaver → Haiku (differensiert strategi)

Alle tre QA-oppgaver er verifiseringsoppgaver med tydelige kriterier:

```
Sitatverifisering: "Finnes dette sitatet ordrett i kildeteksten?" → Citations API
Logikksjekk:       "Følger konklusjon X logisk fra premiss Y?"   → Structured output
Dekningssjekk:     "Er A-kandidat X behandlet i notatet?"        → Structured output
```

Sitatsjekk bruker Citations API for maskinell matching — structured output er verken nødvendig eller mulig her. Logikk- og dekningssjekk bruker structured output for garantert JSON — de har ingen kildetekst å kjøre citations mot.

#### B. Curation → Haiku (sanntid eller batch)

Curation (`generate_curation`) identifiserer relevante avsnitt og markerer dem. Enklere enn screening — ingen proposisjonsformulering, ingen relevansvurdering på tvers av saker.

**Egenskaper**:
- Input: Avsnitt fra én sak + problemstilling
- Output: Max 5 highlights med posisjon og relevansbeskrivelse
- Resultater caches i `curation_cache` → feil kan korrigeres ved re-kjøring
- **NB**: Haiku støtter ikke `effort`-parameteren — se ADR-003 seksjon 1

**Anbefaling**: Bytt til Haiku med structured output + batch for curation.

### Tier 2: Mulige Haiku-kandidater (krever evaluering)

#### C. Scoping → Haiku (mulig)

Scoping transformerer en uformell problemstilling til strukturert forskningsplan. Krever kjennskap til norske anskaffelsesrettslige bestemmelser (FOA, LOA, EU-direktiver).

**For**: Oppgaven er i bunn og grunn klassifisering — mapp problem til bestemmelser og søkestrategi.
**Mot**: Feil i scoping forplanter seg gjennom hele analysen. Haiku kan ha svakere domenekunnskap.

**Anbefaling**: Test med eval-sett. Kjør 20 scoping-oppgaver med Haiku vs Sonnet, sammenlign bestemmelsesreferanser og sub-problem-kvalitet.

#### D. Post-search → Haiku (mulig)

Post-search identifiserer gap i screening-dekningen og foreslår nye søk.

**For**: Mønstergjenkjenning i gap-matrise.
**Mot**: Dårlige søkeforslag betyr tapt dekning — men brukeren kan alltid legge til egne søk.

**Anbefaling**: Lavere risiko enn scoping. Kan testes sammen med scoping-eval.

### Tier 3: Behold på Sonnet

Screening, cross-propositions, synthesis og chat forblir på Sonnet. Disse krever juridisk resonnering, kreativ syntese, og dybde som Haiku ikke pålitelig leverer.

---

## Bugfiks: `qa.py:_verify_citations_with_api()`

### Nåværende kode (linje 285–303)

```python
response = anthropic_client.messages.create(
    model=CLAUDE_MODEL,
    max_tokens=4000,
    output_config={
        "format": {
            "type": "json_schema",
            "schema": CITATION_QA_SCHEMA,  # ← Inkompatibelt med citations
        },
        "effort": "medium",
    },
    system=[...],
    messages=[{"role": "user", "content": content_blocks}],  # ← content_blocks har citations enabled
)
```

### Problemer

1. Kombinerer `output_config.format: json_schema` med `citations: {"enabled": True}` på document-blokker → **400-feil**
2. Sender `effort: "medium"` — må fjernes hvis vi bytter til Haiku (som ikke støtter effort, se [ADR-003](003-pipeline-forbedringer.md))

### Anbefalt fix

Fjern `output_config.format` og parse citation-blokker direkte fra responsen:

```python
response = anthropic_client.messages.create(
    model=HAIKU_MODEL,  # Bytt til Haiku
    max_tokens=4000,
    # Ingen format (inkompatibelt med citations), ingen effort (Haiku støtter ikke effort)
    system=[...],
    messages=[{"role": "user", "content": content_blocks}],
)

# Parse cite-blokker fra response.content
citations = [block for block in response.content if block.type == "cite"]
text_blocks = [block for block in response.content if block.type == "text"]
```

Citation-blokker gir `cited_text`, `document_index`, `start_char_offset`, `end_char_offset` — tilstrekkelig for å verifisere sitatnøyaktighet maskinelt.

---

## Batch-arkitektur

### Foreslått design

```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────┐
│  Sitatverifisering       │  │  Logikk + Dekning       │  │  Screening      │
│  Haiku + Citations API   │  │  Haiku + Structured out  │  │  Sonnet + Batch │
│  (ingen structured out)  │  │  (ingen citations)       │  │  (uendret)      │
└──────────┬──────────────┘  └──────────┬──────────────┘  └────────┬────────┘
           │                            │                          │
           ▼                            ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           submit_batch()                                    │
│  llm_utils.py — model + format varierer per request i samme batch           │
│  Batch API støtter både citations- og structured-requests side om side       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementeringsendringer

1. **`llm_utils.py`**: Legg til `HAIKU_MODEL` konstant, `model`-parameter i `build_batch_request()` og `call_claude_structured()`
2. **`qa.py` sitatsjekk**: Fjern `output_config.format`, behold Citations API, bytt til Haiku, legg til citation-block-parser
3. **`qa.py` logikk+dekning**: Bytt til Haiku med structured output (uendret API-strategi, kun modellbytte)
4. **`qa.py` batch-varianter**: Oppdater `_build_citation_batch_request()` til å bruke citations uten structured output
5. **`curation.py`**: Bytt til Haiku med structured output + batch

### Kostnadssammendrag

| Oppgave | Nåværende | Ny strategi | Besparelse |
|---------|-----------|-------------|------------|
| Sitatverifisering | Sonnet (bugget) | Haiku + Citations + Batch | ~83% |
| Logikksjekk | Sonnet | Haiku + Structured + Batch | ~83% |
| Dekningssjekk | Sonnet | Haiku + Structured + Batch | ~83% |
| Curation | Sonnet/Gemini | Haiku + Structured + Batch | ~83% |
| Screening | Sonnet | Sonnet + Batch (ADR-001) | ~50% |
| EU-screening | Sonnet | Sonnet + Batch (ADR-001) | ~50% |

---

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|-----------|
| Haiku gir lavere kvalitet på logikksjekk | Lav | Middels | Logikksjekk flagger problemer — false negatives betyr færre flagg, ikke feil. Eval-sett |
| Citation-block-parsing er mer komplekst enn JSON-schema | Lav | Lav | Citation-blokker er veldefinert API-output med faste felter |
| Haiku-fritekst for sitatsjekk er mindre presis enn structured | Middels | Lav | Citation-blokkene er hoveddataen — friteksten er supplement. Alternativt: prompt-basert JSON uten grammatisk tvang |
| Haiku-curation gir svakere highlights | Middels | Lav | Curation caches og kan re-kjøres |
| Batch-latens for QA (minutter vs sekunder) | Middels | Middels | QA er siste steg — brukeren venter allerede. Progressbar + polling |
| Blanding av citations- og structured-requests i batch | Lav | Lav | Batch API behandler hver request uavhengig |

---

## Handlingsplan

### Prioritet 0 — Bugfiks (kritisk)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 0 | Fiks citations + structured output-kombinasjon | `qa.py` | Fjern `output_config.format` fra `_verify_citations_with_api()`, parse citation-blokker |

### Prioritet 1 — QA til Haiku (lav risiko, høy gevinst)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 1 | Legg til `HAIKU_MODEL` konstant | `llm_utils.py` | `HAIKU_MODEL = "claude-haiku-4-5-20251001"` |
| 2 | Legg til `model`-parameter | `llm_utils.py` | I `call_claude_structured()` og `build_batch_request()` |
| 3 | Sitatsjekk → Haiku + Citations (uten structured) | `qa.py` | Bytt modell, fjern json_schema, implementer citation-parser |
| 4 | Logikk+dekning → Haiku + Structured | `qa.py` | Bytt modell, behold structured output |
| 5 | Batch-varianter → Haiku | `qa.py` | Oppdater `_build_*_batch_request()` med riktig strategi per oppgave |

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
- [Structured outputs — inkompatibiliteter](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Batches API](https://docs.anthropic.com/en/docs/build-with-claude/batches)
- [Create a Message Batch — API-referanse](https://docs.anthropic.com/en/api/creating-message-batches)
- [Claude Haiku 4.5](https://docs.anthropic.com/en/docs/about-claude/models)
- [Introducing Citations API](https://www.anthropic.com/news/introducing-citations-api)
