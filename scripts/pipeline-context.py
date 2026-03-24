#!/usr/bin/env python3
"""Pipeline context CLI — token-efficient data fetching for Claude Code pipeline.

Returns pre-formatted context ready for LLM prompts, much smaller than raw
Supabase MCP JSON responses.

Usage:
    python scripts/pipeline-context.py <command> <analysis_id> [args...]

Commands:
    context <id>                    Analysis context (problem, seeds, status)
    candidates <id>                 All candidates with screening status
    screening <id> <sak_nr>         Full screening input for one case
    screening-results <id>          All screening results (capsule format)
    propositions <id>               Cross-propositions (if they exist)
    note <id>                       Synthesis note markdown
    qa-report <id>                  QA report JSON
    case-text <sak_nr> [section]    Case decision text (default: vurdering)
    paragraphs <sak_nr> <p1,p2,...> Specific paragraphs from a case
    vector-search <query> [max]     Hybrid vector+FTS search (Gemini embeddings)
"""
import json
import os
import sys

# Add backend to path for db module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from db import get_client


def cmd_context(analysis_id: str):
    """Analysis context: problem, scoping result, status."""
    client = get_client()
    row = (
        client.table("analyses")
        .select("problem, refined_problem, sub_problems, context, status, scoping_result, iteration")
        .eq("id", analysis_id)
        .single()
        .execute()
        .data
    )
    if not row:
        print("ERROR: Analyse ikke funnet", file=sys.stderr)
        sys.exit(1)

    scoping = row.get("scoping_result") or {}
    sub_problems = row.get("sub_problems") or scoping.get("sub_problems") or []
    provisions = scoping.get("provisions") or []
    search_strategy = scoping.get("search_strategy") or {}

    print(f"<analysis id=\"{analysis_id}\" status=\"{row.get('status')}\" iteration=\"{row.get('iteration', 1)}\">")
    print(f"<problemstilling>{row.get('problem', '')}</problemstilling>")
    if row.get("refined_problem"):
        print(f"<presisert>{row['refined_problem']}</presisert>")
    if sub_problems:
        print("<delspørsmål>")
        for i, sp in enumerate(sub_problems, 1):
            print(f"  {i}. {sp}")
        print("</delspørsmål>")
    if provisions:
        refs = [p["ref"] for p in provisions if p.get("primary")]
        print(f"<bestemmelser>{', '.join(refs)}</bestemmelser>")
    if search_strategy.get("fts"):
        print(f"<søkeord>{', '.join(search_strategy['fts'])}</søkeord>")
    print("</analysis>")


def cmd_candidates(analysis_id: str):
    """All candidates with category and screening status."""
    client = get_client()
    rows = (
        client.table("analysis_candidates")
        .select("sak_nr, category, screening_status, ai_screening")
        .eq("analysis_id", analysis_id)
        .order("category")
        .order("sak_nr")
        .execute()
        .data
    ) or []

    screened = sum(1 for r in rows if r.get("ai_screening"))
    stars = sum(1 for r in rows if (r.get("ai_screening") or {}).get("star"))
    print(f"<candidates total=\"{len(rows)}\" screened=\"{screened}\" stars=\"{stars}\">")
    for r in rows:
        s = r.get("ai_screening") or {}
        status = "screened" if s else r.get("screening_status", "pending")
        star = " ★" if s.get("star") else ""
        prop = s.get("proposition", "")
        print(f"  {r['sak_nr']} ({r.get('category', '?')}{star}) [{status}] {prop}")
    print("</candidates>")


def cmd_screening(analysis_id: str, sak_nr: str):
    """Full screening input for one case: context + decision text."""
    # Context
    cmd_context(analysis_id)
    print()

    # Decision text
    client = get_client()
    paragraphs = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .eq("section", "vurdering")
        .order("paragraph_number")
        .execute()
        .data
    ) or []

    if not paragraphs:
        # Fallback: all paragraphs
        paragraphs = (
            client.table("kofa_decision_text")
            .select("paragraph_number, text")
            .eq("sak_nr", sak_nr)
            .order("paragraph_number")
            .limit(80)
            .execute()
            .data
        ) or []

    print(f"<case sak_nr=\"{sak_nr}\">")
    print("<avgjørelsestekst>")
    for p in paragraphs:
        print(f"({p['paragraph_number']}) {p['text']}")
    print("</avgjørelsestekst>")
    print("</case>")


def cmd_screening_results(analysis_id: str):
    """All screening results in capsule format for synthesis."""
    client = get_client()
    rows = (
        client.table("analysis_candidates")
        .select("sak_nr, category, ai_screening")
        .eq("analysis_id", analysis_id)
        .not_.is_("ai_screening", "null")
        .order("category")
        .order("sak_nr")
        .execute()
        .data
    ) or []

    print("<screening_results>")
    for r in rows:
        s = r["ai_screening"]
        star = "★" if s.get("star") else ""
        quotes = "\n".join(f"    [{q.get('p', '?')}] «{q.get('text', '')}»" for q in s.get("quotes", []))
        nuances = s.get("nuances") or ""
        print(f"""<case sak_nr="{r['sak_nr']}" category="{r.get('category', '?')}" relevance="{s.get('relevance', '?')}"{f' star="true"' if star else ''}>
  <rettssetning>{s.get('proposition', '—')}</rettssetning>
  <faktum>{s.get('factum', '—')}</faktum>
  <vurdering>{s.get('assessment', '—')}</vurdering>
  <sitater>
{quotes}
  </sitater>
  {f'<nyanser>{nuances}</nyanser>' if nuances else ''}
</case>""")
    print("</screening_results>")


