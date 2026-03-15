import logging
import os

from cases import get_case_detail
from curation_cache import cache_curation, get_cached_curation, make_problem_hash
from llm_utils import CLAUDE_MODEL, GEMINI_MODEL, call_claude_structured, parse_json_response

logger = logging.getLogger(__name__)
MAX_PARAGRAPHS_CHARS = 12000  # Truncate very long decisions

# JSON schema for structured Gemini output
CURATION_SCHEMA = {
    "type": "object",
    "properties": {
        "highlights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "paragraph": {"type": "integer"},
                    "start_char": {"type": "integer"},
                    "end_char": {"type": "integer"},
                    "relevance": {"type": "string"},
                    "cross_references": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "target_case": {"type": "string"},
                                "target_paragraph": {"type": "integer"},
                                "relation": {"type": "string", "enum": ["confirming", "contradicting", "distinguishing"]},
                                "note": {"type": "string"},
                            },
                            "required": ["target_case", "target_paragraph", "relation", "note"],
                        },
                    },
                },
                "required": ["paragraph", "start_char", "end_char", "relevance", "cross_references"],
            },
        },
        "summary_note": {"type": "string"},
    },
    "required": ["highlights", "summary_note"],
}


SYSTEM_PROMPT = """\
Du er en juridisk assistent for norsk anskaffelsesrett (KOFA-praksis).

Du får nemndas vurdering og konklusjon fra en KOFA-avgjørelse — IKKE partenes \
anførsler eller sakens bakgrunn/faktum. Alt du leser er nemndas egen rettslige analyse.

<instructions>
<task>
Identifiser avsnitt der nemnda fastslår rettssetninger, tolker bestemmelser, \
eller trekker konklusjoner som er relevante for problemstillingen. Fokuser på \
nemndas begrunnelse — ikke gjengivelse av partenes argumenter. Hvis nemnda \
siterer eller drøfter de oppgitte seed-bestemmelsene, marker disse avsnittene.
</task>
</instructions>

<formatting_rules>
- Marker MAKS 5 avsnitt (velg de viktigste)
- start_char og end_char refererer til posisjoner i avsnittsteksten (0-indeksert)
- Bruk hele setninger for markering (ikke klipp midt i en setning)
- cross_references bare når nemnda eksplisitt viser til en annen KOFA-sak
- Skriv alltid på norsk
</formatting_rules>"""


CURATION_SECTIONS = {"vurdering", "konklusjon"}


def _build_user_prompt(
    case_data: dict, problem_statement: str, seed_provisions: list[str]
) -> str:
    """Build the user prompt with only the tribunal's reasoning (vurdering + konklusjon)."""
    parts = [
        f"## Problemstilling\n{problem_statement}",
        f"## Seed-bestemmelser\n{', '.join(seed_provisions) if seed_provisions else '(ingen)'}",
        f"## Avgjørelse: {case_data['sak_nr']}",
    ]

    if case_data.get("saken_gjelder"):
        parts.append(f"Saken gjelder: {case_data['saken_gjelder']}")
    if case_data.get("avgjoerelse"):
        parts.append(f"Resultat: {case_data['avgjoerelse']}")

    # Only include vurdering + konklusjon (skip bakgrunn, anfoersler, innledning)
    paragraphs = [
        p for p in case_data.get("paragraphs", [])
        if p.get("section") in CURATION_SECTIONS
    ]

    text_parts = []
    total_chars = 0
    for p in paragraphs:
        text = p.get("text", "")
        if total_chars + len(text) > MAX_PARAGRAPHS_CHARS:
            text_parts.append(f"[Avsnitt {p['paragraph_number']}]: [avkortet]")
            break
        text_parts.append(f"[Avsnitt {p['paragraph_number']}]: {text}")
        total_chars += len(text)

    parts.append("## Nemndas vurdering\n" + "\n\n".join(text_parts))

    return "\n\n".join(parts)




def _call_claude(user_prompt: str) -> dict | None:
    """Call Anthropic Claude API with structured output. Returns parsed dict."""
    try:
        return call_claude_structured(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_prompt,
            schema=CURATION_SCHEMA,
            max_tokens=2000,
            effort="medium",
            log_label="Curation",
        )
    except Exception as e:
        logger.error("Curation Claude call failed: %s", e)
        return None


def _call_gemini(user_prompt: str) -> str | None:
    """Call Google Gemini API. Returns raw text response."""
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=4096,
            response_mime_type="application/json",
            response_json_schema=CURATION_SCHEMA,
        ),
    )
    return response.text


def _get_provider() -> str:
    """Determine which LLM provider to use. Default: gemini (cheaper for testing)."""
    provider = os.environ.get("CURATION_PROVIDER", "").lower()
    if provider in ("claude", "anthropic"):
        return "claude"
    if provider in ("gemini", "google"):
        return "gemini"
    # Auto-detect: prefer gemini if key available, fall back to claude
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "claude"
    return "none"


def generate_curation(
    sak_nr: str, problem_statement: str, seed_provisions: list[str]
) -> dict:
    """Generate AI curation for a case. Returns cached result if available."""
    problem_hash = make_problem_hash(problem_statement, seed_provisions)

    # Check cache
    cached = get_cached_curation(sak_nr, problem_hash)
    if cached:
        return cached

    # Fetch case data
    case_data = get_case_detail(sak_nr)
    if not case_data:
        return {"highlights": [], "summary_note": "Saken ble ikke funnet i databasen."}

    if not case_data.get("paragraphs"):
        return {"highlights": [], "summary_note": "Ingen avgjørelsestekst tilgjengelig."}

    # Determine provider
    provider = _get_provider()
    if provider == "none":
        return {
            "highlights": [],
            "summary_note": "AI-kuratering er ikke tilgjengelig (mangler API-nøkkel).",
        }

    user_prompt = _build_user_prompt(case_data, problem_statement, seed_provisions)

    # Call LLM
    if provider == "claude":
        model_name = CLAUDE_MODEL
        curation = _call_claude(user_prompt)
    else:
        model_name = GEMINI_MODEL
        text = _call_gemini(user_prompt)
        curation = parse_json_response(text) if text else None

    if not curation:
        return {
            "highlights": [],
            "summary_note": f"AI-kuratering feilet ({provider} — mangler API-nøkkel eller tom respons).",
        }

    logger.info("Curation generated via %s for %s", provider, sak_nr)

    # Validate structure
    if "highlights" not in curation:
        curation["highlights"] = []
    if "summary_note" not in curation:
        curation["summary_note"] = ""

    # Cache the result
    cache_curation(sak_nr, problem_hash, curation, model_name)

    return curation
