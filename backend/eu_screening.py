"""EU case screening — Sprint 15.

Identifies EU cases referenced by screened KOFA cases, then screens them
with an adapted template focused on directive interpretation.
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from db import get_client
from llm_utils import (
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
    build_batch_request,
    submit_batch,
    get_batch_results,
)

logger = logging.getLogger(__name__)


class EuScreeningError(Exception):
    """Raised when EU screening fails."""


EU_SCREENING_SCHEMA = {
    "type": "object",
    "properties": {
        "factum": {
            "type": "string",
            "description": "Kort om hva saken gjelder — tvistepunkt og direktivbestemmelse",
        },
        "holding": {
            "type": "string",
            "description": "Domstolens konklusjon og begrunnelse — rettslig kjerne",
        },
        "proposition": {
            "type": "string",
            "description": "Destillert rettssetning fra EU-domstolen",
        },
        "directive_articles": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Direktivartikler som tolkes (f.eks. 'Dir. 2014/24/EU art. 58')",
        },
        "kofa_relevance": {
            "type": "string",
            "description": "Hvordan dommen er relevant for norsk anskaffelsesrett og KOFA-praksis",
        },
        "quotes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "p": {"type": "integer", "description": "Avsnittsnummer"},
                    "text": {"type": "string", "description": "Ordrett sitat"},
                },
                "required": ["p", "text"],
                "additionalProperties": False,
            },
            "description": "Nøkkelsitater fra dommen",
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
    },
    "required": [
        "factum",
        "holding",
        "proposition",
        "directive_articles",
        "kofa_relevance",
        "quotes",
        "relevance",
        "relevance_reasoning",
    ],
    "additionalProperties": False,
}


EU_SCREENING_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for EU/EØS-anskaffelsesrett. \
Du screener EU-domstolens avgjørelser for en erfaren jurist som undersøker et \
konkret rettsspørsmål i norsk anskaffelsesrett.

<instructions>
<role>
Du får informasjon om en EU-dom (beskrivelse, kontekst fra refererende KOFA-saker), \
sammen med juristens problemstilling, delspørsmål og relevante bestemmelser. Din \
oppgave er å screene dommen og returnere en strukturert oppsummering med fokus på \
direktivtolkning.
</role>

<task name="factum">
Kort om hva saken gjelder — tvistepunkt, parter og relevant direktivbestemmelse. \
2-3 setninger.
</task>

<task name="holding">
Domstolens konklusjon og rettslige begrunnelse. Fokuser på den generelle regelen \
som utledes, ikke bare resultatet i den konkrete saken. 2-4 setninger.
</task>

<task name="proposition">
Destillert rettssetning fra EU-domstolen som kan gjenbrukes i juristens analyse. \
Formuler som en generell regel. Én setning, maks to.
</task>

<task name="directive_articles">
List opp direktivartiklene som tolkes i dommen (f.eks. 'Dir. 2014/24/EU art. 58').
</task>

<task name="kofa_relevance">
Forklar kort hvordan denne EU-dommen er relevant for norsk anskaffelsesrett og \
KOFA-praksis. Nevn koblingen mellom EU-direktivet og den norske forskriften.
</task>

<task name="quotes">
Velg 1-3 nøkkelsitater fra dommen eller dens beskrivelse. For hvert sitat:
- Ta med avsnittsnummer hvis tilgjengelig.
- Siter ordrett.
</task>

<task name="relevance">
Vurder relevans for juristens konkrete problemstilling:
- A: Direkte relevant — dommen behandler kjernen av spørsmålet
- B: Utfyllende — gir nyttig EU-rettslig kontekst
- C: Perifer — tangerer problemstillingen
Begrunn kort i relevance_reasoning.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær presis og konsis
- Fokuser på direktivtolkning og overførbarhet til norsk rett
</formatting_rules>"""


