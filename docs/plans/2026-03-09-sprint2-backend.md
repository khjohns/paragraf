# Sprint 2: Backend — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Python Flask backend that serves the traversal algorithm, case details, and provision details — turning Supabase data into the graph model the frontend consumes.

**Architecture:** Flask 3.x on port 5002, proxied by Vite dev server. Uses supabase-py 2.x for all database access. All queries are batch (no per-row loops). Two active discovery signals (R: reference table, F: full-text search) with vector search (V) as future addition.

**Reference:** Patterns from `~/Projects/Catenda/paragraf` and `~/Projects/Catenda/kofa` (supabase-py client, RPC calls, batch queries). Schema verified against live Supabase project `iyetsvrteyzpirygxenu`.

---

## Verified Schema (from Supabase MCP, 2026-03-09)

### Tables used by backend

| Table | PK | Key columns |
|-------|-----|------------|
| `kofa_cases` | `sak_nr` | avgjoerelse, saken_gjelder, avsluttet (date), regelverk, sakstype, summary, fts |
| `kofa_law_references` | `id` | sak_nr, law_name, law_section, regulation_version, context, paragraph_number |
| `kofa_case_references` | `id` | from_sak_nr, to_sak_nr, context, paragraph_number |
| `kofa_eu_references` | `id` | sak_nr, eu_case_id, eu_case_name, context, paragraph_number |
| `kofa_eu_case_law` | `eu_case_id` | celex, case_name, judgment_date, subject, description |
| `kofa_decision_text` | `id` (unique: sak_nr+paragraph_number) | sak_nr, paragraph_number, section, text, search_vector, embedding |
| `kofa_forarbeider` | `doc_id` | doc_type, title, full_title |
| `kofa_forarbeider_sections` | `id` (unique: doc_id+section_number) | doc_id, section_number, title, text, search_vector |
| `kofa_forarbeider_law_refs` | `id` | doc_id, section_number, law_name, law_section |
| `lovdata_sections` | `id` (uuid) | dok_id, section_id, title, content, structure_id |
| `lovdata_structure` | `id` (uuid) | dok_id, structure_type, structure_id, title, sort_order, parent_id |

### RPC functions used

| Function | Args | Returns |
|----------|------|---------|
| `search_kofa_decision_text` | `search_query text, section_filter text?, max_results int?` | `sak_nr, paragraph_number, section, text, rank, innklaget, sakstype, avgjoerelse, avsluttet` |
| `search_kofa` | `search_query text, max_results int?` | `sak_nr, slug, innklaget, avgjoerelse, saken_gjelder, summary, avsluttet, rank` |

### Data format notes

- `law_section` has TWO sub-section naming formats: parenthesis ("16-10 (1)", "16-10 (2)") AND text ("16-10 første ledd", "16-10 annet ledd"). Both are present in the data. `LIKE '16-10%'` catches all variants. Verified for §16-10: 11 bare, 40 with parens, 9 with text ledd.
- `regulation_version`: "new" (9,436 refs) or "old" (16,512 refs). Filter is on kofa_law_references, not kofa_cases.
- `avgjoerelse`: "Brudd på regelverket" or "Ikke brudd på regelverket" (full strings).
- `avsluttet`: date type (ISO format in JSON).
- Provision IDs from frontend: `"anskaffelsesforskriften:16-10"` → parse to law_name + law_section.

### Signal categorization

With 2 active signals (R + F), vector (V) disabled:
- **A** = R ∩ F (both signals found the case)
- **B** = R ⊕ F (one signal found the case)
- **C** = seed-only or single weak signal

When V is enabled later, switch to: A = 3/3, B = 2/3, C = 1/3.

---

## Task 1: Backend Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/db.py`
- Create: `backend/app.py`

**Step 1: Create backend directory**

```bash
mkdir -p backend
```

**Step 2: Create requirements.txt**

```txt
flask>=3.0.0
flask-cors>=5.0.0
supabase>=2.0.0
python-dotenv>=1.0.0
```

**Step 3: Create .env.example**

```env
SUPABASE_URL=https://iyetsvrteyzpirygxenu.supabase.co
SUPABASE_KEY=your-service-role-key-here
```

