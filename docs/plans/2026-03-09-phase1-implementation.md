# Paragraf Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a functional legal research workbench (MVP) with three-panel layout, list view, graph view, A/B/C categorization, and persistent analysis state.

**Architecture:** SvelteKit 2 SPA (adapter-static, no SSR) with Flask backend for graph traversal and Supabase queries. Frontend uses Svelte 5 runes, Tailwind CSS v4 with custom design tokens, D3+dagre for graph rendering. Data lives in Supabase project `unified-timeline` (id: `iyetsvrteyzpirygxenu`).

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind CSS v4, D3, dagre, @tanstack/svelte-query, lucide-svelte, Python Flask, Supabase/Postgres

**Reference project:** `~/Projects/endringsmeldinger` — copy project structure, build system, API client patterns.

**Design spec:** `docs/design/paragraf-designspesifikasjon.md` (authoritative for all design decisions)

**Design tokens:** Section 17 of design spec — warm paper palette, not tech-blue.

---

## Phase 1 Scope (from spec section 33)

- Three-panel layout with list view as default
- Graph view with hierarchical layout (D3+dagre+SVG)
- A/B/C categorization with R/F/V signal dots
- Regulation version filter (prominent, default on)
- Gap matrix in left panel
- Read status and notes with persistence
- Delimitation as content tag (manual)
- Edge valence (UI ready, data shown as "unknown" until NLP)
- Citation direction in graph (directed arrows on hover)
- Persistent selected node across views
- Empty states pointing to next action
- Subtle toasts

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/app.html`
- Create: `src/app.css`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+layout.ts`
- Create: `.gitignore`

**Step 1: Initialize git and SvelteKit project**

```bash
cd ~/Projects/paragraf
git init
npx sv create . --template minimal --types ts --no-add-ons
```

If `sv create` doesn't work in existing dir, scaffold in a temp dir and move files.

**Step 2: Install dependencies**

```bash
npm install @tanstack/svelte-query lucide-svelte d3 dagre
npm install -D @sveltejs/adapter-static @tailwindcss/vite tailwindcss
npm install -D @types/d3 @types/dagre
```

**Step 3: Configure svelte.config.js**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
```

**Step 4: Configure vite.config.ts**

```ts
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true
      }
    }
  }
});
```

Port 5174 to avoid conflict with endringsmeldinger on 5173. Flask on 5002.

**Step 5: Configure +layout.ts**

```ts
export const ssr = false;
export const prerender = false;
```

**Step 6: Set up app.css with Paragraf design tokens**

Use design tokens from spec section 17. Warm paper palette. See `docs/design/paragraf-designspesifikasjon.md` section 17 for exact values.

Key tokens:
```css
@import "tailwindcss";

@theme inline {
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-data: 'JetBrains Mono', 'SF Mono', monospace;

  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* Map to CSS vars resolved at runtime */
  --color-bg: var(--p-bg);
  --color-panel: var(--p-panel);
  --color-surface: var(--p-surface);
  --color-ink: var(--p-ink);
  --color-ink2: var(--p-ink2);
  --color-ink3: var(--p-ink3);
  --color-ink4: var(--p-ink4);
  --color-border: var(--p-border);
  --color-border-m: var(--p-border-m);
  --color-border-s: var(--p-border-s);
}

:root {
  --p-bg: #F5F3EE;
  --p-panel: #FAF9F6;
  --p-surface: #FFFFFF;
  --p-input: #EFECE5;
  --p-hover: rgba(26,24,20,0.03);
  --p-active: rgba(26,24,20,0.06);

  --p-ink: #1A1814;
  --p-ink2: #5C564D;
  --p-ink3: #8C8578;
  --p-ink4: #B0A99E;

  --p-border: rgba(26,24,20,0.08);
  --p-border-m: rgba(26,24,20,0.13);
  --p-border-s: rgba(26,24,20,0.22);

  /* Node types */
  --p-provision-bg: #E8EEF0;
  --p-provision-accent: #4A6670;
  --p-provision-border: #C5D3D8;
  --p-kofa-bg: #F0EBD8;
  --p-kofa-accent: #8B6914;
  --p-kofa-border: #DDD3B0;
  --p-eu-bg: #E4F0EC;
  --p-eu-accent: #2D6A5D;
  --p-eu-border: #BDD9CF;
  --p-court-bg: #EDE4EE;
  --p-court-accent: #6B4C6E;
  --p-court-border: #D4C4D6;
  --p-prep-bg: #EDE8E0;
  --p-prep-accent: #7A6B5D;
  --p-prep-border: #D5CEC3;

  /* Semantic */
  --p-success: #3D7A4A;
  --p-success-bg: #EBF5ED;
  --p-warn: #A67B2E;
  --p-warn-bg: #FBF5E8;
  --p-danger: #A63D3D;
  --p-danger-bg: #F5EBEB;
  --p-gap: #9B4DCA;
  --p-gap-bg: #F3ECF8;
  --p-delim: #C4650A;
  --p-delim-bg: #FDF2E7;

  /* Signals */
  --p-signal-on: #1A1814;
  --p-signal-off: #D5D0C8;

  /* AI */
  --p-highlight: #FBF5E8;
  --p-ai-accent: #8B6914;
  --p-ai-comment-bg: rgba(139,105,20,0.04);
}
```

**Step 7: Set up root +layout.svelte**

```svelte
<script lang="ts">
  import { QueryClientProvider, QueryClient } from '@tanstack/svelte-query';
  import '../app.css';
  let { children } = $props();
  const queryClient = new QueryClient();
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
```

**Step 8: Set up app.html**

Standard SvelteKit template with Inter + JetBrains Mono font imports.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with Paragraf design tokens"
```

