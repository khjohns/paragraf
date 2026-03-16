"""Synthesis — Sprint 15.

Generates a legal analysis note (notatutkast) from screening results,
proposition registry, notes, and EU case summaries. Uses capsule compression
to stay within token budget.
"""
import logging

from db import get_client
from llm_cache import get_cached, set_cached, make_synthesis_hash
from llm_utils import (
    call_claude_structured,
    load_analysis_context,
    format_sub_problems,
)

logger = logging.getLogger(__name__)

DOC_TYPE_NOTE = "note"
DOC_TYPE_QA_REPORT = "qa_report"


class SynthesisError(Exception):
    """Raised when synthesis fails."""


SYNTHESIS_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Notatets tittel",
        },
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "heading": {
                        "type": "string",
                        "description": "Seksjonsoverskrift",
                    },
                    "content": {
                        "type": "string",
                        "description": "Seksjonens innhold i markdown-format",
                    },
                    "requires_lawyer_input": {
                        "type": "boolean",
                        "description": "True hvis seksjonen krever juristens egen vurdering",
                    },
                },
                "required": ["heading", "content", "requires_lawyer_input"],
                "additionalProperties": False,
            },
            "description": "Notatets seksjoner i rekkefølge",
        },
        "unresolved_tensions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "Beskrivelse av spenningen",
                    },
                    "cases": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Saker involvert i spenningen",
                    },
                },
                "required": ["description", "cases"],
                "additionalProperties": False,
            },
            "description": "Uløste spenninger som juristen bør ta stilling til",
        },
        "coverage_notes": {
            "type": "string",
            "description": "Vurdering av analysens dekning — hva mangler eventuelt",
        },
    },
    "required": ["title", "sections", "unresolved_tensions", "coverage_notes"],
    "additionalProperties": False,
}


SYNTHESIS_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du skriver utkast til rettslige analysenotater basert på systematisk screening \
av KOFA-avgjørelser og EU-dommer.

<instructions>
<role>
Du mottar komprimerte screeningresultater, rettssetningsregister med spenninger, \
gap-analyse, juristens notater og EU-dom-oppsummeringer. Din oppgave er å skrive \
et strukturert notatutkast som organiserer funnene systematisk.
</role>

<task name="title">
Gi notatet en presis, beskrivende tittel som reflekterer den juridiske \
problemstillingen.
</task>

<task name="sections">
Organiser notatet i seksjoner. Typisk struktur:
1. Problemstilling — kort oppsummering
2. Rettslig utgangspunkt — relevante bestemmelser med ordlyd
3-N. Systematisk gjennomgang per delproblemstilling — praksis, rettssetninger, \
    utvikling over tid
N+1. Spenninger og uavklarte spørsmål
N+2. Foreløpig vurdering / [JURISTENS VURDERING]

Skriv i markdown-format. Referer til saker som sak_nr (f.eks. «2024/2019, avsnitt 27»).

**Viktig:** Seksjoner som krever juristens egen rettslige vurdering eller konklusjon \
skal markeres med `requires_lawyer_input: true` og inneholde teksten \
«[JURISTENS VURDERING: beskriv hva som trengs]» på relevant sted. Du trekker ikke \
konklusjoner — du organiserer materialet.
</task>

<task name="unresolved_tensions">
List opp spenninger i praksisen som notatet ikke kan løse — motstridende \
rettssetninger, uavklart rettstilstand, dissenser. Dette gir juristen et \
kart over de vanskelige spørsmålene.
</task>