def cmd_propositions(analysis_id: str):
    """Cross-propositions if they exist."""
    client = get_client()

    # Check for document first
    doc = (
        client.table("analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", "cross_propositions")
        .execute()
        .data
    )
    if doc:
        print(doc[0]["content"])
        return

    # Fallback: individual propositions
    rows = (
        client.table("analysis_propositions")
        .select("proposition_text, theme, source_case, evolution_type")
        .eq("analysis_id", analysis_id)
        .order("theme")
        .execute()
        .data
    ) or []

    if not rows:
        print("<rettssetningsregister>Ikke tilgjengelig</rettssetningsregister>")
        return

    print("<rettssetningsregister>")
    current_theme = None
    for r in rows:
        if r.get("theme") != current_theme:
            current_theme = r.get("theme")
            print(f"\n## {current_theme or 'Uten tema'}")
        print(f"  - [{r.get('source_case', '?')}] ({r.get('evolution_type', '?')}) {r['proposition_text']}")
    print("</rettssetningsregister>")


def cmd_note(analysis_id: str):
    """Synthesis note markdown."""
    client = get_client()
    doc = (
        client.table("analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", "note")
        .execute()
        .data
    )
    if doc:
        print(doc[0]["content"])
    else:
        print("ERROR: Ingen syntese-notat funnet", file=sys.stderr)
        sys.exit(1)


def cmd_qa_report(analysis_id: str):
    """QA report JSON."""
    client = get_client()
    doc = (
        client.table("analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", "qa_report")
        .execute()
        .data
    )
    if doc:
        print(doc[0]["content"])
    else:
        print("ERROR: Ingen KS-rapport funnet", file=sys.stderr)
        sys.exit(1)


def cmd_case_text(sak_nr: str, section: str = "vurdering"):
    """Case decision text, optionally filtered by section."""
    client = get_client()
    query = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
    )
    if section != "all":
        query = query.eq("section", section)

    paragraphs = query.limit(100).execute().data or []

    print(f"<case sak_nr=\"{sak_nr}\" section=\"{section}\" paragraphs=\"{len(paragraphs)}\">")
    for p in paragraphs:
        print(f"({p['paragraph_number']}) {p['text']}")
    print("</case>")


def cmd_paragraphs(sak_nr: str, paragraph_nrs: str):
    """Specific paragraphs from a case."""
    nrs = [int(n.strip()) for n in paragraph_nrs.split(",")]
    client = get_client()
    paragraphs = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .in_("paragraph_number", nrs)
        .order("paragraph_number")
        .execute()
        .data
    ) or []

    for p in paragraphs:
        print(f"({p['paragraph_number']}) {p['text']}")


def cmd_vector_search(query: str, max_results: str = "30"):
    """Vector+FTS hybrid search via Gemini embeddings."""
    from vector_seed import _generate_query_embedding

    query_embedding = list(_generate_query_embedding(query))
    client = get_client()
    result = client.rpc(
        "search_kofa_decision_hybrid",
        {
            "query_text": query,
            "query_embedding": query_embedding,
            "match_count": int(max_results),
        },
    ).execute()

    rows = result.data or []
    seen = {}
    for r in rows:
        sak = r["sak_nr"]
        if sak not in seen or r.get("combined_score", 0) > seen[sak]["score"]:
            seen[sak] = {"score": r.get("combined_score", 0), "sim": r.get("similarity", 0)}

    print(f"<vector_search query=\"{query}\" results=\"{len(seen)}\">")
    for sak, info in sorted(seen.items(), key=lambda x: -x[1]["score"]):
        print(f"  {sak} (score={info['score']:.3f} sim={info['sim']:.3f})")
    print("</vector_search>")


COMMANDS = {
    "context": (cmd_context, 1),
    "candidates": (cmd_candidates, 1),
    "screening": (cmd_screening, 2),
    "screening-results": (cmd_screening_results, 1),
    "propositions": (cmd_propositions, 1),
    "note": (cmd_note, 1),
    "qa-report": (cmd_qa_report, 1),
    "case-text": (cmd_case_text, 1),
    "paragraphs": (cmd_paragraphs, 2),
    "vector-search": (cmd_vector_search, 1),
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)

    cmd_name = sys.argv[1]
    fn, min_args = COMMANDS[cmd_name]
    args = sys.argv[2:]

    if len(args) < min_args:
        print(f"ERROR: {cmd_name} krever minst {min_args} argument(er)", file=sys.stderr)
        sys.exit(1)

    fn(*args)
