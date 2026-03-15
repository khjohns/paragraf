# ADR-001: Anthropic API-optimalisering

**Dato:** 2026-03-15
**Status:** Foreslått
**Kontekst:** Kvalitetssikring av guidet analyse-implementering (sprints 10–16)

---

## Sammendrag

Paragraf bruker Claude API (claude-sonnet-4-6) i 9 backend-moduler for strukturert juridisk analyse. Denne ADR evaluerer dagens bruk mot tilgjengelige API-funksjoner og anbefaler optimaliseringer for kostnad, kvalitet og pålitelighet.

---

## Nåtilstand

### Moduloversikt

| Modul | Metode | Structured | Effort | Cache | Streaming | Max tokens |
|-------|--------|-----------|--------|-------|-----------|-----------|
| `llm_utils.py` | `messages.create` | json_schema | konfig. (default: high) | ephemeral | Nei | 4000 |
| `scoping.py` | `messages.create` | json_schema | medium | ephemeral | Nei | 4000 |
| `screening.py` | via `call_claude_structured` | json_schema | high | ephemeral | Nei | 4000 |
| `eu_screening.py` | via `call_claude_structured` | json_schema | high | ephemeral | Nei | 4000 |
| `post_search.py` | via `call_claude_structured` | json_schema | **mangler** (default: high) | ephemeral | Nei | 4000 |
| `cross_propositions.py` | via `call_claude_structured` | json_schema | **mangler** (default: high) | ephemeral | Nei | 8000 |
| `synthesis.py` | via `call_claude_structured` | json_schema | high | ephemeral | Nei | 12000 |
| `qa.py` (sitatsjekk) | `messages.create` | json_schema | medium | ephemeral | Nei | 4000 |
| `qa.py` (logikk+dekning) | via `call_claude_structured` | json_schema | medium | ephemeral | Nei | 4000 |
| `chat.py` | `messages.stream` | Nei | **mangler** | ephemeral | Ja | 2000 |
| `curation.py` | `messages.create` | **Nei** | **mangler** | **Nei** | Nei | 2000 |

### Identifiserte problemer

1. **`curation.py`** — Oppretter egen `anthropic.Anthropic()`-klient, mangler structured output, effort, cache_control, og XML-tags. Bruker regex-fallback for JSON-parsing.
2. **`scoping.py`** — Oppretter egen `anthropic.Anthropic()`-klient med kortere timeout (60s vs 120s).
3. **`post_search.py`** — Mangler eksplisitt `effort`-parameter, arver default `"high"` fra `call_claude_structured`. Bør være `"medium"`.
4. **`cross_propositions.py`** — Mangler eksplisitt `effort`-parameter. Bør være eksplisitt `"high"`.
5. **`chat.py`** — Mangler `effort`-parameter i streaming-kallet.

---

## Evaluering av API-funksjoner

### 1. Effort levels (`output_config.effort`)

**Hva:** Styrer hvor mye innsats Claude bruker på svaret. Lavere effort = raskere + billigere.

**Nivåer:** `low` | `medium` | `high` (default)

**Anbefaling per modul:**

| Modul | Nåværende | Anbefalt | Begrunnelse |
|-------|-----------|----------|-------------|
| `scoping.py` | medium | medium | Korrekt — rutineoppgave med tydelig instruksjon |
| `screening.py` | high | high | Korrekt — kompleks rettslig analyse |
| `eu_screening.py` | high | high | Korrekt — kompleks rettslig analyse |
| `post_search.py` | high (implicit) | **medium** | Ettersøk er mønstergjenkjenning, ikke dyp analyse |
| `cross_propositions.py` | high (implicit) | **high** (eksplisitt) | Kompleks tverrgående analyse krever dyp resonnering |
| `synthesis.py` | high | high | Korrekt — mest komplekse oppgaven |
| `qa.py` (alle 3) | medium | medium | Korrekt — verifisering, ikke kreativt arbeid |
| `chat.py` | mangler | **medium** | Sparring er interaktiv; responstid viktigere enn dybde |
| `curation.py` | mangler | **medium** | Enkel highlight-oppgave |

**Beslutning:** Implementer. Eksplisitt effort på alle kall.

**Handling:**
- `post_search.py`: Legg til `effort="medium"`
- `cross_propositions.py`: Legg til `effort="high"` (eksplisitt)
- `chat.py`: Legg til `effort="medium"` i streaming-kallet (krever tilpasning siden `messages.stream()` ikke direkte støtter `output_config`)
- `curation.py`: Legg til effort via `call_claude_structured`

---

### 2. Prompt caching (`cache_control`)

**Hva:** Cacher system-prompts og lange kontekstblokker. 90% besparelse på input-tokens ved cache hit (0.1x pris). Cache-skriving koster 1.25x. TTL: 5 min (default) eller 1 time.