**Step 4: Create .env from example**

```bash
cp backend/.env.example backend/.env
```

Then manually add the real `SUPABASE_KEY` (service role key from Supabase dashboard). **Do NOT commit .env.**

**Step 5: Add backend/.env to .gitignore**

Append to existing `.gitignore`:

```
backend/.env
backend/__pycache__/
backend/*.pyc
```

**Step 6: Create db.py — Supabase client singleton**

```python
# backend/db.py

import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


@lru_cache(maxsize=1)
def get_client():
    """Get shared Supabase client (singleton via lru_cache)."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

    return create_client(url, key)
```

**Step 7: Create app.py — Flask app with health endpoint**

```python
# backend/app.py

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "paragraf-backend"})


if __name__ == "__main__":
    app.run(port=5002, debug=True)
```

**Step 8: Set up virtual environment and install**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 9: Verify — start server and test health endpoint**

```bash
cd backend && source venv/bin/activate && python app.py &
curl http://localhost:5002/api/health
# Expected: {"service":"paragraf-backend","status":"ok"}
kill %1
```

**Step 10: Verify — Supabase connection works**

```bash
cd backend && source venv/bin/activate && python -c "
from db import get_client
client = get_client()
result = client.table('kofa_cases').select('sak_nr').limit(1).execute()
print('Connected! Sample:', result.data)
"
```

**Step 11: Commit**

```bash
git add backend/ .gitignore
# Do NOT add backend/.env
git reset backend/.env 2>/dev/null
git commit -m "feat: scaffold Flask backend with Supabase connection"
```

---

## Task 2: Traversal — Signal Collection (R + F)

**Files:**
- Create: `backend/traversal.py`

This task implements the two discovery signals as pure functions that return `dict[str, SignalData]` (sak_nr → metadata).

**Step 1: Create traversal.py with reference signal (R)**

The reference signal finds cases by looking up `kofa_law_references` for each seed provision. Uses batch query per provision (not per case).

```python
# backend/traversal.py

from __future__ import annotations

from db import get_client


def parse_provision(provision_id: str) -> tuple[str, str]:
    """Parse 'anskaffelsesforskriften:16-10' → ('anskaffelsesforskriften', '16-10')."""
    parts = provision_id.split(":", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid provision ID: {provision_id}")
    return parts[0], parts[1]


def collect_reference_signal(
    provisions: list[str],
) -> dict[str, set[str]]:
    """R signal: find cases that reference seed provisions.

    Returns {sak_nr: set of matched provision IDs}.
    Uses LIKE prefix match to capture sub-sections (e.g., '16-10' matches '16-10 (1)').
    One query per provision — acceptable since seed count is small (typically 2-5).
    """
    client = get_client()
    ref_cases: dict[str, set[str]] = {}

    for provision_id in provisions:
        law_name, law_section = parse_provision(provision_id)

        result = (
            client.table("kofa_law_references")
            .select("sak_nr, regulation_version")
            .eq("law_name", law_name)
            .like("law_section", f"{law_section}%")
            .execute()
        )

        for row in result.data or []:
            ref_cases.setdefault(row["sak_nr"], set()).add(provision_id)

    return ref_cases


def collect_fts_signal(fts_terms: list[str]) -> set[str]:
    """F signal: full-text search on decision text.

    Returns set of sak_nr found via FTS.
    Uses the search_kofa_decision_text RPC (GIN index on search_vector).
    """
    client = get_client()
    fts_cases: set[str] = set()

    for term in fts_terms:
        result = client.rpc(
            "search_kofa_decision_text",
            {"search_query": term, "max_results": 200},
        ).execute()

        for row in result.data or []:
            fts_cases.add(row["sak_nr"])

    return fts_cases
```

**Step 2: Verify signal collection works**

```bash
cd backend && source venv/bin/activate && python -c "
from traversal import collect_reference_signal, collect_fts_signal

# R signal: cases referencing FOA §16-10
ref = collect_reference_signal(['anskaffelsesforskriften:16-10'])
print(f'R signal: {len(ref)} cases')
for sak_nr in sorted(ref)[:3]:
    print(f'  {sak_nr}: {ref[sak_nr]}')

# F signal: FTS for 'forpliktelseserklæring'
fts = collect_fts_signal(['forpliktelseserklæring'])
print(f'F signal: {len(fts)} cases')
"
```

