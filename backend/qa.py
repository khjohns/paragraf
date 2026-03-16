"""Quality Assurance — Sprint 15.

Three-part QA process:
1. Citation verification — uses Citations API to verify quotes match source text
2. Logical consistency — checks if conclusions follow from case law
3. Coverage check — ensures all A-candidates are treated in the note
"""
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from db import get_client
from synthesis import DOC_TYPE_NOTE, DOC_TYPE_QA_REPORT
from llm_utils import (
    CLAUDE_MODEL,
    HAIKU_MODEL,
    get_anthropic_client,
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
    build_batch_request,
    submit_batch,
    get_batch_results,
    log_usage,
    parse_json_response,
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

    log_usage(response.usage, HAIKU_MODEL, "Citation QA")

    # Extract text blocks (skip cite blocks — they confirm source positions)
    text_parts = [block.text for block in response.content if block.type == "text"]
    full_text = "\n".join(text_parts)

    result = parse_json_response(full_text)
    if result is None:
        logger.warning("Citation QA: could not parse JSON from response")
        return {"verified_quotes": [], "summary": "Kunne ikke tolke QA-respons."}

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
        max_tokens=4000,
        effort="medium",
        model=HAIKU_MODEL,
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
        max_tokens=4000,
        effort="medium",
        model=HAIKU_MODEL,
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


def run_qa(analysis_id: str) -> dict:
    """Run full QA on the synthesis note.

    Performs three checks in parallel:
    1. Citation verification (with Citations API)
    2. Logical consistency
    3. Coverage check

    Returns combined QA report. Persists report in analysis_documents.
    """
    note_markdown, candidates, candidates_summary = _load_qa_inputs(analysis_id)

    logger.info("Starting QA for analysis %s", analysis_id)

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
        effort="medium",
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
            effort="medium",
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
        effort="medium",
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
        effort="medium",
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