**Min. størrelse:** ~1024 tokens for Sonnet.

**Nåtilstand:** Alle moduler bruker `cache_control: {"type": "ephemeral"}` på system-prompts — **unntatt `curation.py`**.

**Anbefaling:**
- **`curation.py`**: Legg til caching. System-prompten er ~65 linjer og kalles gjentatte ganger for ulike saker i samme analyse.
- **Screening parallellkjøring**: Prompt caching er spesielt verdifullt her — 3 parallelle kall med identisk system-prompt betyr at 2 av 3 treffer cache.
- **Chat**: Allerede implementert korrekt. Multi-turn samtaler drar nytte av at system+historikk caches.
- **Vurder 1-timers cache** for synthesis og cross-propositions der system-prompten er lang og brukeren kan kjøre flere iterasjoner.

**Beslutning:** Implementer caching i `curation.py`. Vurder 1-timers TTL for tunge kall.

---

### 3. Structured output (`output_config.format.json_schema`)

**Hva:** Grammatisk tvunget JSON-output som garantert matcher schema. Eliminerer behovet for regex-fallback og manuell JSON-parsing.

**Nåtilstand:** 8 av 9 moduler bruker structured output korrekt. `curation.py` og `chat.py` gjør det ikke.

**`curation.py`-analyse:**
- Bruker `parse_json_response()` med regex-fallback — fragilt
- Gemini-varianten bruker allerede `response_json_schema` — Claude-varianten bør gjøre tilsvarende
- `CURATION_SCHEMA` finnes allerede i filen, men brukes kun av Gemini

**`chat.py`-analyse:**
- Chat returnerer fritekst (markdown med referanser) — structured output er **ikke hensiktsmessig** her
- Streaming + fritekst er riktig mønster for interaktiv sparring

**Beslutning:** Refaktorer `curation.py` til å bruke `call_claude_structured()`. La `chat.py` være som den er.

---

### 4. Citations API

**Hva:** Lar Claude sitere direkte fra kildetekst med nøyaktige posisjonsfeferanser. Støtter plaintext, PDF og bilder som dokumentkilder.

**Nåtilstand:** Brukt i `qa.py` (`_verify_citations_with_api`) — sender avgjørelsestekst som `document`-blokker med `citations: {"enabled": True}`.

**Analyse:**
- QA-implementeringen er **korrekt og god** — verifiserer screening-sitater mot kildetekst
- Kunne potensielt brukes i screening for å sikre ordrett sitering → men dette ville øke kompleksitet og token-bruk betydelig
- Citations API har en viktig fordel: `cited_text` telles ikke som output-tokens

**Vurdert utvidelse — Citations i screening:**
- **For:** Ville gi maskinverifiserbare sitater allerede i screening-steget
- **Mot:** Krever at hele avgjørelsesteksten sendes som document-blokk (ikke bare tekst), øker kompleksitet uten tydelig gevinst siden QA allerede verifiserer
- **Mot:** Screening kjøres parallelt for mange saker — ekstra overhead per sak

**Beslutning:** Behold nåværende bruk i QA. Ikke utvid til screening — QA-steget dekker behovet.

---

### 5. Message Batches API

**Hva:** Asynkron batchbehandling av opptil 10 000 forespørsler. 50% rabatt på tokens. Ferdigstilles innen 24 timer (typisk <1 time).

**Analyse for Paragraf:**

| Modul | Batch-egnet? | Begrunnelse |
|-------|-------------|-------------|
| `screening.py` | **Ja, men...** | Screener 5–30 saker parallelt. 50% rabatt er attraktivt. Men: brukeren venter på SSE-streaming av resultater i sanntid. |
| `eu_screening.py` | Mulig | Samme mønster som screening, men færre saker (typisk 3–10). |
| `qa.py` | Mulig | 3 uavhengige kall. Men: brukeren venter på QA-rapport. |
| Alle andre | Nei | Enkelt-kall der brukeren venter på svar. |

**Avveiing:**
- **50% rabatt** er betydelig for screening av mange saker (typisk 10–30 kall per analyse)
- Screening er en stor analysejobb — brukeren forventer ikke umiddelbar respons
- Dagens SSE-streaming gir progressiv tilbakemelding, men dette er «nice to have», ikke kritisk
- Batch API ferdigstiller typisk innen 1 time, ofte raskere — akseptabelt for en analysejobb
- Prompt caching stacker med batch-rabatt: 50% batch + 90% cache-read = potensielt 95% besparelse
- QA-modulens 3 parallelle kall er også en naturlig batch-kandidat

