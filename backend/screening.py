"""AI screening of KOFA cases — Sprint 13.

Sends case decision text + analysis context to Claude for structured screening.
Returns proposition, factum, assessment, quotes, nuances, and relevance per case.
"""
import contextvars
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from db import get_client
from llm_utils import (
    call_claude_structured,
    format_sub_problems,
    load_analysis_context,
    build_batch_request,
    submit_batch,
    get_batch_results,
)

logger = logging.getLogger(__name__)


class ScreeningError(Exception):
    """Raised when screening fails."""


# --- JSON Schema for structured output ---

SCREENING_SCHEMA = {
    "type": "object",
    "properties": {
        "factum": {
            "type": "string",
            "description": "Kort om hva saken gjelder — faktum",
        },
        "assessment": {
            "type": "string",
            "description": "Hva nemnda konkluderer og hvorfor — nemndas vurdering",
        },
        "proposition": {
            "type": "string",
            "description": "Destillert rettssetning som kan gjenbrukes",
        },
        "quotes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "p": {"type": "integer", "description": "Avsnittsnummer"},
                    "text": {"type": "string", "description": "Ordrett sitat fra teksten"},
                },
                "required": ["p", "text"],
                "additionalProperties": False,
            },
            "description": "Nøkkelsitater med avsnittsnumre",
        },
        "nuances": {
            "type": ["string", "null"],
            "description": "Motargumenter, unntak, dissens",
        },
        "relevance": {
            "type": "string",
            "enum": ["A", "B", "C"],
            "description": "A=direkte relevant, B=utfyllende, C=perifer",
        },
        "relevance_reasoning": {
            "type": "string",
            "description": "Kort begrunnelse for relevansvurderingen",
        },
        "star": {
            "type": "boolean",
            "description": "True hvis dette er en gullkandidat — særlig viktig avgjørelse",
        },
    },
    "required": [
        "factum",
        "assessment",
        "proposition",
        "quotes",
        "nuances",
        "relevance",
        "relevance_reasoning",
        "star",
    ],
    "additionalProperties": False,
}


SCREENING_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du screener KOFA-avgjørelser for en erfaren jurist som undersøker et konkret \
rettsspørsmål.

<instructions>
<role>
Du får avgjørelsesteksten (seksjonen «vurdering») fra en KOFA-sak, sammen med \
juristens problemstilling, delspørsmål og relevante bestemmelser. Din oppgave er \
å screene saken og returnere en strukturert oppsummering.
</role>

<task name="factum">
Kort om hva saken gjelder — fakta og tvistepunkt. 2-3 setninger.
</task>

<task name="assessment">
Hva nemnda konkluderer og hvorfor. Fokuser på rettslig begrunnelse, ikke \
prosessuelle forhold. 2-4 setninger.
</task>

<task name="proposition">
Destillert rettssetning som kan gjenbrukes i juristens analyse. Formuler som \
en generell regel utledet fra denne avgjørelsen. Én setning, maks to.
</task>

<task name="quotes">
Velg 2-5 nøkkelsitater fra teksten. For hvert sitat:
- Ta med avsnittsnummer (p).
- Siter ordrett — ikke trunker bort kvalifikasjoner. Hvis originalteksten har \
  vilkår som begrenser utsagnet, skal de med i sitatet.
- Prioriter sitater som underbygger rettssetningen.
</task>

<task name="nuances">
Noter hvis nemnda drøfter motargumenter, unntak, eller dissens. Disse er like \
viktige som hovedkonklusjonen. Null hvis ingen vesentlige nyanser.
</task>

<task name="relevance">
Vurder relevans for juristens konkrete problemstilling:
- A: Direkte relevant — saken behandler kjernen av spørsmålet
- B: Utfyllende — gir nyttig kontekst eller prinsipper
- C: Perifer — tangerer problemstillingen
Begrunn kort i relevance_reasoning.
</task>

<task name="star">
Sett true hvis dette er en «gullkandidat» — en særlig viktig avgjørelse som \
bør få sentral plass i analysen. Typisk: direkte parallell i faktum OG \
klare rettssetninger.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær presis og konsis — dette er et kompresjonslag, ikke en fullstendig analyse
- Sitater skal være ordrett fra teksten
</formatting_rules>"""


def _fetch_case_text(sak_nr: str, sections: list[str] | None = None) -> str:
    """Fetch decision text for a case, optionally filtered by section."""
    client = get_client()
    q = (
        client.table("kofa_decision_text")
        .select("paragraph_number, section, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
    )
    if sections:
        q = q.in_("section", sections)
    rows = q.execute().data or []
    if not rows:
        return ""
    return "\n\n".join(
        f"[{r['paragraph_number']}] {r['text']}" for r in rows
    )


def _build_user_message(
    sak_nr: str,
    case_text: str,
    problem: str,
    sub_problems: list[str],
    provisions: list[str],
) -> str:
    """Build the user message for a screening call."""
    prov_str = ", ".join(provisions) if provisions else "Ingen spesifikke bestemmelser"
    sub_str = format_sub_problems(sub_problems)

    return f"""<case>
