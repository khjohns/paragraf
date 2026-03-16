"""Cross-propositions analysis — Sprint 14.

Sends all propositions + key quotes to Claude for thematic grouping,
evolution analysis, and tension identification across cases.
"""
import logging

from db import get_client
from llm_cache import get_cached, set_cached, make_cross_props_hash
from llm_utils import load_analysis_context, call_claude_structured, format_sub_problems

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
    ctx = load_analysis_context(analysis_id)
    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]

    # Load all screened candidates with their screening results
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

    if not candidates:
        raise CrossPropositionsError("Ingen screende saker å analysere")

    # Check output cache
    content_hash = make_cross_props_hash(problem, candidates)
    cached = get_cached(analysis_id, "cross_propositions", content_hash)
    if cached:
        return cached

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

    user_message = f"""<screened_cases>
{chr(10).join(case_parts)}
</screened_cases>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{format_sub_problems(sub_problems)}
</delspørsmål>
</analysis_context>

Analyser rettssetningene tverrgående. Grupper tematisk, spor utvikling \
over tid, og identifiser spenninger mellom rettssetninger."""

    try:
        result = call_claude_structured(
            system_prompt=CROSS_PROPOSITIONS_SYSTEM_PROMPT,
            user_message=user_message,
            schema=CROSS_PROPOSITIONS_SCHEMA,
            max_tokens=8000,
            effort="high",
            log_label=f"Cross-propositions for {analysis_id}",
        )
    except Exception as e:
        logger.error("Cross-propositions LLM-kall feilet for analyse %s: %s", analysis_id, e)
        raise CrossPropositionsError(f"LLM-kall feilet under kryssanalyse: {e}") from e

    # Persist propositions to DB
    _persist_cross_propositions(analysis_id, result)

    set_cached(analysis_id, "cross_propositions", content_hash, result)
    return result


def _persist_cross_propositions(analysis_id: str, result: dict):
    """Persist cross-propositions to the analysis_propositions table (batch upsert)."""
    client = get_client()
    propositions = result.get("propositions", [])

    rows = []
    for prop in propositions:
        instances = prop.get("instances", [])
        source_case = instances[0]["caseId"] if instances else None
        source_paragraph = instances[0].get("paragraph") if instances else None

        rows.append({
            "analysis_id": analysis_id,
            "proposition_text": prop["proposition"],
            "theme": prop.get("theme"),
            "source_case": source_case,
            "source_paragraph": source_paragraph,
            "evolution_type": instances[0]["evolution"] if instances else None,
            "source": "ai_cross",
            "confirmed": False,
        })

    if rows:
        client.table("analysis_propositions").upsert(
            rows,
            on_conflict="analysis_id,source_case,source",
        ).execute()
