# ADR-003: Pipeline-forbedringer — token-logging, effort-kompatibilitet og operasjonell robusthet

**Dato:** 2026-03-16
**Status:** Implementert (P0–P3 fullført)
**Kontekst:** Oppfølging av ADR-001 og ADR-002, med fokus på operasjonelle forbedringer

---

## Problemstilling

ADR-001 og ADR-002 fokuserer på API-strategi (Citations, Batch, Haiku). Denne ADR-en adresserer tverrgående problemer som påvirker hele pipelinen:

1. **Effort-parameteren støttes ikke av Haiku 4.5** — koden sender `effort` til alle modeller uten sjekk
2. **Token-logging mangler prisberegning** — vi logger token-tall men ikke faktisk kostnad
3. **Manglende `cache_creation_input_tokens`** — vi logger bare `cache_read` men ikke cache-skriving
4. **Ingen aggregert kostnadsrapport** per analyse
5. **Dupliserte DB-spørringer** i screening og QA
6. **Manglende feilhåndtering** i flere moduler
7. **Sekvensielle kall** som kan parallelliseres

---

## 1. Effort-parameter og Haiku-kompatibilitet

### Funn

Fra [Anthropic-dokumentasjonen](https://platform.claude.com/docs/en/build-with-claude/effort):

> The effort parameter is supported by Claude Opus 4.6, Claude Sonnet 4.6, and Claude Opus 4.5.

**Haiku 4.5 støtter ikke effort.** Å sende `effort` til Haiku vil enten gi feil eller bli ignorert.

### Konsekvens for ADR-002

ADR-002 foreslår Haiku for QA med `effort="medium"`. Dette må endres — enten:
- **A)** Ikke send `output_config.effort` når modell er Haiku
- **B)** Send uten effort og la Haiku bruke sin default-adferd

### Anbefalt implementering

```python
# llm_utils.py
EFFORT_SUPPORTED_MODELS = {"claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-5-20251022"}

def _build_output_config(
    schema: dict | None = None,
    effort: str | None = "high",
    model: str = CLAUDE_MODEL,
) -> dict:
    """Build output_config respecting model capabilities."""
    config = {}

    if schema:
        config["format"] = {"type": "json_schema", "schema": schema}

    # Only include effort for models that support it
    if effort and model in EFFORT_SUPPORTED_MODELS:
        config["effort"] = effort

    return config if config else {}
```

### Effort-anbefalinger per oppgave (oppdatert)

| Oppgave | Modell | Effort | Begrunnelse |
|---------|--------|--------|-------------|
| Screening | Sonnet 4.6 | `medium` | Anbefalt default for Sonnet — god balanse |
| EU-screening | Sonnet 4.6 | `medium` | Samme som screening |
| Synthesis | Sonnet 4.6 | `high` | Kompleks komposisjon — trenger full kapasitet |
| Cross-propositions | Sonnet 4.6 | `high` | Tverrgående syntese |
| QA sitatsjekk | Haiku 4.5 | *(ikke støttet)* | Citations API gjør tung-løftet |
| QA logikk/dekning | Haiku 4.5 | *(ikke støttet)* | Enkel klassifisering |
| Curation | Haiku 4.5 | *(ikke støttet)* | Enkel highlight-identifisering |
| Post-search | Sonnet 4.6 | `low` | Enkel gap-mønstergjenkjenning |
| Scoping | Sonnet 4.6 | `medium` | Strukturert klassifisering |
| Chat | Sonnet 4.6 | `low` | Interaktiv — latens viktigere enn dybde |

Sonnet-anbefalingene følger Anthropics egne retningslinjer:
- `medium`: *"Best balance of speed, cost, and performance for most applications"*
- `low`: *"For high-volume or latency-sensitive workloads"*
- `high`: *"For tasks requiring maximum intelligence"*

---

## 2. Token-logging med prisberegning

### Nåværende tilstand

`llm_utils.py` linje 69–75 logger:
```python
logger.info(
    "%s: %d input tokens (%d cached), %d output tokens",
    log_label,
    response.usage.input_tokens,
    getattr(response.usage, "cache_read_input_tokens", 0),
    response.usage.output_tokens,
)
```

