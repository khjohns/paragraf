"""Scoping endpoint — Claude-assisted problem definition (Sprint 11)."""
import json
import logging
import os

import anthropic

from db import get_client
from llm_utils import CLAUDE_MODEL
from provisions import _ALIAS_TO_DOK_ID

logger = logging.getLogger(__name__)


class ScopeError(Exception):
    """Raised when scoping fails (missing key, bad response, etc.)."""


# JSON schema for structured output — guarantees valid JSON from Claude
SCOPING_SCHEMA = {
    "type": "object",
    "properties": {
        "refined_problem": {"type": "string"},
        "sub_problems": {
            "type": "array",
            "items": {"type": "string"},
        },
        "context": {
            "type": "object",
            "properties": {
                "procedure": {"type": ["string", "null"]},
                "service_area": {"type": ["string", "null"]},
                "market": {"type": ["string", "null"]},
                "threshold": {"type": ["string", "null"]},
            },
            "required": ["procedure", "service_area", "market", "threshold"],
            "additionalProperties": False,
        },
        "provisions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ref": {"type": "string"},
                    "label": {"type": "string"},
                    "primary": {"type": "boolean"},
                    "reason": {"type": "string"},
                },
                "required": ["ref", "label", "primary", "reason"],
                "additionalProperties": False,
            },
        },
        "search_strategy": {
            "type": "object",
            "properties": {
                "ref_table": {"type": "array", "items": {"type": "string"}},
                "fts": {"type": "array", "items": {"type": "string"}},
                "vector": {"type": "array", "items": {"type": "string"}},
                "prep_work": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["ref_table", "fts", "vector", "prep_work"],
            "additionalProperties": False,
        },
        "reasoning": {"type": "string"},
    },
    "required": [
        "refined_problem",
        "sub_problems",
        "context",
        "provisions",
        "search_strategy",
        "reasoning",
    ],
    "additionalProperties": False,
}

SCOPING_SYSTEM_PROMPT = """\
Du er en spesialisert juridisk forskningsassistent for norsk anskaffelsesrett. \
Du bistår erfarne jurister med å presisere uformelle problemstillinger til \
strukturerte forskningsplaner for systematisk søk i KOFA-praksis.

KOFA (Klagenemnda for offentlige anskaffelser) behandler klager på brudd på \
anskaffelsesregelverket. Databasen inneholder KOFAs avgjørelser med referanser \
til bestemmelser i anskaffelsesforskriften (FOA), anskaffelsesloven og \
EU-direktiv 2014/24/EU.

Juristen sender deg en uformell problemstilling. Du skal analysere den og \
returnere en strukturert forskningsplan.

<instructions>
<task name="refined_problem">
Omformuler problemstillingen til et presist juridisk spørsmål som kan \
undersøkes systematisk i KOFA-praksis. Behold juristens intensjon, men \
gjør spørsmålet konkret og avgrenset.
</task>

<task name="sub_problems">
Bryt ned i 2–5 konkrete delspørsmål som til sammen dekker problemstillingen. \
Hvert delspørsmål skal kunne besvares selvstendig gjennom søk i praksis.
</task>

<task name="context">
Identifiser følgende der det fremgår av problemstillingen:
- procedure: anskaffelsesprosedyre (åpen, begrenset, konkurranse med forhandling, osv.)
- service_area: tjenesteområde/kategori
- market: markedsforhold
- threshold: terskelverdi (nasjonal/EØS)
Sett til null der informasjonen ikke fremgår.
</task>

<task name="provisions">
Identifiser relevante bestemmelser i anskaffelsesforskriften (FOA) og evt. \
EU-direktiv 2014/24/EU.

For hver bestemmelse, oppgi:
- ref: bestemmelsesreferanse
- label: kort beskrivende tittel
- primary: true hvis direkte relevant, false hvis kontekst/ramme
- reason: kort begrunnelse for relevans (1–2 setninger)

Vær konservativ — foreslå kun bestemmelser du er sikker på er relevante. \
Bedre å utelate en usikker bestemmelse enn å inkludere en feil.
</task>

<task name="search_strategy">
Foreslå søkestrategi for databasen:
- ref_table: bestemmelsesreferanser å slå opp (samme format som provisions.ref)
- fts: 2–4 korte, presise søketermer for fulltekstsøk
- vector: 1–2 konseptuelle søkesetninger for semantisk søk
- prep_work: relevante forarbeider å sjekke (f.eks. «Prop. 51 L (2015–2016)»)
</task>

<task name="reasoning">
Forklar kort resonnementet bak forslagene — hvorfor akkurat disse bestemmelsene \
og søketermene er valgt.
</task>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Bestemmelsesformat FOA: "foa:§-nummer" (f.eks. "foa:16-12", "foa:16-5")
- EU-direktiver: "dir:art-nummer" (f.eks. "dir:65")
</formatting_rules>"""


def _verify_provisions(provisions: list[dict]) -> list[dict]:
    """Verify each provision against lovdata_sections and attach excerpt."""
    client = get_client()

    for prov in provisions:
        ref = prov.get("ref", "")
        parts = ref.split(":")
        if len(parts) != 2:
            prov["verified"] = False
            prov["excerpt"] = None
            continue

        alias, section_id = parts
        dok_id = _ALIAS_TO_DOK_ID.get(alias, alias)

        # Look up in lovdata_sections
        result = (
            client.table("lovdata_sections")
            .select("content, title")
            .eq("dok_id", dok_id)
            .eq("section_id", section_id)
            .limit(1)
            .execute()
        )
        section = (result.data or [None])[0]
        if section:
            prov["verified"] = True
            content = section.get("content", "")
            # Truncate long provisions for display
            if len(content) > 500:
                content = content[:500] + "…"
            prov["excerpt"] = content
            if section.get("title"):
                prov["label"] = section["title"]
        else:
            prov["verified"] = False
            prov["excerpt"] = None

    return provisions


def generate_scope(problem: str) -> dict:
    """Send problem to Claude, return structured scoping result with verified provisions.

    Uses structured outputs (output_config.format) for guaranteed valid JSON,
    medium effort for cost/quality balance, and prompt caching for the system prompt.

    Raises ScopeError on failure (missing API key, empty problem, bad response).
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ScopeError("ANTHROPIC_API_KEY ikke konfigurert")

    if not problem.strip():
        raise ScopeError("Problemstilling mangler")

    client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        # Structured output — guarantees valid JSON matching SCOPING_SCHEMA
        output_config={
            "format": {
                "type": "json_schema",
                "schema": SCOPING_SCHEMA,
            },
            "effort": "medium",
        },
        # Prompt caching on system prompt — 90% savings on subsequent calls
        system=[
            {
                "type": "text",
                "text": SCOPING_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": problem}],
    )
    text = response.content[0].text
    logger.info(
        "Scoping: %d input tokens (%d cached), %d output tokens",
        response.usage.input_tokens,
        getattr(response.usage, "cache_read_input_tokens", 0),
        response.usage.output_tokens,
    )

    # Structured output guarantees valid JSON — no regex fallback needed
    result = json.loads(text)

    # Verify provisions against DB
    if "provisions" in result:
        result["provisions"] = _verify_provisions(result["provisions"])

    return result