**Implementeringsstrategi:**
1. **Screening:** Erstatt `ThreadPoolExecutor` med batch-innsending. Poll for status, oppdater UI via polling eller push når ferdig.
2. **QA:** Send 3 QA-kall som én batch (sitatverifisering, logikk, dekning).
3. **EU-screening:** Samme mønster som KOFA-screening.
4. **Frontend:** Endre fra SSE-streaming til en «jobb pågår»-status med polling. Vis resultater samlet når batch er ferdig.

**UX-endring:**
- Nåværende: Resultater tikker inn én etter én via SSE (1–3 min)
- Ny: «Screening pågår…» → resultater vises samlet når ferdig (typisk <1 time, ofte minutter)
- Progressbar basert på batch-status polling (`processing_status` har `request_counts`)

**Beslutning:** **Implementer.** 50% kostnadsbesparelse på den tyngste API-bruken rettferdiggjør UX-endringen. Screening, EU-screening og QA er alle gode kandidater. Behold sanntids-SSE for chat (som er interaktiv).

---

### 6. Extended thinking / Adaptive reasoning

**Hva:** Lar Claude tenke steg-for-steg før den svarer. `thinking={"type": "adaptive"}` (anbefalt for Claude 4+) lar Claude selv bestemme resonneringsdybde.

**Begrensninger:**
- Krever `max_tokens` stor nok for thinking + svar
- Thinking-tokens faktureres (men til lavere pris)
- **Kan ikke kombineres med `output_config.format` (structured output)** i Sonnet-modeller

**Kritisk funn:** Extended thinking er **inkompatibelt med structured output** for claude-sonnet-4-6. Siden alle våre kall (unntatt chat) bruker structured output, er extended thinking ikke tilgjengelig for disse.

**Chat-analyse:**
- Chat bruker streaming uten structured output → **kan** bruke extended thinking
- Men: chat er interaktiv sparring med lav responstid-forventning
- Extended thinking ville gi bedre resonnering men tregere opplevd responstid

**Syntese-analyse:**
- Syntese er den mest komplekse oppgaven og ville tjene mest på extended thinking
- Men: bruker structured output → inkompatibelt

**Beslutning:** **Ikke implementer.** Inkompatibilitet med structured output gjør det uaktuelt for de fleste moduler. For chat er avveiningen feil — responstid trumfer dybde i en interaktiv kontekst. Revurder hvis Anthropic fjerner begrensningen med structured output.

---

### 7. Klient-konsolidering

**Nåtilstand:**
- `llm_utils.py`: Singleton `_anthropic_client` med 120s timeout via `get_anthropic_client()`
- `scoping.py`: Oppretter egen `anthropic.Anthropic(api_key=..., timeout=60.0)`
- `curation.py`: Oppretter egen `anthropic.Anthropic(api_key=...)`

**Problemer:**
- Tre separate klient-instanser = tre separate connection pools
- `scoping.py` har 60s timeout vs 120s standard — scoping er en enkel oppgave, men timeout bør være konsistent
- `curation.py` mangler eksplisitt timeout

**Beslutning:** Konsolider alle til `get_anthropic_client()`. Scoping og curation bør bruke `call_claude_structured()` der mulig.

---

### 8. XML-strukturerte prompts

**Nåtilstand:** 8 av 9 moduler bruker XML-tags (`<instructions>`, `<task>`, `<formatting_rules>`, `<case>`, etc.) i system- og user-prompts. `curation.py` bruker ren fritekst.

**Anbefaling:** Legg til XML-tags i `curation.py` for konsistens. Claude presterer bedre med strukturert prompt-format.

---

### 9. PDF-støtte

**Hva:** Støtter base64-kodet PDF som `document`-blokk. Maks 32 MB, 100 sider.

**Relevans for Paragraf:** Lav. Paragraf jobber med strukturert tekst fra Supabase (KOFA-avgjørelser lagret som avsnitt). Ingen PDF-inntaksbehov identifisert.

**Beslutning:** Ikke aktuelt nå. Kan bli relevant hvis brukere vil laste opp egne dokumenter.

---

### 10. Vertex AI

**Hva:** Claude tilgjengelig via Google Cloud Vertex AI. Samme prising, data forblir i valgt GCP-region.

**Relevans:** Paragraf kjører allerede på GCP Cloud Run (europe-north1). Vertex AI ville gi:
- Data i EU-region (compliance)
- GCP-fakturering (én faktura)
- Potensielt lavere latens fra europe-west1

**Avveiing:**
- Krever `AnthropicVertex`-klient og Google auth setup
- Marginalt mer kompleks konfigurering
- Samme prising — ingen kostnadsgevinst

**Beslutning:** **Vurder senere.** Ikke prioritert nå, men relevant ved GDPR/compliance-krav. Dokumenter som mulighet.

---

## Handlingsplan