---

## Task 2: TypeScript Types & Domain Model

**Files:**
- Create: `src/lib/types/graph.ts`
- Create: `src/lib/types/analysis.ts`
- Create: `src/lib/types/api.ts`

**Step 1: Define node and edge types**

```ts
// src/lib/types/graph.ts

export type NodeType = 'provision' | 'kofa_case' | 'eu_case' | 'court_case' | 'prep_work';
export type Category = 'A' | 'B' | 'C';
export type Valence = 'confirming' | 'distinguishing' | 'departing' | 'unknown';
export type RegulationVersion = 'new' | 'old';

export interface SignalHits {
  ref: boolean;  // R: Reference table
  fts: boolean;  // F: Full-text search
  vec: boolean;  // V: Vector search
}

export interface GraphNode {
  id: string;           // FQN: kofa:2021/1102, anskaffelsesforskriften:16-10, etc.
  type: NodeType;
  label: string;        // Display label: "2023/456", "FOA §16-10"
  subtitle: string;
  date?: string;
  outcome?: string;     // "Brudd", "Ikke brudd", "Avvist"
  category?: Category;
  signals?: SignalHits;
  citations: number;
  regulation?: RegulationVersion;
  iteration: number;
  isSeed: boolean;
  isDelimitation: boolean;
  detail?: string;       // Summary text from DB
  directive?: string;    // For EU cases: "Art. 63"
}

export interface GraphEdge {
  from: string;          // Node ID
  to: string;            // Node ID
  valence: Valence;
  context?: string;      // Citation context from DB
}

export interface GapPair {
  provision1: string;
  provision2: string;
  count: number;         // 0 = gap (∅)
}
```

**Step 2: Define analysis state types**

```ts
// src/lib/types/analysis.ts

export interface Analysis {
  id: string;
  problemStatement: string;
  seeds: {
    provisions: string[];     // Paragraph seeds
    ftsTerms: string[];       // FTS search terms
    vectorQuery: string;      // Natural language vector query
    cases: string[];          // Known case seeds
  };
  iteration: number;
  readStatus: Record<string, boolean>;       // nodeId → read
  notes: Record<string, string>;             // nodeId → note text
  delimitations: Record<string, boolean>;    // nodeId → is delimitation
  createdAt: string;
  updatedAt: string;
}
```

**Step 3: Define API response types**

```ts
// src/lib/types/api.ts

import type { GraphNode, GraphEdge, GapPair } from './graph';

export interface TraversalRequest {
  provisions: string[];
  ftsTerms: string[];
  vectorQuery: string;
  cases: string[];
  regulationFilter: 'new' | 'all';
}

export interface TraversalResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  gaps: GapPair[];
  stats: {
    total: number;
    categoryA: number;
    categoryB: number;
    categoryC: number;
    delimitations: number;
  };
}

export interface CaseDetailResponse {
  sak_nr: string;
  paragraphs: Array<{
    paragraph_number: number;
    section: string;       // "bakgrunn" | "vurdering"
    text: string;
  }>;
  law_references: Array<{
    law_name: string;
    law_section: string;
    context: string;
    regulation_version: string;
  }>;
  case_references: Array<{
    to_sak_nr: string;
    context: string;
  }>;
  eu_references: Array<{
    eu_case_id: string;
    eu_case_name: string;
    context: string;
  }>;
}

export interface ProvisionDetailResponse {
  dok_id: string;
  section_id: string;
  title: string;
  content: string;
  structure_path: string[];  // ["Del IV", "Kapittel 16", "§ 16-10"]
  referencing_cases: number;
}
```

**Step 4: Commit**

```bash
git add src/lib/types/
git commit -m "feat: add TypeScript types for graph, analysis, and API"
```

---

## Task 3: Svelte Stores — Analysis State

**Files:**
- Create: `src/lib/stores/analysis.svelte.ts`
- Create: `src/lib/stores/ui.svelte.ts`

**Step 1: Create analysis state store**