**Step 3: Commit**

```bash
git add backend/traversal.py
git commit -m "feat: add reference and FTS signal collection for traversal"
```

---

## Task 3: Traversal — Categorize & Build Nodes

**Files:**
- Modify: `backend/traversal.py`

Merge signals, batch-fetch case metadata, build `GraphNode[]` response.

**Step 1: Add outcome simplifier and node builder**

Append to `backend/traversal.py`:

```python
def simplify_outcome(avgjoerelse: str | None) -> str | None:
    """Simplify verbose outcome to short label."""
    if not avgjoerelse:
        return None
    if "Ikke brudd" in avgjoerelse:
        return "Ikke brudd"
    if "Brudd" in avgjoerelse:
        return "Brudd"
    return avgjoerelse


def determine_regulation(sak_nr: str, ref_cases: dict[str, set[str]]) -> str | None:
    """Determine regulation version for a case based on its law references.

    A case is 'old' if ALL its matched references are old-regulation.
    If any matched reference is new, the case is 'new'.
    """
    # This is resolved during edge building — for now, return None
    # and let the provision-level regulation_version from the ref query determine it.
    return None


def build_traversal_response(
    provisions: list[str],
    fts_terms: list[str],
    vector_query: str,
    seed_cases: list[str],
    regulation_filter: str,
) -> dict:
    """Core traversal algorithm. Returns full TraversalResponse dict."""
    client = get_client()

    # --- 1. Collect signals ---
    ref_cases = collect_reference_signal(provisions)
    fts_cases = collect_fts_signal(fts_terms)
    vec_cases: set[str] = set()  # V signal: future

    # --- 2. Merge all discovered case sak_nrs ---
    all_sak_nrs = set(ref_cases.keys()) | fts_cases | vec_cases | set(seed_cases)

    if not all_sak_nrs:
        return {
            "nodes": _build_provision_nodes(client, provisions),
            "edges": [],
            "gaps": _compute_gaps(provisions, {}),
            "stats": {"total": 0, "categoryA": 0, "categoryB": 0, "categoryC": 0, "delimitations": 0},
        }

    # --- 3. Batch-fetch case metadata ---
    sak_list = list(all_sak_nrs)
    case_data = (
        client.table("kofa_cases")
        .select("sak_nr, avgjoerelse, saken_gjelder, avsluttet, regelverk, summary")
        .in_("sak_nr", sak_list)
        .execute()
    )
    case_map = {c["sak_nr"]: c for c in (case_data.data or [])}

    # --- 4. Batch-fetch regulation versions for all discovered cases ---
    reg_result = (
        client.table("kofa_law_references")
        .select("sak_nr, regulation_version")
        .in_("sak_nr", sak_list)
        .execute()
    )
    # A case's regulation = 'new' if ANY of its references are 'new'
    case_reg: dict[str, str] = {}
    for row in reg_result.data or []:
        sak = row["sak_nr"]
        if row.get("regulation_version") == "new":
            case_reg[sak] = "new"
        elif sak not in case_reg:
            case_reg[sak] = "old"

    # --- 5. Build case nodes ---
    case_nodes = []
    for sak_nr in all_sak_nrs:
        case = case_map.get(sak_nr)
        if not case:
            continue  # Case not in DB (broken reference)

        has_ref = sak_nr in ref_cases
        has_fts = sak_nr in fts_cases
        has_vec = sak_nr in vec_cases
        signals = {"ref": has_ref, "fts": has_fts, "vec": has_vec}

        signal_count = sum(signals.values())
        if signal_count >= 2:
            category = "A"
        elif signal_count == 1:
            category = "B"
        else:
            category = "C"  # Seed cases with no signal match

        reg = case_reg.get(sak_nr)

        case_nodes.append({
            "id": f"kofa:{sak_nr}",
            "type": "kofa_case",
            "label": sak_nr,
            "subtitle": case.get("saken_gjelder") or "",
            "date": str(case["avsluttet"]) if case.get("avsluttet") else None,
            "outcome": simplify_outcome(case.get("avgjoerelse")),
            "category": category,
            "signals": signals,
            "citations": 0,  # Filled in edge-building step
            "regulation": reg,
            "iteration": 1,
            "isSeed": sak_nr in seed_cases,
            "isDelimitation": False,
        })

    # --- 6. Build provision nodes ---
    provision_nodes = _build_provision_nodes(client, provisions)

    # --- 7. Build edges + compute citations ---
    edges, eu_nodes, prep_nodes = _build_edges(client, all_sak_nrs, provisions)

    # Count incoming citations per case
    citation_counts: dict[str, int] = {}
    for edge in edges:
        target = edge["to"]
        citation_counts[target] = citation_counts.get(target, 0) + 1
    for node in case_nodes:
        node["citations"] = citation_counts.get(node["id"], 0)
    for node in provision_nodes:
        node["citations"] = citation_counts.get(node["id"], 0)

    # --- 8. Gap matrix ---
    gaps = _compute_gaps(provisions, ref_cases)

    # --- 9. Stats ---
    all_nodes = provision_nodes + case_nodes + eu_nodes + prep_nodes
    stats = {
        "total": len(case_nodes),
        "categoryA": sum(1 for n in case_nodes if n.get("category") == "A"),
        "categoryB": sum(1 for n in case_nodes if n.get("category") == "B"),
        "categoryC": sum(1 for n in case_nodes if n.get("category") == "C"),
        "delimitations": sum(1 for n in case_nodes if n.get("isDelimitation")),
    }

    return {"nodes": all_nodes, "edges": edges, "gaps": gaps, "stats": stats}
```

