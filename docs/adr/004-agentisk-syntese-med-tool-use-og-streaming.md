# ADR-004: Agentisk syntese med tool use, streaming og strukturert output

**Dato:** 2026-03-17
**Status:** Implementert (Fase 1+2+3)
**Kontekst:** Oppfølging av ADR-001 (API-optimalisering) og ADR-002 (Haiku QA). Vurderer overgang fra enkelt strukturert kall til agentisk mønster med tool use for syntese-modulen.

---

## Problemstilling

Syntese-modulen (`synthesis.py`) komprimerer i dag all kontekst inn i ett enkelt API-kall. Komprimeringen bruker et capsule-mønster (A→full, B→komprimert, C→minimal) for å holde token-budsjettet under ~20k. Dette gir tre problemer:

1. **Informasjonstap**: B- og C-saker mister nyanser som kan være avgjørende for juridisk analyse
2. **Ingen adaptivitet**: Claude kan ikke hente mer kontekst når den oppdager at en sak er viktigere enn antatt
3. **Ingen transparens**: Brukeren ser et spinner-ikon i 15-30 sekunder uten innsikt i hva som skjer

### Ny mulighet

Anthropic API støtter nå **tool use + structured output + streaming** i samme kall. Dette muliggjør et agentisk mønster der Claude starter med komprimerte capsules, men kan hente fulltekst on-demand — med sanntids-feedback til brukeren.

---

## 1. API-kompatibilitet (verifisert mars 2026)

### Structured output + tool use = kompatibelt

Fra [Anthropic-dokumentasjonen](https://platform.claude.com/docs/en/build-with-claude/structured-outputs):

> When combined, Claude can call tools with guaranteed-valid parameters AND return structured JSON responses. This is useful for agentic workflows where you need both reliable tool calls and structured final outputs.

**Parameter-syntaks (GA, ingen beta-header nødvendig):**

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=12000,
    # Structured output for sluttrespons
    output_config={
        "format": {
            "type": "json_schema",
            "schema": synthesis_schema,
        },
        "effort": "high",
    },
    # Tool-definisjoner med strict mode
    tools=[{
        "name": "fetch_case_paragraphs",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "sak_nr": {"type": "string"},
                "paragraph_nrs": {"type": "array", "items": {"type": "integer"}},
            },
            "required": ["sak_nr"],
            "additionalProperties": False,
        },
    }],
    system=[...],
    messages=[...],
)
```

`strict: True` garanterer at tool-input alltid matcher skjemaet. `output_config.format` garanterer at sluttresponsen er gyldig JSON.

### Streaming + tool use = kompatibelt

Fra [streaming-dokumentasjonen](https://platform.claude.com/docs/en/api/streaming):

Streaming-events følger denne flyten:

1. `message_start` — tom Message
2. Per content block:
   - `content_block_start` — type `text` eller `tool_use` (med `name` og `id`)
   - `content_block_delta` — `text_delta` (tekst) eller `input_json_delta` (partial JSON for tool-input)
   - `content_block_stop`
3. `message_delta` — `stop_reason` (`end_turn` eller `tool_use`)
4. `message_stop`

**Viktig for tool use**: Når `stop_reason == "tool_use"`, må vi:
1. Eksekvere tool-kallet
2. Sende `tool_result` tilbake som brukermelding
3. Fortsette streaming-loopen

### Oppdatert kompatibilitetsmatrise

| | Structured Output | Tool Use | Streaming | Prompt Caching | Citations |
|---|---|---|---|---|---|
| **Structured Output** | — | Kompatibelt | Kompatibelt | Kompatibelt | **Inkompatibelt** |
| **Tool Use** | Kompatibelt | — | Kompatibelt | Kompatibelt | Kompatibelt |
| **Streaming** | Kompatibelt | Kompatibelt | — | Kompatibelt | Kompatibelt |
| **Prompt Caching** | Kompatibelt | Kompatibelt | Kompatibelt | — | Kompatibelt |

### Modellstøtte

| Funksjon | Sonnet 4.6 | Haiku 4.5 | Opus 4.6 |
|----------|-----------|-----------|----------|
| Structured Output (`output_config`) | GA | GA | GA |
| Strict Tool Use (`strict: true`) | GA | GA | GA |
| Effort | Ja | **Nei** | Ja |
| Prompt Caching (min. tokens) | 2048 | 4096 | 4096 |

**Kilde**: [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

---

## 2. Arkitektur: agentisk syntese

### Nåværende flyt (ett kall)

```
Frontend → POST /api/synthesize → synthesis.py
  1. Last kontekst fra DB (kandidater, proposisjoner, gaps)
  2. Komprimer til capsules (A=full, B=komprimert, C=minimal)
  3. call_claude_structured() — ett kall, ~15-30s
  4. Returner JSON til frontend
