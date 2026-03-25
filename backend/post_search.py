"""Post-search (ettersøk) — Sprint 14.

Sends screening results + gap matrix + seeds to Claude to suggest
additional search terms, provisions, and patterns to explore.
"""
import logging

from db import get_client
from llm_cache import get_cached, set_cached, make_post_search_hash
from llm_utils import load_analysis_context, call_claude_structured, format_sub_problems

logger = logging.getLogger(__name__)


class PostSearchError(Exception):
    """Raised when post-search fails."""


POST_SEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "fts_terms": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Nye fulltekstsøketermer å prøve",
        },
        "vector_queries": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Nye semantiske søk (naturlig språk)",
        },
        "provisions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Nye bestemmelser å søke etter (format: dok_id:section_id)",
        },
        "patterns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Identifiserte mønstre og hull i dekningsbildet",
        },
        "reasoning": {
            "type": "string",
            "description": "Begrunnelse for forslagene — hva mangler i analysen",
        },
    },
    "required": ["fts_terms", "vector_queries", "provisions", "patterns", "reasoning"],
    "additionalProperties": False,
}


POST_SEARCH_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du hjelper en erfaren jurist med å identifisere hull i søkedekningen etter \
screening av KOFA-avgjørelser.

<instructions>
<role>
Du mottar oppsummerte screeningresultater, gap-matrise (bestemmelsespar uten \
felles saker), gjeldende seeds og problemstilling. Din oppgave er å foreslå \
supplerende søk som kan dekke blinde flekker i analysen.
</role>

<task name="fts_terms">
Foreslå nye fulltekstsøketermer som kan fange saker de gjeldende termene \
misser. Tenk på synonymer, juridisk fagterminologi, og vanlige formuleringer \
i KOFA-avgjørelser. Maks 5 termer.
</task>

<task name="vector_queries">
Foreslå 1-3 semantiske søk formulert som naturlige spørsmål. Disse brukes \
for vektorsøk og bør fange konseptuelle nyanser som FTS-termer misser.
</task>

<task name="provisions">
Foreslå bestemmelser som kan være relevante men mangler i søket. Bruk \
formatet dok_id:section_id (f.eks. forskrift/2016-08-12-974:§16-10). \
Maks 3 nye bestemmelser.
</task>

<task name="patterns">
Identifiser mønstre i de screende sakene: Finnes det rettslige temaer \
som bare er dekket fra én vinkel? Spenninger som bør utforskes? \
Tidsmessige hull? Maks 5 observasjoner.
</task>

<task name="reasoning">
Gi en kort begrunnelse for forslagene. Hva mangler mest åpenbart i \
den nåværende dekningen? 2-3 setninger.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær konkret og handlingsrettet — juristen skal kunne bruke forslagene direkte
- Ikke gjenta seeds som allerede er i bruk
</formatting_rules>"""


def _compress_screening_results(analysis_id: str) -> str:
    """Compress screening results into a concise format for the prompt."""
    client = get_client()
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .execute()
        .data
    ) or []

    if not candidates:
        return "Ingen screende saker."

    parts = []
    for c in candidates:
        screening = c["ai_screening"]
        parts.append(
            f"- {c['sak_nr']} (kat. {c.get('category') or '?'}): "
            f"{screening.get('proposition', '—')} "
            f"[Relevans: {screening.get('relevance', '?')}]"
        )
    return "\n".join(parts)


def generate_post_search(analysis_id: str) -> dict:
    """Generate post-search suggestions using Claude.

    Sends compressed screening results + gaps + seeds to Claude.
    Returns structured suggestions for additional searches.
    """
    ctx = load_analysis_context(analysis_id, extra_columns=["gaps"])

    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]
    provisions = ctx["provisions"]
    gaps = ctx.get("gaps") or []

    # Load additional seed types for current-seeds display
    client = get_client()
    all_seeds = (
        client.table("analysis_seeds")
        .select("seed_type, value")
        .eq("analysis_id", analysis_id)
        .execute()
        .data
    ) or []
    fts_terms = [s["value"] for s in all_seeds if s["seed_type"] == "fts"]
    vector_queries = [s["value"] for s in all_seeds if s["seed_type"] == "vector"]

    # Compress screening results
    screening_summary = _compress_screening_results(analysis_id)

    # Check output cache
    content_hash = make_post_search_hash(problem, provisions, screening_summary)
    cached = get_cached(analysis_id, "post_search", content_hash)
    if cached:
        return cached

    # Build gap summary
    gap_summary = "Ingen gap-par." if not gaps else "\n".join(
        f"- {g.get('provision1', '?')} ∩ {g.get('provision2', '?')}: {g.get('count', 0)} saker"
        for g in gaps
    )

    user_message = f"""<screening_results>
{screening_summary}
</screening_results>

<gap_matrix>
{gap_summary}
</gap_matrix>

<current_seeds>
<bestemmelser>{', '.join(provisions) if provisions else 'Ingen'}</bestemmelser>
<fts_termer>{', '.join(fts_terms) if fts_terms else 'Ingen'}</fts_termer>
<vektorsøk>{', '.join(vector_queries) if vector_queries else 'Ingen'}</vektorsøk>
</current_seeds>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{format_sub_problems(sub_problems)}
</delspørsmål>
</analysis_context>

Analyser dekningen og foreslå supplerende søk for å dekke hull i analysen."""

    try:
        result = call_claude_structured(
            system_prompt=POST_SEARCH_SYSTEM_PROMPT,
            user_message=user_message,
            schema=POST_SEARCH_SCHEMA,
            effort="medium",
            log_label=f"Post-search for {analysis_id}",
            analysis_id=analysis_id,
            call_type="post_search",
        )
        set_cached(analysis_id, "post_search", content_hash, result)
        return result
    except Exception as e:
        logger.error("Post-search LLM-kall feilet for analyse %s: %s", analysis_id, e)
        raise PostSearchError(f"LLM-kall feilet under ettersøk: {e}") from e
