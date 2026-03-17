"""Synthesis — Sprint 15 + agentisk syntese (ADR-004 Fase 1).

Generates a legal analysis note (notatutkast) from screening results,
proposition registry, notes, and EU case summaries. Uses capsule compression
to stay within token budget. Agentic loop lets Claude fetch additional case
paragraphs on-demand via tool use.
"""
import json as json_module
import logging
import time

from db import get_client
from llm_cache import get_cached, set_cached, make_synthesis_hash
from llm_utils import (
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
    get_anthropic_client,
    build_output_config,
    log_usage,
    persist_llm_call,
    CostTracker,
    CLAUDE_MODEL,
)

logger = logging.getLogger(__name__)

DOC_TYPE_NOTE = "note"
DOC_TYPE_QA_REPORT = "qa_report"


class SynthesisError(Exception):
    """Raised when synthesis fails."""


SYNTHESIS_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Notatets tittel",
        },
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "heading": {
                        "type": "string",
                        "description": "Seksjonsoverskrift",
                    },
                    "content": {
                        "type": "string",
                        "description": "Seksjonens innhold i markdown-format",
                    },
                    "requires_lawyer_input": {
                        "type": "boolean",
                        "description": "True hvis seksjonen krever juristens egen vurdering",
                    },
                },
                "required": ["heading", "content", "requires_lawyer_input"],
                "additionalProperties": False,
            },
            "description": "Notatets seksjoner i rekkefølge",
        },
        "unresolved_tensions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "Beskrivelse av spenningen",
                    },
                    "cases": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Saker involvert i spenningen",
                    },
                },
                "required": ["description", "cases"],
                "additionalProperties": False,
            },
            "description": "Uløste spenninger som juristen bør ta stilling til",
        },
        "coverage_notes": {
            "type": "string",
            "description": "Vurdering av analysens dekning — hva mangler eventuelt",
        },
    },
    "required": ["title", "sections", "unresolved_tensions", "coverage_notes"],
    "additionalProperties": False,
}


SYNTHESIS_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du skriver utkast til rettslige analysenotater basert på systematisk screening \
av KOFA-avgjørelser og EU-dommer.

<instructions>
<role>
Du mottar komprimerte screeningresultater, rettssetningsregister med spenninger, \
gap-analyse, juristens notater og EU-dom-oppsummeringer. Din oppgave er å skrive \
et strukturert notatutkast som organiserer funnene systematisk.
</role>

<task name="title">
Gi notatet en presis, beskrivende tittel som reflekterer den juridiske \
problemstillingen.
</task>

<task name="sections">
Organiser notatet i seksjoner. Typisk struktur:
1. Problemstilling — kort oppsummering
2. Rettslig utgangspunkt — relevante bestemmelser med ordlyd
3-N. Systematisk gjennomgang per delproblemstilling — praksis, rettssetninger, \
    utvikling over tid
N+1. Spenninger og uavklarte spørsmål
N+2. Foreløpig vurdering / [JURISTENS VURDERING]

Skriv i markdown-format. Referer til saker som sak_nr (f.eks. «2024/2019, avsnitt 27»).

**Viktig:** Seksjoner som krever juristens egen rettslige vurdering eller konklusjon \
skal markeres med `requires_lawyer_input: true` og inneholde teksten \
«[JURISTENS VURDERING: beskriv hva som trengs]» på relevant sted. Du trekker ikke \
konklusjoner — du organiserer materialet.
</task>

<task name="unresolved_tensions">
List opp spenninger i praksisen som notatet ikke kan løse — motstridende \
rettssetninger, uavklart rettstilstand, dissenser. Dette gir juristen et \
kart over de vanskelige spørsmålene.
</task>

<task name="coverage_notes">
Vurder kort om analysen har vesentlige hull: Mangler det viktige saker? Er det \
bestemmelsespar som ikke er dekket? Tidsmessige hull?
</task>
</instructions>