<task name="coverage_notes">
Vurder kort om analysen har vesentlige hull: Mangler det viktige saker? Er det \
bestemmelsespar som ikke er dekket? Tidsmessige hull?
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Bruk akademisk juridisk stil — presis, nøktern, ikke-konkluderende
- Referer alltid til saker med sak_nr og avsnittsnummer
- Marker AI-generert vurdering tydelig vs. gjennomgang av praksis
- Marker seksjoner der juristen må bidra med [JURISTENS VURDERING]
</formatting_rules>"""


# Rough token estimates per character (for Norwegian legal text)
_CHARS_PER_TOKEN = 3.5


def _estimate_tokens(text: str) -> int:
    """Rough token estimate for Norwegian text."""
    return int(len(text) / _CHARS_PER_TOKEN)


def _compress_screening_for_synthesis(
    candidates: list[dict],
    token_budget: int = 20000,
) -> str:
    """Compress screening results using capsule pattern.

    Priority: A full, B compressed, C minimal.
    """
    a_cases = [c for c in candidates if c.get("category") == "A"]
    b_cases = [c for c in candidates if c.get("category") == "B"]
    c_cases = [c for c in candidates if c.get("category") == "C"]

    parts = []
    tokens_used = 0

    def _format_full(c: dict) -> str:
        s = c.get("ai_screening", {})
        lines = [
            f"### {c['sak_nr']} (kat. {c['category']}) {'★' if s.get('star') else ''}",
            f"**Rettssetning:** {s.get('proposition', '—')}",
            f"**Faktum:** {s.get('factum', '—')}",
            f"**Vurdering:** {s.get('assessment', '—')}",
        ]
        if s.get("quotes"):
            lines.append("**Sitater:**")
            for q in s["quotes"]:
                lines.append(f"- §{q.get('p', '?')}: «{q.get('text', '')}»")
        if s.get("nuances"):
            lines.append(f"**Nyanser:** {s['nuances']}")
        lines.append(f"**Relevans:** {s.get('relevance', '?')} — {s.get('relevance_reasoning', '')}")
        return "\n".join(lines)

    def _format_compressed(c: dict) -> str:
        s = c.get("ai_screening", {})
        return (
            f"- **{c['sak_nr']}** (kat. {c['category']}): "
            f"{s.get('proposition', '—')} "
            f"[Relevans: {s.get('relevance', '?')}] "
            f"{'★' if s.get('star') else ''}"
        )

    def _format_minimal(c: dict) -> str:
        s = c.get("ai_screening", {})
        return f"- {c['sak_nr']}: {s.get('proposition', '—')}"

    # A-cases: always full
    for c in a_cases:
        text = _format_full(c)
        tokens_used += _estimate_tokens(text)
        parts.append(text)

    # B-cases: full if budget allows, else compressed
    for c in b_cases:
        full_text = _format_full(c)
        if tokens_used + _estimate_tokens(full_text) <= token_budget:
            parts.append(full_text)
            tokens_used += _estimate_tokens(full_text)
        else:
            text = _format_compressed(c)
            parts.append(text)
            tokens_used += _estimate_tokens(text)

    # C-cases: compressed if budget allows, else minimal
    for c in c_cases:
        comp_text = _format_compressed(c)
        if tokens_used + _estimate_tokens(comp_text) <= token_budget:
            parts.append(comp_text)
            tokens_used += _estimate_tokens(comp_text)
        else:
            text = _format_minimal(c)
            parts.append(text)
            tokens_used += _estimate_tokens(text)

    logger.info("Synthesis capsule: ~%d estimated tokens for %d cases", tokens_used, len(candidates))
    return "\n\n".join(parts)


def _load_propositions(analysis_id: str) -> str:
    """Load proposition registry as formatted text."""
    client = get_client()
    props = (
        client.table("analysis_propositions")
        .select("proposition_text, theme, source_case, evolution_type, tension_with_id, confirmed")
        .eq("analysis_id", analysis_id)
        .execute()
        .data
    ) or []

    if not props:
        return "Ingen rettssetninger registrert."

    # Group by theme
    themes: dict[str, list] = {}
    for p in props:
        theme = p.get("theme") or "Ukategorisert"
        themes.setdefault(theme, []).append(p)

    parts = []
    for theme, items in themes.items():
        parts.append(f"**{theme}:**")
        for p in items:
            confirmed = "✓" if p.get("confirmed") else "?"
            evolution = p.get("evolution_type", "")
            tension = f" [SPENNING: {p['tension_with_id']}]" if p.get("tension_with_id") else ""
            parts.append(
                f"  [{confirmed}] {p.get('source_case', '?')}: "
                f"{p.get('proposition_text', '—')} "
                f"({evolution}){tension}"
            )

    return "\n".join(parts)


def _format_user_notes(candidates: list[dict]) -> str:
    """Format user notes from already-loaded candidates."""
    notes = [c for c in candidates if c.get("user_notes")]
    if not notes:
        return "Ingen notater fra juristen."

    return "\n".join(f"- {c['sak_nr']}: {c['user_notes']}" for c in notes)


def generate_synthesis(analysis_id: str) -> dict:
    """Generate a legal analysis note using Claude.

    Sends compressed screening results + propositions + notes to Claude.
    Returns structured note with sections, tensions, and coverage notes.
    Persists the note as markdown in analysis_documents.
    """
    ctx = load_analysis_context(analysis_id, extra_columns=["gaps"])
    problem = ctx["problem"]
    sub_problems = ctx["sub_problems"]
    provisions = ctx["provisions"]
    gaps = ctx.get("gaps") or []

    # Load screened candidates
    client = get_client()
    candidates = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening, user_notes")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .execute()
        .data
    ) or []

    if not candidates:
        raise SynthesisError("Ingen screenede saker å syntetisere")

    # Check output cache
    content_hash = make_synthesis_hash(problem, candidates, provisions)
    cached = get_cached(analysis_id, "synthesis", content_hash)
    if cached:
        return cached

    # Build capsule-compressed screening data
    screening_capsule = _compress_screening_for_synthesis(candidates)

    # Load propositions; extract notes from already-loaded candidates
    propositions_text = _load_propositions(analysis_id)
    notes_text = _format_user_notes(candidates)

    # Build gap summary
    gap_summary = "Ingen hull." if not gaps else "\n".join(
        f"- {g.get('provision1', '?')} ∩ {g.get('provision2', '?')}: {g.get('count', 0)} saker"
        for g in gaps
    )

    user_message = f"""<screening_results>
{screening_capsule}
</screening_results>

