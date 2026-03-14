"""Cross-propositions analysis — Sprint 14.

Sends all propositions + key quotes to Claude for thematic grouping,
evolution analysis, and tension identification across cases.
"""
import json
import logging
import os

import anthropic

from db import get_client
from llm_utils import CLAUDE_MODEL

logger = logging.getLogger(__name__)


class CrossPropositionsError(Exception):
    """Raised when cross-proposition analysis fails."""


CROSS_PROPOSITIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "propositions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unik ID for rettssetningen (rs1, rs2, ...)",
                    },
                    "theme": {
                        "type": "string",
                        "description": "Tematisk gruppering — kort overskrift",
                    },
                    "proposition": {
                        "type": "string",
                        "description": "Destillert tverrgående rettssetning",
                    },
                    "instances": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "caseId": {"type": "string"},
                                "paragraph": {"type": "integer"},
                                "date": {"type": "string"},
                                "evolution": {
                                    "type": "string",
                                    "enum": ["established", "confirmed", "qualified", "consolidating"],
                                },
                                "quote": {"type": "string"},
                                "suggested": {"type": "boolean"},
                            },
                            "required": ["caseId", "paragraph", "date", "evolution", "quote"],
                            "additionalProperties": False,
                        },
                    },
                    "tension": {
                        "type": ["object", "null"],
                        "properties": {
                            "withId": {
                                "type": "string",
                                "description": "ID for rettssetningen det er spenning mot",
                            },
                            "note": {
                                "type": "string",
                                "description": "Kort beskrivelse av spenningen",
                            },
                        },
                        "required": ["withId", "note"],
                        "additionalProperties": False,
                    },
                },
                "required": ["id", "theme", "proposition", "instances"],
                "additionalProperties": False,
            },
        },
        "themes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Liste over alle temaer i rekkefølge",
        },
    },
    "required": ["propositions", "themes"],
    "additionalProperties": False,
}


CROSS_PROPOSITIONS_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du analyserer rettssetninger på tvers av KOFA-avgjørelser for å identifisere \
mønstre, utvikling og spenninger.

<instructions>
<role>
Du mottar rettssetninger og nøkkelsitater fra screening av KOFA-avgjørelser, \
sammen med juristens problemstilling. Din oppgave er å organisere disse \
tverrgående — finne mønstre, spore utvikling og avdekke spenninger.
</role>

<task name="propositions">
Formuler tverrgående rettssetninger basert på de individuelle rettssetningene \
fra screeningen. For hver rettssetning:

1. **Tema**: Grupper relaterte rettssetninger under et kort, beskrivende tema.
2. **Rettssetning**: Formuler en presis, gjenbrukbar rettssetning som syntetiserer \
   innsikten fra flere saker. Én til to setninger.
3. **Forekomster (instances)**: List sakene som underbygger rettssetningen, med:
   - caseId: saksnummer
   - paragraph: avsnittsnummer for det mest relevante sitatet
   - date: avgjørelsesdato (YYYY-MM-DD format)
   - evolution: klassifiser forekomsten:
     * established: Første gang prinsippet formuleres
     * confirmed: Bekrefter et allerede etablert prinsipp
     * qualified: Presiserer eller nyanserer prinsippet
     * consolidating: Konsoliderer en etablert rettsoppfatning
   - quote: Ordrett sitat fra avgjørelsen som underbygger rettssetningen
   - suggested: true hvis denne koblingen er en AI-vurdering (ikke eksplisitt i teksten)
4. **Spenninger (tension)**: Identifiser spenninger mellom rettssetninger — \
   der to prinsipper trekker i ulik retning. Bruk withId for å referere \
   til ID-en til den andre rettssetningen, og note for å beskrive spenningen.
</task>

<task name="themes">
List alle temaer i logisk rekkefølge — fra kjernespørsmål til perifere emner.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Rettssetninger skal være presise og formelle — de skal kunne brukes direkte \
  i en juridisk analyse