```

### Foreslått flyt (agentisk loop med streaming)

```
Frontend → POST /api/synthesize → SSE-stream
  1. Last kontekst fra DB
  2. Komprimer til capsules (alle kategorier)
  3. Start streaming agentic loop:
     a. Claude analyserer capsules
     b. Claude kaller fetch_case_paragraphs() for B/C-saker med interessante nyanser
     c. Backend eksekverer tool, returnerer avsnitt
     d. Claude fortsetter analyse med ny kontekst
     e. Gjenta til Claude har nok informasjon
     f. Claude produserer strukturert syntese-JSON
  4. Stream events til frontend underveis
```

### Tool-definisjoner

```python
SYNTHESIS_TOOLS = [
    {
        "name": "fetch_case_paragraphs",
        "description": (
            "Hent spesifikke avsnitt fra en KOFA-sak. Bruk dette verktøyet når "
            "du trenger mer kontekst om en sak enn det capsule-sammendraget gir — "
            "for eksempel for å verifisere et juridisk poeng, sammenligne faktum, "
            "eller forstå nyanser i klagenemndas resonnement."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "sak_nr": {
                    "type": "string",
                    "description": "Saksnummer, f.eks. '2023/456'",
                },
                "paragraph_nrs": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": (
                        "Spesifikke avsnittsnumre å hente. Utelat for å hente "
                        "alle avsnitt (maks 50)."
                    ),
                },
            },
            "required": ["sak_nr"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fetch_provision_cases",
        "description": (
            "Hent liste over saker som refererer til en spesifikk lovbestemmelse. "
            "Bruk for å sjekke om det finnes flere relevante saker du ikke har sett."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "dok_id": {"type": "string", "description": "Dokument-ID for loven"},
                "section_id": {"type": "string", "description": "Paragraf-ID, f.eks. '§ 7-9'"},
            },
            "required": ["dok_id", "section_id"],
            "additionalProperties": False,
        },
    },
]
```

### Backend-implementering: agentisk streaming-loop

```python
# synthesis.py — foreslått implementering