def identify_eu_cases(analysis_id: str) -> list[dict]:
    """Identify EU cases referenced by screened KOFA cases in this analysis.

    Returns a list of EU case dicts with reference count and contexts,
    sorted by reference count (most referenced first).
    """
    client = get_client()

    # Get all screened KOFA case sak_nrs for this analysis
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr")
        .eq("analysis_id", analysis_id)
        .eq("screening_status", "ai_screened")
        .execute()
        .data
    ) or []

    if not candidates:
        return []

    sak_nrs = [c["sak_nr"] for c in candidates]

    # Find EU cases referenced by these KOFA cases
    refs = (
        client.table("kofa_eu_references")
        .select("eu_case_id, sak_nr, context, paragraph_number")
        .in_("sak_nr", sak_nrs)
        .execute()
        .data
    ) or []

    if not refs:
        return []

    # Group by eu_case_id
    eu_map: dict[str, dict] = {}
    for r in refs:
        eu_id = r["eu_case_id"]
        if eu_id not in eu_map:
            eu_map[eu_id] = {"eu_case_id": eu_id, "references": [], "contexts": []}
        eu_map[eu_id]["references"].append(r["sak_nr"])
        if r.get("context"):
            eu_map[eu_id]["contexts"].append(
                f"{r['sak_nr']} (§{r.get('paragraph_number', '?')}): {r['context']}"
            )

    # Fetch EU case metadata
    eu_ids = list(eu_map.keys())
    eu_cases = (
        client.table("kofa_eu_case_law")
        .select("eu_case_id, celex, case_name, judgment_date, subject, description")
        .in_("eu_case_id", eu_ids)
        .execute()
        .data
    ) or []

    result = []
    for ec in eu_cases:
        eu_id = ec["eu_case_id"]
        info = eu_map.get(eu_id, {})
        result.append({
            "eu_case_id": eu_id,
            "celex": ec.get("celex"),
            "case_name": ec.get("case_name"),
            "judgment_date": str(ec["judgment_date"]) if ec.get("judgment_date") else None,
            "subject": ec.get("subject"),
            "description": ec.get("description"),
            "ref_count": len(set(info.get("references", []))),
            "referencing_sak_nrs": list(set(info.get("references", []))),
            "contexts": info.get("contexts", []),
        })

    # Sort by reference count descending
    result.sort(key=lambda x: x["ref_count"], reverse=True)
    return result


def _build_eu_user_message(
    eu_case: dict,
    problem: str,
    sub_problems: list[str],
    provisions: list[str],
) -> str:
    """Build user message for an EU case screening call."""
    prov_str = ", ".join(provisions) if provisions else "Ingen spesifikke bestemmelser"
    sub_str = format_sub_problems(sub_problems)

    # Build EU case context from description + reference contexts
    case_text_parts = []
    if eu_case.get("subject"):
        case_text_parts.append(f"Emne: {eu_case['subject']}")
    if eu_case.get("description"):
        case_text_parts.append(f"Beskrivelse:\n{eu_case['description']}")
    if eu_case.get("contexts"):
        case_text_parts.append(
            "Kontekst fra refererende KOFA-saker:\n"
            + "\n".join(f"- {c}" for c in eu_case["contexts"][:10])
        )

    case_text = "\n\n".join(case_text_parts) or "Ingen beskrivelse tilgjengelig"

    return f"""<eu_case>
<eu_case_id>{eu_case['eu_case_id']}</eu_case_id>
<case_name>{eu_case.get('case_name', 'Ukjent')}</case_name>
<celex>{eu_case.get('celex', '')}</celex>
<judgment_date>{eu_case.get('judgment_date', '')}</judgment_date>
<innhold>
{case_text}
</innhold>
<refererende_kofa_saker>{', '.join(eu_case.get('referencing_sak_nrs', []))}</refererende_kofa_saker>
</eu_case>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{sub_str}
</delspørsmål>
<bestemmelser>{prov_str}</bestemmelser>
</analysis_context>

Screen denne EU-dommen for relevans til problemstillingen over. Fokuser på \
direktivtolkning og overførbarhet til norsk anskaffelsesrett."""


def screen_single_eu_case(
    eu_case: dict,
    problem: str,
    sub_problems: list[str],
    provisions: list[str],
) -> dict:
    """Screen a single EU case with Claude."""
    user_message = _build_eu_user_message(eu_case, problem, sub_problems, provisions)

    try:
        result = call_claude_structured(
            system_prompt=EU_SCREENING_SYSTEM_PROMPT,
            user_message=user_message,
            schema=EU_SCREENING_SCHEMA,
            max_tokens=4000,
            log_label=f"EU screening {eu_case['eu_case_id']}",
        )
    except Exception as e:
        logger.error("EU screening LLM-kall feilet for %s: %s", eu_case["eu_case_id"], e)
        raise EuScreeningError(f"LLM-kall feilet for {eu_case['eu_case_id']}: {e}") from e

    result["eu_case_id"] = eu_case["eu_case_id"]
    result["case_name"] = eu_case.get("case_name")
    result["ref_count"] = eu_case.get("ref_count", 0)
    return result


