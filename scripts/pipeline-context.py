#!/usr/bin/env python3
"""Pipeline context CLI — token-efficient data fetching for Claude Code pipeline.

Returns pre-formatted context ready for LLM prompts, much smaller than raw
Supabase MCP JSON responses.

Usage:
    python scripts/pipeline-context.py <command> <analysis_id> [args...]

Commands:
    context <id>                    Analysis context (problem, seeds, status)
    candidates <id>                 All candidates with screening status
    triage <id> [category]          Pending candidates with metadata for Haiku triage (default: C)
    screening <id> <sak_nr>         Full screening input for one case
    screening-results <id>          All screening results (capsule format)
    propositions <id>               Cross-propositions (if they exist)
    note <id>                       Synthesis note markdown
    qa-report <id>                  QA report JSON
    case-text <sak_nr> [section]    Case decision text (default: vurdering)
    paragraphs <sak_nr> <p1,p2,...> Specific paragraphs from a case
    verify-provision <ref>          Verify provision in lovdata (e.g. foa:16-11)
    ref-search <section_id> [max]   Search kofa_law_references (e.g. 16-11)
    fts-search <term> [max]         Full-text search in KOFA decisions
    vector-search <query> [max]     Hybrid vector+FTS search (Gemini embeddings)

Write commands (read JSON/content from stdin):
    create-analysis <title>         Create new analysis (problem via stdin, prints ID)
    save-screening <id> <sak_nr>    Save screening result (JSON via stdin)
    save-triage-reject <id>         Mark sak_nrs as triaged out (JSON array via stdin)
    save-document <id> <doc_type>   Save/upsert document (content via stdin)
    save-candidates <id>            Batch-insert candidates (JSON array via stdin)
    save-scoping <id>               Save scoping result (JSON via stdin)
    update-status <id> <status>     Update analysis status
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


def cmd_triage(analysis_id: str, category: str = "C"):
    """Triage input: pending candidates with metadata for Haiku pre-filter."""
    client = get_client()
    rows = (
        client.table("analysis_candidates")
        .select("sak_nr, category, signals")
        .eq("analysis_id", analysis_id)
        .eq("category", category.upper())
        .eq("screening_status", "pending")
        .order("sak_nr")
        .execute()
        .data
    ) or []

    if not rows:
        print(f"<triage category=\"{category}\">Ingen pending kandidater</triage>")
        return

    # Batch-fetch case metadata
    sak_nrs = [r["sak_nr"] for r in rows]
    cases = (
        client.table("kofa_cases")
        .select("sak_nr, saken_gjelder, avgjoerelse")
        .in_("sak_nr", sak_nrs)
        .execute()
        .data
    ) or []
    case_map = {c["sak_nr"]: c for c in cases}

    print(f"<triage category=\"{category}\" count=\"{len(rows)}\">")
    for r in rows:
        c = case_map.get(r["sak_nr"], {})
        signals = r.get("signals") or {}
        sig_parts = []
        for sig_type, vals in signals.items():
            if sig_type == "vector":
                sig_parts.append(f"vector[{max(vals):.3f}]")
            else:
                sig_parts.append(f"{sig_type}[{','.join(str(v) for v in vals)}]")
        sig_str = "+".join(sig_parts) if sig_parts else "?"
        saken = c.get("saken_gjelder") or "(ukjent)"
        avgj = c.get("avgjoerelse") or "?"
        print(f"  {r['sak_nr']} | signal: {sig_str} | {saken} | {avgj}")
    print("</triage>")


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


def cmd_verify_provision(ref: str):
    """Verify a provision exists in lovdata_sections and return excerpt."""
    from provisions import _ALIAS_TO_DOK_ID

    parts = ref.split(":")
    if len(parts) != 2:
        print(f"<provision ref=\"{ref}\" verified=\"false\">Ugyldig format (bruk foa:16-11)</provision>")
        return

    alias, section_id = parts
    dok_id = _ALIAS_TO_DOK_ID.get(alias, alias)

    client = get_client()
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
        content = section.get("content", "")
        if len(content) > 500:
            content = content[:500] + "…"
        title = section.get("title", "")
        print(f"<provision ref=\"{ref}\" verified=\"true\" title=\"{title}\">")
        print(content)
        print("</provision>")
    else:
        print(f"<provision ref=\"{ref}\" verified=\"false\">Ikke funnet i lovdata_sections</provision>")


def cmd_ref_search(section_id: str, max_results: str = "50"):
    """Search kofa_law_references for cases referencing a provision."""
    client = get_client()
    rows = (
        client.table("kofa_law_references")
        .select("sak_nr, law_section, context")
        .or_(f"law_section.eq.{section_id},law_section.like.{section_id} %")
        .limit(int(max_results))
        .execute()
        .data
    ) or []

    seen = {}
    for r in rows:
        sak = r["sak_nr"]
        if sak not in seen:
            seen[sak] = []
        seen[sak].append(r["law_section"])

    print(f"<ref_search section=\"{section_id}\" cases=\"{len(seen)}\">")
    for sak, refs in sorted(seen.items()):
        print(f"  {sak} [{', '.join(refs)}]")
    print("</ref_search>")


def cmd_fts_search(term: str, max_results: str = "30"):
    """Full-text search in KOFA decision text."""
    client = get_client()
    result = client.rpc(
        "search_kofa_decision_text",
        {"search_query": term, "max_results": int(max_results)},
    ).execute()

    rows = result.data or []
    seen = {}
    for r in rows:
        sak = r.get("sak_nr", "?")
        if sak not in seen:
            seen[sak] = r.get("rank", 0)

    print(f"<fts_search term=\"{term}\" cases=\"{len(seen)}\">")
    for sak, rank in sorted(seen.items(), key=lambda x: -x[1]):
        print(f"  {sak} (rank={rank:.4f})")
    print("</fts_search>")


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


# ── Write commands (accept JSON via stdin) ────────────────────────────────────


def cmd_save_screening(analysis_id: str, sak_nr: str):
    """Save screening result for one case. Reads JSON from stdin."""
    data = json.loads(sys.stdin.read())
    client = get_client()
    client.table("analysis_candidates").update(
        {"ai_screening": data, "screening_status": "ai_screened"}
    ).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()
    star = " ★" if data.get("star") else ""
    print(f"✓ {sak_nr} — {data.get('relevance', '?')}{star} — {data.get('proposition', '')[:80]}")


def cmd_save_triage_reject(analysis_id: str):
    """Mark candidates as triage-rejected. Reads JSON array of sak_nrs from stdin."""
    sak_nrs = json.loads(sys.stdin.read())
    client = get_client()
    for sak_nr in sak_nrs:
        client.table("analysis_candidates").update(
            {"ai_screening": {"triage": "rejected", "model": "haiku"}, "screening_status": "ai_screened"}
        ).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()
    print(f"✓ {len(sak_nrs)} saker markert som triaged out")


def cmd_save_document(analysis_id: str, doc_type: str):
    """Save/upsert a document (note, qa_report, cross_propositions). Reads content from stdin."""
    content = sys.stdin.read()
    client = get_client()

    existing = (
        client.table("analysis_documents")
        .select("id, version")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", doc_type)
        .execute()
        .data
    )

    if existing:
        doc = existing[0]
        new_version = (doc.get("version") or 0) + 1
        client.table("analysis_documents").update(
            {"content": content, "version": new_version}
        ).eq("id", doc["id"]).execute()
        print(f"✓ {doc_type} oppdatert (v{new_version})")
    else:
        client.table("analysis_documents").insert(
            {"analysis_id": analysis_id, "doc_type": doc_type, "content": content, "version": 1}
        ).execute()
        print(f"✓ {doc_type} opprettet (v1)")


def cmd_save_candidates(analysis_id: str):
    """Batch-insert candidates. Reads JSON array from stdin: [{sak_nr, category, signals}]."""
    candidates = json.loads(sys.stdin.read())
    client = get_client()
    rows = [
        {
            "analysis_id": analysis_id,
            "sak_nr": c["sak_nr"],
            "category": c.get("category", "C"),
            "signals": c.get("signals", {}),
            "iteration": c.get("iteration", 1),
            "screening_status": "pending",
        }
        for c in candidates
    ]
    result = client.table("analysis_candidates").upsert(
        rows, on_conflict="analysis_id,sak_nr"
    ).execute()
    print(f"✓ {len(rows)} kandidater lagret")


def cmd_update_status(analysis_id: str, status: str):
    """Update analysis status."""
    client = get_client()
    client.table("analyses").update(
        {"status": status, "updated_at": "now()"}
    ).eq("id", analysis_id).execute()
    print(f"✓ status → {status}")


def cmd_create_analysis(title: str):
    """Create a new analysis. Reads problem statement from stdin. Returns analysis ID."""
    problem = sys.stdin.read().strip()
    if not problem:
        print("ERROR: Problemstilling mangler (send via stdin)", file=sys.stderr)
        sys.exit(1)
    client = get_client()
    result = client.table("analyses").insert(
        {"title": title, "problem": problem, "status": "scoping"}
    ).execute()
    row = result.data[0]
    print(row["id"])


def cmd_save_scoping(analysis_id: str):
    """Save scoping result. Reads JSON from stdin: {refined_problem, sub_problems, context, ...full scoping result}."""
    data = json.loads(sys.stdin.read())
    client = get_client()
    update = {
        "scoping_result": data,
        "status": "searching",
        "updated_at": "now()",
    }
    if "refined_problem" in data:
        update["refined_problem"] = data["refined_problem"]
    if "sub_problems" in data:
        update["sub_problems"] = data["sub_problems"]
    if "context" in data:
        update["context"] = data["context"]

    client.table("analyses").update(update).eq("id", analysis_id).execute()
    print(f"✓ scoping lagret ({len(data.get('provisions', []))} bestemmelser)")


COMMANDS = {
    "context": (cmd_context, 1),
    "candidates": (cmd_candidates, 1),
    "triage": (cmd_triage, 1),
    "screening": (cmd_screening, 2),
    "screening-results": (cmd_screening_results, 1),
    "propositions": (cmd_propositions, 1),
    "note": (cmd_note, 1),
    "qa-report": (cmd_qa_report, 1),
    "case-text": (cmd_case_text, 1),
    "paragraphs": (cmd_paragraphs, 2),
    "verify-provision": (cmd_verify_provision, 1),
    "ref-search": (cmd_ref_search, 1),
    "fts-search": (cmd_fts_search, 1),
    "vector-search": (cmd_vector_search, 1),
    # Write commands (read JSON/content from stdin)
    "create-analysis": (cmd_create_analysis, 1),
    "save-screening": (cmd_save_screening, 2),
    "save-triage-reject": (cmd_save_triage_reject, 1),
    "save-document": (cmd_save_document, 2),
    "save-candidates": (cmd_save_candidates, 1),
    "save-scoping": (cmd_save_scoping, 1),
    "update-status": (cmd_update_status, 2),
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
