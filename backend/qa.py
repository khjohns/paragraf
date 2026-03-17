"""Quality Assurance — Sprint 15 + agentisk QA (ADR-004).

Single agentic QA call with tool use that checks:
1. Reference accuracy — verifies synthesis references against source text
2. Logical consistency — checks if conclusions follow from case law
3. Coverage — ensures all A-candidates are treated in the note
"""
import json
import json as json_module
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

from db import get_client
from synthesis import DOC_TYPE_NOTE, DOC_TYPE_QA_REPORT, SYNTHESIS_TOOLS, _execute_tool

from llm_utils import (
    CLAUDE_MODEL,
    HAIKU_MODEL,
    get_anthropic_client,
    build_output_config,
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
    build_batch_request,
    submit_batch,
    get_batch_results,
    log_usage,
    persist_llm_call,
    parse_json_response,
    CostTracker,
    _calculate_cost,
    _extract_cache_tokens,
)

logger = logging.getLogger(__name__)


class QAError(Exception):
    """Raised when QA fails."""


# Max number of cases to verify citations for (A+B categories)
MAX_CITATION_CASES = int(os.environ.get("MAX_CITATION_CASES", "8"))


# --- Schemas ---

CITATION_QA_SCHEMA = {
    "type": "object",
    "properties": {
        "verified_quotes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sak_nr": {"type": "string"},
                    "paragraph": {"type": "integer"},
                    "quoted_text": {"type": "string", "description": "Sitatet fra screening"},
                    "status": {
                        "type": "string",
                        "enum": ["verified", "truncated", "inaccurate", "not_found"],
                    },
                    "issue": {
                        "type": ["string", "null"],
                        "description": "Beskrivelse av problemet hvis status != verified",
                    },
                },
                "required": ["sak_nr", "paragraph", "quoted_text", "status", "issue"],
                "additionalProperties": False,
            },
        },
        "summary": {
            "type": "string",
            "description": "Oppsummering av sitatverifiseringen",
        },
    },
    "required": ["verified_quotes", "summary"],
    "additionalProperties": False,
}


LOGIC_QA_SCHEMA = {
    "type": "object",
    "properties": {
        "flags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": [
                            "argumentative_gap",
                            "unsupported_conclusion",
                            "analogy_not_flagged",
                            "missing_nuance",
                            "contradiction",
                        ],
                    },
                    "location": {
                        "type": "string",
                        "description": "Hvor i notatet problemet finnes",
                    },
                    "description": {
                        "type": "string",
                        "description": "Beskrivelse av problemet",
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                    "suggestion": {
                        "type": "string",
                        "description": "Forslag til utbedring",
                    },
                },
                "required": ["type", "location", "description", "severity", "suggestion"],
                "additionalProperties": False,
            },
        },
        "summary": {
            "type": "string",
            "description": "Oppsummering av logisk konsistenssjekk",
        },
    },
    "required": ["flags", "summary"],
    "additionalProperties": False,
}


COVERAGE_QA_SCHEMA = {
    "type": "object",
    "properties": {
        "untreated_cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sak_nr": {"type": "string"},
                    "category": {"type": "string"},
                    "proposition": {"type": "string"},
                    "justified_omission": {"type": "boolean"},
                    "reason": {
                        "type": "string",
                        "description": "Begrunnelse for om utelatelsen er rimelig",
                    },
                },
                "required": ["sak_nr", "category", "proposition", "justified_omission", "reason"],
                "additionalProperties": False,
            },
        },
        "summary": {
            "type": "string",
            "description": "Oppsummering av dekningssjekken",
        },
    },
    "required": ["untreated_cases", "summary"],
    "additionalProperties": False,
}


# Pre-formatted schema for citation QA prompt (Citations API is incompatible with json_schema)
_CITATION_QA_SCHEMA_JSON = json.dumps(CITATION_QA_SCHEMA, ensure_ascii=False, indent=2)

# --- System prompts ---