Uses Svelte 5 runes. Manages the entire analysis session: seeds, results, read status, notes.

```ts
// src/lib/stores/analysis.svelte.ts

import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type { Analysis } from '$lib/types/analysis';

// Singleton analysis state using runes
let nodes = $state<GraphNode[]>([]);
let edges = $state<GraphEdge[]>([]);
let gaps = $state<GapPair[]>([]);
let analysis = $state<Analysis>({
  id: '',
  problemStatement: '',
  seeds: { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] },
  iteration: 1,
  readStatus: {},
  notes: {},
  delimitations: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function getAnalysis() { return analysis; }
export function getNodes() { return nodes; }
export function getEdges() { return edges; }
export function getGaps() { return gaps; }

export function setResults(n: GraphNode[], e: GraphEdge[], g: GapPair[]) {
  nodes = n;
  edges = e;
  gaps = g;
}

export function toggleRead(nodeId: string) {
  analysis.readStatus[nodeId] = !analysis.readStatus[nodeId];
  analysis.updatedAt = new Date().toISOString();
}

export function setNote(nodeId: string, text: string) {
  analysis.notes[nodeId] = text;
  analysis.updatedAt = new Date().toISOString();
}

export function toggleDelimitation(nodeId: string) {
  analysis.delimitations[nodeId] = !analysis.delimitations[nodeId];
  analysis.updatedAt = new Date().toISOString();
}

export function setProblemStatement(text: string) {
  analysis.problemStatement = text;
}

export function setSeeds(seeds: Analysis['seeds']) {
  analysis.seeds = seeds;
}

// Derived counts
export function getCategoryCounts() {
  const a = nodes.filter(n => n.category === 'A').length;
  const b = nodes.filter(n => n.category === 'B').length;
  const c = nodes.filter(n => n.category === 'C').length;
  const delim = nodes.filter(n => n.isDelimitation).length;
  return { a, b, c, delim, total: a + b + c };
}

export function getReadProgress() {
  const total = nodes.length;
  const read = nodes.filter(n => analysis.readStatus[n.id]).length;
  return { read, total };
}
```

**Step 2: Create UI state store**

```ts
// src/lib/stores/ui.svelte.ts

export type ViewMode = 'list' | 'graph';
export type ListFilter = 'all' | 'delimitation' | 'unread';
export type ListSort = 'category' | 'citations' | 'date';

let selectedNodeId = $state<string | null>(null);
let viewMode = $state<ViewMode>('list');
let leftPanelOpen = $state(true);
let listFilter = $state<ListFilter>('all');
let listSort = $state<ListSort>('category');
let regulationFilter = $state<boolean>(true); // true = only new (2017+)

export function getSelectedNodeId() { return selectedNodeId; }
export function setSelectedNodeId(id: string | null) { selectedNodeId = id; }
export function getViewMode() { return viewMode; }
export function setViewMode(mode: ViewMode) { viewMode = mode; }
export function getLeftPanelOpen() { return leftPanelOpen; }
export function toggleLeftPanel() { leftPanelOpen = !leftPanelOpen; }
export function getListFilter() { return listFilter; }
export function setListFilter(f: ListFilter) { listFilter = f; }
export function getListSort() { return listSort; }
export function setListSort(s: ListSort) { listSort = s; }
export function getRegulationFilter() { return regulationFilter; }
export function toggleRegulationFilter() { regulationFilter = !regulationFilter; }
```

**Step 3: Commit**

```bash
git add src/lib/stores/
git commit -m "feat: add analysis and UI state stores"
```

---

## Task 4: API Client & Query Layer

**Files:**
- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/traversal.ts`
- Create: `src/lib/api/cases.ts`
- Create: `src/lib/queries/traversal.ts`

**Step 1: Create API client**

Follow endringsmeldinger pattern. Simpler version without CSRF (add auth later).

```ts
// src/lib/api/client.ts

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.message ?? response.statusText, data);
  }

  return response.json();
}
```

**Step 2: Create traversal API functions**

```ts
// src/lib/api/traversal.ts

import { apiFetch } from './client';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