<tools_guidance>
Du har tilgang til verktøy for å hente mer kontekst ved behov. Bruk dem sparsomt:
- Hent avsnitt kun når capsule-sammendraget mangler nyanser du trenger for analysen
- Prioriter B- og C-saker der du ser potensielt viktige poenger i komprimeringen
- Maks 3-5 tool-kall per syntese — start med det du har, hent kun det som mangler
</tools_guidance>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Bruk akademisk juridisk stil — presis, nøktern, ikke-konkluderende
- Referer alltid til saker med sak_nr og avsnittsnummer
- Marker AI-generert vurdering tydelig vs. gjennomgang av praksis
- Marker seksjoner der juristen må bidra med [JURISTENS VURDERING]
</formatting_rules>"""


SYNTHESIS_TOOLS = [
    {
        "name": "fetch_case_paragraphs",
        "description": (
            "Hent spesifikke avsnitt fra en KOFA-avgjørelse. Bruk dette når "
            "capsule-sammendraget ikke gir nok detaljer — f.eks. for å verifisere "
            "et juridisk poeng, sammenligne faktum, eller forstå nyanser i "
            "klagenemndas resonnement. Send null for paragraph_nrs for å "
            "hente alle avsnitt (maks 50)."
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
                    "type": ["array", "null"],
                    "items": {"type": "integer"},
                    "description": (
                        "Spesifikke avsnittsnumre å hente. "
                        "Null for å hente alle avsnitt (maks 50)."
                    ),
                },
            },
            "required": ["sak_nr", "paragraph_nrs"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fetch_provision_cases",
        "description": (
            "Hent liste over KOFA-saker som refererer til en spesifikk "
            "lovbestemmelse. Bruk for å sjekke om det finnes relevante saker "
            "du ikke har sett i capsule-dataene."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "dok_id": {
                    "type": "string",
                    "description": "Lovnavn/alias, f.eks. 'anskaffelsesforskriften'",
                },
                "section_id": {
                    "type": "string",
                    "description": "Paragraf-ID, f.eks. '§ 7-9'",
                },
            },
            "required": ["dok_id", "section_id"],
            "additionalProperties": False,
        },
    },
]

MAX_TOOL_TURNS = 5


# ---------------------------------------------------------------------------
# Tool dispatch helpers for agentic loop
# ---------------------------------------------------------------------------


def _fetch_paragraphs(sak_nr: str, paragraph_nrs: list[int] | None) -> dict:
    """Fetch specific paragraphs from a KOFA decision. Tool handler.

    Returns {"sak_nr": ..., "paragraphs": [{"nr": int, "text": str}, ...]}.
    paragraph_nrs=None means all paragraphs (max 50).
    """
    client = get_client()
    q = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
        .limit(50)
    )
    if paragraph_nrs:
        q = q.in_("paragraph_number", paragraph_nrs)
    rows = q.execute().data or []
    return {
        "sak_nr": sak_nr,
        "paragraphs": [{"nr": r["paragraph_number"], "text": r["text"]} for r in rows],
    }


def _fetch_provision_cases_tool(dok_id: str, section_id: str) -> dict:
    """Fetch cases referencing a provision. Tool handler.

    Returns {"dok_id": ..., "section_id": ..., "total": int, "cases": [...]}.
    dok_id is the law alias (e.g. 'anskaffelsesforskriften') which maps to
    kofa_law_references.law_name. Reuses _fetch_referencing_cases from provisions.py.
    """
    from provisions import _fetch_referencing_cases
    client = get_client()
    total, cases = _fetch_referencing_cases(client, dok_id, section_id)
    return {
        "dok_id": dok_id,
        "section_id": section_id,
        "total": total,
        "cases": cases,
    }


def _execute_tool(name: str, tool_input: dict) -> dict:
    """Dispatch a tool call to the appropriate handler."""
    if name == "fetch_case_paragraphs":
        return _fetch_paragraphs(tool_input["sak_nr"], tool_input["paragraph_nrs"])
    elif name == "fetch_provision_cases":
        return _fetch_provision_cases_tool(tool_input["dok_id"], tool_input["section_id"])
    raise ValueError(f"Unknown tool: {name}")


# ---------------------------------------------------------------------------
# Agentic loop (ADR-004 Fase 1 — blocking, no streaming)
# ---------------------------------------------------------------------------


def _run_agentic_loop(
    user_message: str,
    analysis_id: str,
) -> dict:
    """Run an agentic synthesis loop with tool use.

    Returns the structured synthesis result dict with _llm_meta.
    Raises SynthesisError on failure.
    """
    client = get_anthropic_client()
    messages = [{"role": "user", "content": user_message}]
    cost_tracker = CostTracker()
    tools_called = []
    t0 = time.monotonic()

    for turn in range(1, MAX_TOOL_TURNS + 1):
        t_turn = time.monotonic()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config=build_output_config(
                schema=SYNTHESIS_SCHEMA, effort="high", model=CLAUDE_MODEL,
            ),
            tools=SYNTHESIS_TOOLS,
            system=[{
                "type": "text",
                "text": SYNTHESIS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        )
        elapsed_turn = int((time.monotonic() - t_turn) * 1000)

        turn_cost = cost_tracker.add(
            f"Synthesis/{analysis_id}/turn-{turn}",
            CLAUDE_MODEL,
            response.usage,
            elapsed_ms=elapsed_turn,
        )

        # Append assistant response to message history
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            # Extract structured JSON from the last text block
            text = next(
                (b.text for b in response.content if hasattr(b, "text")),
                None,
            )
            if not text:
                raise SynthesisError("Agentisk loop ga ingen tekst-output")

            result = json_module.loads(text)

            # Build _llm_meta with agentic-specific info
            total_elapsed = int((time.monotonic() - t0) * 1000)
            result["_llm_meta"] = {
                "model": CLAUDE_MODEL,
                "total_turns": turn,
                "tools_called": tools_called,
                "cost_usd": round(cost_tracker.total_cost, 6),
                "elapsed_ms": total_elapsed,
                "agentic": True,
            }
            logger.info(
                "Agentic synthesis complete: %d turns, %d tool calls, $%.4f, %.1fs",
                turn, len(tools_called), cost_tracker.total_cost,
                total_elapsed / 1000,
            )

            # Persist final turn to call log
            persist_llm_call(
                analysis_id=analysis_id, call_type="synthesis",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="end_turn", turn=turn,
            )
            return result

        if response.stop_reason == "tool_use":
            turn_tool_calls = []
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info(
                        "Synthesis tool call: %s(%s)",
                        block.name,
                        json_module.dumps(block.input, ensure_ascii=False)[:200],
                    )
                    try:
                        tool_result = _execute_tool(block.name, block.input)
                        content = json_module.dumps(tool_result, ensure_ascii=False)
                    except Exception as e:
                        logger.error("Tool execution failed: %s", e)
                        content = json_module.dumps({"error": str(e)})

                    tool_entry = {
                        "turn": turn,
                        "tool": block.name,
                        "input": block.input,
                        "success": "error" not in content,
                    }
                    tools_called.append(tool_entry)
                    turn_tool_calls.append(tool_entry)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": content,
                    })

            # Persist tool-use turn to call log
            persist_llm_call(
                analysis_id=analysis_id, call_type="synthesis",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="tool_use", turn=turn,
                tool_calls=turn_tool_calls,
            )

            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop_reason
        logger.warning("Unexpected stop_reason: %s", response.stop_reason)
        raise SynthesisError(f"Uventet stop_reason: {response.stop_reason}")

    # Exhausted max turns without end_turn
    raise SynthesisError(f"Agentisk loop nådde maks {MAX_TOOL_TURNS} turns uten sluttresultat")


# Rough token estimates per character (for Norwegian legal text)
_CHARS_PER_TOKEN = 3.5


def _estimate_tokens(text: str) -> int:
    """Rough token estimate for Norwegian text."""
    return int(len(text) / _CHARS_PER_TOKEN)


def _compress_screening_for_synthesis(
    candidates: list[dict],
    token_budget: int = 20000,
) -> str:
    """Compress screening results using capsule pattern.

    Priority: A full, B compressed, C minimal.
    """
    a_cases = [c for c in candidates if c.get("category") == "A"]
    b_cases = [c for c in candidates if c.get("category") == "B"]
    c_cases = [c for c in candidates if c.get("category") == "C"]

    parts = []
    tokens_used = 0

    def _format_full(c: dict) -> str:
        s = c.get("ai_screening", {})
        lines = [
            f"### {c['sak_nr']} (kat. {c['category']}) {'★' if s.get('star') else ''}",
            f"**Rettssetning:** {s.get('proposition', '—')}",
            f"**Faktum:** {s.get('factum', '—')}",
            f"**Vurdering:** {s.get('assessment', '—')}",
        ]
        if s.get("quotes"):
            lines.append("**Sitater:**")
            for q in s["quotes"]:
                lines.append(f"- §{q.get('p', '?')}: «{q.get('text', '')}»")
        if s.get("nuances"):
            lines.append(f"**Nyanser:** {s['nuances']}")
        lines.append(f"**Relevans:** {s.get('relevance', '?')} — {s.get('relevance_reasoning', '')}")
        return "\n".join(lines)

    def _format_compressed(c: dict) -> str:
        s = c.get("ai_screening", {})
        return (
            f"- **{c['sak_nr']}** (kat. {c['category']}): "
            f"{s.get('proposition', '—')} "
            f"[Relevans: {s.get('relevance', '?')}] "
            f"{'★' if s.get('star') else ''}"
        )

    def _format_minimal(c: dict) -> str:
        s = c.get("ai_screening", {})
        return f"- {c['sak_nr']}: {s.get('proposition', '—')}"

    # A-cases: always full
    for c in a_cases:
        text = _format_full(c)
        tokens_used += _estimate_tokens(text)
        parts.append(text)

    # B-cases: full if budget allows, else compressed
    for c in b_cases:
        full_text = _format_full(c)
        if tokens_used + _estimate_tokens(full_text) <= token_budget:
            parts.append(full_text)
            tokens_used += _estimate_tokens(full_text)
        else:
            text = _format_compressed(c)
            parts.append(text)
            tokens_used += _estimate_tokens(text)

    # C-cases: compressed if budget allows, else minimal
    for c in c_cases:
        comp_text = _format_compressed(c)
        if tokens_used + _estimate_tokens(comp_text) <= token_budget:
            parts.append(comp_text)
            tokens_used += _estimate_tokens(comp_text)
        else:
            text = _format_minimal(c)
            parts.append(text)
            tokens_used += _estimate_tokens(text)

    logger.info("Synthesis capsule: ~%d estimated tokens for %d cases", tokens_used, len(candidates))
    return "\n\n".join(parts)


def _load_propositions(analysis_id: str) -> str:
    """Load proposition registry as formatted text."""
    client = get_client()
    props = (
        client.table("analysis_propositions")
        .select("proposition_text, theme, source_case, evolution_type, tension_with_id, confirmed")
        .eq("analysis_id", analysis_id)
        .execute()
        .data
    ) or []

    if not props:
        return "Ingen rettssetninger registrert."

    # Group by theme
    themes: dict[str, list] = {}
    for p in props:
        theme = p.get("theme") or "Ukategorisert"
        themes.setdefault(theme, []).append(p)

    parts = []
    for theme, items in themes.items():
        parts.append(f"**{theme}:**")
        for p in items:
            confirmed = "✓" if p.get("confirmed") else "?"
            evolution = p.get("evolution_type", "")
            tension = f" [SPENNING: {p['tension_with_id']}]" if p.get("tension_with_id") else ""
            parts.append(
                f"  [{confirmed}] {p.get('source_case', '?')}: "
                f"{p.get('proposition_text', '—')} "
                f"({evolution}){tension}"
            )

    return "\n".join(parts)


def _format_user_notes(candidates: list[dict]) -> str:
    """Format user notes from already-loaded candidates."""
    notes = [c for c in candidates if c.get("user_notes")]
    if not notes:
        return "Ingen notater fra juristen."

    return "\n".join(f"- {c['sak_nr']}: {c['user_notes']}" for c in notes)


def generate_synthesis(analysis_id: str) -> dict:
    """Generate a legal analysis note using Claude.

    Sends compressed screening results + propositions + notes to Claude.
    Returns structured note with sections, tensions, and coverage notes.
    Persists the note as markdown in analysis_documents.
    """
    ctx = load_analysis_context(analysis_id, extra_columns=["gaps"])
    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]
    provisions = ctx["provisions"]
    gaps = ctx.get("gaps") or []

    # Load screened candidates
    client = get_client()
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening, user_notes")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .execute()
        .data
    ) or []

    if not candidates:
        raise SynthesisError("Ingen screenede saker å syntetisere")

    # Check output cache
    content_hash = make_synthesis_hash(problem, candidates, provisions)
    cached = get_cached(analysis_id, "synthesis", content_hash)
    if cached:
        return cached

    # Build capsule-compressed screening data
    screening_capsule = _compress_screening_for_synthesis(candidates)

    # Load propositions; extract notes from already-loaded candidates
    propositions_text = _load_propositions(analysis_id)
    notes_text = _format_user_notes(candidates)

    # Build gap summary
    gap_summary = "Ingen hull." if not gaps else "\n".join(
        f"- {g.get('provision1', '?')} ∩ {g.get('provision2', '?')}: {g.get('count', 0)} saker"
        for g in gaps
    )

    user_message = f"""<screening_results>
{screening_capsule}
</screening_results>

