#!/usr/bin/env python3
"""Pipeline context CLI — token-efficient data fetching for Claude Code pipeline.

Returns pre-formatted context ready for LLM prompts, much smaller than raw
Supabase MCP JSON responses.

Usage:
    python scripts/pipeline-context.py <command> <analysis_id> [args...]

Commands:
    context <id>                    Analysis context (problem, seeds, status)
    candidates <id>                 All candidates with screening status
    triage <id> [max_rank]          Pending candidates for Haiku triage (default: rank=1)
    screening <id> <sak_nr>         Full screening input for one case
    screening-results <id>          All screening results (capsule format)
    propositions <id>               Cross-propositions (if they exist)
    note <id>                       Synthesis note markdown
    qa-report <id>                  QA report JSON
    case-text <sak_nr> [section]    Case decision text (default: vurdering)
    paragraphs <sak_nr> <p1,p2,...> Specific paragraphs from a case
    verify-quotes <id> <sak_nr>     Quote vs original text side-by-side
    verify-provision <ref>          Verify provision in lovdata (e.g. foa:16-11)
    ref-search <section_id> [max]   Search kofa_law_references (e.g. 16-11)
    fts-search <term> [max]         Full-text search in KOFA decisions
    vector-search <query> [max]     Hybrid vector+FTS search (Gemini embeddings)
    merge-search-results            Merge ref/fts/vec results → candidates JSON (stdin)

Write commands (read JSON/content from stdin):
    create-analysis <title>         Create new analysis (problem via stdin, prints ID)
    save-screening <id> <sak_nr>    Save screening result (JSON via stdin)
    save-triage-reject <id>         Mark sak_nrs as triaged out (JSON array via stdin)
    save-document <id> <doc_type>   Save/upsert document (content via stdin)
    save-candidates <id>            Batch-insert candidates (JSON array via stdin)
    save-scoping <id>               Save scoping result (JSON via stdin)
    update-status <id> <status>     Update analysis status

Run tracking (ADR-007):
    start-run <id> [parent_run_id]  Start pipeline run (variation JSON via stdin, prints run_id)
    log-step <run_id> <step_type>   Log pipeline step (JSON via stdin: step_input, step_output, ...)
    end-run <run_id> [status]       Close run (default: completed)
    log-correction <id> <sak_nr>    Log user correction (JSON via stdin)
    register-prompt <hash> <type> [tag]  Register prompt version (description via stdin)
"""
import json
import os
import sys
from datetime import datetime

# Add backend to path for db module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from db import get_client