export async function fetchTraversal(req: TraversalRequest): Promise<TraversalResponse> {
  return apiFetch<TraversalResponse>('/api/traverse', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
```

**Step 3: Create case detail API**

```ts
// src/lib/api/cases.ts

import { apiFetch } from './client';
import type { CaseDetailResponse, ProvisionDetailResponse } from '$lib/types/api';

export async function fetchCaseDetail(sakNr: string): Promise<CaseDetailResponse> {
  return apiFetch<CaseDetailResponse>(`/api/cases/${encodeURIComponent(sakNr)}`);
}

export async function fetchProvisionDetail(dokId: string, sectionId: string): Promise<ProvisionDetailResponse> {
  return apiFetch<ProvisionDetailResponse>(`/api/provisions/${encodeURIComponent(dokId)}/${encodeURIComponent(sectionId)}`);
}
```

**Step 4: Create query hooks**

```ts
// src/lib/queries/traversal.ts

import { createQuery } from '@tanstack/svelte-query';
import { fetchTraversal } from '$lib/api/traversal';
import type { TraversalRequest } from '$lib/types/api';

export function createTraversalQuery(request: TraversalRequest) {
  return createQuery({
    queryKey: ['traversal', request],
    queryFn: () => fetchTraversal(request),
    enabled: request.provisions.length > 0 || request.ftsTerms.length > 0,
  });
}
```

**Step 5: Commit**

```bash
git add src/lib/api/ src/lib/queries/
git commit -m "feat: add API client and query layer"
```

---

## Task 5: Flask Backend — Graph Traversal

**Files:**
- Create: `backend/app.py`
- Create: `backend/requirements.txt`
- Create: `backend/traversal.py`
- Create: `backend/db.py`

**Step 1: Create backend structure**

```bash
mkdir -p backend
```

**Step 2: Create requirements.txt**

```
flask>=3.0
flask-cors>=4.0
supabase>=2.0
python-dotenv>=1.0
```

**Step 3: Create Supabase client**

```python
# backend/db.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client
```

**Step 4: Create .env template**

```bash
# backend/.env
SUPABASE_URL=https://iyetsvrteyzpirygxenu.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

**Step 5: Create graph traversal endpoint**

The core algorithm:
1. Take seed provisions + FTS terms + vector query
2. Find KOFA cases referencing seed provisions via `kofa_law_references`
3. Run FTS on `kofa_decision_text` using terms
4. Run vector search on `kofa_decision_text` embeddings
5. Categorize: A = all 3 signals, B = 2 of 3, C = 1 of 3
6. Build edges from `kofa_case_references`, `kofa_eu_references`, `kofa_court_references`
7. Compute gap matrix from seed provision pairs

```python
# backend/traversal.py

from db import get_db

def traverse(provisions: list[str], fts_terms: list[str], vector_query: str,
             cases: list[str], regulation_filter: str = 'new') -> dict:
    db = get_db()

    # Step 1: Find cases via reference table (R signal)
    ref_cases = set()
    if provisions:
        # Parse provision seeds into law_name + law_section pairs
        for prov in provisions:
            # Query kofa_law_references for cases referencing this provision
            result = db.table('kofa_law_references') \
                .select('sak_nr') \
                .ilike('law_section', f'%{prov}%') \
                .execute()
            for row in result.data:
                ref_cases.add(row['sak_nr'])

    # Step 2: FTS search (F signal)
    fts_cases = set()
    if fts_terms:
        query = ' & '.join(fts_terms)
        result = db.rpc('search_decision_text', {'search_query': query}).execute()
        for row in result.data:
            fts_cases.add(row['sak_nr'])

    # Step 3: Vector search (V signal) — uses embedding similarity
    vec_cases = set()
    if vector_query:
        result = db.rpc('match_decision_text', {
            'query_text': vector_query,
            'match_threshold': 0.7,
            'match_count': 50
        }).execute()
        for row in result.data:
            vec_cases.add(row['sak_nr'])

    # Step 4: Combine and categorize
    all_cases = ref_cases | fts_cases | vec_cases
    nodes = []
    for sak_nr in all_cases:
        in_ref = sak_nr in ref_cases
        in_fts = sak_nr in fts_cases
        in_vec = sak_nr in vec_cases
        signal_count = sum([in_ref, in_fts, in_vec])
        category = 'A' if signal_count == 3 else 'B' if signal_count == 2 else 'C'

        # Fetch case metadata
        case_data = db.table('kofa_cases') \
            .select('*') \
            .eq('sak_nr', sak_nr) \
            .single() \
            .execute()

        if case_data.data:
            c = case_data.data
            # Determine regulation version from law references
            reg_version = determine_regulation_version(db, sak_nr)

            nodes.append({
                'id': f'kofa:{sak_nr}',
                'type': 'kofa_case',
                'label': sak_nr,
                'subtitle': c.get('saken_gjelder', ''),
                'date': str(c.get('avsluttet', '')),
                'outcome': c.get('avgjoerelse', ''),
                'category': category,
                'signals': {'ref': in_ref, 'fts': in_fts, 'vec': in_vec},
                'citations': 0,  # computed later
                'regulation': reg_version,
                'iteration': 1,
                'isSeed': sak_nr in cases,
                'isDelimitation': False,
            })

    # Step 5: Add provision nodes for seeds
    for prov in provisions:
        # ... fetch from lovdata_sections
        pass

    # Step 6: Build edges
    edges = build_edges(db, [n['id'] for n in nodes])

    # Step 7: Compute citation counts
    for node in nodes:
        node['citations'] = sum(1 for e in edges if e['to'] == node['id'])

    # Step 8: Gap matrix
    gaps = compute_gaps(db, provisions, all_cases)

    # Step 9: Stats
    stats = {
        'total': len(nodes),
        'categoryA': sum(1 for n in nodes if n.get('category') == 'A'),
        'categoryB': sum(1 for n in nodes if n.get('category') == 'B'),
        'categoryC': sum(1 for n in nodes if n.get('category') == 'C'),
        'delimitations': 0,
    }

    return {'nodes': nodes, 'edges': edges, 'gaps': gaps, 'stats': stats}


def determine_regulation_version(db, sak_nr: str) -> str:
    """Check if case primarily references new (2017+) or old FOA."""
    result = db.table('kofa_law_references') \
        .select('regulation_version') \
        .eq('sak_nr', sak_nr) \
        .execute()
    versions = [r['regulation_version'] for r in result.data if r.get('regulation_version')]
    if not versions:
        return 'new'
    return 'old' if all(v == 'old' for v in versions) else 'new'


def build_edges(db, node_ids: list[str]) -> list[dict]:
    """Build edges between nodes in the result set."""
    sak_nrs = [nid.replace('kofa:', '') for nid in node_ids if nid.startswith('kofa:')]
    edges = []

    if sak_nrs:
        # Case-to-case references
        result = db.table('kofa_case_references') \
            .select('from_sak_nr, to_sak_nr, context') \
            .in_('from_sak_nr', sak_nrs) \
            .execute()
        for r in result.data:
            if r['to_sak_nr'] in sak_nrs:
                edges.append({
                    'from': f"kofa:{r['from_sak_nr']}",
                    'to': f"kofa:{r['to_sak_nr']}",
                    'valence': 'unknown',
                    'context': r.get('context'),
                })

        # Case-to-law references
        result = db.table('kofa_law_references') \
            .select('sak_nr, law_name, law_section') \
            .in_('sak_nr', sak_nrs) \
            .execute()
        for r in result.data:
            prov_id = f"{r['law_name']}:{r.get('law_section', '')}"
            if any(nid == prov_id for nid in node_ids):
                edges.append({
                    'from': f"kofa:{r['sak_nr']}",
                    'to': prov_id,
                    'valence': 'unknown',
                })

    return edges


def compute_gaps(db, provisions: list[str], case_set: set[str]) -> list[dict]:
    """Compute gap matrix for seed provision pairs."""
    gaps = []
    for i, p1 in enumerate(provisions):
        for p2 in provisions[i+1:]:
            # Count cases that reference both provisions
            # This is a simplified version — full implementation needs
            # to query kofa_law_references for intersection
            count = 0  # TODO: implement intersection query
            gaps.append({
                'provision1': p1,
                'provision2': p2,
                'count': count,
            })
    return gaps
```

**Step 6: Create Flask app**

```python
# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from traversal import traverse

app = Flask(__name__)
CORS(app)

@app.route('/api/traverse', methods=['POST'])
def api_traverse():
    data = request.get_json()
    result = traverse(
        provisions=data.get('provisions', []),
        fts_terms=data.get('ftsTerms', []),
        vector_query=data.get('vectorQuery', ''),
        cases=data.get('cases', []),
        regulation_filter=data.get('regulationFilter', 'new'),
    )
    return jsonify(result)

@app.route('/api/cases/<sak_nr>', methods=['GET'])
def api_case_detail(sak_nr):
    from db import get_db
    db = get_db()

    # Fetch decision text
    paragraphs = db.table('kofa_decision_text') \
        .select('paragraph_number, section, text') \
        .eq('sak_nr', sak_nr) \
        .order('paragraph_number') \
        .execute()

    # Fetch references
    law_refs = db.table('kofa_law_references') \
        .select('law_name, law_section, context, regulation_version') \
        .eq('sak_nr', sak_nr) \
        .execute()

    case_refs = db.table('kofa_case_references') \
        .select('to_sak_nr, context') \
        .eq('from_sak_nr', sak_nr) \
        .execute()

    eu_refs = db.table('kofa_eu_references') \
        .select('eu_case_id, eu_case_name, context') \
        .eq('sak_nr', sak_nr) \
        .execute()

    return jsonify({
        'sak_nr': sak_nr,
        'paragraphs': paragraphs.data,
        'law_references': law_refs.data,
        'case_references': case_refs.data,
        'eu_references': eu_refs.data,
    })

@app.route('/api/provisions/<dok_id>/<section_id>', methods=['GET'])
def api_provision_detail(dok_id, section_id):
    from db import get_db
    db = get_db()

    section = db.table('lovdata_sections') \
        .select('*') \
        .eq('dok_id', dok_id) \
        .eq('section_id', section_id) \
        .single() \
        .execute()

    return jsonify(section.data)

if __name__ == '__main__':
    app.run(port=5002, debug=True)
```

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add Flask backend with graph traversal and case detail endpoints"
```

---

## Task 6: Three-Panel Layout Shell

**Files:**
- Create: `src/routes/+page.svelte`
- Create: `src/lib/components/layout/ThreePanel.svelte`
- Create: `src/lib/components/layout/Toolbar.svelte`

**Step 1: Create ThreePanel layout component**

```
┌──────────────┬──────────────────────────┬─────────────────┐
│  Venstre     │      Midtpanel           │   Høyrepanel    │
│  300px       │      (flex)              │   370px         │
│  Collapsible │   Liste (default)        │   Hidden until  │
│              │        eller             │   node click    │
│              │   Graf                   │                 │
└──────────────┴──────────────────────────┴─────────────────┘
```

Key behaviors:
- Left panel is collapsible (toggle button in toolbar)
- Right panel is hidden until a node is selected
- Center panel fills remaining space
- Toolbar sits at top of center panel

**Step 2: Create Toolbar component**

Contains:
1. Panel toggle button (left panel show/hide)
2. View switcher: "Liste | Graf" (two-button toggle, "Liste" default)
3. List filters (only visible in list view): "Alle | Avgrensning | Ulest"
4. Node type legend (compact, with icons)

**Step 3: Create main page**

The `+page.svelte` is the analysis workspace. It reads from stores and renders the three-panel layout.

**Step 4: Commit**

```bash
git add src/routes/+page.svelte src/lib/components/layout/
git commit -m "feat: add three-panel layout shell with toolbar"
```

---

## Task 7: Left Panel — Workflow Steps

**Files:**
- Create: `src/lib/components/left-panel/LeftPanel.svelte`
- Create: `src/lib/components/left-panel/Section.svelte`
- Create: `src/lib/components/left-panel/ProblemStatement.svelte`
- Create: `src/lib/components/left-panel/SearchParams.svelte`
- Create: `src/lib/components/left-panel/Results.svelte`
- Create: `src/lib/components/left-panel/Mapping.svelte`
- Create: `src/lib/components/left-panel/GapMatrix.svelte`
- Create: `src/lib/components/left-panel/AboutRanking.svelte`

Five numbered sections per spec section 4:

1. **Problemstilling** — Shows the formulated problem statement
2. **Utgangspunkt** — Shows seed provisions (monospace chips), FTS terms, vector query (italic), seed cases
3. **Resultater** — A/B/C category counts with badges, delimitation count, regulation version warning, signal explanation
4. **Kartlegging** — Read progress per category (progress bars), gap matrix, iteration info, "Ny iterasjon" button
5. **Om rangeringen** — Fixed pedagogical text about citation direction bias

Each section is collapsible. Number circle fills (inverted) when open.

**GapMatrix component:** Flat list of provision pairs with intersection count. Null hits (∅) on purple (#F3ECF8) background, clickable. Summary text in italic below.

**Step: Commit**

```bash
git add src/lib/components/left-panel/
git commit -m "feat: add left panel with workflow sections and gap matrix"
```

---

## Task 8: List View

**Files:**
- Create: `src/lib/components/list/ListView.svelte`
- Create: `src/lib/components/list/ListItem.svelte`
- Create: `src/lib/components/shared/CategoryBadge.svelte`
- Create: `src/lib/components/shared/SignalDots.svelte`
- Create: `src/lib/components/shared/DelimitationBadge.svelte`
- Create: `src/lib/components/shared/NodeTypeIcon.svelte`

**ListView:** Renders filtered and sorted list of GraphNodes. Reads from analysis store + UI store.

**ListItem layout (per spec section 8a):**
```
☐  ◉  2022/789    A  ●●○  Forpliktelseserklæring — tidspunkt
                          2022-11-22  Ikke brudd  7 sit.
```

Line 1: Checkbox (read status) · NodeTypeIcon · Case number (monospace, bold) · CategoryBadge · SignalDots · DelimitationBadge (if applicable) · IterationBadge (if iter 2+)
Line 2: Subtitle
Line 3: Date · Outcome badge · Citation count

**Sorting:** Buttons for "Kategori" (default), "Siteringer", "Dato". When "Siteringer" selected, show inline warning: "Eldre saker dominerer — kombiner med dato"

**Filtering:** "Alle" (default), "Avgrensning", "Ulest". Avgrensning button uses orange when active.

**Checkbox click:** Toggles read status → updates store → updates progress in left panel. Green check + green background when marked.

**Row click (outside checkbox):** Sets selectedNodeId in UI store → opens right panel.

**Regulation filter:** Nodes from old regulation (when filter deactivated) dim to 20-25% opacity.

**Step: Commit**

```bash
git add src/lib/components/list/ src/lib/components/shared/
git commit -m "feat: add list view with sorting, filtering, and shared badge components"
```

---

## Task 9: Right Panel — Overview Mode

**Files:**
- Create: `src/lib/components/right-panel/RightPanel.svelte`
- Create: `src/lib/components/right-panel/CaseOverview.svelte`
- Create: `src/lib/components/right-panel/ProvisionOverview.svelte`
- Create: `src/lib/components/right-panel/EuCaseOverview.svelte`
- Create: `src/lib/components/right-panel/PrepWorkOverview.svelte`
- Create: `src/lib/components/right-panel/NoteEditor.svelte`

**RightPanel:** Container that shows content based on selected node type. Invisible until node is clicked.

**Header (all types):** Background in node type's muted color. Shows: node type icon + label, case/section number (large, monospace), subtitle, metadata row.

Close button (×) top right.

**CaseOverview (KOFA case):**
- Header with metadata
- Signal indicators (R/F/V) with explanations
- Relations list with valence indicators
- Note editor
- Actions: "Marker som lest" toggle, "Bruk som seed i neste iterasjon"
- Delimitation marking if applicable

**ProvisionOverview (law section):**
- Full provision text (authoritative, from DB — shown at top)
- Placement in law structure (del → kapittel → paragraf)
- Count of KOFA cases referencing this provision

**NoteEditor:** Simple textarea, auto-saves to store on change (debounced).

**Actions:** "Marker som lest" button toggles read status. "Bruk som seed" adds to next iteration's seeds.

**Step: Commit**

```bash
git add src/lib/components/right-panel/
git commit -m "feat: add right panel with overview mode per node type"
```

---

## Task 10: Graph View — D3 + dagre + SVG

**Files:**
- Create: `src/lib/components/graph/GraphView.svelte`
- Create: `src/lib/components/graph/GraphNode.svelte`
- Create: `src/lib/components/graph/GraphEdge.svelte`
- Create: `src/lib/components/graph/GraphLegend.svelte`
- Create: `src/lib/utils/layout.ts`

**This is the most complex task.** Uses D3 for calculations, dagre for hierarchical layout, Svelte for SVG rendering.

**Layout (spec section 8b):** Three layers:
```
BESTEMMELSER        [§16-10]   [§17-1]   [§16-12]
PRAKSIS              (2023/456) (2022/789) (2021/234)
EU / FORARBEIDER      ◆C-324/14  ◆C-601/13  □Prop. 51 L
```

Layer labels in left margin: "BESTEMMELSER", "PRAKSIS", "EU / FORARBEIDER" — muted, uppercase, small.

**layout.ts:** Uses dagre to compute hierarchical positions.

```ts
// src/lib/utils/layout.ts
import dagre from 'dagre';
import type { GraphNode, GraphEdge } from '$lib/types/graph';

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): {
  nodes: LayoutNode[];
  edges: Array<GraphEdge & { points: Array<{x: number; y: number}> }>;
} {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    ranksep: 80,
    nodesep: 40,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Assign ranks based on node type
  const rankMap: Record<string, number> = {
    provision: 0,
    kofa_case: 1,
    eu_case: 2,
    court_case: 2,
    prep_work: 2,
  };

  for (const node of nodes) {
    const baseSize = 22;
    const sizeBonus = node.citations >= 10 ? 10 : node.citations >= 5 ? 5 : 0;
    const size = baseSize + sizeBonus;

    g.setNode(node.id, {
      width: node.type === 'provision' ? 120 : size * 2,
      height: node.type === 'provision' ? 40 : size * 2,
      rank: rankMap[node.type] ?? 1,
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = nodes.map(node => {
    const pos = g.node(node.id);
    return { ...node, x: pos.x, y: pos.y, width: pos.width, height: pos.height };
  });

  const layoutEdges = edges.filter(e => g.hasNode(e.from) && g.hasNode(e.to)).map(edge => {
    const edgeData = g.edge(edge.from, edge.to);
    return { ...edge, points: edgeData?.points ?? [] };
  });

  return { nodes: layoutNodes, edges: layoutEdges };
}
```

**Node shapes (spec section 8b):**
| Type | Shape | Background | Accent |
|------|-------|-----------|--------|
| Provision | Rectangle (wide) | #E8EEF0 | #4A6670 |
| KOFA case | Circle | #F0EBD8 | #8B6914 |
| EU case | Diamond (rotated square) | #E4F0EC | #2D6A5D |
| Court case | Triangle | #EDE4EE | #6B4C6E |
| Prep work | Rectangle (low) | #EDE8E0 | #7A6B5D |

**Node size codes centrality:** Base 22px, +5 at 5+ citations, +10 at 10+.

**Node overlays:** A/B/C badge (upper right), read mark (green circle), delimitation (orange ∅), seed mark (filled dot left), iteration badge.

**Edge styles (spec section 9):**
| Valence | Line style | Color | Opacity |
|---------|-----------|-------|---------|
| Confirming/Unknown | Solid | borderM color | 0.3 |
| Distinguishing | Long-dash (5,3) | #A67B2E | 0.5 |
| Departing | Short-dash (2,3) | #A63D3D | 0.5 |

**Citation direction:** Subtle arrow at endpoint on hover. Permanent for distinguishing/departing edges.

**Node click:** Sets selectedNodeId → opens right panel.

**Hover tooltip (spec section 32):** Compact 3-line tooltip after ~300ms delay.

**GraphLegend:** Shows node shape + color key and edge valence line styles in upper right corner.

**Step: Commit**

```bash
git add src/lib/components/graph/ src/lib/utils/
git commit -m "feat: add graph view with D3+dagre hierarchical layout"
```

---

## Task 11: Toast Notifications

**Files:**
- Create: `src/lib/components/shared/Toast.svelte`
- Create: `src/lib/stores/toast.svelte.ts`

Subtle toast at bottom center of mid panel. Dark background (#1A1814), light text (#FAF9F6), rounded corners, no shadow. Auto-dismiss after 2 seconds. Shows action confirmation with context (e.g., "Markert som lest · 5 av 8").

**Step: Commit**

```bash
git add src/lib/components/shared/Toast.svelte src/lib/stores/toast.svelte.ts
git commit -m "feat: add subtle toast notification system"
```

---

## Task 12: Empty States

**Files:**
- Modify: `src/lib/components/list/ListView.svelte`
- Modify: `src/lib/components/graph/GraphView.svelte`

Per spec section 32: every empty state points to next action.

- **List without results:** "Definer problemstilling og seeds i venstrepanelet for å starte søket."
- **Graph with only seeds:** Show seed nodes with aggregate badges ("? saker" in dashed frame)
- **Right panel without selection:** Hidden (not shown at all)

No generic "nothing here" messages.

**Step: Commit**

```bash
git add src/lib/components/list/ src/lib/components/graph/
git commit -m "feat: add meaningful empty states"
```

---

## Task 13: Mock Data for Development

**Files:**
- Create: `src/lib/mocks/analysis.ts`

Port the mock data from `docs/design/legal-workbench.jsx` (NODES, EDGES, GAP_MATRIX, DECISION_TEXT, AI_CURATION) to TypeScript, conforming to our type definitions. This lets the frontend be developed without the Flask backend running.

Use mock data fallback in query hooks (same pattern as endringsmeldinger's `createCaseContextQuery`).

**Step: Commit**

```bash
git add src/lib/mocks/
git commit -m "feat: add mock data from design mock for frontend development"
```

---

## Task 14: Integration & Polish

**Step 1:** Wire up the full data flow:
- Problem statement → seeds → traversal query → store → list/graph/right panel
- Read status toggle → store → progress bar → toast
- Note editing → store → auto-persist
- Delimitation toggle → store → badge update

**Step 2:** Test with mock data end-to-end. Verify:
- Three-panel layout renders correctly
- Left panel sections expand/collapse
- List view sorts and filters
- Node click opens right panel
- View switching (list ↔ graph) preserves selected node
- Gap matrix shows ∅ for zero-count pairs
- Regulation filter dims old-regulation nodes
- Toasts appear on actions

**Step 3:** Connect Flask backend with real Supabase data. Test with a real traversal query.

**Step 4:** Final commit

```bash
git add -A
git commit -m "feat: wire up full data flow and integration"
```

---

## Task Order & Dependencies

```
Task 1 (Scaffold)
  └→ Task 2 (Types)
       └→ Task 3 (Stores)
            └→ Task 4 (API Client)
            └→ Task 6 (Layout Shell)
                 ├→ Task 7 (Left Panel)
                 ├→ Task 8 (List View)
                 ├→ Task 9 (Right Panel)
                 └→ Task 10 (Graph View)
  └→ Task 5 (Flask Backend) — can run in parallel with frontend tasks
  └→ Task 13 (Mock Data) — can run right after Task 2

Task 11 (Toasts) — independent, after Task 1
Task 12 (Empty States) — after Tasks 8 + 10
Task 14 (Integration) — after all others
```

**Parallelizable:** Tasks 5, 7, 8, 9, 10, 11, 13 can run in parallel (independent components).

---

## Critical Design Rules (from spec — do not violate)

1. **List view is default, not graph.** The lawyer is unfamiliar with graph visualization.
2. **C cases are not visually degraded.** They often contain delimitation practice of equal value.
3. **A/B/C is discovery signal, delimitation is content type.** Two orthogonal dimensions.
4. **Regulation version filter is prominent.** Yellow warning box, enabled by default.
5. **Filtering dims nodes, doesn't remove them.** 15-25% opacity for filtered nodes.
6. **Shape is primary signal for node type, color is secondary.**
7. **DB text has no marking. AI text has gold-brown left border.** Never confusable.
8. **Aesthetic: researcher workspace, calm authority, warm paper tones.** Not tech-blue, not dashboard-y.