CITATION_QA_SYSTEM_PROMPT = """\
Du er en juridisk kvalitetssikrer. Din oppgave er å verifisere sitater fra \
KOFA-avgjørelser.

<instructions>
Du mottar sitater fra en rettslig analyse sammen med originalteksten de er \
hentet fra. For hvert sitat, vurder:
- **verified**: Sitatet er korrekt gjengitt
- **truncated**: Sitatet er trunkert på en måte som fjerner kvalifikasjoner
- **inaccurate**: Sitatet avviker vesentlig fra originalteksten
- **not_found**: Sitatet finnes ikke i den oppgitte teksten

Trunkering som fjerner «men»/«under forutsetning av»/«med mindre» er særlig \
problematisk og skal flagges.
</instructions>"""


LOGIC_QA_SYSTEM_PROMPT = """\
Du er en juridisk kvalitetssikrer. Din oppgave er å sjekke logisk konsistens \
i et rettslig analysenotat.

<instructions>
Du mottar et notatutkast sammen med screeningresultatene det bygger på. Sjekk:
1. Følger konklusjonene av den gjennomgåtte praksisen?
2. Er det argumentative sprang — påstander uten dekning i kildene?
3. Er analogier tydelig flagget som analogier (ikke direkte anvendelse)?
4. Er vesentlige nyanser fra screening tatt med i notatet?
5. Er det indre motsetninger i notatet?

Flagg problemer med alvorlighetsgrad (high/medium/low) og konkret forslag \
til utbedring.
</instructions>"""


COVERAGE_QA_SYSTEM_PROMPT = """\
Du er en juridisk kvalitetssikrer. Din oppgave er å sjekke om alle viktige \
saker er behandlet i et rettslig analysenotat.

<instructions>
Du mottar et notatutkast og en liste over screenede saker med kategori. Sjekk:
1. Er alle A-kandidater behandlet eller nevnt i notatet?
2. Er utelatelser av A-kandidater rimelig begrunnet?
3. Er det B-kandidater som burde vært behandlet (f.eks. gullkandidater)?

Merk: C-kandidater trenger ikke nødvendigvis behandling.
</instructions>"""


