import json
import os
import re

import anthropic

from cases import get_case_detail
from curation_cache import cache_curation, get_cached_curation, make_problem_hash

MODEL = "claude-sonnet-4-20250514"
MAX_PARAGRAPHS_CHARS = 12000  # Truncate very long decisions


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

    # Check API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "highlights": [],
            "summary_note": "AI-kuratering er ikke tilgjengelig (mangler API-nøkkel).",
        }

    # Call Claude
    client = anthropic.Anthropic(api_key=api_key)
    user_prompt = _build_user_prompt(case_data, problem_statement, seed_provisions)

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    # Parse response
    text = response.content[0].text
    try:
        curation = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from response if wrapped in markdown
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            curation = json.loads(match.group())
        else:
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
    cache_curation(sak_nr, problem_hash, curation, MODEL)

    return curation