<rettssetningsregister>
{propositions_text}
</rettssetningsregister>

<juristens_notater>
{notes_text}
</juristens_notater>

<gap_analyse>
{gap_summary}
</gap_analyse>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{format_sub_problems(sub_problems)}
</delspørsmål>
<bestemmelser>{', '.join(provisions) if provisions else 'Ingen'}</bestemmelser>
</analysis_context>

Skriv et strukturert notatutkast som organiserer funnene fra screening og \
rettssetningsregisteret. Marker seksjoner der juristen må bidra med egne \
vurderinger med [JURISTENS VURDERING]."""

    # Try agentic loop, fall back to single-shot on failure
    try:
        result = _run_agentic_loop(user_message, analysis_id)
    except Exception as e:
        logger.warning(
            "Agentic synthesis failed for %s, falling back to single-shot: %s",
            analysis_id, e,
        )
        try:
            result = call_claude_structured(
                system_prompt=SYNTHESIS_SYSTEM_PROMPT,
                user_message=user_message,
                schema=SYNTHESIS_SCHEMA,
                max_tokens=12000,
                effort="high",
                log_label=f"Synthesis fallback for {analysis_id}",
            )
        except Exception as e2:
            logger.error("Synthesis fallback also failed for %s: %s", analysis_id, e2)
            raise SynthesisError(f"Syntese feilet: {e2}") from e2

    # Convert structured response to markdown for persistence
    markdown = _to_markdown(result)

    # Persist to analysis_documents (with llm_meta)
    llm_meta = result.get("_llm_meta")
    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_NOTE,
            "content": markdown,
            "llm_meta": llm_meta,
            "version": 1,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()

    # Increment total_cost_usd on the analysis
    cost = (result.get("_llm_meta") or {}).get("cost_usd", 0)
    if cost:
        client.rpc("increment_total_cost", {
            "analysis_id_input": analysis_id,
            "cost_increment": cost,
        }).execute()

    result["markdown"] = markdown
    set_cached(analysis_id, "synthesis", content_hash, result)
    return result


def _to_markdown(result: dict) -> str:
    """Convert structured synthesis response to markdown."""
    parts = [f"# {result.get('title', 'Notatutkast')}"]

    for section in result.get("sections", []):
        parts.append(f"\n## {section['heading']}")
        parts.append(section["content"])

    if result.get("unresolved_tensions"):
        parts.append("\n## Uløste spenninger")
        for t in result["unresolved_tensions"]:
            cases = ", ".join(t.get("cases", []))
            parts.append(f"- **{t['description']}** ({cases})")

    if result.get("coverage_notes"):
        parts.append(f"\n## Dekningsvurdering\n\n{result['coverage_notes']}")

    return "\n\n".join(parts)


def update_synthesis(analysis_id: str, markdown: str) -> dict:
    """Update the synthesis note content (user edits)."""
    client = get_client()

    # Increment version
    existing = (
        client.table("analysis_documents")
        .select("version")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", DOC_TYPE_NOTE)
        .limit(1)
        .execute()
        .data
    )
    version = (existing[0]["version"] + 1) if existing else 1

    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_NOTE,
            "content": markdown,
            "version": version,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()

    return {"ok": True, "version": version}