def _verify_citations_with_api(candidates: list[dict], note_markdown: str) -> dict:
    """Verify quotes using Citations API for machine verification.

    Takes pre-loaded candidates to avoid redundant DB queries.
    Fetches the actual case text and sends it as a document for Claude to
    cite against, enabling automatic verification.
    """
    quotes_to_verify, source_texts = _fetch_source_texts(candidates)

    if not quotes_to_verify:
        return {"verified_quotes": [], "summary": "Ingen sitater å verifisere."}

    if not source_texts:
        return {"verified_quotes": [], "summary": "Kunne ikke hente kildetekster."}

    # Build content blocks with source documents for Citations API
    content_blocks = []
    for sak_nr, text in source_texts.items():
        content_blocks.append({
            "type": "document",
            "source": {
                "type": "content",
                "content": text,
            },
            "title": f"Avgjørelsestekst {sak_nr}",
            "citations": {"enabled": True},
        })

    # Add the quotes to verify as text
    quotes_text = "\n".join(
        f"- {q['sak_nr']} §{q['paragraph']}: «{q['text']}»"
        for q in quotes_to_verify
        if q["sak_nr"] in source_texts
    )
    content_blocks.append({
        "type": "text",
        "text": f"""Verifiser følgende sitater mot kildetekstene over.

<sitater_å_verifisere>
{quotes_text}
</sitater_å_verifisere>

For hvert sitat: sjekk om det finnes ordrett i kildeteksten, om det er trunkert \
(fjerner kvalifikasjoner), eller om det avviker. Returner strukturert resultat.""",
    })

    # Call Claude with Citations API enabled.
    # NOTE: Citations API and structured output (json_schema) are incompatible —
    # combining them returns 400. We use citations for machine-verified text
    # matching and ask the model to return JSON via prompt instruction instead.
    anthropic_client = get_anthropic_client()
    t0 = time.monotonic()
    response = anthropic_client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=4000,
        system=[
            {
                "type": "text",
                "text": CITATION_QA_SYSTEM_PROMPT
                + "\n\nReturner resultatet som JSON med dette formatet:\n"
                + _CITATION_QA_SCHEMA_JSON,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": content_blocks}],
    )
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    cost = log_usage(response.usage, HAIKU_MODEL, "Citation QA", elapsed_ms=elapsed_ms)

    # Extract text blocks (skip cite blocks — they confirm source positions)
    text_parts = [block.text for block in response.content if block.type == "text"]
    full_text = "\n".join(text_parts)

    result = parse_json_response(full_text)
    if result is None:
        logger.warning("Citation QA: could not parse JSON from response")
        return {"verified_quotes": [], "summary": "Kunne ikke tolke QA-respons."}

    # Attach LLM metadata (Haiku does not use adaptive thinking)
    usage = response.usage
    cache_write, cache_read = _extract_cache_tokens(usage)
    result["_llm_meta"] = {
        "model": HAIKU_MODEL,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "cost_usd": round(cost, 6),
        "elapsed_ms": elapsed_ms,
        "has_thinking": False,
    }

    return result


def _check_logical_consistency(note_markdown: str, screening_summary: str) -> dict:
    """Check logical consistency of the note against screening results."""
    user_message = f"""<notat>
{note_markdown}
</notat>

<screeningresultater>
{screening_summary}
</screeningresultater>

Sjekk notatets logiske konsistens mot screeningresultatene. Flagg problemer."""

    return call_claude_structured(
        system_prompt=LOGIC_QA_SYSTEM_PROMPT,
        user_message=user_message,
        schema=LOGIC_QA_SCHEMA,
        max_tokens=16000,
        model=CLAUDE_MODEL,
        log_label="Logic QA",
    )


def _check_coverage(note_markdown: str, candidates_summary: str) -> dict:
    """Check if all important cases are covered in the note."""
    user_message = f"""<notat>
{note_markdown}
</notat>

<kandidater>
{candidates_summary}
</kandidater>

Sjekk om alle viktige saker (spesielt A-kandidater) er behandlet i notatet."""

    return call_claude_structured(
        system_prompt=COVERAGE_QA_SYSTEM_PROMPT,
        user_message=user_message,
        schema=COVERAGE_QA_SCHEMA,
        max_tokens=16000,
        model=CLAUDE_MODEL,
        log_label="Coverage QA",
    )


def _compress_candidates_for_qa(candidates: list[dict]) -> str:
    """Compress candidates into a concise summary for QA."""
    parts = []
    for c in candidates:
        s = c.get("ai_screening", {})
        star = " ★" if s.get("star") else ""
        parts.append(
            f"- {c['sak_nr']} (kat. {c.get('category', '?')}){star}: "
            f"{s.get('proposition', '—')} "
            f"[Relevans: {s.get('relevance', '?')}]"
        )
    return "\n".join(parts)


def _load_qa_inputs(analysis_id: str) -> tuple[str, list[dict], str]:
    """Load synthesis note and screened candidates for QA.

    Returns (note_markdown, candidates, candidates_summary).
    """
    client = get_client()

    doc = (
        client.table("analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", DOC_TYPE_NOTE)
        .limit(1)
        .execute()
        .data
    )
    if not doc:
        raise QAError("Ingen syntese-notat funnet — kjør syntese først")

    note_markdown = doc[0]["content"]

    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .execute()
        .data
    ) or []

    return note_markdown, candidates, _compress_candidates_for_qa(candidates)


def _build_and_persist_qa_report(
    analysis_id: str,
    citation_result: dict,
    logic_result: dict,
    coverage_result: dict,
) -> dict:
    """Assemble QA report from sub-results, persist, and return."""
    report = {
        "citation_verification": citation_result,
        "logical_consistency": logic_result,
        "coverage": coverage_result,
        "total_flags": (
            len([q for q in citation_result.get("verified_quotes", []) if q.get("status") != "verified"])
            + len(logic_result.get("flags", []))
            + len([c for c in coverage_result.get("untreated_cases", []) if not c.get("justified_omission")])
        ),
    }

    client = get_client()
    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_QA_REPORT,
            "content": json.dumps(report, ensure_ascii=False),
            "version": 1,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()

    return report