<sak_nr>{sak_nr}</sak_nr>
<avgjørelsestekst>
{case_text}
</avgjørelsestekst>
</case>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{sub_str}
</delspørsmål>
<bestemmelser>{prov_str}</bestemmelser>
</analysis_context>

Screen denne KOFA-avgjørelsen for relevans til problemstillingen over."""


def screen_single_case(
    sak_nr: str,
    problem: str,
    sub_problems: list[str],
    provisions: list[str],
    sections: list[str] | None = None,
    case_text: str | None = None,
) -> dict:
    """Screen a single case with Claude. Returns screening result dict.

    Uses structured outputs for guaranteed valid JSON, high effort for
    complex analysis, and prompt caching on the system prompt.

    Args:
        case_text: Pre-fetched case text. If None, fetches from DB.
    """
    # Fetch case text if not pre-supplied
    if case_text is None:
        case_text = _fetch_case_text(sak_nr, sections or ["vurdering"])
    if not case_text:
        raise ScreeningError(f"Ingen avgjørelsestekst funnet for {sak_nr}")

    user_message = _build_user_message(sak_nr, case_text, problem, sub_problems, provisions)

    result = call_claude_structured(
        system_prompt=SCREENING_SYSTEM_PROMPT,
        user_message=user_message,
        schema=SCREENING_SCHEMA,
        max_tokens=4000,
        effort="high",
        log_label=f"Screening {sak_nr}",
    )

    result["sak_nr"] = sak_nr
    return result


def _load_screening_context(analysis_id: str) -> tuple[str, list[str], list[str]]:
    """Load analysis context needed for screening.

    Returns (problem, sub_problems, provisions).
    Raises ScreeningError if analysis not found.
    """
    ctx = load_analysis_context(analysis_id)
    return ctx["problem"], ctx["sub_problems"], ctx["provisions"]


def screen_cases(
    analysis_id: str,
    sak_nrs: list[str],
    max_parallel: int | None = None,
):
    """Screen multiple cases in parallel, yielding results as they complete.

    Yields (sak_nr, result_dict) tuples. Each result is also persisted to DB.
    On error, yields (sak_nr, {"error": message}).
    Skips cases that already have ai_screening in DB (use /rescreen to force).
    """
    if max_parallel is None:
        max_parallel = int(os.environ.get("MAX_PARALLEL_SCREENING", "3"))

    # Filter out already-screened cases
    db_client = get_client()
    existing = (
        db_client.table("analysis_candidates")
        .select("sak_nr")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .in_("sak_nr", sak_nrs)
        .execute()
        .data
    ) or []
    already_screened = {r["sak_nr"] for r in existing}

    to_screen = [s for s in sak_nrs if s not in already_screened]
    if already_screened:
        logger.info(
            "Skipping %d already-screened cases for %s: %s",
            len(already_screened), analysis_id, already_screened,
        )

    if not to_screen:
        logger.info("All %d cases already screened for %s", len(sak_nrs), analysis_id)
        return

    problem, sub_problems, provisions = _load_screening_context(analysis_id)

    # Pre-fetch all case texts in a single DB query to avoid per-case fetches
    case_texts = _fetch_case_texts_batch(to_screen, ["vurdering"])

    with ThreadPoolExecutor(max_workers=max_parallel) as executor:
        futures = {
            executor.submit(
                # Copy context per thread so child inherits request_id for log correlation
                contextvars.copy_context().run,
                screen_single_case, sak_nr, problem, sub_problems, provisions,
                case_text=case_texts.get(sak_nr),
            ): sak_nr
            for sak_nr in to_screen
        }

        for future in as_completed(futures):
            sak_nr = futures[future]
            try:
                result = future.result()
                _persist_screening_result(analysis_id, sak_nr, result)
                yield sak_nr, result
            except Exception as e:
                logger.error("Screening failed for %s: %s", sak_nr, e)
                yield sak_nr, {"error": str(e), "sak_nr": sak_nr}


def rescreen_case(
    analysis_id: str,
    sak_nr: str,
    sections: list[str] | None = None,
) -> dict:
    """Re-screen a single case with more context (additional sections)."""
    problem, sub_problems, provisions = _load_screening_context(analysis_id)

    result = screen_single_case(
        sak_nr, problem, sub_problems, provisions,
        sections=sections or ["vurdering", "bakgrunn"],
    )

    _persist_screening_result(analysis_id, sak_nr, result)
    return result


def _persist_screening_result(analysis_id: str, sak_nr: str, result: dict):
    """Save screening result to analysis_candidates and extract propositions."""
    client = get_client()

    # ADR-006: category is set by screening (ai_screening.relevance), not by traversal
    update_data = {
        "ai_screening": result,
        "screening_status": "ai_screened",
    }
    relevance = result.get("relevance")
    if relevance in ("A", "B", "C"):
        update_data["category"] = relevance

    client.table("analysis_candidates").update(
        update_data
    ).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()

    # Increment total_cost_usd on the analysis
    cost = (result.get("_llm_meta") or {}).get("cost_usd", 0)
    if cost:
        client.rpc("increment_total_cost", {
            "analysis_id_input": analysis_id,
            "cost_increment": cost,
        }).execute()

    # Extract proposition to analysis_propositions (upsert by source_case+source)
    if result.get("proposition"):
        try:
            client.table("analysis_propositions").upsert(
                {
                    "analysis_id": analysis_id,
                    "proposition_text": result["proposition"],
                    "source_case": sak_nr,
                    "source": "ai_screening",
                    "confirmed": False,
                },
                on_conflict="analysis_id,source_case,source",
            ).execute()
        except Exception as e:
            logger.warning(
                "Failed to upsert proposition for %s (analysis %s): %s",
                sak_nr, analysis_id, e,
            )


def _fetch_case_texts_batch(sak_nrs: list[str], sections: list[str] | None = None) -> dict[str, str]:
    """Fetch decision texts for multiple cases in a single DB query.

    Returns dict mapping sak_nr → formatted text. Cases with no text are omitted.
    """
    client = get_client()
    q = (
        client.table("kofa_decision_text")
        .select("sak_nr, paragraph_number, section, text")
        .in_("sak_nr", sak_nrs)
        .order("paragraph_number")
    )
    if sections:
        q = q.in_("section", sections)
    rows = q.execute().data or []

    texts: dict[str, list[str]] = {}
    for r in rows:
        sak_nr = r["sak_nr"]
        if sak_nr not in texts:
            texts[sak_nr] = []
        texts[sak_nr].append(f"[{r['paragraph_number']}] {r['text']}")

    return {sak_nr: "\n\n".join(parts) for sak_nr, parts in texts.items()}


def screen_cases_batch(analysis_id: str, sak_nrs: list[str]) -> str:
    """Submit screening for multiple cases as a single batch.

    Returns the batch_id for polling. Results are persisted when retrieved
    via process_screening_batch_results().
    """
    problem, sub_problems, provisions = _load_screening_context(analysis_id)

    # Fetch all case texts in a single DB query
    case_texts = _fetch_case_texts_batch(sak_nrs, ["vurdering"])

    requests = []
    for sak_nr in sak_nrs:
        case_text = case_texts.get(sak_nr)
        if not case_text:
            logger.warning("No case text for %s — skipping in batch", sak_nr)
            continue

        user_message = _build_user_message(
            sak_nr, case_text, problem, sub_problems, provisions
        )
        requests.append(
            build_batch_request(
                custom_id=sak_nr.replace("/", "_"),
                system_prompt=SCREENING_SYSTEM_PROMPT,
                user_message=user_message,
                schema=SCREENING_SCHEMA,
                max_tokens=4000,
            )
        )

    if not requests:
        raise ScreeningError("Ingen saker med avgjørelsestekst å screene")

    return submit_batch(requests, log_label=f"Screening batch ({len(requests)} saker)")


def process_screening_batch_results(analysis_id: str, batch_id: str) -> list[dict]:
    """Retrieve and persist results from a completed screening batch.

    Returns list of screening result dicts (with sak_nr set).
    """
    raw_results = get_batch_results(batch_id)
    results = []

    for sak_nr, result in raw_results.items():
        result["sak_nr"] = sak_nr
        if "error" not in result:
            _persist_screening_result(analysis_id, sak_nr, result)
        results.append(result)

    return results