def generate_synthesis_stream(analysis_id: str):
    """Agentisk syntese med tool use og streaming."""
    # 1. Last kontekst (uendret fra dagens kode)
    context = _load_synthesis_context(analysis_id)
    user_message = _format_capsules(context)

    messages = [{"role": "user", "content": user_message}]

    # 2. Agentisk loop
    while True:
        with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=12000,
            output_config=build_output_config(
                schema=SYNTHESIS_SCHEMA, effort="high", model=CLAUDE_MODEL
            ),
            tools=SYNTHESIS_TOOLS,
            system=[{
                "type": "text",
                "text": SYNTHESIS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        ) as stream:
            # Samle opp respons for message-historikk
            collected_text = []
            collected_tool_calls = []

            for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "tool_use":
                        # Fortell frontend at vi henter mer data
                        yield sse_event("status", {
                            "tool": event.content_block.name,
                            "id": event.content_block.id,
                        })
                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        yield sse_event("text_delta", {"text": event.delta.text})
                    elif hasattr(event.delta, "partial_json"):
                        pass  # Akkumuleres av SDK

            # Hent ferdig melding
            response = stream.get_final_message()

        # 3. Legg til assistentens respons i historikk
        messages.append({"role": "assistant", "content": response.content})

        # 4. Sjekk om vi er ferdige
        if response.stop_reason == "end_turn":
            # Ekstraher strukturert syntese fra siste text-blokk
            final_text = next(
                (b.text for b in response.content if hasattr(b, "text")), None
            )
            log_usage(response.usage, CLAUDE_MODEL, f"Synthesis/{analysis_id}")
            yield sse_event("result", {"synthesis": json.loads(final_text)})
            yield sse_event("done", {})
            return

        # 5. Håndter tool calls
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                yield sse_event("tool_executing", {
                    "tool": block.name,
                    "input": block.input,
                })
                result = _execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
                yield sse_event("tool_done", {
                    "tool": block.name,
                    "summary": _summarize_tool_result(block.name, result),
                })

        messages.append({"role": "user", "content": tool_results})

        # Logg mellom-kall
        log_usage(response.usage, CLAUDE_MODEL, f"Synthesis/{analysis_id}/tool-turn")


def _execute_tool(name: str, input: dict) -> dict:
    """Dispatch tool call til database-funksjoner."""
    if name == "fetch_case_paragraphs":
        return _fetch_paragraphs(input["sak_nr"], input.get("paragraph_nrs"))
    elif name == "fetch_provision_cases":
        return _fetch_provision_cases(input["dok_id"], input["section_id"])
    raise ValueError(f"Unknown tool: {name}")
```

### Flask SSE-endpoint

```python
# app.py — ny rute

@app.route("/api/analyses/<analysis_id>/synthesize-stream", methods=["POST"])
def synthesize_stream(analysis_id: str):
    """Streaming agentisk syntese med live feedback."""
    def generate():
        try:
            for event_type, data in generate_synthesis_stream(analysis_id):
                yield f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("Synthesis stream error")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx: ikke buffer SSE
        },
    )
```

---

## 3. Frontend: live feedback

### SSE-event-typer

| Event | Payload | UI-effekt |
|-------|---------|-----------|
| `status` | `{tool, id}` | Vis "Henter avsnitt fra sak X..." |
| `tool_executing` | `{tool, input}` | Vis spinner + saksnummer |
| `tool_done` | `{tool, summary}` | Vis checkmark + kort sammendrag |
| `text_delta` | `{text}` | Append til syntese-tekst (streaming) |
| `result` | `{synthesis}` | Ferdig strukturert JSON — oppdater UI |
| `done` | `{}` | Lukk EventSource |
| `error` | `{message}` | Vis feilmelding |

### Svelte-komponent (skisse)

```svelte
<script lang="ts">
  let statusMessages = $state<{tool: string; done: boolean; summary?: string}[]>([]);
  let streamedText = $state('');
  let synthesisResult = $state<SynthesisResult | null>(null);
  let isStreaming = $state(false);

  function startSynthesis(analysisId: string) {
    isStreaming = true;
    const source = new EventSource(`/api/analyses/${analysisId}/synthesize-stream`);

    source.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      statusMessages.push({ tool: data.tool, done: false });
    });

    source.addEventListener('tool_done', (e) => {
      const data = JSON.parse(e.data);
      const msg = statusMessages.findLast(m => m.tool === data.tool);
      if (msg) { msg.done = true; msg.summary = data.summary; }
    });

    source.addEventListener('text_delta', (e) => {
      streamedText += JSON.parse(e.data).text;
    });

    source.addEventListener('result', (e) => {
      synthesisResult = JSON.parse(e.data).synthesis;
    });

    source.addEventListener('done', () => {
      isStreaming = false;
      source.close();
    });

    source.addEventListener('error', () => {
      isStreaming = false;
      source.close();
    });
  }
</script>