**Step 2: Add provision node builder**

Append to `backend/traversal.py`:

```python
def _build_provision_nodes(client, provisions: list[str]) -> list[dict]:
    """Build GraphNode dicts for seed provisions from lovdata_sections."""
    if not provisions:
        return []

    nodes = []
    for provision_id in provisions:
        law_name, law_section = parse_provision(provision_id)

        # Try to find the lovdata section
        result = (
            client.table("lovdata_sections")
            .select("dok_id, section_id, title")
            .eq("dok_id", law_name)
            .like("section_id", f"%{law_section}%")
            .limit(1)
            .execute()
        )

        section = (result.data or [None])[0]
        title = section["title"] if section else f"§{law_section}"

        nodes.append({
            "id": provision_id,
            "type": "provision",
            "label": f"§{law_section}",
            "subtitle": title,
            "citations": 0,
            "regulation": "new",
            "iteration": 1,
            "isSeed": True,
            "isDelimitation": False,
        })

    return nodes
```

**Step 3: Verify node building (dry run)**

```bash
cd backend && source venv/bin/activate && python -c "
from traversal import build_traversal_response

result = build_traversal_response(
    provisions=['anskaffelsesforskriften:16-10'],
    fts_terms=['forpliktelseserklæring'],
    vector_query='',
    seed_cases=[],
    regulation_filter='new',
)
print(f'Nodes: {len(result[\"nodes\"])}')
for n in result['nodes'][:5]:
    print(f'  {n[\"id\"]} ({n[\"type\"]}) cat={n.get(\"category\",\"-\")} signals={n.get(\"signals\",\"-\")}')
print(f'Stats: {result[\"stats\"]}')
"
```

This will fail on `_build_edges` and `_compute_gaps` — that's expected, we implement those in Task 4.

**Step 4: Commit**

```bash
git add backend/traversal.py
git commit -m "feat: add traversal categorization and node building"
```

---

## Task 4: Traversal — Edges, Gaps & Endpoint

**Files:**
- Modify: `backend/traversal.py`
- Modify: `backend/app.py`

**Step 1: Add edge builder**

Append to `backend/traversal.py`:

```python
def _build_edges(
    client, case_sak_nrs: set[str], provisions: list[str]
) -> tuple[list[dict], list[dict], list[dict]]:
    """Build edges and collect EU + forarbeider nodes.

    Returns (edges, eu_nodes, prep_nodes).
    """
    sak_list = list(case_sak_nrs)
    edges: list[dict] = []
    eu_nodes: list[dict] = []
    prep_nodes: list[dict] = []
    seen_eu: set[str] = set()
    seen_prep: set[str] = set()

    # --- Case → Provision edges (from law references) ---
    law_refs = (
        client.table("kofa_law_references")
        .select("sak_nr, law_name, law_section")
        .in_("sak_nr", sak_list)
        .execute()
    )
    provision_set = set(provisions)
    for ref in law_refs.data or []:
        # Check if this reference matches any seed provision
        for prov_id in provision_set:
            law_name, law_section = parse_provision(prov_id)
            if ref["law_name"] == law_name and (ref.get("law_section") or "").startswith(law_section):
                edges.append({
                    "from": f"kofa:{ref['sak_nr']}",
                    "to": prov_id,
                    "valence": "unknown",
                })
                break  # One edge per case→provision pair

    # --- Case → Case edges ---
    case_refs = (
        client.table("kofa_case_references")
        .select("from_sak_nr, to_sak_nr, context")
        .in_("from_sak_nr", sak_list)
        .execute()
    )
    # Only include edges where both ends are in our result set
    for ref in case_refs.data or []:
        if ref["to_sak_nr"] in case_sak_nrs:
            edges.append({
                "from": f"kofa:{ref['from_sak_nr']}",
                "to": f"kofa:{ref['to_sak_nr']}",
                "valence": "unknown",
                "context": ref.get("context"),
            })

    # --- Case → EU edges ---
    eu_refs = (
        client.table("kofa_eu_references")
        .select("sak_nr, eu_case_id, eu_case_name, context")
        .in_("sak_nr", sak_list)
        .execute()
    )
    eu_ids = set()
    for ref in eu_refs.data or []:
        eu_id = ref["eu_case_id"]
        eu_ids.add(eu_id)
        edges.append({
            "from": f"kofa:{ref['sak_nr']}",
            "to": f"eu:{eu_id}",
            "valence": "unknown",
        })

    # Batch-fetch EU case metadata
    if eu_ids:
        eu_data = (
            client.table("kofa_eu_case_law")
            .select("eu_case_id, case_name, judgment_date, subject")
            .in_("eu_case_id", list(eu_ids))
            .execute()
        )
        for eu in eu_data.data or []:
            node_id = f"eu:{eu['eu_case_id']}"
            if node_id not in seen_eu:
                seen_eu.add(node_id)
                eu_nodes.append({
                    "id": node_id,
                    "type": "eu_case",
                    "label": eu["eu_case_id"],
                    "subtitle": eu.get("case_name") or "",
                    "date": str(eu["judgment_date"]) if eu.get("judgment_date") else None,
                    "citations": 0,
                    "iteration": 1,
                    "isSeed": False,
                    "isDelimitation": False,
                })

    # --- Forarbeider → Provision edges ---
    if provisions:
        for prov_id in provisions:
            law_name, law_section = parse_provision(prov_id)
            prep_refs = (
                client.table("kofa_forarbeider_law_refs")
                .select("doc_id, section_number, context")
                .eq("law_name", law_name)
                .like("law_section", f"{law_section}%")
                .execute()
            )
            prep_doc_ids = set()
            for ref in prep_refs.data or []:
                doc_id = ref["doc_id"]
                prep_doc_ids.add(doc_id)
                node_id = f"forarbeid:{doc_id}:{ref['section_number']}"
                edges.append({
                    "from": node_id,
                    "to": prov_id,
                    "valence": "unknown",
                })

            # Batch-fetch forarbeider metadata
            if prep_doc_ids:
                prep_data = (
                    client.table("kofa_forarbeider")
                    .select("doc_id, title, full_title")
                    .in_("doc_id", list(prep_doc_ids))
                    .execute()
                )
                prep_map = {p["doc_id"]: p for p in (prep_data.data or [])}
                for ref in prep_refs.data or []:
                    node_id = f"forarbeid:{ref['doc_id']}:{ref['section_number']}"
                    if node_id not in seen_prep:
                        seen_prep.add(node_id)
                        meta = prep_map.get(ref["doc_id"], {})
                        prep_nodes.append({
                            "id": node_id,
                            "type": "prep_work",
                            "label": meta.get("title") or ref["doc_id"],
                            "subtitle": meta.get("full_title") or "",
                            "citations": 0,
                            "iteration": 1,
                            "isSeed": False,
                            "isDelimitation": False,
                        })

    return edges, eu_nodes, prep_nodes
```