**Mangler**:
- `cache_creation_input_tokens` — vi vet ikke hva cache-skriving koster
- Faktisk pris i USD — token-tall alene gir ingen kostnadsinnsikt
- Aggregering per analyse — ingen oversikt over total kostnad

### Prisliste fra Anthropic (per MTok, USD)

| Modell | Input | Output | Cache Write (5m) | Cache Read | Batch Input | Batch Output |
|--------|-------|--------|-----------------|------------|-------------|--------------|
| Sonnet 4.6 | $3.00 | $15.00 | $3.75 | $0.30 | $1.50 | $7.50 |
| Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 | $0.50 | $2.50 |
| Opus 4.6 | $5.00 | $25.00 | $6.25 | $0.50 | $2.50 | $12.50 |

**Kilde**: [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Anbefalt implementering

```python
# llm_utils.py — ny prisberegning

# Prices per million tokens (USD)
MODEL_PRICING = {
    "claude-sonnet-4-6": {
        "input": 3.00, "output": 15.00,
        "cache_write": 3.75, "cache_read": 0.30,
        "batch_input": 1.50, "batch_output": 7.50,
    },
    "claude-haiku-4-5-20251001": {
        "input": 1.00, "output": 5.00,
        "cache_write": 1.25, "cache_read": 0.10,
        "batch_input": 0.50, "batch_output": 2.50,
    },
}

def _calculate_cost(usage, model: str, is_batch: bool = False) -> float:
    """Calculate USD cost from API usage object."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-6"])

    input_price = pricing["batch_input"] if is_batch else pricing["input"]
    output_price = pricing["batch_output"] if is_batch else pricing["output"]

    input_tokens = usage.input_tokens
    output_tokens = usage.output_tokens
    cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0

    # Subtract cached tokens from base input (they're billed separately)
    base_input = input_tokens - cache_read
    cost = (
        base_input * input_price / 1_000_000
        + output_tokens * output_price / 1_000_000
        + cache_creation * pricing["cache_write"] / 1_000_000
        + cache_read * pricing["cache_read"] / 1_000_000
    )
    return cost


def log_usage(usage, model: str, label: str, is_batch: bool = False) -> float:
    """Log token usage with cost. Returns cost in USD."""
    cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cost = _calculate_cost(usage, model, is_batch)

    logger.info(
        "%s [%s]: %d input (%d cache-write, %d cache-read), %d output — $%.4f",
        label,
        model.split("-")[1],  # "sonnet" / "haiku"
        usage.input_tokens,
        cache_creation,
        cache_read,
        usage.output_tokens,
        cost,
    )
    return cost
```

### Usage-objektets felter

Fra Anthropic API-responsen:

| Felt | Beskrivelse | Prisberegning |
|------|-------------|---------------|
| `input_tokens` | Totale input-tokens (inkl. cache-read) | `(input_tokens - cache_read) × input_price` |
| `output_tokens` | Output-tokens generert | `output_tokens × output_price` |
| `cache_creation_input_tokens` | Tokens skrevet til cache | `cache_creation × cache_write_price` |
| `cache_read_input_tokens` | Tokens lest fra cache | `cache_read × cache_read_price` |

**Viktig**: `input_tokens` inkluderer `cache_read_input_tokens`. For å beregne riktig pris må cache-read trekkes fra base input.

### Aggregert kostnadsrapport per analyse

```python
# Legg til i analyse-kontekst eller returner fra pipeline-steg
class CostTracker:
    """Track cumulative LLM costs for an analysis run."""

    def __init__(self):
        self.entries: list[dict] = []

    def add(self, label: str, model: str, usage, is_batch: bool = False):
        cost = log_usage(usage, model, label, is_batch)
        self.entries.append({
            "label": label,
            "model": model,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost_usd": cost,
        })

    @property
    def total_cost(self) -> float:
        return sum(e["cost_usd"] for e in self.entries)

    def summary(self) -> str:
        lines = [f"  {e['label']}: ${e['cost_usd']:.4f}" for e in self.entries]
        lines.append(f"  TOTAL: ${self.total_cost:.4f}")
        return "\n".join(lines)
```

---

## 3. Dupliserte DB-spørringer

### screening.py — dobbel-henting av sakstekster

`_fetch_case_texts_batch()` henter alle sakstekster for batch-operasjonen. Deretter henter `screen_single_case()` **de samme tekstene enkeltvis** via `_fetch_case_text()`.

**Nåværende flyt**:
```
_fetch_case_texts_batch() → {sak_nr: text}  (for batch)
  ↓
screen_single_case() → _fetch_case_text(sak_nr)  (per sak, ny spørring)
```

**Anbefalt**: La `screen_single_case()` akseptere pre-hentet tekst som parameter. Hent alle tekster én gang, distribuer til parallelle kall.

### qa.py — dobbel-henting av kandidater

`_load_qa_inputs()` (linje 374–405) henter kandidater og bygger kontekst. `_build_citation_batch_request()` (linje 468–502) henter **de samme kandidatene på nytt** for batch-varianten.

**Anbefalt**: Refaktorer til én `_load_qa_inputs()` som returnerer alt QA trenger, og del resultatet mellom sanntids- og batch-stier.

---

## 4. Feilhåndtering

### Moduler uten try/except rundt LLM-kall

| Modul | Konsekvens | Anbefalt handling |
|-------|-----------|-------------------|
| `eu_screening.py` | 500-feil til klienten | Wrap i try/except, returner feil-dict per sak |
| `synthesis.py` | 500-feil til klienten | Wrap, returner meningsfull feilmelding |
| `cross_propositions.py` | 500-feil til klienten | Wrap, returner feil-dict |

### Transient API-feil uten retry

`screening.py` fanger feil per sak men prøver ikke på nytt. En transient 429 eller 500 feiler saken permanent.

**Anbefalt**: Legg til retry-dekorator i `llm_utils.py`:

```python
import time

def retry_on_transient(fn, max_retries=2, backoff_base=2):
    """Retry on transient API errors (429, 500, 529)."""
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except anthropic.RateLimitError:
            if attempt == max_retries:
                raise
            wait = backoff_base ** attempt
            logger.warning("Rate limited, retrying in %ds...", wait)
            time.sleep(wait)
        except anthropic.InternalServerError:
            if attempt == max_retries:
                raise
            wait = backoff_base ** attempt
            logger.warning("Server error, retrying in %ds...", wait)
            time.sleep(wait)
```

Alternativt: bruk Anthropic Python SDK sin innebygde retry-mekanisme (`max_retries` parameter på klienten).

---

## 5. Sekvensielle kall som kan parallelliseres

### chat.py — kontekst-lasting

Linje 57–74 laster kandidater, proposisjoner og syntese-notat sekvensielt per melding.

```python
# Nåværende (sekvensiell)
candidates = _load_candidates(...)      # DB-kall
propositions = _load_propositions(...)  # DB-kall
note = _load_synthesis_note(...)        # DB-kall

# Anbefalt (parallell)
with ThreadPoolExecutor(max_workers=3) as pool:
    f_cand = pool.submit(_load_candidates, ...)
    f_prop = pool.submit(_load_propositions, ...)
    f_note = pool.submit(_load_synthesis_note, ...)
    candidates = f_cand.result()
    propositions = f_prop.result()
    note = f_note.result()
```

### synthesis.py — uavhengige data-lasting

`_load_propositions()` og `_format_user_notes()` er uavhengige og kan parallelliseres.

---

## 6. Manglende output-caching

Kun `curation.py` cacher LLM-resultater (via `curation_cache.py`). Andre moduler betaler full Claude-pris ved regenerering med identiske inputs.

**Kandidater for output-caching**:

| Modul | Cache-nøkkel | Invalidering |
|-------|-------------|--------------|
| `synthesis.py` | `hash(candidates + propositions + problem)` | Ved ny screening/cross-props |
| `cross_propositions.py` | `hash(screenings + problem)` | Ved ny screening |
| `post_search.py` | `hash(screenings + gaps + problem)` | Ved ny screening |
| `qa.py` | `hash(note + screenings + candidates)` | Ved ny syntese |

**Anbefalt**: Utvid `curation_cache.py`-mønsteret til en generisk `llm_cache.py` med hash-basert lookup.

---

## 7. Hardkodede verdier

| Verdi | Fil:linje | Nåværende | Anbefalt |
|-------|-----------|-----------|----------|
| Modellnavn | `llm_utils.py:11` | `"claude-sonnet-4-6"` | `os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")` |
| Max parallelle screening | `screening.py:242` | `3` | `int(os.environ.get("MAX_PARALLEL_SCREENING", "3"))` |
| Token-budget syntese | `synthesis.py:152` | `20000` | Env var |
| Maks saker citation QA | `qa.py:226` | `8` | Env var eller konstant med navn |
| Chat note-trunkering | `chat.py:120` | `3000` chars | Env var |
| Curation max chars | `curation.py:11` | `12000` | Env var |

Modellnavn som env var er spesielt nyttig for å teste Haiku-bytte uten kodendring.

---

## Handlingsplan

### Prioritet 0 — Effort-kompatibilitet (blokkerer ADR-002)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 1 | Bygg `_build_output_config()` med modellsjekk | `llm_utils.py` | Ny helper som bare inkluderer effort for støttede modeller |
| 2 | Oppdater `call_claude_structured()` | `llm_utils.py` | Legg til `model`-parameter, bruk `_build_output_config()` |
| 3 | Oppdater `build_batch_request()` | `llm_utils.py` | Legg til `model`-parameter, bruk `_build_output_config()` |

### Prioritet 1 — Token-logging med pris (høy verdi, lav risiko)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 4 | Legg til `MODEL_PRICING` og `_calculate_cost()` | `llm_utils.py` | Pristabell + kostnadsberegning |
| 5 | Legg til `log_usage()` med cache_creation | `llm_utils.py` | Erstatt inline logger.info i alle call-sites |
| 6 | Legg til `CostTracker` klasse | `llm_utils.py` | Aggregert kostnad per analyse |
| 7 | Oppdater `get_batch_results()` | `llm_utils.py` | Logg pris per batch-resultat |

### Prioritet 2 — Robusthet (middels verdi)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 8 | Retry-mekanisme for transient feil | `llm_utils.py` | Dekorator eller SDK `max_retries` |
| 9 | Try/except i eu_screening, synthesis, cross_props | Diverse | Wrap LLM-kall, returner feil-dict |
| 10 | Fjern dupliserte DB-spørringer | `screening.py`, `qa.py` | Pre-hent og del data |

### Prioritet 3 — Ytelse og caching (lavere prioritet)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 11 | Parallelliser chat-kontekst-lasting | `chat.py` | ThreadPoolExecutor for DB-kall |
| 12 | Output-caching for synthesis/cross-props | `llm_cache.py` (ny) | Hash-basert cache etter curation-mønster |
| 13 | Flytt hardkodede verdier til env vars | Diverse | Modellnavn, grenser, budsjetter |

---

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|-----------|
| Prisberegning avviker fra faktisk faktura | Middels | Lav | Estimat for innsikt, ikke fakturering. Oppdater MODEL_PRICING ved prisendring |
| Retry forlenger responstid | Middels | Middels | Max 2 retries med kort backoff. Synlig for bruker via SSE-progress |
| Output-cache serverer stale data | Lav | Middels | Invalider ved upstream-endring. TTL som ekstra sikkerhet |
| Effort-fjerning for Haiku gir annen adferd | Lav | Lav | Haiku har aldri støttet effort — ingen endring i praksis |

---

## Referanser

- [ADR-001: Anthropic API-optimalisering](001-anthropic-api-optimalisering.md)
- [ADR-002: Haiku-agenter for QA og batch](002-haiku-citation-qa-og-batch-oppdeling.md)
- [Effort — modellstøtte](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
