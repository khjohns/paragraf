"""Chat — Sprint 16.

Free-form conversation (sparring) with full analysis context.
Streams responses via SSE. Uses capsule compression for context.
"""
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from db import db_query_with_retry
from llm_utils import (
    CLAUDE_MODEL,
    build_output_config,
    get_anthropic_client,
    load_analysis_context,
    format_sub_problems,
    log_usage,
)

logger = logging.getLogger(__name__)


class ChatError(Exception):
    """Raised when chat fails."""


# Max chars for synthesis note truncation in chat context
CHAT_SYNTHESIS_TRUNCATE = int(os.environ.get("CHAT_SYNTHESIS_TRUNCATE", "3000"))

# Reusable executor for parallel DB queries (avoids per-request thread creation)
_db_executor = ThreadPoolExecutor(max_workers=3)


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
    line = f"  {c['sak_nr']} [{c.get('category') or '?'}]"
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
    """Build a context summary for the chat system prompt.

    Loads candidates, propositions, and synthesis note in parallel.
    """
    ctx = load_analysis_context(analysis_id, extra_columns=["gaps"])

    def _fetch_candidates():
        return db_query_with_retry(lambda c: (
            c.table("analysis_candidates")
            .select("sak_nr, category, ai_screening, user_notes, is_delimitation")
            .eq("analysis_id", analysis_id)
            .order("category")
            .execute()
            .data
        ) or [])

    def _fetch_propositions():
        return db_query_with_retry(lambda c: (
            c.table("analysis_propositions")
            .select("proposition_text, theme, source_case, evolution_type, tension_with_id")
            .eq("analysis_id", analysis_id)
            .execute()
            .data
        ) or [])

    def _fetch_synthesis_note():
        def _query(c):
            doc = (
                c.table("analysis_documents")
                .select("content")
                .eq("analysis_id", analysis_id)
                .eq("doc_type", "note")
                .limit(1)
                .execute()
                .data
            )
            return doc[0]["content"] if doc else None
        return db_query_with_retry(_query)

    candidates_future = _db_executor.submit(_fetch_candidates)
    propositions_future = _db_executor.submit(_fetch_propositions)
    note_future = _db_executor.submit(_fetch_synthesis_note)

    candidates = candidates_future.result()
    propositions = propositions_future.result()
    synthesis_note = note_future.result()

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
        note_preview = synthesis_note[:CHAT_SYNTHESIS_TRUNCATE]
        if len(synthesis_note) > CHAT_SYNTHESIS_TRUNCATE:
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


def _persist_message(analysis_id: str, role: str, content: str) -> None:
    """Persist a single chat message to the database."""
    try:
        db_query_with_retry(lambda c: c.table("analysis_chat_messages").insert({
            "analysis_id": analysis_id,
            "role": role,
            "content": content,
        }).execute())
    except Exception as e:
        logger.warning("Failed to persist chat message: %s", e)


def load_chat_history(analysis_id: str) -> list[dict]:
    """Load chat history from the database, ordered by created_at ASC."""
    rows = db_query_with_retry(lambda c: (
        c.table("analysis_chat_messages")
        .select("role, content, created_at")
        .eq("analysis_id", analysis_id)
        .order("created_at")
        .execute()
        .data
    )) or []
    return [{"role": r["role"], "content": r["content"], "created_at": r["created_at"]} for r in rows]


def chat_stream(analysis_id: str, messages: list[dict]):
    """Stream a chat response given message history.

    Yields (event_type, data) tuples for typed SSE.
    Messages should be [{role: "user"|"assistant", content: str}, ...].
    """
    if not messages:
        raise ChatError("Ingen meldinger")

    # Persist the latest user message (always the last in the array)
    last_msg = messages[-1]
    if last_msg.get("role") == "user":
        _persist_message(analysis_id, "user", last_msg["content"])

    # Signal context loading phase
    yield "status", {"phase": "loading_context"}

    # Load analysis context
    try:
        context = _load_chat_context(analysis_id)
    except Exception as e:
        raise ChatError(f"Kunne ikke laste analysekontekst: {e}")

    yield "status", {"phase": "streaming"}

    system_prompt = SYSTEM_PROMPT.format(context=context)

    client = get_anthropic_client()

    full_response = []
    try:
        with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            output_config=build_output_config(effort="medium", model=CLAUDE_MODEL),
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
                full_response.append(text)
                yield "chunk", {"text": text}

            response = stream.get_final_message()
            log_usage(response.usage, CLAUDE_MODEL, "Chat")

        # Persist assistant response after successful stream
        _persist_message(analysis_id, "assistant", "".join(full_response))
    except Exception as e:
        raise ChatError(f"Claude-feil: {e}")