def verify_screening_citations(analysis_id: str) -> dict:
    """Pre-synthesis citation verification on screening quotes.

    Fetches screened candidates, extracts their quotes, verifies against
    source text using Citations API with Haiku. Returns verification report
    and persists quote_verification on each candidate's ai_screening jsonb.
    """
    client = get_client()

    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .execute()
        .data
    ) or []

    # Filter to A and B categories (same as _fetch_source_texts importance filter)
    ab_candidates = [c for c in candidates if c.get("category") in ("A", "B")]

    if not ab_candidates:
        return {"verified_quotes": [], "summary": "Ingen A/B-kandidater å verifisere."}

    logger.info(
        "Pre-synthesis citation verification for analysis %s (%d A/B candidates)",
        analysis_id,
        len(ab_candidates),
    )

    # Reuse existing verification — pass empty note_markdown (not needed pre-synthesis)
    result = _verify_citations_with_api(ab_candidates, "")

    # Link verification status directly on quote objects
    verified_quotes = result.get("verified_quotes", [])

    # Log citation status summary
    from collections import Counter
    if verified_quotes:
        status_counts = Counter(vq.get("status", "unknown") for vq in verified_quotes)
        summary_parts = [f"{count} {status}" for status, count in sorted(status_counts.items())]
        logger.info(
            "Citation verification for %s: %d quotes — %s",
            analysis_id,
            len(verified_quotes),
            ", ".join(summary_parts),
        )

        # Index verification results by (sak_nr, paragraph)
        vq_index: dict[tuple[str, int], dict] = {}
        for vq in verified_quotes:
            key = (vq.get("sak_nr", ""), vq.get("paragraph", 0))
            vq_index[key] = {"status": vq.get("status"), "issue": vq.get("issue")}

        for candidate in ab_candidates:
            sak_nr = candidate["sak_nr"]
            existing_screening = candidate.get("ai_screening") or {}
            quotes = existing_screening.get("quotes", [])
            changed = False
            for quote in quotes:
                key = (sak_nr, quote.get("p", 0))
                if key in vq_index:
                    quote["verification"] = vq_index[key]
                    changed = True
            if changed:
                # Remove legacy quote_verification if present, write updated quotes
                updated_screening = {**existing_screening, "quotes": quotes}
                updated_screening.pop("quote_verification", None)
                client.table("analysis_candidates").update({
                    "ai_screening": updated_screening,
                }).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()

    # Build and persist citation_summary on the analysis
    all_statuses = [vq.get("status", "unknown") for vq in verified_quotes]
    citation_summary = {
        "total": len(all_statuses),
        **{s: c for s, c in Counter(all_statuses).items()},
    }
    client.table("analyses").update({
        "citation_summary": citation_summary,
    }).eq("id", analysis_id).execute()

    # Increment total_cost_usd with QA cost
    qa_cost = (result.get("_llm_meta") or {}).get("cost_usd", 0)
    if qa_cost:
        client.rpc("increment_total_cost", {
            "analysis_id_input": analysis_id,
            "cost_increment": qa_cost,
        }).execute()

    return result


COMBINED_QA_SCHEMA = {
    "type": "object",
    "properties": {
        "reference_issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sak_nr": {"type": "string"},
                    "paragraph": {"type": ["integer", "null"]},
                    "issue_type": {
                        "type": "string",
                        "enum": ["inaccurate_reference", "missing_nuance", "paragraph_mismatch", "fabricated"],
                    },
                    "description": {"type": "string"},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": ["sak_nr", "paragraph", "issue_type", "description", "severity"],
                "additionalProperties": False,
            },
            "description": "Referanseproblemer funnet ved å slå opp avsnittene syntesen refererer til",
        },
        "logic_flags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": [
                            "argumentative_gap", "unsupported_conclusion",
                            "analogy_not_flagged", "missing_nuance", "contradiction",
                        ],
                    },
                    "location": {"type": "string"},
                    "description": {"type": "string"},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "suggestion": {"type": "string"},
                },
                "required": ["type", "location", "description", "severity", "suggestion"],
                "additionalProperties": False,
            },
            "description": "Logiske konsistensproblemer i notatet",
        },
        "untreated_cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sak_nr": {"type": "string"},
                    "category": {"type": "string"},
                    "proposition": {"type": "string"},
                    "justified_omission": {"type": "boolean"},
                    "reason": {"type": "string"},
                },
                "required": ["sak_nr", "category", "proposition", "justified_omission", "reason"],
                "additionalProperties": False,
            },
            "description": "Screenede saker som ikke er behandlet i notatet",
        },
        "overall_assessment": {
            "type": "string",
            "description": "Samlet kvalitetsvurdering av syntese-notatet",
        },
    },
    "required": ["reference_issues", "logic_flags", "untreated_cases", "overall_assessment"],
    "additionalProperties": False,
}