{#if isStreaming}
  <div class="synthesis-progress">
    {#each statusMessages as msg}
      <div class="status-line">
        {#if msg.done}
          <span class="check">&#10003;</span>
        {:else}
          <span class="spinner" />
        {/if}
        <span>{_toolLabel(msg.tool)}</span>
        {#if msg.summary}
          <span class="summary">{msg.summary}</span>
        {/if}
      </div>
    {/each}
    {#if streamedText}
      <div class="streamed-preview">{streamedText}</div>
    {/if}
  </div>
{/if}
```

---

## 4. Prompt caching-strategi

### Hva som caches

System-prompten (~2000 tokens) og tool-definisjonene er identiske mellom turns i den agentiske loopen. Med `cache_control: {"type": "ephemeral"}` (5 min TTL) caches disse automatisk.

```python
system=[{
    "type": "text",
    "text": SYNTHESIS_SYSTEM_PROMPT,
    "cache_control": {"type": "ephemeral"},  # Caches i 5 min
}]
```

Fra [prompt caching-dokumentasjonen](https://platform.claude.com/docs/en/build-with-claude/prompt-caching):

| Komponent | Pris vs standard |
|-----------|-----------------|
| Cache write (5 min) | 1.25x |
| Cache read | 0.10x (90% rabatt) |

For den agentiske loopen: Første turn betaler 1.25x for system+tools. Påfølgende turns (2-5 typisk) betaler 0.10x — **90% besparelse** på ~2000 tokens per turn.

### Min. cachebar størrelse

Sonnet 4.6 krever minimum 2048 tokens for caching. System-prompten for syntese er ~2000 tokens — akkurat på grensen. Vurder å legge tool-definisjoner i system-blokken for å nå minimum.

---

## 5. Kostnadsanalyse

### Antagelser

- Typisk syntese: 12 kandidatsaker, ~8k input tokens (capsules), ~4k output tokens
- Agentisk: 2-4 tool calls (henter avsnitt for B/C-saker), ~2k ekstra input per call
- Modell: Sonnet 4.6

### Scenario: enkel syntese (3 tool calls)

| Turn | Input tokens | Output tokens | Cache | Kostnad |
|------|-------------|---------------|-------|---------|
| 1 (initial + 1 tool call) | 10 000 | 500 | Write 2k | $0.038 |
| 2 (tool result + 1 tool call) | 12 500 | 300 | Read 2k | $0.034 |
| 3 (tool result + final) | 15 000 | 4 000 | Read 2k | $0.101 |
| **Totalt** | | | | **$0.173** |

### Sammenligning

| Tilnærming | Typisk kostnad | Kvalitet |
|------------|---------------|----------|
| Dagens (ett kall) | ~$0.084 | B/C-saker mangler nyanser |
| Agentisk (3 tool calls) | ~$0.17 | Claude henter det den trenger |
| Agentisk (5 tool calls) | ~$0.25 | Omfattende kryssverifisering |

**Merkostnad: ~$0.09-0.17 per syntese** (~2-3x). For en analyse med 5 bestemmelser: ~$0.85-1.25 ekstra.

### Mitigering

- **Token-budsjett på tool calls**: Begrens til maks 5 tool calls per syntese (`tool_choice: auto`, men stopp loopen etter N turns)
- **Caching**: System-prompt og tools caches mellom turns (90% rabatt)
- **Capsule-optimering**: Bedre initiale capsules reduserer behovet for tool calls

---

## 6. Risikovurdering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|-----------|
| Claude bruker for mange tool calls (kostnad) | Middels | Middels | Max 5 turns, tydelig prompt-instruks om parsimoni |
| Økt latens (30s → 45-60s) | Høy | Lav | Streaming gir umiddelbar feedback — opplevd ventetid reduseres |
| Tool call returnerer for mye data (token overflow) | Lav | Middels | Begrens avsnitt per call (maks 50), trunkér lange avsnitt |
| SSE-connection dropper | Middels | Middels | Frontend retry-logikk, idempotent backend |
| Structured output + tool use viser seg ustabilt | Lav | Høy | Fallback til dagens enkelt-kall ved feil |
| System-prompt under cache-minimum (2048 tok) | Lav | Lav | Inkluder tool-definisjoner i cachebart prefix |

---

## 7. Migrasjonsstrategi

### Fase 1: Tool use uten streaming (lavest risiko)

Legg til tools i `call_claude_structured()`. Implementer agentisk loop med blocking kall. Ingen frontend-endringer — brukeren ser fortsatt spinner.

**Verdi**: Bedre syntese-kvalitet. Ingen UI-arbeid.

### Fase 2: SSE-streaming med live feedback

Bytt til streaming-variant. Nytt endpoint `/api/analyses/<id>/synthesize-stream`. Frontend viser tool-progress.

**Verdi**: Transparens og opplevd hastighet.

### Fase 3: Bruker-avbryting

Frontend kan sende abort-signal. Backend avbryter pågående stream.

**Verdi**: Bruker-kontroll ved feil retning.

---

## Handlingsplan

### Prioritet 0 — Agentisk loop (backend)

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 1 | Definer `SYNTHESIS_TOOLS` med `fetch_case_paragraphs` og `fetch_provision_cases` | `synthesis.py` | Ny konstant med tool-definisjoner, `strict: True` |
| 2 | Implementer `_execute_tool()` dispatcher | `synthesis.py` | Router tool-kall til eksisterende DB-funksjoner |
| 3 | Implementer agentisk loop (blocking) | `synthesis.py` | While-loop med tool-håndtering, maks 5 turns |
| 4 | Utvid `build_output_config()` for tools | `llm_utils.py` | Ingen endring nødvendig — tools er separat parameter |

### Prioritet 1 — SSE-streaming

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 5 | Implementer `generate_synthesis_stream()` generator | `synthesis.py` | Streaming-variant med SSE-events |
| 6 | Nytt endpoint `/api/analyses/<id>/synthesize-stream` | `app.py` | Flask SSE-rute |
| 7 | Frontend EventSource-integrasjon | `SynthesisPanel.svelte` | Konsumer SSE, vis tool-progress |

### Prioritet 2 — Polish og kontroll

| # | Handling | Fil | Endring |
|---|---------|-----|---------|
| 8 | Max-turn-begrensning med tydelig prompt-instruks | `synthesis.py` | Stopp loop etter N turns |
| 9 | Kostnadslogging per agentisk sesjon | `llm_utils.py` | `CostTracker` fra ADR-003 |
| 10 | Fallback til enkelt-kall ved streaming-feil | `synthesis.py` | Try/except rundt agentisk loop |

---

## Beslutningstabell

| Aspekt | Beslutning | Begrunnelse |
|--------|-----------|-------------|
| Modell for agentisk syntese | Sonnet 4.6 | Støtter effort + structured output + tools |
| Maks tool-turns | 5 | Begrens kostnad, typisk 2-3 er nok |
| Cache-strategi | `ephemeral` (5 min) | Nok for agentisk loop (alle turns innen 2 min) |
| Structured output | `output_config.format.json_schema` | GA, ingen beta-header |
| Strict tool use | `strict: True` | Garanterer validerte tool-inputs |
| Streaming-protokoll | SSE (Server-Sent Events) | Allerede brukt i `chat.py`, Flask-kompatibelt |
| Fallback | Enkelt-kall (dagens `generate_synthesis`) | Ved API-feil eller timeout |

---

## Referanser

- [ADR-001: Anthropic API-optimalisering](001-anthropic-api-optimalisering.md)
- [ADR-002: Haiku-agenter for QA og batch](002-haiku-citation-qa-og-batch-oppdeling.md)
- [ADR-003: Pipeline-forbedringer](003-pipeline-forbedringer.md)
- [Streaming Messages — Anthropic](https://platform.claude.com/docs/en/api/streaming)
- [Structured Outputs — Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Tool Use — Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Prompt Caching — Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