<rettssetningsregister>
{propositions_text}
</rettssetningsregister>

<juristens_notater>
{notes_text}
</juristens_notater>

<gap_analyse>
{gap_summary}
</gap_analyse>

<analysis_context>
<problemstilling>{problem}</problemstilling>
<delspørsmål>
{format_sub_problems(sub_problems)}
</delspørsmål>
<bestemmelser>{', '.join(provisions) if provisions else 'Ingen'}</bestemmelser>
</analysis_context>

Skriv et strukturert notatutkast som organiserer funnene fra screening og \
rettssetningsregisteret. Marker seksjoner der juristen må bidra med egne \
vurderinger med [JURISTENS VURDERING]."""

    try:
        result = call_claude_structured(
            system_prompt=SYNTHESIS_SYSTEM_PROMPT,
            user_message=user_message,
            schema=SYNTHESIS_SCHEMA,
            max_tokens=12000,
            effort="high",
            log_label=f"Synthesis for {analysis_id}",
        )
    except Exception as e:
        logger.error("Syntese LLM-kall feilet for analyse %s: %s", analysis_id, e)
        raise SynthesisError(f"LLM-kall feilet under syntese: {e}") from e

    # Convert structured response to markdown for persistence
    markdown = _to_markdown(result)

    # Persist to analysis_documents
    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_NOTE,
            "content": markdown,
            "version": 1,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()

    result["markdown"] = markdown
    set_cached(analysis_id, "synthesis", content_hash, result)
    return result


def _to_markdown(result: dict) -> str:
    """Convert structured synthesis response to markdown."""
    parts = [f"# {result.get('title', 'Notatutkast')}"]

    for section in result.get("sections", []):
        parts.append(f"\n## {section['heading']}")
        parts.append(section["content"])

    if result.get("unresolved_tensions"):
        parts.append("\n## Uløste spenninger")
        for t in result["unresolved_tensions"]:
            cases = ", ".join(t.get("cases", []))
            parts.append(f"- **{t['description']}** ({cases})")

    if result.get("coverage_notes"):
        parts.append(f"\n## Dekningsvurdering\n\n{result['coverage_notes']}")

    return "\n\n".join(parts)


def update_synthesis(analysis_id: str, markdown: str) -> dict:
    """Update the synthesis note content (user edits)."""
    client = get_client()

    # Increment version
    existing = (
        client.table("analysis_documents")
        .select("version")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", DOC_TYPE_NOTE)
        .limit(1)
        .execute()
        .data
    )
    version = (existing[0]["version"] + 1) if existing else 1

    client.table("analysis_documents").upsert(
        {
            "analysis_id": analysis_id,
            "doc_type": DOC_TYPE_NOTE,
            "content": markdown,
            "version": version,
        },
        on_conflict="analysis_id,doc_type",
    ).execute()

    return {"ok": True, "version": version}