**Step 2: Add gap matrix computation**

Append to `backend/traversal.py`:

```python
def _compute_gaps(
    provisions: list[str], ref_cases: dict[str, set[str]]
) -> list[dict]:
    """Compute gap matrix — provision pairs with shared case counts.

    For each pair of provisions, count cases that reference both.
    Gaps (count=0) are the interesting analytical finding.
    """
    if len(provisions) < 2:
        return []

    # Invert: provision → set of sak_nrs
    prov_to_cases: dict[str, set[str]] = {}
    for sak_nr, prov_set in ref_cases.items():
        for prov_id in prov_set:
            prov_to_cases.setdefault(prov_id, set()).add(sak_nr)

    # Also include provisions with zero cases
    for prov_id in provisions:
        prov_to_cases.setdefault(prov_id, set())

    gaps = []
    for i, p1 in enumerate(provisions):
        for p2 in provisions[i + 1 :]:
            shared = prov_to_cases.get(p1, set()) & prov_to_cases.get(p2, set())
            _, s1 = parse_provision(p1)
            _, s2 = parse_provision(p2)
            gaps.append({
                "provision1": f"§{s1}",
                "provision2": f"§{s2}",
                "count": len(shared),
            })

    return gaps
```

**Step 3: Wire up the traverse endpoint in app.py**

Replace `backend/app.py`:

```python
# backend/app.py

from flask import Flask, jsonify, request
from flask_cors import CORS
from traversal import build_traversal_response

app = Flask(__name__)
CORS(app)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "paragraf-backend"})


@app.route("/api/traverse", methods=["POST"])
def traverse():
    body = request.get_json()
    if not body:
        return jsonify({"error": "Request body required"}), 400

    try:
        result = build_traversal_response(
            provisions=body.get("provisions", []),
            fts_terms=body.get("ftsTerms", []),
            vector_query=body.get("vectorQuery", ""),
            seed_cases=body.get("cases", []),
            regulation_filter=body.get("regulationFilter", "new"),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5002, debug=True)
```

**Step 4: Verify full traversal with curl**

```bash
cd backend && source venv/bin/activate && python app.py &
sleep 2

curl -s -X POST http://localhost:5002/api/traverse \
  -H 'Content-Type: application/json' \
  -d '{
    "provisions": ["anskaffelsesforskriften:16-10"],
    "ftsTerms": ["forpliktelseserklæring"],
    "vectorQuery": "",
    "cases": [],
    "regulationFilter": "new"
  }' | python -m json.tool | head -40

kill %1
```

Expected: JSON with nodes (provision + case + EU + prep), edges, gaps, stats.

**Step 5: Commit**

```bash
git add backend/traversal.py backend/app.py
git commit -m "feat: add traversal edges, gap matrix, and POST /api/traverse endpoint"
```

---

## Task 5: Case Detail Endpoint

**Files:**
- Create: `backend/cases.py`
- Modify: `backend/app.py`

**Step 1: Create cases.py**