COMBINED_QA_SYSTEM_PROMPT = """\
Du er en juridisk kvalitetssikrer for norsk anskaffelsesrett. Du kvalitetssikrer \
et rettslig analysenotat som er generert fra screening av KOFA-avgjørelser.

<instructions>
Du mottar et notatutkast og screeningresultatene det bygger på. Gjennomfør tre sjekker:

<check name="reference_accuracy">
Notatet refererer til spesifikke saker og avsnittsnumre (f.eks. «2022/31, avsnitt 35»). \
Bruk fetch_case_paragraphs-verktøyet til å slå opp de viktigste referansene og verifiser:
- Sier kildeteksten det notatet påstår?
- Er nyanser eller kvalifikasjoner utelatt?
- Finnes det refererte avsnittet i det hele tatt?
Prioriter referanser som underbygger sentrale poenger i notatet.
</check>

<check name="logical_consistency">
Sjekk om notatets fremstilling er logisk konsistent:
- Følger konklusjonene av den gjennomgåtte praksisen?
- Er det argumentative sprang — påstander uten dekning i kildene?
- Er analogier tydelig flagget som analogier?
- Er vesentlige nyanser fra screening tatt med?
- Er det indre motsetninger?
</check>

<check name="coverage">
Sjekk om alle viktige saker er behandlet:
- Er alle A-kandidater (direkte relevante) nevnt eller behandlet?
- Er gullkandidater (★) gitt tilstrekkelig plass?
- Er utelatelser av saker rimelig begrunnet?
</check>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær konkret — referer til spesifikke steder i notatet og spesifikke avsnitt i kildene
- Bruk verktøy for å verifisere — ikke gjett om kildeteksten stemmer
</formatting_rules>"""


MAX_QA_TOOL_TURNS = 15


def run_qa(analysis_id: str) -> dict:
    """Run agentic QA on the synthesis note.

    Single Sonnet call with tool use (fetch_case_paragraphs) that checks
    reference accuracy, logical consistency, and coverage in one pass.
    Falls back to legacy parallel QA on failure.
    """
    note_markdown, candidates, candidates_summary = _load_qa_inputs(analysis_id)

    logger.info("Starting agentic QA for analysis %s", analysis_id)

    try:
        result = _run_qa_agentic(analysis_id, note_markdown, candidates_summary)
    except Exception as e:
        logger.warning("Agentic QA failed for %s, falling back to legacy: %s", analysis_id, e)
        result = _run_qa_legacy(analysis_id, note_markdown, candidates, candidates_summary)

    return result


