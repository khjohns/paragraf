"""Chat — Sprint 16.

Free-form conversation (sparring) with full analysis context.
Streams responses via SSE. Uses capsule compression for context.
"""
import json
import logging

from db import get_client
from llm_utils import (
    CLAUDE_MODEL,
    get_anthropic_client,
    load_analysis_context,
    format_sub_problems,
)

logger = logging.getLogger(__name__)


class ChatError(Exception):
    """Raised when chat fails."""


def _parse_screening(raw) -> dict | None:
    """Parse ai_screening field which may be a JSON string or dict."""
    if not raw:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
    return raw if isinstance(raw, dict) else None


def _format_candidate_line(c: dict) -> str:
    """Format a single candidate as a compact context line."""
    line = f"  {c['sak_nr']} [{c['category']}]"
    if c.get("is_delimitation"):
        line += " [AVGRENSET]"
    screening = _parse_screening(c.get("ai_screening"))
    if screening:
        verdict = screening.get("verdict", "")
        one_liner = screening.get("one_liner", "")
        if verdict or one_liner:
            line += f" — {verdict}: {one_liner}"
    if c.get("user_notes"):
        line += f" | Notat: {c['user_notes']}"
    return line


def _load_chat_context(analysis_id: str) -> str:
    """Build a context summary for the chat system prompt."""
    ctx = load_analysis_context(analysis_id, extra_columns=["gaps"])

    # Load screened candidates (compact summaries)
    client = get_client()
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening, user_notes, is_delimitation")
        .eq("analysis_id", analysis_id)
        .order("category")
        .execute()
        .data
    ) or []

    # Load propositions
    propositions = (
        client.table("analysis_propositions")
        .select("proposition_text, theme, source_case, evolution_type, tension_with_id")
        .eq("analysis_id", analysis_id)
        .execute()
        .data
    ) or []

    # Load synthesis note if exists
    doc = (
        client.table("analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", "note")
        .limit(1)
        .execute()
        .data
    )
    synthesis_note = doc[0]["content"] if doc else None

    # Build context string
    parts = []

    parts.append(f"<problem>\n{ctx['problem']}\n</problem>")
    if ctx["sub_problems"]:
        parts.append(f"<sub_problems>\n{format_sub_problems(ctx['sub_problems'])}\n</sub_problems>")
    if ctx["provisions"]:
        parts.append(f"<provisions>\n{', '.join(ctx['provisions'])}\n</provisions>")

    # Candidate summaries (capsule format)
    if candidates:
        case_lines = [_format_candidate_line(c) for c in candidates]
        parts.append(f"<candidates>\n" + "\n".join(case_lines) + "\n</candidates>")

    # Propositions
    if propositions:
        prop_lines = []
        for p in propositions:
            line = f"  [{p.get('theme', '?')}] {p['proposition_text']} (kilde: {p.get('source_case', '?')})"
            if p.get("evolution_type"):
                line += f" [{p['evolution_type']}]"
            prop_lines.append(line)
        parts.append(f"<propositions>\n" + "\n".join(prop_lines) + "\n</propositions>")

    # Gaps
    gaps = ctx.get("gaps")
    if gaps:
        gap_lines = [f"  {g.get('provision1', '?')} ∩ {g.get('provision2', '?')}: {g.get('count', 0)}" for g in gaps]
        parts.append(f"<gaps>\n" + "\n".join(gap_lines) + "\n</gaps>")

    # Synthesis note
    if synthesis_note:
        # Truncate to ~3000 chars to stay within budget
        note_preview = synthesis_note[:3000]
        if len(synthesis_note) > 3000:
            note_preview += "\n[… trunkert]"
        parts.append(f"<synthesis_note>\n{note_preview}\n</synthesis_note>")

    return "\n\n".join(parts)


SYSTEM_PROMPT = """Du er en juridisk sparringspartner for norsk anskaffelsesrett (offentlige anskaffelser).

Du har tilgang til brukerens pågående rettskildeanalyse:
{context}

<role>
- Du er en kritisk, presisjonsorientert diskusjonspartner — ikke en assistent som bekrefter alt.
- Du hjelper brukeren med å forstå rettskildebildet, identifisere spenninger, og teste argumenter.
- Vær faglig presis men konversasjonell i tonen.
- Bruk referanser til saker i analysen med formatet {{ref:kofa:saksnr:§avsnitt}} for klikkbare lenker.
- Hvert svar skal inneholde en utfordrende vinkel — pek på svakheter, manglende nyanser, eller alternative tolkninger.
- Marker slike utfordringer eksplisitt med «**Mulig motargument:**» som prefix.
- Hvis du identifiserer saker brukeren bør lese som ikke er i analysen, beskriv dem kort.
</role>

<constraints>
- Svar ALLTID på norsk (bokmål).
- Referer kun til saker som faktisk finnes i analysekonteksten, med mindre du eksplisitt sier at du spekulerer.
- Ikke gjengi hele avsnitt — pek til §-referanser.
- Hold svar konsise (maks 3-4 avsnitt). Utdyp kun hvis brukeren ber om det.
</constraints>"""


def chat_stream(analysis_id: str, messages: list[dict]):
    """Stream a chat response given message history.

    Yields (event_type, data) tuples for SSE.
    Messages should be [{role: "user"|"assistant", content: str}, ...].
    """
    if not messages:
        raise ChatError("Ingen meldinger")

    # Load analysis context
    try:
        context = _load_chat_context(analysis_id)
    except Exception as e:
        raise ChatError(f"Kunne ikke laste analysekontekst: {e}")

    system_prompt = SYSTEM_PROMPT.format(context=context)

    client = get_anthropic_client()

    try:
        with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            output_config={"effort": "medium"},
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield "chunk", {"text": text}

            # Log token usage
            response = stream.get_final_message()
            logger.info(
                "Chat: %d input tokens (%d cached), %d output tokens",
                response.usage.input_tokens,
                getattr(response.usage, "cache_read_input_tokens", 0),
                response.usage.output_tokens,
            )
    except Exception as e:
        raise ChatError(f"Claude-feil: {e}")
