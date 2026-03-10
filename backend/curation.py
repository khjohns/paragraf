import json
import logging
import os
import re

from cases import get_case_detail
from curation_cache import cache_curation, get_cached_curation, make_problem_hash

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-sonnet-4-20250514"
GEMINI_MODEL = "gemini-3-flash-preview"
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

Brukeren analyserer en KOFA-avgjørelse i kontekst av et konkret juridisk spørsmål (problemstilling) og bestemte lovbestemmelser (seed-bestemmelser).

Din oppgave er å identifisere de mest relevante avsnittene i avgjørelsesteksten og gi korte, presise kommentarer.

Returner ALLTID gyldig JSON med denne strukturen:
{
  "highlights": [
    {
      "paragraph": <avsnittsnummer>,
      "start_char": <startposisjon i avsnittsteksten>,
      "end_char": <sluttposisjon i avsnittsteksten>,
      "relevance": "<kort forklaring på norsk, 1-2 setninger>",
      "cross_references": [
        {
          "target_case": "<saksnummer, f.eks. 2022/789>",
          "target_paragraph": <avsnittsnummer>,
          "relation": "<confirming|contradicting|distinguishing>",
          "note": "<kort forklaring på norsk>"
        }
      ]
    }
  ],
  "summary_note": "<sammendrag av sakens relevans for problemstillingen, 2-3 setninger på norsk>"
}

Regler:
- Marker MAKS 5 avsnitt (velg de viktigste)
- start_char og end_char refererer til posisjoner i avsnittsteksten (0-indeksert)
- Bruk hele setninger for markering (ikke klipp midt i en setning)
- cross_references bare når det er tydelig referanse til en annen sak i teksten
- Skriv alltid på norsk
- Returner KUN JSON, ingen annen tekst"""


def _build_user_prompt(
    case_data: dict, problem_statement: str, seed_provisions: list[str]
) -> str:
    """Build the user prompt with case text and context."""
    parts = [
        f"## Problemstilling\n{problem_statement}",
        f"## Seed-bestemmelser\n{', '.join(seed_provisions) if seed_provisions else '(ingen)'}",
        f"## Avgjørelse: {case_data['sak_nr']}",
    ]

    if case_data.get("saken_gjelder"):
        parts.append(f"Saken gjelder: {case_data['saken_gjelder']}")
    if case_data.get("avgjoerelse"):
        parts.append(f"Avgjørelse: {case_data['avgjoerelse']}")

    # Add paragraphs (truncated if too long)
    paragraphs = case_data.get("paragraphs", [])
    text_parts = []
    total_chars = 0
    for p in paragraphs:
        text = p.get("text", "")
        if total_chars + len(text) > MAX_PARAGRAPHS_CHARS:
            text_parts.append(f"[Avsnitt {p['paragraph_number']}]: [avkortet — {len(paragraphs) - len(text_parts)} avsnitt gjenstår]")
            break
        text_parts.append(f"[Avsnitt {p['paragraph_number']}]: {text}")
        total_chars += len(text)

    parts.append("## Avgjørelsestekst\n" + "\n\n".join(text_parts))

    return "\n\n".join(parts)


def _parse_json_response(text: str) -> dict | None:
    """Parse JSON from LLM response, handling markdown code blocks."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return None
        return None


def _call_claude(user_prompt: str) -> str | None:
    """Call Anthropic Claude API. Returns raw text response."""
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text


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
        text = _call_claude(user_prompt)
    else:
        model_name = GEMINI_MODEL
        text = _call_gemini(user_prompt)

    if not text:
        return {
            "highlights": [],
            "summary_note": f"AI-kuratering feilet ({provider} — mangler API-nøkkel eller tom respons).",
        }

    logger.info("Curation generated via %s for %s", provider, sak_nr)

    # Parse response
    curation = _parse_json_response(text)
    if not curation:
        return {
            "highlights": [],
            "summary_note": "Kunne ikke tolke AI-responsen.",
        }

    # Validate structure
    if "highlights" not in curation:
        curation["highlights"] = []
    if "summary_note" not in curation:
        curation["summary_note"] = ""

    # Cache the result
    cache_curation(sak_nr, problem_hash, curation, model_name)

    return curation