def _run_qa_agentic(
    analysis_id: str,
    note_markdown: str,
    candidates_summary: str,
) -> dict:
    """Agentic QA with tool use — single Sonnet call."""
    client = get_anthropic_client()

    user_message = f"""<notat>
{note_markdown}
</notat>

<screenede_saker>
{candidates_summary}
</screenede_saker>

Kvalitetssikre dette notatutkastet. Du MÅ gjøre følgende:

1. FØRST: Identifiser de 3-5 viktigste avsnitthenvisningene i notatet (f.eks. «2022/31, avsnitt 35»). \
Bruk fetch_case_paragraphs for å hente disse avsnittene og sammenlign med hva notatet påstår.

2. DERETTER: Vurder logisk konsistens og dekning basert på screenede saker.

Ikke returner tomme arrays med mindre du faktisk har sjekket og funnet null problemer."""

    messages = [{"role": "user", "content": user_message}]
    cost_tracker = CostTracker()
    tools_called = []
    t0 = time.monotonic()

    for turn in range(1, MAX_QA_TOOL_TURNS + 1):
        t_turn = time.monotonic()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config=build_output_config(
                schema=COMBINED_QA_SCHEMA, effort="high", model=CLAUDE_MODEL,
            ),
            tools=SYNTHESIS_TOOLS,
            system=[{
                "type": "text",
                "text": COMBINED_QA_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        )
        elapsed_turn = int((time.monotonic() - t_turn) * 1000)

        turn_cost = cost_tracker.add(
            f"QA/{analysis_id}/turn-{turn}",
            CLAUDE_MODEL,
            response.usage,
            elapsed_ms=elapsed_turn,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            text = next(
                (b.text for b in response.content if b.type == "text"),
                None,
            )
            if not text:
                raise QAError("QA-loop ga ingen tekst-output")

            result = json_module.loads(text)
            total_elapsed = int((time.monotonic() - t0) * 1000)
            result["_llm_meta"] = {
                "model": CLAUDE_MODEL,
                "total_turns": turn,
                "tools_called": tools_called,
                "cost_usd": round(cost_tracker.total_cost, 6),
                "elapsed_ms": total_elapsed,
                "agentic": True,
            }

            persist_llm_call(
                analysis_id=analysis_id, call_type="qa",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="end_turn", turn=turn,
            )

            logger.info(
                "Agentic QA complete: %d turns, %d tool calls, $%.4f, %.1fs",
                turn, len(tools_called), cost_tracker.total_cost,
                total_elapsed / 1000,
            )

            # Persist QA report
            _persist_qa_report(analysis_id, result)
            return result

        if response.stop_reason == "tool_use":
            turn_tool_calls = []
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info("QA tool call: %s(%s)",
                        block.name,
                        json_module.dumps(block.input, ensure_ascii=False)[:200],
                    )
                    try:
                        tool_result = _execute_tool(block.name, block.input)
                        content = json_module.dumps(tool_result, ensure_ascii=False)
                    except Exception as e:
                        logger.error("QA tool execution failed: %s", e)
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

            persist_llm_call(
                analysis_id=analysis_id, call_type="qa",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="tool_use", turn=turn,
                tool_calls=turn_tool_calls,
            )

            messages.append({"role": "user", "content": tool_results})
            continue

        raise QAError(f"Uventet stop_reason i QA: {response.stop_reason}")

    raise QAError(f"QA-loop nådde maks {MAX_QA_TOOL_TURNS} turns")


def run_qa_stream(analysis_id: str):
    """Streaming QA with live SSE events during the agentic loop.

    Yields (event_type, data) tuples — same protocol as generate_synthesis_stream.
    """
    from synthesis import _summarize_tool_result

    yield ("status", {"phase": "loading_context"})

    try:
        note_markdown, candidates, candidates_summary = _load_qa_inputs(analysis_id)
    except QAError as e:
        yield ("error", {"message": str(e)})
        return

    yield ("status", {"phase": "calling_claude", "turn": 1})

    client = get_anthropic_client()
    user_message = f"""<notat>
{note_markdown}
</notat>

<screenede_saker>
{candidates_summary}
</screenede_saker>

Kvalitetssikre dette notatutkastet. Du MÅ gjøre følgende:

1. FØRST: Identifiser de 3-5 viktigste avsnitthenvisningene i notatet (f.eks. «2022/31, avsnitt 35»). \
Bruk fetch_case_paragraphs for å hente disse avsnittene og sammenlign med hva notatet påstår.

2. DERETTER: Vurder logisk konsistens og dekning basert på screenede saker.

Ikke returner tomme arrays med mindre du faktisk har sjekket og funnet null problemer."""

    messages = [{"role": "user", "content": user_message}]
    cost_tracker = CostTracker()
    tools_called = []
    t0 = time.monotonic()

    for turn in range(1, MAX_QA_TOOL_TURNS + 1):
        if turn > 1:
            yield ("status", {"phase": "calling_claude", "turn": turn})

        t_turn = time.monotonic()
        try:
            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                output_config=build_output_config(
                    schema=COMBINED_QA_SCHEMA, effort="high", model=CLAUDE_MODEL,
                ),
                tools=SYNTHESIS_TOOLS,
                system=[{
                    "type": "text",
                    "text": COMBINED_QA_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=messages,
            )
        except Exception as e:
            logger.error("QA API call failed on turn %d: %s", turn, e)
            yield ("error", {"message": f"API-feil: {e}"})
            return

        elapsed_turn = int((time.monotonic() - t_turn) * 1000)
        turn_cost = cost_tracker.add(
            f"QA/{analysis_id}/turn-{turn}",
            CLAUDE_MODEL, response.usage, elapsed_ms=elapsed_turn,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            text = next(
                (b.text for b in response.content if hasattr(b, "text")), None,
            )
            if not text:
                yield ("error", {"message": "QA-loop ga ingen tekst-output"})
                return

            result = json_module.loads(text)
            total_elapsed = int((time.monotonic() - t0) * 1000)
            result["_llm_meta"] = {
                "model": CLAUDE_MODEL,
                "total_turns": turn,
                "tools_called": tools_called,
                "cost_usd": round(cost_tracker.total_cost, 6),
                "elapsed_ms": total_elapsed,
                "agentic": True,
            }

            persist_llm_call(
                analysis_id=analysis_id, call_type="qa",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="end_turn", turn=turn,
            )

            _persist_qa_report(analysis_id, result)

            logger.info(
                "Streaming QA complete: %d turns, %d tool calls, $%.4f, %.1fs",
                turn, len(tools_called), cost_tracker.total_cost,
                total_elapsed / 1000,
            )

            yield ("result", {"qa_report": result})
            return

        if response.stop_reason == "tool_use":
            turn_tool_calls = []
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    yield ("tool_call", {
                        "tool": block.name,
                        "input": block.input,
                        "turn": turn,
                    })

                    try:
                        tool_result = _execute_tool(block.name, block.input)
                        content = json_module.dumps(tool_result, ensure_ascii=False)
                        summary = _summarize_tool_result(block.name, tool_result)
                    except Exception as e:
                        logger.error("QA tool execution failed: %s", e)
                        content = json_module.dumps({"error": str(e)})
                        summary = f"Feil: {e}"

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

                    yield ("tool_result", {
                        "tool": block.name,
                        "summary": summary,
                        "success": tool_entry["success"],
                        "turn": turn,
                    })

            persist_llm_call(
                analysis_id=analysis_id, call_type="qa",
                model=CLAUDE_MODEL, usage=response.usage,
                cost_usd=turn_cost, elapsed_ms=elapsed_turn,
                stop_reason="tool_use", turn=turn,
                tool_calls=turn_tool_calls,
            )

            messages.append({"role": "user", "content": tool_results})
            continue

        yield ("error", {"message": f"Uventet stop_reason i QA: {response.stop_reason}"})
        return

    yield ("error", {"message": f"QA-loop nådde maks {MAX_QA_TOOL_TURNS} turns"})


def _persist_qa_report(analysis_id: str, result: dict) -> None:
    """Persist QA report to analysis_documents."""
    client = get_client()
    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_QA_REPORT,
            "content": json.dumps(result, ensure_ascii=False),
            "llm_meta": result.get("_llm_meta"),
            "version": 1,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()


def _run_qa_legacy(
    analysis_id: str,
    note_markdown: str,
    candidates: list[dict],
    candidates_summary: str,
) -> dict:
    """Legacy parallel QA — fallback if agentic QA fails."""
    with ThreadPoolExecutor(max_workers=3) as executor:
        citation_future = executor.submit(_verify_citations_with_api, candidates, note_markdown)
        logic_future = executor.submit(_check_logical_consistency, note_markdown, candidates_summary)
        coverage_future = executor.submit(_check_coverage, note_markdown, candidates_summary)

        citation_result = citation_future.result()
        logic_result = logic_future.result()
        coverage_result = coverage_future.result()

    return _build_and_persist_qa_report(
        analysis_id, citation_result, logic_result, coverage_result
    )


def _fetch_source_texts(candidates: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Fetch source texts for citation verification.

    Returns (quotes_to_verify, source_texts) where source_texts maps sak_nr → text.
    Shared by both real-time and batch citation verification.
    """
    quotes_to_verify = []
    source_cases = set()
    for c in candidates:
        screening = c.get("ai_screening", {})
        for q in screening.get("quotes", []):
            quotes_to_verify.append({
                "sak_nr": c["sak_nr"],
                "paragraph": q.get("p", 0),
                "text": q.get("text", ""),
            })
            source_cases.add(c["sak_nr"])

    if not quotes_to_verify:
        return [], {}

    important_cases = [c["sak_nr"] for c in candidates if c.get("category") in ("A", "B")]
    cases_to_fetch = [s for s in source_cases if s in important_cases][:MAX_CITATION_CASES]

    client_db = get_client()
    all_rows = (
        client_db.table("kofa_decision_text")
        .select("sak_nr, paragraph_number, text")
        .in_("sak_nr", cases_to_fetch)
        .eq("section", "vurdering")
        .order("paragraph_number")
        .execute()
        .data
    ) or []

    source_texts: dict[str, str] = {}
    for row in all_rows:
        sak_nr = row["sak_nr"]
        line = f"[{row['paragraph_number']}] {row['text']}"
        if sak_nr in source_texts:
            source_texts[sak_nr] += f"\n\n{line}"
        else:
            source_texts[sak_nr] = line

    return quotes_to_verify, source_texts


def _build_citation_batch_request(candidates: list[dict], note_markdown: str) -> dict | None:
    """Build a batch request for citation verification.

    Uses structured output (not Citations API) for batch compatibility.
    Returns None if no quotes to verify.
    """
    quotes_to_verify, source_texts = _fetch_source_texts(candidates)

    if not quotes_to_verify or not source_texts:
        return None

    # Build a combined user message with source texts and quotes
    source_parts = []
    for sak_nr, text in source_texts.items():
        source_parts.append(f"<kildetekst sak_nr=\"{sak_nr}\">\n{text}\n</kildetekst>")

    quotes_text = "\n".join(
        f"- {q['sak_nr']} §{q['paragraph']}: «{q['text']}»"
        for q in quotes_to_verify
        if q["sak_nr"] in source_texts
    )

    user_message = f"""{chr(10).join(source_parts)}

Verifiser følgende sitater mot kildetekstene over.

<sitater_å_verifisere>
{quotes_text}
</sitater_å_verifisere>

For hvert sitat: sjekk om det finnes ordrett i kildeteksten, om det er trunkert \
(fjerner kvalifikasjoner), eller om det avviker. Returner strukturert resultat."""

    return build_batch_request(
        custom_id="citation_qa",
        system_prompt=CITATION_QA_SYSTEM_PROMPT,
        user_message=user_message,
        schema=CITATION_QA_SCHEMA,
        max_tokens=4000,
        model=HAIKU_MODEL,
    )


def submit_qa_batch(analysis_id: str) -> str:
    """Submit QA as a batch with 3 requests (citation, logic, coverage).

    Returns batch_id for polling.
    """
    note_markdown, candidates, candidates_summary = _load_qa_inputs(analysis_id)

    # Build batch requests
    requests = []

    # 1. Citation verification
    citation_req = _build_citation_batch_request(candidates, note_markdown)
    if citation_req:
        requests.append(citation_req)
    else:
        # No quotes — add a dummy that returns empty
        requests.append(build_batch_request(
            custom_id="citation_qa",
            system_prompt=CITATION_QA_SYSTEM_PROMPT,
            user_message="Ingen sitater å verifisere. Returner tomt resultat.",
            schema=CITATION_QA_SCHEMA,
            max_tokens=1000,
            model=HAIKU_MODEL,
        ))

    # 2. Logical consistency
    logic_message = f"""<notat>
{note_markdown}
</notat>

<screeningresultater>
{candidates_summary}
</screeningresultater>

Sjekk notatets logiske konsistens mot screeningresultatene. Flagg problemer."""

    requests.append(build_batch_request(
        custom_id="logic_qa",
        system_prompt=LOGIC_QA_SYSTEM_PROMPT,
        user_message=logic_message,
        schema=LOGIC_QA_SCHEMA,
        max_tokens=4000,
        model=HAIKU_MODEL,
    ))

    # 3. Coverage check
    coverage_message = f"""<notat>
{note_markdown}
</notat>

<kandidater>
{candidates_summary}
</kandidater>

Sjekk om alle viktige saker (spesielt A-kandidater) er behandlet i notatet."""

    requests.append(build_batch_request(
        custom_id="coverage_qa",
        system_prompt=COVERAGE_QA_SYSTEM_PROMPT,
        user_message=coverage_message,
        schema=COVERAGE_QA_SCHEMA,
        max_tokens=4000,
        model=HAIKU_MODEL,
    ))

    return submit_batch(requests, log_label="QA batch")


def process_qa_batch_results(analysis_id: str, batch_id: str) -> dict:
    """Retrieve and process QA batch results. Persists report.

    Returns the combined QA report.
    """
    raw_results = get_batch_results(batch_id)

    citation_result = raw_results.get("citation_qa", {"verified_quotes": [], "summary": "Batch-feil"})
    logic_result = raw_results.get("logic_qa", {"flags": [], "summary": "Batch-feil"})
    coverage_result = raw_results.get("coverage_qa", {"untreated_cases": [], "summary": "Batch-feil"})

    return _build_and_persist_qa_report(
        analysis_id, citation_result, logic_result, coverage_result
    )