```python
# backend/cases.py

from db import get_client


def get_case_detail(sak_nr: str) -> dict:
    """Fetch full case detail: metadata, decision text, and all references.

    Uses batch queries — 5 parallel-safe queries, no per-row loops.
    """
    client = get_client()

    # 1. Case metadata
    case_result = (
        client.table("kofa_cases")
        .select("sak_nr, avgjoerelse, saken_gjelder, avsluttet, innklaget, klager, sakstype, regelverk, summary")
        .eq("sak_nr", sak_nr)
        .limit(1)
        .execute()
    )
    case = (case_result.data or [None])[0]
    if not case:
        return None

    # 2. Decision text paragraphs (ordered)
    text_result = (
        client.table("kofa_decision_text")
        .select("paragraph_number, section, text")
        .eq("sak_nr", sak_nr)
        .order("paragraph_number")
        .execute()
    )

    # 3. Law references
    law_result = (
        client.table("kofa_law_references")
        .select("law_name, law_section, context, regulation_version")
        .eq("sak_nr", sak_nr)
        .execute()
    )

    # 4. Case references
    case_ref_result = (
        client.table("kofa_case_references")
        .select("to_sak_nr, context")
        .eq("from_sak_nr", sak_nr)
        .execute()
    )

    # 5. EU references
    eu_result = (
        client.table("kofa_eu_references")
        .select("eu_case_id, eu_case_name, context")
        .eq("sak_nr", sak_nr)
        .execute()
    )

    return {
        "sak_nr": sak_nr,
        "paragraphs": text_result.data or [],
        "law_references": [
            {
                "law_name": r["law_name"],
                "law_section": r.get("law_section") or "",
                "context": r.get("context") or "",
                "regulation_version": r.get("regulation_version") or "",
            }
            for r in (law_result.data or [])
        ],
        "case_references": [
            {"to_sak_nr": r["to_sak_nr"], "context": r.get("context") or ""}
            for r in (case_ref_result.data or [])
        ],
        "eu_references": [
            {
                "eu_case_id": r["eu_case_id"],
                "eu_case_name": r.get("eu_case_name") or "",
                "context": r.get("context") or "",
            }
            for r in (eu_result.data or [])
        ],
    }
```

**Step 2: Add route to app.py**

Add import and route:

```python
from cases import get_case_detail

@app.route("/api/cases/<path:sak_nr>")
def case_detail(sak_nr):
    result = get_case_detail(sak_nr)
    if result is None:
        return jsonify({"error": "Case not found"}), 404
    return jsonify(result)
```

**Step 3: Verify with curl**

```bash
cd backend && source venv/bin/activate && python app.py &
sleep 2

# Test with a real sak_nr
curl -s http://localhost:5002/api/cases/2025/1456 | python -m json.tool | head -30

kill %1
```

Expected: JSON with sak_nr, paragraphs[], law_references[], case_references[], eu_references[].

**Step 4: Commit**

```bash
git add backend/cases.py backend/app.py
git commit -m "feat: add GET /api/cases/:sak_nr endpoint"
```

---

## Task 6: Provision Detail Endpoint

**Files:**
- Create: `backend/provisions.py`
- Modify: `backend/app.py`

**Step 1: Create provisions.py**

```python
# backend/provisions.py

from db import get_client


def get_provision_detail(dok_id: str, section_id: str) -> dict:
    """Fetch provision detail: content, structure path, referencing case count."""
    client = get_client()

    # 1. Section content
    section_result = (
        client.table("lovdata_sections")
        .select("dok_id, section_id, title, content, structure_id")
        .eq("dok_id", dok_id)
        .eq("section_id", section_id)
        .limit(1)
        .execute()
    )
    section = (section_result.data or [None])[0]
    if not section:
        return None

    # 2. Structure path (walk up parent_id chain)
    structure_path = []
    if section.get("structure_id"):
        # Get the structure node and walk up
        current_id = section["structure_id"]
        visited = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            struct_result = (
                client.table("lovdata_structure")
                .select("id, title, parent_id, structure_type")
                .eq("id", current_id)
                .limit(1)
                .execute()
            )
            struct = (struct_result.data or [None])[0]
            if not struct:
                break
            structure_path.append(struct["title"])
            current_id = struct.get("parent_id")
        structure_path.reverse()

    # 3. Count referencing cases
    ref_count_result = (
        client.table("kofa_law_references")
        .select("sak_nr", count="exact")
        .eq("law_name", dok_id)
        .like("law_section", f"{section_id}%")
        .limit(0)
        .execute()
    )
    referencing_cases = ref_count_result.count or 0

    return {
        "dok_id": dok_id,
        "section_id": section_id,
        "title": section.get("title") or "",
        "content": section.get("content") or "",
        "structure_path": structure_path,
        "referencing_cases": referencing_cases,
    }
```

**Step 2: Add route to app.py**

Add import and route:

```python
from provisions import get_provision_detail

@app.route("/api/provisions/<path:dok_id>/<path:section_id>")
def provision_detail(dok_id, section_id):
    result = get_provision_detail(dok_id, section_id)
    if result is None:
        return jsonify({"error": "Provision not found"}), 404
    return jsonify(result)
```

**Step 3: Verify with curl**

```bash
cd backend && source venv/bin/activate && python app.py &
sleep 2

# Test with a known provision
curl -s "http://localhost:5002/api/provisions/anskaffelsesforskriften/16-10" | python -m json.tool

kill %1
```

**Step 4: Commit**

```bash
git add backend/provisions.py backend/app.py
git commit -m "feat: add GET /api/provisions/:dok_id/:section_id endpoint"
```

---

## Task 7: Integration Test & Frontend Wiring

**Files:**
- Create: `backend/test_integration.py`
- Modify: `src/lib/queries/traversal.ts` (remove mock fallback for real data)

**Step 1: Create integration test**

```python
# backend/test_integration.py

"""Integration tests against live Supabase.

Run: cd backend && source venv/bin/activate && python -m pytest test_integration.py -v
"""

import json
import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"


def test_traverse_basic(client):
    """Traverse with a single provision seed."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10"],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()

    # Structure check
    assert "nodes" in data
    assert "edges" in data
    assert "gaps" in data
    assert "stats" in data

    # Should find provision node + case nodes
    node_types = {n["type"] for n in data["nodes"]}
    assert "provision" in node_types
    assert "kofa_case" in node_types

    # All nodes must have required fields
    for node in data["nodes"]:
        assert "id" in node
        assert "type" in node
        assert "label" in node
        assert "isSeed" in node

    # Stats must be consistent
    stats = data["stats"]
    case_nodes = [n for n in data["nodes"] if n["type"] == "kofa_case"]
    assert stats["total"] == len(case_nodes)
    assert stats["categoryA"] + stats["categoryB"] + stats["categoryC"] == stats["total"]


def test_traverse_with_fts(client):
    """Traverse with provision + FTS gives category A hits."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10"],
            "ftsTerms": ["forpliktelseserklæring"],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert data["stats"]["categoryA"] > 0, "Should have A-category hits with both R+F signals"


def test_traverse_gap_matrix(client):
    """Two provisions should produce gap data."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": ["anskaffelsesforskriften:16-10", "anskaffelsesforskriften:17-1"],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert len(data["gaps"]) >= 1
    assert all("provision1" in g and "provision2" in g and "count" in g for g in data["gaps"])


def test_case_detail(client):
    """Fetch a known case."""
    resp = client.get("/api/cases/2025/1456")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["sak_nr"] == "2025/1456"
    assert "paragraphs" in data
    assert "law_references" in data
    assert "case_references" in data
    assert "eu_references" in data


def test_case_not_found(client):
    resp = client.get("/api/cases/9999/9999")
    assert resp.status_code == 404


def test_traverse_empty(client):
    """Empty provisions should return empty results."""
    resp = client.post(
        "/api/traverse",
        json={
            "provisions": [],
            "ftsTerms": [],
            "vectorQuery": "",
            "cases": [],
            "regulationFilter": "new",
        },
    )
    data = resp.get_json()
    assert data["stats"]["total"] == 0
```

**Step 2: Install pytest and run tests**

```bash
cd backend && source venv/bin/activate
pip install pytest
python -m pytest test_integration.py -v
```

All tests should pass against live Supabase.

**Step 3: Commit**

```bash
git add backend/test_integration.py
git commit -m "feat: add integration tests for all backend endpoints"
```

---

## Summary

After Sprint 2, the backend has:
- Flask 3.x app on port 5002 with CORS
- `POST /api/traverse` — two-signal traversal (R + F), batch queries, gap matrix
- `GET /api/cases/:sak_nr` — full case detail with decision text + references
- `GET /api/provisions/:dok_id/:section_id` — provision content + structure path
- Integration tests passing against live Supabase
- Architecture ready for vector signal (V) when embedding API is added

Sprint 3 (UI Components) can now switch from mock fallback to real API.