### Prioritet 1 — Direkte fikser (lav risiko, høy verdi)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 1 | Eksplisitt effort | `post_search.py` | Legg til `effort="medium"` |
| 2 | Eksplisitt effort | `cross_propositions.py` | Legg til `effort="high"` |
| 3 | Konsolider klient | `scoping.py` | Bruk `get_anthropic_client()` og `call_claude_structured()` |

### Prioritet 2 — Moderniser curation (middels risiko)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 4 | Refaktorer Claude-variant | `curation.py` | Bruk `call_claude_structured()` med `CURATION_SCHEMA` |
| 5 | XML-tags | `curation.py` | Legg til `<instructions>`, `<task>`, `<formatting_rules>` |
| 6 | Fjern regex-fallback | `curation.py` | Structured output garanterer valid JSON |

### Prioritet 3 — Chat effort (lav risiko)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 7 | Effort i streaming | `chat.py` | Legg til effort-parameter (krever sjekk av streaming API-støtte) |

### Prioritet 4 — Batch API (middels risiko, høy kostnadsgevinst)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 8 | Batch-hjelpefunksjon | `llm_utils.py` | `submit_batch()` og `poll_batch()` med `client.messages.batches` |
| 9 | Batch-screening | `screening.py` | Erstatt `ThreadPoolExecutor` med batch-innsending |
| 10 | Batch-QA | `qa.py` | Send 3 QA-kall som én batch |
| 11 | Batch EU-screening | `eu_screening.py` | Samme mønster som KOFA-screening |
| 12 | Backend polling-endepunkt | `app.py` | `GET /api/analyses/:id/batch-status` for frontend-polling |
| 13 | Frontend jobb-status | `AnalysisState` + UI | «Screening pågår…» med progressbar, vis resultater samlet |

### Ikke prioritert nå

| Funksjon | Begrunnelse |
|----------|-------------|
| Extended thinking | Inkompatibelt med structured output |
| PDF-støtte | Ingen brukstilfelle identifisert |
| Vertex AI | Ingen compliance-krav identifisert |
| Citations i screening | QA-steget dekker behovet |
| 1-timers cache TTL | Marginal gevinst; 5 min dekker typisk bruksmønster |

---

## Kostnadsimplikasjoner

**Effort-fikser:**
- `post_search.py` high→medium: ~20-30% færre output-tokens per kall
- `chat.py` med medium: Raskere respons, noe færre tokens

**Batch API (screening + QA + EU-screening):**
- 50% rabatt på alle tokens — dette er den største kostnadsposten i appen
- Typisk analyse: 15–25 screening-kall + 3 QA-kall + 5–10 EU-screening-kall
- Estimert besparelse: ~50% av total Claude-kostnad per analyse
- Stacker med prompt caching: potensielt 90–95% besparelse på cached+batched kall

**Klient-konsolidering:**
- Ingen direkte kostnadseffekt, men bedre connection pooling

**Curation-modernisering:**
- Prompt caching: ~90% besparelse på system-prompt-tokens ved gjentatte kall
- Structured output: Eliminerer feilede JSON-parsinger (indirekte kostnadsbesparelse ved å unngå retries)

---

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|-----------|
| Effort-endring påvirker kvalitet | Lav | Middels | `post_search` er forslag, ikke endelig analyse — medium er tilstrekkelig |
| Curation-refaktorering bryter Gemini-path | Lav | Lav | Gemini-varianten er uavhengig (`_call_gemini`) og forblir uendret |
| Scoping med `call_claude_structured` endrer timeout | Lav | Lav | `get_anthropic_client()` har 120s timeout — mer enn tilstrekkelig for scoping |
| Batch API gir tregere brukeropplevelse | Middels | Middels | Progressbar + «jobb pågår»-UX. Brukeren forventer ikke umiddelbar screening — det er en analysejobb |
| Batch-feil er vanskeligere å debugge | Lav | Middels | Logg `custom_id` per request. Håndter `errored`-status per request i batch-resultat |
| Batch API validerer asynkront | Lav | Middels | Valider input lokalt før innsending. Håndter feilede enkeltforespørsler gracefully |

---

## Referanser

- [Anthropic API: Messages](https://docs.anthropic.com/en/api/messages)
- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Structured Output](https://docs.anthropic.com/en/docs/build-with-claude/structured-output)
- [Citations](https://docs.anthropic.com/en/docs/build-with-claude/citations)
- [Streaming](https://docs.anthropic.com/en/docs/build-with-claude/streaming)
- [Batches](https://docs.anthropic.com/en/docs/build-with-claude/batches)
- [Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/reasoning)
- [PDF Support](https://docs.anthropic.com/en/docs/build-with-claude/pdf-support)
- [Vertex AI](https://docs.anthropic.com/en/api/claude-on-vertex-ai)