def cmd_context(analysis_id: str):
    """Analysis context: problem, scoping result, status."""
    client = get_client()
    row = (
        client.table("paragraf_analyses")
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
        client.table("paragraf_analysis_candidates")
        .select("sak_nr, category, signals, screening_status, ai_screening")
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
        cat = r.get("category") or "–"  # ADR-006: null until screening
        signals = _normalize_signals(r.get("signals") or {})
        rank = signals.get("discovery_rank", "?")
        print(f"  {r['sak_nr']} (cat={cat} rank={rank}{star}) [{status}] {prop}")
    print("</candidates>")


def cmd_triage(analysis_id: str, max_rank: str = "1"):
    """Triage input: pending candidates with discovery_rank <= max_rank for Haiku pre-filter.

    ADR-006: category is null until screening. Triage filters on discovery_rank, not category.
    discovery_rank=1 means 1 signal channel (weakest), 3 means all channels (strongest).
    Default: rank=1 (single-channel candidates that need triage).
    """
    client = get_client()
    max_rank_int = int(max_rank)
    rows = (
        client.table("paragraf_analysis_candidates")
        .select("sak_nr, category, signals")
        .eq("analysis_id", analysis_id)
        .eq("screening_status", "pending")
        .is_("category", "null")
        .order("sak_nr")
        .execute()
        .data
    ) or []

    # Filter by discovery_rank in Python (jsonb integer filter not straightforward in postgrest)
    rows = [r for r in rows if (r.get("signals") or {}).get("discovery_rank", 0) <= max_rank_int]

    if not rows:
        print(f"<triage max_rank=\"{max_rank_int}\">Ingen pending kandidater</triage>")
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

    print(f"<triage max_rank=\"{max_rank_int}\" count=\"{len(rows)}\">")
    for r in rows:
        c = case_map.get(r["sak_nr"], {})
        signals = _normalize_signals(r.get("signals") or {})
        # ADR-006: show signal type + details
        sig_parts = []
        for k in ("ref", "fts", "vec"):
            vals = signals.get(k, [])
            if vals:
                if k == "vec" and vals and isinstance(vals[0], (int, float)):
                    sig_parts.append(f"vec({vals[0]:.2f})")
                elif isinstance(vals, list) and len(vals) > 0:
                    sig_parts.append(f"{k}({','.join(str(v) for v in vals)})")
                else:
                    sig_parts.append(k)
        sig_str = "+".join(sig_parts) if sig_parts else "?"
        rank = signals.get("discovery_rank", "?")
        saken = c.get("saken_gjelder") or "(ukjent)"
        avgj = c.get("avgjoerelse") or "?"
        print(f"  {r['sak_nr']} | rank={rank} signal: {sig_str} | {saken} | {avgj}")
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

    # Case metadata
    case_meta = (
        client.table("kofa_cases")
        .select("avsluttet, regelverk, saken_gjelder, avgjoerelse")
        .eq("sak_nr", sak_nr)
        .limit(1)
        .execute()
        .data
    )
    meta = (case_meta or [{}])[0]
    avsluttet = meta.get("avsluttet", "")
    regelverk = meta.get("regelverk") or ""
    gammel_foa = avsluttet < "2017-01-01" if avsluttet else False
    forskrift_hint = "gammel FOA (pre-2017)" if gammel_foa else ("ny FOA (2017+)" if avsluttet else "ukjent")

    print(f"<case sak_nr=\"{sak_nr}\" avsluttet=\"{avsluttet}\" forskrift=\"{forskrift_hint}\">")
    if meta.get("saken_gjelder"):
        print(f"<saken_gjelder>{meta['saken_gjelder']}</saken_gjelder>")
    if gammel_foa:
        print("<regelverksnotat>OBS: Denne saken er avgjort under den gamle anskaffelsesforskriften (pre-2017). "
              "Paragrafnumre i avgjørelsesteksten refererer til gammel FOA, ikke gjeldende forskrift. "
              "Bruk paragrafnumrene slik de står i teksten. "
              "Angi i rettssetningen at den er utledet under tidligere regelverk og "
              "vurder om prinsippet er videreført.</regelverksnotat>")
    print("<avgjørelsestekst>")
    for p in paragraphs:
        print(f"({p['paragraph_number']}) {p['text']}")
    print("</avgjørelsestekst>")
    print("</case>")


def cmd_screening_results(analysis_id: str):
    """All screening results in capsule format for synthesis."""
    client = get_client()
    rows = (
        client.table("paragraf_analysis_candidates")
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
        client.table("paragraf_analysis_documents")
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
        client.table("paragraf_analysis_propositions")
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


def cmd_provision_capsule(analysis_id: str):
    """Provision screening capsule (bestemmelseskapsel)."""
    client = get_client()
    doc = (
        client.table("paragraf_analysis_documents")
        .select("content")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", "provision_screening")
        .execute()
        .data
    )
    if doc:
        print(doc[0]["content"])
    else:
        print("<provision_screening>Ikke tilgjengelig — kjør provisions-steget først</provision_screening>")


def cmd_note(analysis_id: str):
    """Synthesis note markdown."""
    client = get_client()
    doc = (
        client.table("paragraf_analysis_documents")
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
        client.table("paragraf_analysis_documents")
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


def cmd_verify_quotes(analysis_id: str, sak_nr: str):
    """Fetch quotes from screening + original paragraph text side-by-side for verification."""
    client = get_client()

    # Get screening result
    candidate = (
        client.table("paragraf_analysis_candidates")
        .select("ai_screening")
        .eq("analysis_id", analysis_id)
        .eq("sak_nr", sak_nr)
        .single()
        .execute()
        .data
    )
    if not candidate or not candidate.get("ai_screening"):
        print(f"<verify_quotes sak_nr=\"{sak_nr}\">Ingen screening funnet</verify_quotes>")
        return

    quotes = candidate["ai_screening"].get("quotes", [])
    if not quotes:
        print(f"<verify_quotes sak_nr=\"{sak_nr}\">Ingen sitater</verify_quotes>")
        return

    # Fetch all referenced paragraphs in one query
    p_nrs = [q.get("p") for q in quotes if q.get("p")]
    paragraphs = (
        client.table("kofa_decision_text")
        .select("paragraph_number, text")
        .eq("sak_nr", sak_nr)
        .in_("paragraph_number", p_nrs)
        .order("paragraph_number")
        .execute()
        .data
    ) or []
    p_map = {p["paragraph_number"]: p["text"] for p in paragraphs}

    print(f"<verify_quotes sak_nr=\"{sak_nr}\" count=\"{len(quotes)}\">")
    for i, q in enumerate(quotes, 1):
        p_nr = q.get("p", "?")
        quoted = q.get("text", "")
        original = p_map.get(p_nr)
        if original is None:
            print(f"  <quote nr=\"{i}\" p=\"{p_nr}\" found=\"false\">")
            print(f"    <sitat>{quoted}</sitat>")
            print(f"    <original>AVSNITT IKKE FUNNET</original>")
        else:
            print(f"  <quote nr=\"{i}\" p=\"{p_nr}\" found=\"true\">")
            print(f"    <sitat>{quoted}</sitat>")
            print(f"    <original>{original}</original>")
        print(f"  </quote>")
    print("</verify_quotes>")


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
    # ADR-006: category is set by screening (relevance), not by traversal
    update_data = {"ai_screening": data, "screening_status": "ai_screened"}
    relevance = data.get("relevance")
    if relevance in ("A", "B", "C"):
        update_data["category"] = relevance
    client.table("paragraf_analysis_candidates").update(
        update_data
    ).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()
    star = " ★" if data.get("star") else ""
    print(f"✓ {sak_nr} — {data.get('relevance', '?')}{star} — {data.get('proposition', '')[:80]}")


def cmd_save_quote_verification(analysis_id: str, sak_nr: str):
    """Add quote_verification to existing ai_screening (merge, not replace). JSON array via stdin."""
    raw = json.loads(sys.stdin.read())
    # Unwrap if input is {"quote_verification": [...]} instead of bare [...]
    if isinstance(raw, dict) and "quote_verification" in raw:
        verification = raw["quote_verification"]
    elif isinstance(raw, list):
        verification = raw
    else:
        verification = raw
    client = get_client()
    # Fetch existing
    row = (
        client.table("paragraf_analysis_candidates")
        .select("ai_screening")
        .eq("analysis_id", analysis_id)
        .eq("sak_nr", sak_nr)
        .single()
        .execute()
        .data
    )
    existing = row.get("ai_screening") or {}
    existing["quote_verification"] = verification
    client.table("paragraf_analysis_candidates").update(
        {"ai_screening": existing}
    ).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()
    v = sum(1 for q in verification if q.get("status") == "verified")
    t = sum(1 for q in verification if q.get("status") == "truncated")
    print(f"✓ {sak_nr} — {v} verified, {t} truncated, {len(verification)-v-t} andre")


def cmd_save_triage_reject(analysis_id: str, prompt_version: str = "v1"):
    """Mark candidates as triage-rejected. Reads JSON array of sak_nrs from stdin.

    Appends to triage_history for A/B testing across triage re-runs.
    Optional second arg: prompt version label (default: v1).
    """
    sak_nrs = json.loads(sys.stdin.read())
    client = get_client()
    timestamp = datetime.utcnow().isoformat() + "Z"
    for sak_nr in sak_nrs:
        # Append to triage_history
        existing = (
            client.table("paragraf_analysis_candidates")
            .select("triage_history")
            .eq("analysis_id", analysis_id)
            .eq("sak_nr", sak_nr)
            .execute()
            .data
        )
        history = (existing[0].get("triage_history") or []) if existing else []
        history.append({
            "prompt_version": prompt_version,
            "decision": "NEI",
            "timestamp": timestamp,
        })
        client.table("paragraf_analysis_candidates").update({
            "ai_screening": {"triage": "rejected", "model": "haiku", "prompt_version": prompt_version},
            "screening_status": "triage_rejected",
            "triage_history": history,
        }).eq("analysis_id", analysis_id).eq("sak_nr", sak_nr).execute()
    print(f"✓ {len(sak_nrs)} saker markert som triaged out (prompt {prompt_version})")


VALID_DOC_TYPES = {"note", "qa_report", "cross_propositions", "provision_screening", "export", "deposit"}


def cmd_save_document(analysis_id: str, doc_type: str):
    """Save/upsert a document. Reads content from stdin."""
    if doc_type not in VALID_DOC_TYPES:
        print(f"ERROR: Ugyldig doc_type '{doc_type}'. Gyldige: {', '.join(sorted(VALID_DOC_TYPES))}", file=sys.stderr)
        sys.exit(1)
    content = sys.stdin.read()
    client = get_client()

    existing = (
        client.table("paragraf_analysis_documents")
        .select("id, version")
        .eq("analysis_id", analysis_id)
        .eq("doc_type", doc_type)
        .execute()
        .data
    )

    if existing:
        doc = existing[0]
        new_version = (doc.get("version") or 0) + 1
        client.table("paragraf_analysis_documents").update(
            {"content": content, "version": new_version}
        ).eq("id", doc["id"]).execute()
        print(f"✓ {doc_type} oppdatert (v{new_version})")
    else:
        client.table("paragraf_analysis_documents").insert(
            {"analysis_id": analysis_id, "doc_type": doc_type, "content": content, "version": 1}
        ).execute()
        print(f"✓ {doc_type} opprettet (v1)")


def _normalize_signals(raw: dict) -> dict:
    """Normalize signals to ADR-006 array format for display and persistence.

    Accepts three formats:
    1. ADR-006 arrays: {"ref": ["16-11"], "fts": ["konsortium"], "vec": [0.78], "discovery_rank": 2}
    2. Legacy boolean:  {"ref": true, "fts": false, "vec": true}
    3. Legacy CLI:      {"ref": ["16-11"], "fts": ["term"], "vector": [0.78]}

    Always returns ADR-006 format with arrays + discovery_rank.
    """
    result: dict = {}
    for key, val in raw.items():
        # Normalize key: "vector" -> "vec"
        norm_key = "vec" if key == "vector" else key
        if norm_key == "discovery_rank":
            result["discovery_rank"] = val
            continue
        if norm_key not in ("ref", "fts", "vec"):
            continue
        # Convert boolean to empty array, keep arrays as-is
        if isinstance(val, bool):
            # Legacy boolean: content is lost, but track presence for discovery_rank
            result[norm_key] = []
            if val:
                result.setdefault("_legacy_true", set()).add(norm_key)
        elif isinstance(val, list):
            result[norm_key] = val
        else:
            result[norm_key] = [val] if val else []

    # Ensure all three keys are present
    for k in ("ref", "fts", "vec"):
        result.setdefault(k, [])

    # Compute discovery_rank if not already present
    if "discovery_rank" not in result:
        legacy_true = result.pop("_legacy_true", set())
        result["discovery_rank"] = sum(
            1 for k in ("ref", "fts", "vec") if result[k] or k in legacy_true
        )
    else:
        result.pop("_legacy_true", None)

    return result


def cmd_save_candidates(analysis_id: str):
    """Batch-insert candidates. Reads JSON array from stdin: [{sak_nr, category, signals}]."""
    candidates = json.loads(sys.stdin.read())
    client = get_client()
    rows = [
        {
            "analysis_id": analysis_id,
            "sak_nr": c["sak_nr"],
            "category": c.get("category"),  # ADR-006: None until screening
            "signals": _normalize_signals(c.get("signals", {})),
            "iteration": c.get("iteration", 1),
            "screening_status": "pending",
        }
        for c in candidates
    ]
    result = client.table("paragraf_analysis_candidates").upsert(
        rows, on_conflict="analysis_id,sak_nr"
    ).execute()
    print(f"✓ {len(rows)} kandidater lagret")


def cmd_update_status(analysis_id: str, status: str):
    """Update analysis status."""
    client = get_client()
    client.table("paragraf_analyses").update(
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
    result = client.table("paragraf_analyses").insert(
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

    client.table("paragraf_analyses").update(update).eq("id", analysis_id).execute()

    # Also populate analysis_seeds (required by frontend for traversal/graph)
    seeds = []
    for p in data.get("provisions", []):
        if p.get("primary") and p.get("ref"):
            seeds.append({"analysis_id": analysis_id, "seed_type": "provision", "value": p["ref"],
                          "iteration": 1, "source": "ai_suggested", "confirmed": True})
    for term in (data.get("search_strategy") or {}).get("fts", []):
        seeds.append({"analysis_id": analysis_id, "seed_type": "fts", "value": term,
                      "iteration": 1, "source": "ai_suggested", "confirmed": True})
    for query in (data.get("search_strategy") or {}).get("vector", []):
        seeds.append({"analysis_id": analysis_id, "seed_type": "vector", "value": query,
                      "iteration": 1, "source": "ai_suggested", "confirmed": True})
    if seeds:
        client.table("paragraf_analysis_seeds").upsert(seeds, on_conflict="analysis_id,seed_type,value").execute()

    print(f"✓ scoping lagret ({len(data.get('provisions', []))} bestemmelser, {len(seeds)} seeds)")


def cmd_merge_search_results():
    """Merge ref/fts/vec search results into candidates with ADR-006 signals.

    Reads JSON from stdin:
    {
      "ref": {"18-1": ["2023/123", "2024/456"], "14-1": ["2023/123"]},
      "fts": {"taktisk prising": ["2023/123", "2024/789"], "prisskjema": ["2024/456"]},
      "vec": {"2023/123": 0.78, "2024/456": 0.72, "2025/100": 0.65}
    }

    Outputs JSON array of candidates with signals, sorted by discovery_rank.
    """
    data = json.loads(sys.stdin.read())
    ref_data = data.get("ref", {})   # {section_id: [sak_nr, ...]}
    fts_data = data.get("fts", {})   # {term: [sak_nr, ...]}
    vec_data = data.get("vec", {})   # {sak_nr: best_sim_score}

    # Merge into per-case signals
    all_cases: dict[str, dict] = {}
    for section, cases in ref_data.items():
        for sak in cases:
            all_cases.setdefault(sak, {"ref": set(), "fts": set(), "vec": []})
            all_cases[sak]["ref"].add(section)
    for term, cases in fts_data.items():
        for sak in cases:
            all_cases.setdefault(sak, {"ref": set(), "fts": set(), "vec": []})
            all_cases[sak]["fts"].add(term)
    for sak, score in vec_data.items():
        all_cases.setdefault(sak, {"ref": set(), "fts": set(), "vec": []})
        all_cases[sak]["vec"].append(round(float(score), 3))

    # Build candidate list with ADR-006 signals
    candidates = []
    for sak, sig in all_cases.items():
        ref_hits = sorted(sig["ref"])
        fts_hits = sorted(sig["fts"])
        vec_hits = sorted(sig["vec"], reverse=True)
        channels = sum(1 for s in [ref_hits, fts_hits, vec_hits] if s)
        candidates.append({
            "sak_nr": sak,
            "signals": {
                "ref": ref_hits,
                "fts": fts_hits,
                "vec": vec_hits,
                "discovery_rank": channels,
            },
        })

    candidates.sort(key=lambda c: (
        -c["signals"]["discovery_rank"],
        -len(c["signals"]["ref"]),
        -len(c["signals"]["fts"]),
    ))

    # Summary to stderr, JSON to stdout
    rank_counts: dict[int, int] = {}
    for c in candidates:
        r = c["signals"]["discovery_rank"]
        rank_counts[r] = rank_counts.get(r, 0) + 1
    print(f"# {len(candidates)} kandidater: rank3={rank_counts.get(3, 0)} rank2={rank_counts.get(2, 0)} rank1={rank_counts.get(1, 0)}", file=sys.stderr)
    print(json.dumps(candidates))


def cmd_start_run(analysis_id: str, parent_run_id: str = None):
    """Create a new pipeline run. Optionally provide parent_run_id for controlled variations.
    Reads optional variation JSON from stdin (empty stdin = no variation)."""
    import select
    variation = None
    if not sys.stdin.isatty() and select.select([sys.stdin], [], [], 0.0)[0]:
        raw = sys.stdin.read().strip()
        if raw:
            variation = json.loads(raw)

    client = get_client()
    row_data = {
        "analysis_id": analysis_id,
        "status": "running",
    }
    if parent_run_id:
        row_data["parent_run_id"] = parent_run_id
    if variation:
        row_data["variation"] = variation

    result = client.table("paragraf_pipeline_runs").insert(row_data).execute()
    run_id = result.data[0]["id"]
    print(run_id)


def cmd_log_step(run_id: str, step_type: str):
    """Log a pipeline step. Reads JSON from stdin with fields:
    {step_input, step_output, model_id?, prompt_hash?, prompt_text?, duration_ms?, cost_usd?, metadata?}"""
    data = json.loads(sys.stdin.read())
    client = get_client()

    row_data = {
        "run_id": run_id,
        "step_type": step_type,
        "step_input": data["step_input"],
        "step_output": data["step_output"],
    }
    for opt in ("model_id", "prompt_hash", "prompt_text", "duration_ms", "cost_usd", "metadata"):
        if opt in data and data[opt] is not None:
            row_data[opt] = data[opt]

    result = client.table("paragraf_pipeline_steps").insert(row_data).execute()
    step_id = result.data[0]["id"]
    print(f"✓ step {step_type} → {step_id}")


def cmd_end_run(run_id: str, status: str = "completed"):
    """Close a pipeline run. Status: completed | failed | partial."""
    client = get_client()
    client.table("paragraf_pipeline_runs").update(
        {"status": status, "completed_at": "now()"}
    ).eq("id", run_id).execute()
    print(f"✓ run {run_id} → {status}")


def cmd_log_correction(analysis_id: str, sak_nr: str):
    """Log a user correction. Reads JSON from stdin:
    {correction_type, before_value, after_value, reason?, run_id?}"""
    data = json.loads(sys.stdin.read())
    client = get_client()

    row_data = {
        "analysis_id": analysis_id,
        "sak_nr": sak_nr,
        "correction_type": data["correction_type"],
    }
    for opt in ("before_value", "after_value", "reason", "run_id"):
        if opt in data and data[opt] is not None:
            row_data[opt] = data[opt]

    client.table("paragraf_user_corrections").insert(row_data).execute()
    print(f"✓ correction logged: {data['correction_type']} for {sak_nr}")


def cmd_register_prompt(prompt_hash: str, step_type: str, version_tag: str = None):
    """Register a prompt version. Reads optional description from stdin."""
    import select
    description = None
    if not sys.stdin.isatty() and select.select([sys.stdin], [], [], 0.0)[0]:
        raw = sys.stdin.read().strip()
        if raw:
            description = raw

    client = get_client()
    row_data = {
        "hash": prompt_hash,
        "step_type": step_type,
    }
    if version_tag:
        row_data["version_tag"] = version_tag
    if description:
        row_data["description"] = description

    # Upsert — prompt hash is the PK
    client.table("paragraf_prompt_registry").upsert(row_data).execute()
    print(f"✓ prompt registered: {step_type} {version_tag or prompt_hash[:12]}")


COMMANDS = {
    "context": (cmd_context, 1),
    "candidates": (cmd_candidates, 1),
    "triage": (cmd_triage, 1),
    "screening": (cmd_screening, 2),
    "screening-results": (cmd_screening_results, 1),
    "propositions": (cmd_propositions, 1),
    "provision-capsule": (cmd_provision_capsule, 1),
    "note": (cmd_note, 1),
    "qa-report": (cmd_qa_report, 1),
    "case-text": (cmd_case_text, 1),
    "paragraphs": (cmd_paragraphs, 2),
    "verify-quotes": (cmd_verify_quotes, 2),
    "verify-provision": (cmd_verify_provision, 1),
    "ref-search": (cmd_ref_search, 1),
    "fts-search": (cmd_fts_search, 1),
    "vector-search": (cmd_vector_search, 1),
    "merge-search-results": (cmd_merge_search_results, 0),
    # Write commands (read JSON/content from stdin)
    "create-analysis": (cmd_create_analysis, 1),
    "save-screening": (cmd_save_screening, 2),
    "save-quote-verification": (cmd_save_quote_verification, 2),
    "save-triage-reject": (cmd_save_triage_reject, 1),
    "save-document": (cmd_save_document, 2),
    "save-candidates": (cmd_save_candidates, 1),
    "save-scoping": (cmd_save_scoping, 1),
    "update-status": (cmd_update_status, 2),
    # ADR-007: Run tracking commands
    "start-run": (cmd_start_run, 1),
    "log-step": (cmd_log_step, 2),
    "end-run": (cmd_end_run, 1),
    "log-correction": (cmd_log_correction, 2),
    "register-prompt": (cmd_register_prompt, 2),
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