def screen_eu_cases(
    analysis_id: str,
    eu_case_ids: list[str] | None = None,
    max_parallel: int = 3,
):
    """Screen EU cases in parallel, yielding results as they complete.

    If eu_case_ids is None, identifies EU cases automatically from screened candidates.
    Yields (eu_case_id, result_dict) tuples.
    """
    # Load analysis context
    ctx = load_analysis_context(analysis_id)
    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]
    provisions = ctx["provisions"]

    # Identify or filter EU cases
    all_eu_cases = identify_eu_cases(analysis_id)
    if not all_eu_cases:
        return

    if eu_case_ids:
        all_eu_cases = [ec for ec in all_eu_cases if ec["eu_case_id"] in eu_case_ids]

    with ThreadPoolExecutor(max_workers=max_parallel) as executor:
        futures = {
            executor.submit(
                screen_single_eu_case, ec, problem, sub_problems, provisions
            ): ec["eu_case_id"]
            for ec in all_eu_cases
        }

        for future in as_completed(futures):
            eu_case_id = futures[future]
            try:
                result = future.result()
                _persist_eu_screening(analysis_id, eu_case_id, result)
                yield eu_case_id, result
            except Exception as e:
                logger.error("EU screening failed for %s: %s", eu_case_id, e)
                yield eu_case_id, {"error": str(e), "eu_case_id": eu_case_id}


def _persist_eu_screening(analysis_id: str, eu_case_id: str, result: dict):
    """Persist EU screening result to analysis_propositions."""
    client = get_client()

    if result.get("proposition"):
        client.table("analysis_propositions").upsert(
            {
                "analysis_id": analysis_id,
                "proposition_text": result["proposition"],
                "source_case": f"eu:{eu_case_id}",
                "source": "ai_screening",
                "theme": "EU-rett",
                "confirmed": False,
            },
            on_conflict="analysis_id,source_case,source",
        ).execute()


def screen_eu_cases_batch(
    analysis_id: str,
    eu_case_ids: list[str] | None = None,
) -> str:
    """Submit EU case screening as a single batch.

    Returns batch_id for polling.
    """
    ctx = load_analysis_context(analysis_id)
    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]
    provisions = ctx["provisions"]

    all_eu_cases = identify_eu_cases(analysis_id)
    if not all_eu_cases:
        raise EuScreeningError("Ingen EU-saker å screene")

    if eu_case_ids:
        all_eu_cases = [ec for ec in all_eu_cases if ec["eu_case_id"] in eu_case_ids]

    requests = []
    for ec in all_eu_cases:
        user_message = _build_eu_user_message(ec, problem, sub_problems, provisions)
        requests.append(
            build_batch_request(
                custom_id=ec["eu_case_id"].replace("/", "_"),
                system_prompt=EU_SCREENING_SYSTEM_PROMPT,
                user_message=user_message,
                schema=EU_SCREENING_SCHEMA,
                max_tokens=4000,
            )
        )

    if not requests:
        raise EuScreeningError("Ingen EU-saker med data å screene")

    return submit_batch(requests, log_label=f"EU screening batch ({len(requests)} saker)")


def process_eu_screening_batch_results(
    analysis_id: str,
    batch_id: str,
    eu_cases_meta: list[dict] | None = None,
) -> list[dict]:
    """Retrieve and persist results from a completed EU screening batch.

    Returns list of EU screening result dicts.
    """
    raw_results = get_batch_results(batch_id)

    # Build metadata map for enriching results
    meta_map: dict[str, dict] = {}
    if eu_cases_meta:
        for ec in eu_cases_meta:
            meta_map[ec["eu_case_id"]] = ec

    results = []
    for eu_case_id, result in raw_results.items():
        result["eu_case_id"] = eu_case_id
        meta = meta_map.get(eu_case_id, {})
        result["case_name"] = meta.get("case_name")
        result["ref_count"] = meta.get("ref_count", 0)

        if "error" not in result:
            _persist_eu_screening(analysis_id, eu_case_id, result)
        results.append(result)

    return results