- Sitater skal være ordrett fra kildematerialet
- Forekomster sorteres kronologisk innenfor hver rettssetning
- Spenninger er like viktige som konsistens — jobb hardt for å finne dem
- Bruk 'established' sparsomt — kun for den tidligste formuleringen av et prinsipp
- Merk forekomster som 'suggested: true' når koblingen er en tolkning, \
  ikke en eksplisitt referanse i teksten
</formatting_rules>"""


def generate_cross_propositions(analysis_id: str) -> dict:
    """Analyze propositions across cases and return themed, structured result.

    Sends all screening propositions + quotes to Claude for cross-analysis.
    Returns propositions grouped by theme with evolution and tensions.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise CrossPropositionsError("ANTHROPIC_API_KEY ikke konfigurert")

    client = get_client()

    # Load analysis context
    analysis = (
        client.table("analyses")
        .select("problem, refined_problem, sub_problems")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not analysis:
        raise CrossPropositionsError("Analyse ikke funnet")

    problem = analysis.get("refined_problem") or analysis.get("problem", "")
    sub_problems = analysis.get("sub_problems") or []

    # Load all screened candidates with their screening results
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .execute()
        .data
    ) or []

    if not candidates:
        raise CrossPropositionsError("Ingen screende saker å analysere")

    # Build detailed input with propositions and quotes
    case_parts = []
    for c in candidates:
        screening = c["ai_screening"]
        quotes_str = "\n".join(
            f"    [{q.get('p', '?')}] «{q.get('text', '')}»"
            for q in screening.get("quotes", [])
        )
        nuances = screening.get("nuances") or ""
        case_parts.append(f"""<case sak_nr="{c['sak_nr']}" category="{c['category']}" relevance="{screening.get('relevance', '?')}">
  <rettssetning>{screening.get('proposition', '—')}</rettssetning>
  <faktum>{screening.get('factum', '—')}</faktum>
  <vurdering>{screening.get('assessment', '—')}</vurdering>
  <sitater>
{quotes_str}
  </sitater>
  {f'<nyanser>{nuances}</nyanser>' if nuances else ''}
</case>""")

    sub_str = "\n".join(f"  {i+1}. {sp}" for i, sp in enumerate(sub_problems)) if sub_problems else "  Ingen delspørsmål"

    user_message = f"""<screened_cases>
{chr(10).join(case_parts)}
</screened_cases>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{sub_str}
</delspørsmål>
</analysis_context>

Analyser rettssetningene tverrgående. Grupper tematisk, spor utvikling \
over tid, og identifiser spenninger mellom rettssetninger."""

    llm_client = anthropic.Anthropic(api_key=api_key, timeout=120.0)
    response = llm_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8000,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": CROSS_PROPOSITIONS_SCHEMA,
            },
            "effort": "high",
        },
        system=[
            {
                "type": "text",
                "text": CROSS_PROPOSITIONS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text
    logger.info(
        "Cross-propositions for %s: %d input tokens (%d cached), %d output tokens",
        analysis_id,
        response.usage.input_tokens,
        getattr(response.usage, "cache_read_input_tokens", 0),
        response.usage.output_tokens,
    )

    result = json.loads(text)

    # Persist propositions to DB
    _persist_cross_propositions(analysis_id, result)

    return result


def _persist_cross_propositions(analysis_id: str, result: dict):
    """Persist cross-propositions to the analysis_propositions table."""
    client = get_client()
    propositions = result.get("propositions", [])

    for prop in propositions:
        # Use the first instance's case as source_case
        instances = prop.get("instances", [])
        source_case = instances[0]["caseId"] if instances else None
        source_paragraph = instances[0].get("paragraph") if instances else None

        tension_id = None
        if prop.get("tension"):
            # We'll resolve tension IDs after all propositions are inserted
            pass

        client.table("analysis_propositions").upsert(
            {
                "analysis_id": analysis_id,
                "proposition_text": prop["proposition"],
                "theme": prop.get("theme"),
                "source_case": source_case,
                "source_paragraph": source_paragraph,
                "evolution_type": instances[0]["evolution"] if instances else None,
                "source": "ai_cross",
                "confirmed": False,
            },
            on_conflict="analysis_id,source_case,source",
        ).execute()
