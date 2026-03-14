"""Scoping endpoint — Claude-assisted problem definition (Sprint 11)."""
import logging
import os

import anthropic

from db import get_client
from llm_utils import CLAUDE_MODEL, parse_json_response
from provisions import _ALIAS_TO_DOK_ID

logger = logging.getLogger(__name__)


class ScopeError(Exception):
    """Raised when scoping fails (missing key, bad response, etc.)."""


SCOPING_SYSTEM_PROMPT = """\
Du er en juridisk forskningsassistent for norsk anskaffelsesrett. Du hjelper jurister med å presisere juridiske problemstillinger og planlegge systematisk søk i KOFA-praksis.

Du mottar en uformell problemstilling fra juristen. Din oppgave:

1. **Presiser problemstillingen** — omformuler til et presist juridisk spørsmål som kan undersøkes systematisk.

2. **Identifiser delspørsmål** — bryt ned i 2–5 konkrete delspørsmål som til sammen dekker problemstillingen.

3. **Kartlegg kontekst** — identifiser prosedyre, tjenesteområde, markedsforhold og terskelverdi der dette fremgår.

4. **Foreslå bestemmelser** — identifiser relevante bestemmelser i anskaffelsesforskriften (FOA) og evt. EU-direktiv. For hver bestemmelse:
   - Oppgi referanse i formatet som brukes i systemet (f.eks. "foa:16-12")
   - Marker om bestemmelsen er primær (direkte relevant) eller sekundær (kontekst/ramme)
   - Forklar kort hvorfor bestemmelsen er relevant

5. **Foreslå søkestrategi** — beskriv hvordan databasen bør søkes:
   - Referansetabell: hvilke bestemmelser skal slås opp
   - Fulltekstsøk: foreslå 2-4 søketermer (korte, presise)
   - Vektorsøk: foreslå 1-2 konseptuelle søkesetninger
   - Forarbeider: relevante forarbeider å sjekke

6. **Begrunn** — forklar kort resonnementet bak forslagene.

Regler:
- Skriv alltid på norsk (bokmål)
- Bruk bestemmelsesformat "foa:§-nummer" (f.eks. "foa:16-12", "foa:16-5")
- For EU-direktiver bruk "dir:art-nummer" (f.eks. "dir:65")
- Vær konservativ — foreslå kun bestemmelser du er sikker på er relevante
- Returner KUN JSON, ingen annen tekst

JSON-format:
{
  "refined_problem": "string — presisert problemstilling",
  "sub_problems": ["string — delspørsmål 1", ...],
  "context": {
    "procedure": "string eller null",
    "service_area": "string eller null",
    "market": "string eller null",
    "threshold": "string eller null"
  },
  "provisions": [
    {
      "ref": "foa:16-12",
      "label": "Utvelgelse av leverandører",
      "primary": true,
      "reason": "Hjemmel for utvelgelseskriterier"
    }
  ],
  "search_strategy": {
    "ref_table": ["Beskrivelse av referansesøk 1", ...],
    "fts": ["søketerm1", "søketerm2"],
    "vector": ["konseptuell søkesetning"],
    "prep_work": ["Forarbeider å sjekke"]
  },
  "reasoning": "string — kort begrunnelse for forslagene"
}"""


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
        system=SCOPING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": problem}],
    )
    text = response.content[0].text

    result = parse_json_response(text)
    if not result:
        raise ScopeError("Kunne ikke tolke AI-responsen")

    # Verify provisions against DB
    if "provisions" in result:
        result["provisions"] = _verify_provisions(result["provisions"])

    return result
