"""AI screening of KOFA cases — Sprint 13.

Sends case decision text + analysis context to Claude for structured screening.
Returns proposition, factum, assessment, quotes, nuances, and relevance per case.
"""
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

from db import get_client
from llm_utils import CLAUDE_MODEL

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
    sub_str = "\n".join(f"  {i+1}. {sp}" for i, sp in enumerate(sub_problems)) if sub_problems else "  Ingen delspørsmål"

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
) -> dict:
    """Screen a single case with Claude. Returns screening result dict.

    Uses structured outputs for guaranteed valid JSON, high effort for
    complex analysis, and prompt caching on the system prompt.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ScreeningError("ANTHROPIC_API_KEY ikke konfigurert")

    # Fetch case text
    case_text = _fetch_case_text(sak_nr, sections or ["vurdering"])
    if not case_text:
        raise ScreeningError(f"Ingen avgjørelsestekst funnet for {sak_nr}")

    user_message = _build_user_message(sak_nr, case_text, problem, sub_problems, provisions)

    client = anthropic.Anthropic(api_key=api_key, timeout=120.0)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": SCREENING_SCHEMA,
            },
            "effort": "high",
        },
        system=[
            {
                "type": "text",
                "text": SCREENING_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text
    logger.info(
        "Screening %s: %d input tokens (%d cached), %d output tokens",
        sak_nr,
        response.usage.input_tokens,
        getattr(response.usage, "cache_read_input_tokens", 0),
        response.usage.output_tokens,
    )

    result = json.loads(text)
    result["sak_nr"] = sak_nr
    return result


def _load_screening_context(analysis_id: str) -> tuple[str, list[str], list[str]]:
    """Load analysis context needed for screening.

    Returns (problem, sub_problems, provisions).
    Raises ScreeningError if analysis not found.
    """
    client = get_client()
    analysis = (
        client.table("analyses")
        .select("problem, refined_problem, sub_problems")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not analysis:
        raise ScreeningError("Analyse ikke funnet")

    problem = analysis.get("refined_problem") or analysis.get("problem", "")
    sub_problems = analysis.get("sub_problems") or []

    seeds = (
        client.table("analysis_seeds")
        .select("value")
        .eq("analysis_id", analysis_id)
        .eq("seed_type", "provision")
        .execute()
        .data
    )
    provisions = [s["value"] for s in (seeds or [])]
    return problem, sub_problems, provisions


def screen_cases(
    analysis_id: str,
    sak_nrs: list[str],
    max_parallel: int = 3,
):
    """Screen multiple cases in parallel, yielding results as they complete.

    Yields (sak_nr, result_dict) tuples. Each result is also persisted to DB.
    On error, yields (sak_nr, {"error": message}).
    """
    problem, sub_problems, provisions = _load_screening_context(analysis_id)

    with ThreadPoolExecutor(max_workers=max_parallel) as executor:
        futures = {
            executor.submit(
                screen_single_case, sak_nr, problem, sub_problems, provisions
            ): sak_nr
            for sak_nr in sak_nrs
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

    # Update candidate with screening result
    client.table("analysis_candidates").update({
        "ai_screening": result,
        "screening_status": "ai_screened",
    }).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()

    # Extract proposition to analysis_propositions (upsert by source_case+source)
    if result.get("proposition"):
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
