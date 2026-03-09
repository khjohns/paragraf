# Sprint 1: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the SvelteKit project, define types, create shared stores, build the API client layer, and set up mock data — so Sprint 3 (UI) can build against working types and data.

**Architecture:** SvelteKit 2 SPA with Svelte 5 runes, Tailwind v4 for design tokens (used as CSS variables in scoped styles), class-based `.svelte.ts` stores for shared state, `@tanstack/svelte-query` v6 for server state.

**Reference:** Patterns from `~/Projects/endringsmeldinger` (adapter-static, @tailwindcss/vite, CSS variable styling, mock fallback). We use svelte-query v6 (not v5 like endringsmeldinger) — v6 is designed for Svelte 5 runes with automatic reactivity via thunk syntax.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via sv create)
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `src/app.html`
- Create: `src/app.css`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+layout.ts`
- Create: `src/routes/+page.svelte`
- Create: `.gitignore`

**Step 1: Initialize git and SvelteKit project**

```bash
cd ~/Projects/paragraf
git init
npx sv create . --template minimal --types ts --no-add-ons
```

If `sv create` fails in existing directory (because docs/ exists), scaffold in temp dir and move:

```bash
cd /tmp && npx sv create paragraf-temp --template minimal --types ts --no-add-ons
cp -r paragraf-temp/* paragraf-temp/.* ~/Projects/paragraf/ 2>/dev/null
rm -rf paragraf-temp
cd ~/Projects/paragraf
```

**Step 2: Install dependencies**

Match endringsmeldinger versions where possible:

```bash
npm install @tanstack/svelte-query@next lucide-svelte d3 dagre
npm install -D @sveltejs/adapter-static @tailwindcss/vite tailwindcss
npm install -D @types/d3 @types/dagre
```

**Step 3: Configure svelte.config.js**

Copy from endringsmeldinger exactly:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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

Port 5174 (endringsmeldinger uses 5173). Flask backend on 5002.

**Step 5: Configure +layout.ts**

```ts
// src/routes/+layout.ts
export const ssr = false;
export const prerender = false;
```

**Step 6: Set up app.css with design tokens**

Pattern from endringsmeldinger: `@theme inline` maps Tailwind namespace to CSS vars, `:root` defines actual values. All component styling uses `var(--p-*)` in scoped `<style>` blocks.

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

  /* Node types — spec section 17 */
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

  /* AI (Phase 2, but tokens defined now) */
  --p-highlight: #FBF5E8;
  --p-ai-accent: #8B6914;
  --p-ai-comment-bg: rgba(139,105,20,0.04);
}

/* Global resets */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-ui);
  color: var(--p-ink);
  background: var(--p-bg);
  -webkit-font-smoothing: antialiased;
}

code, .mono {
  font-family: var(--font-data);
}
```

**Step 7: Set up app.html**

```html
<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <title>Paragraf</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

**Step 8: Set up root +layout.svelte**

```svelte
<script lang="ts">
  import { QueryClientProvider, QueryClient } from '@tanstack/svelte-query';
  import '../app.css';

  let { children } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
```

**Step 9: Minimal +page.svelte to verify setup**

```svelte
<h1>Paragraf</h1>
<p>Rettskildeanalyse</p>

<style>
  h1 {
    font-family: var(--font-ui);
    color: var(--p-ink);
    font-size: 1.5rem;
    font-weight: 600;
  }
  p {
    color: var(--p-ink3);
  }
</style>
```

**Step 10: Verify build**

```bash
npm run dev
```

Open http://localhost:5174 — should see "Paragraf" heading with warm paper background and Inter font.

**Step 11: Commit**

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

**Step 1: Define graph types**

```ts
// src/lib/types/graph.ts

export type NodeType = 'provision' | 'kofa_case' | 'eu_case' | 'court_case' | 'prep_work';
export type Category = 'A' | 'B' | 'C';
export type Valence = 'confirming' | 'distinguishing' | 'departing' | 'unknown';
export type RegulationVersion = 'new' | 'old';

export interface SignalHits {
  ref: boolean;
  fts: boolean;
  vec: boolean;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  subtitle: string;
  date?: string;
  outcome?: string;
  category?: Category;
  signals?: SignalHits;
  citations: number;
  regulation?: RegulationVersion;
  iteration: number;
  isSeed: boolean;
  isDelimitation: boolean;
  detail?: string;
  directive?: string;
  connectedTo?: string[];
  valence?: Record<string, Valence>;
}

export interface GraphEdge {
  from: string;
  to: string;
  valence: Valence;
  context?: string;
}

export interface GapPair {
  provision1: string;
  provision2: string;
  count: number;
}
```

**Step 2: Define analysis types**

```ts
// src/lib/types/analysis.ts

export interface Seeds {
  provisions: string[];
  ftsTerms: string[];
  vectorQuery: string;
  cases: string[];
}

export interface Analysis {
  id: string;
  problemStatement: string;
  seeds: Seeds;
  iteration: number;
  readStatus: Record<string, boolean>;
  notes: Record<string, string>;
  delimitations: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}
```

**Step 3: Define API types**

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

export interface DecisionParagraph {
  paragraph_number: number;
  section: string;
  text: string;
}

export interface CaseDetailResponse {
  sak_nr: string;
  paragraphs: DecisionParagraph[];
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
  structure_path: string[];
  referencing_cases: number;
}
```

**Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/types/
git commit -m "feat: add TypeScript types for graph, analysis, and API"
```

---

## Task 3: Svelte Stores — Shared State

**Files:**
- Create: `src/lib/stores/analysis.svelte.ts`
- Create: `src/lib/stores/ui.svelte.ts`

Uses class-based pattern with `$state` and `$derived`. These are `.svelte.ts` files — runes work here. endringsmeldinger keeps runes in components, but Paragraf needs shared state across panels.

**Step 1: Create analysis state store**

```ts
// src/lib/stores/analysis.svelte.ts

import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type { Analysis, Seeds } from '$lib/types/analysis';

const STORAGE_KEY = 'paragraf-analysis';

class AnalysisState {
  nodes = $state<GraphNode[]>([]);
  edges = $state<GraphEdge[]>([]);
  gaps = $state<GapPair[]>([]);
  analysis = $state<Analysis>({
    id: crypto.randomUUID(),
    problemStatement: '',
    seeds: { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] },
    iteration: 1,
    readStatus: {},
    notes: {},
    delimitations: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // --- Mutations ---

  setResults(nodes: GraphNode[], edges: GraphEdge[], gaps: GapPair[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.gaps = gaps;
  }

  setProblemStatement(text: string) {
    this.analysis.problemStatement = text;
    this.touch();
  }

  setSeeds(seeds: Seeds) {
    this.analysis.seeds = seeds;
    this.touch();
  }

  toggleRead(nodeId: string) {
    this.analysis.readStatus[nodeId] = !this.analysis.readStatus[nodeId];
    this.touch();
  }

  setNote(nodeId: string, text: string) {
    this.analysis.notes[nodeId] = text;
    this.touch();
  }

  toggleDelimitation(nodeId: string) {
    this.analysis.delimitations[nodeId] = !this.analysis.delimitations[nodeId];
    this.touch();
  }

  // --- Persistence ---

  save() {
    try {
      const data = {
        analysis: this.analysis,
        nodes: this.nodes,
        edges: this.edges,
        gaps: this.gaps,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.analysis) this.analysis = data.analysis;
      if (data.nodes) this.nodes = data.nodes;
      if (data.edges) this.edges = data.edges;
      if (data.gaps) this.gaps = data.gaps;
    } catch {
      // Corrupt data — start fresh
    }
  }

  private touch() {
    this.analysis.updatedAt = new Date().toISOString();
  }
}

export const analysisState = new AnalysisState();
```

**Step 2: Create UI state store**

```ts
// src/lib/stores/ui.svelte.ts

export type ViewMode = 'list' | 'graph';
export type ListFilter = 'all' | 'delimitation' | 'unread';
export type ListSort = 'category' | 'citations' | 'date';

class UiState {
  selectedNodeId = $state<string | null>(null);
  viewMode = $state<ViewMode>('list');
  leftPanelOpen = $state(true);
  listFilter = $state<ListFilter>('all');
  listSort = $state<ListSort>('category');
  regulationFilter = $state(true); // true = only new (2017+)

  selectNode(id: string | null) {
    this.selectedNodeId = id;
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  toggleLeftPanel() {
    this.leftPanelOpen = !this.leftPanelOpen;
  }

  setListFilter(filter: ListFilter) {
    this.listFilter = filter;
  }

  setListSort(sort: ListSort) {
    this.listSort = sort;
  }

  toggleRegulationFilter() {
    this.regulationFilter = !this.regulationFilter;
  }
}

export const uiState = new UiState();
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/stores/
git commit -m "feat: add class-based analysis and UI state stores"
```

---

## Task 4: API Client & Query Layer

**Files:**
- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/traversal.ts`
- Create: `src/lib/api/cases.ts`
- Create: `src/lib/queries/traversal.ts`
- Create: `src/lib/queries/cases.ts`

Pattern from endringsmeldinger: centralized `apiFetch`, per-endpoint modules, TanStack Query wrappers with mock fallback.

**Step 1: Create API client**

```ts
// src/lib/api/client.ts

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(endpoint, { ...options, headers });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      (data as { message?: string })?.message ?? response.statusText,
      data,
    );
  }

  return response.json();
}
```

**Step 2: Create traversal API**

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

export async function fetchProvisionDetail(
  dokId: string,
  sectionId: string,
): Promise<ProvisionDetailResponse> {
  return apiFetch<ProvisionDetailResponse>(
    `/api/provisions/${encodeURIComponent(dokId)}/${encodeURIComponent(sectionId)}`,
  );
}
```

**Step 4: Create query hooks with mock fallback**

```ts
// src/lib/queries/traversal.ts

import { createQuery } from '@tanstack/svelte-query';
import { fetchTraversal } from '$lib/api/traversal';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

// v6 thunk syntax: () => ({...}) — re-evaluates reactively when $state values change
export function createTraversalQuery(getRequest: () => TraversalRequest) {
  return createQuery<TraversalResponse>(() => {
    const request = getRequest();
    return {
      queryKey: ['traversal', request],
      queryFn: async () => {
        try {
          return await fetchTraversal(request);
        } catch {
          const { mockTraversalResponse } = await import('$lib/mocks/traversal');
          return mockTraversalResponse;
        }
      },
      enabled: request.provisions.length > 0 || request.ftsTerms.length > 0,
    };
  });
}
```

```ts
// src/lib/queries/cases.ts

import { createQuery } from '@tanstack/svelte-query';
import { fetchCaseDetail } from '$lib/api/cases';
import type { CaseDetailResponse } from '$lib/types/api';

// v6 thunk syntax: options re-evaluate when sakNr changes
export function createCaseDetailQuery(getSakNr: () => string | null) {
  return createQuery<CaseDetailResponse>(() => {
    const sakNr = getSakNr();
    return {
      queryKey: ['case-detail', sakNr],
      queryFn: async () => {
        try {
          return await fetchCaseDetail(sakNr!);
        } catch {
          const { mockCaseDetail } = await import('$lib/mocks/cases');
          return mockCaseDetail(sakNr!);
        }
      },
      enabled: !!sakNr,
    };
  });
}
```

**Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/lib/api/ src/lib/queries/
git commit -m "feat: add API client and query layer with mock fallback"
```

---

## Task 5: Mock Data

**Files:**
- Create: `src/lib/mocks/nodes.ts`
- Create: `src/lib/mocks/traversal.ts`
- Create: `src/lib/mocks/cases.ts`

Port data from `docs/design/legal-workbench.jsx`. Adapt to our TypeScript types.

**Step 1: Create mock nodes and edges**

```ts
// src/lib/mocks/nodes.ts

import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';

export const MOCK_NODES: GraphNode[] = [
  // Provisions (seeds)
  {
    id: 'anskaffelsesforskriften:16-10',
    type: 'provision',
    label: 'FOA §16-10',
    subtitle: 'Bruk av andre enheters kapasitet',
    citations: 12,
    regulation: 'new',
    iteration: 1,
    isSeed: true,
    isDelimitation: false,
  },
  {
    id: 'anskaffelsesforskriften:17-1',
    type: 'provision',
    label: 'FOA §17-1',
    subtitle: 'Krav til dokumentasjon',
    citations: 8,
    regulation: 'new',
    iteration: 1,
    isSeed: true,
    isDelimitation: false,
  },
  // KOFA cases
  {
    id: 'kofa:2023/456',
    type: 'kofa_case',
    label: '2023/456',
    subtitle: 'ESPD + støttende virksomhet',
    date: '2023-06-15',
    outcome: 'Brudd',
    category: 'A',
    signals: { ref: true, fts: true, vec: true },
    citations: 3,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
    detail: 'Nemnda fant at oppdragsgiver brøt regelverket ved å akseptere ESPD som tilstrekkelig dokumentasjon for rådighet over støttende virksomhets kapasitet.',
  },
  {
    id: 'kofa:2022/789',
    type: 'kofa_case',
    label: '2022/789',
    subtitle: 'Forpliktelseserklæring — tidspunkt',
    date: '2022-11-22',
    outcome: 'Ikke brudd',
    category: 'A',
    signals: { ref: true, fts: true, vec: true },
    citations: 7,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
    detail: 'Nemnda aksepterte ettersending av forpliktelseserklæring under visse vilkår.',
  },
  {
    id: 'kofa:2021/234',
    type: 'kofa_case',
    label: '2021/234',
    subtitle: 'Kvalifikasjonskrav og rådighet',
    date: '2021-03-10',
    outcome: 'Brudd',
    category: 'B',
    signals: { ref: true, fts: true, vec: false },
    citations: 5,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
  },
  {
    id: 'kofa:2020/567',
    type: 'kofa_case',
    label: '2020/567',
    subtitle: 'Binær vs. kvantitativ rådighet',
    date: '2020-08-05',
    outcome: 'Ikke brudd',
    category: 'B',
    signals: { ref: true, fts: false, vec: true },
    citations: 4,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
  },
  {
    id: 'kofa:2019/890',
    type: 'kofa_case',
    label: '2019/890',
    subtitle: 'Ettersending av dokumentasjon',
    date: '2019-05-20',
    outcome: 'Ikke brudd',
    category: 'C',
    signals: { ref: false, fts: true, vec: false },
    citations: 2,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: true,
  },
  {
    id: 'kofa:2018/123',
    type: 'kofa_case',
    label: '2018/123',
    subtitle: 'Grunnleggende om forpliktelseserklæring',
    date: '2018-02-14',
    outcome: 'Brudd',
    category: 'A',
    signals: { ref: true, fts: true, vec: true },
    citations: 12,
    regulation: 'new',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
  },
  {
    id: 'kofa:2015/345',
    type: 'kofa_case',
    label: '2015/345',
    subtitle: 'Støttende virksomhet (gammel FOA)',
    date: '2015-09-30',
    outcome: 'Brudd',
    category: 'C',
    signals: { ref: true, fts: false, vec: false },
    citations: 3,
    regulation: 'old',
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
  },
  // EU case
  {
    id: 'eu:C-324/14',
    type: 'eu_case',
    label: 'C-324/14',
    subtitle: 'Partner Apelski',
    date: '2016-05-10',
    category: 'A',
    signals: { ref: true, fts: false, vec: true },
    citations: 8,
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
    directive: 'Art. 63',
  },
  // Prep work
  {
    id: 'forarbeid:prop51L:8.3',
    type: 'prep_work',
    label: 'Prop. 51 L',
    subtitle: 'Til anskaffelsesloven (2015–2016)',
    citations: 2,
    iteration: 1,
    isSeed: false,
    isDelimitation: false,
  },
];

export const MOCK_EDGES: GraphEdge[] = [
  // Cases referencing provisions
  { from: 'kofa:2023/456', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
  { from: 'kofa:2023/456', to: 'anskaffelsesforskriften:17-1', valence: 'unknown' },
  { from: 'kofa:2022/789', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
  { from: 'kofa:2021/234', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
  { from: 'kofa:2020/567', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
  { from: 'kofa:2018/123', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
  { from: 'kofa:2018/123', to: 'anskaffelsesforskriften:17-1', valence: 'unknown' },
  // Case-to-case
  { from: 'kofa:2023/456', to: 'kofa:2022/789', valence: 'distinguishing' },
  { from: 'kofa:2023/456', to: 'kofa:2018/123', valence: 'confirming' },
  { from: 'kofa:2022/789', to: 'kofa:2018/123', valence: 'confirming' },
  { from: 'kofa:2021/234', to: 'kofa:2018/123', valence: 'confirming' },
  { from: 'kofa:2020/567', to: 'kofa:2018/123', valence: 'unknown' },
  // EU references
  { from: 'kofa:2023/456', to: 'eu:C-324/14', valence: 'unknown' },
  { from: 'kofa:2018/123', to: 'eu:C-324/14', valence: 'unknown' },
  // Prep work
  { from: 'forarbeid:prop51L:8.3', to: 'anskaffelsesforskriften:16-10', valence: 'unknown' },
];

export const MOCK_GAPS: GapPair[] = [
  { provision1: 'FOA §16-10', provision2: 'FOA §17-1', count: 3 },
  { provision1: 'FOA §16-10', provision2: 'FOA §16-12', count: 2 },
  { provision1: 'FOA §16-10', provision2: 'LOA §5', count: 2 },
  { provision1: 'FOA §16-10', provision2: 'FOA §16-3', count: 0 },
  { provision1: 'FOA §17-1', provision2: 'FOA §16-12', count: 0 },
  { provision1: 'FOA §17-1', provision2: 'LOA §5', count: 1 },
  { provision1: 'FOA §17-1', provision2: 'FOA §16-3', count: 0 },
  { provision1: 'FOA §16-12', provision2: 'LOA §5', count: 0 },
];
```

**Step 2: Create mock traversal response**

```ts
// src/lib/mocks/traversal.ts

import type { TraversalResponse } from '$lib/types/api';
import { MOCK_NODES, MOCK_EDGES, MOCK_GAPS } from './nodes';

export const mockTraversalResponse: TraversalResponse = {
  nodes: MOCK_NODES,
  edges: MOCK_EDGES,
  gaps: MOCK_GAPS,
  stats: {
    total: MOCK_NODES.filter(n => n.type === 'kofa_case').length,
    categoryA: MOCK_NODES.filter(n => n.category === 'A').length,
    categoryB: MOCK_NODES.filter(n => n.category === 'B').length,
    categoryC: MOCK_NODES.filter(n => n.category === 'C').length,
    delimitations: MOCK_NODES.filter(n => n.isDelimitation).length,
  },
};
```

**Step 3: Create mock case detail**

```ts
// src/lib/mocks/cases.ts

import type { CaseDetailResponse } from '$lib/types/api';

const MOCK_PARAGRAPHS: Record<string, CaseDetailResponse['paragraphs']> = {
  '2023/456': [
    { paragraph_number: 35, section: 'bakgrunn', text: 'Saken gjelder klage over innklagedes beslutning om å tildele kontrakt til valgte leverandør. Klager anfører at valgte leverandørs tilbud skulle vært avvist fordi forpliktelseserklæring fra støttende virksomhet ikke forelå ved tilbudsfristen.' },
    { paragraph_number: 36, section: 'bakgrunn', text: 'Klager hadde i sitt tilbud oppgitt Firma X AS som støttende virksomhet for oppfyllelse av kvalifikasjonskravet om relevant erfaring.' },
    { paragraph_number: 42, section: 'vurdering', text: 'Nemnda finner at kravet til forpliktelseserklæring fra støttende virksomhet må foreligge ved tilbudsfristen. ESPD fra støttende virksomhet er ikke tilstrekkelig til å dokumentere at tilbyderen faktisk råder over den støttende virksomhetens ressurser.' },
    { paragraph_number: 43, section: 'vurdering', text: 'Det er en vesentlig forskjell mellom ESPD, som er en egenerklæring om at kravene er oppfylt, og en forpliktelseserklæring, som dokumenterer at den støttende virksomheten faktisk stiller sine ressurser til disposisjon.' },
    { paragraph_number: 44, section: 'vurdering', text: 'Nemnda viser til EU-domstolens avgjørelse i C-324/14 Partner Apelski, der det ble fastslått at oppdragsgiver må forsikre seg om at tilbyderen faktisk disponerer over de ressursene som tilhører andre enheter.' },
  ],
  '2022/789': [
    { paragraph_number: 30, section: 'bakgrunn', text: 'Saken gjelder klage over innklagedes beslutning om å avvise klagers tilbud. Klager anfører at avvisningen var urettmessig fordi forpliktelseserklæring ble ettersendt innen oppklaringsfristen.' },
    { paragraph_number: 38, section: 'vurdering', text: 'Nemnda finner at ettersending av forpliktelseserklæring kan aksepteres dersom tilbudet for øvrig inneholder tilstrekkelig informasjon til å vurdere om kvalifikasjonskravet er oppfylt.' },
    { paragraph_number: 39, section: 'vurdering', text: 'Det avgjørende er om ettersendingen innebærer en forbedring av tilbudet eller kun en klargjøring av allerede innleverte opplysninger.' },
  ],
};

export function mockCaseDetail(sakNr: string): CaseDetailResponse {
  return {
    sak_nr: sakNr,
    paragraphs: MOCK_PARAGRAPHS[sakNr] ?? [
      { paragraph_number: 1, section: 'vurdering', text: `Mockdata for sak ${sakNr} er ikke tilgjengelig.` },
    ],
    law_references: [
      { law_name: 'anskaffelsesforskriften', law_section: '16-10', context: 'jf. anskaffelsesforskriften § 16-10', regulation_version: 'new' },
    ],
    case_references: [],
    eu_references: [],
  };
}
```

**Step 4: Verify types compile and mock data matches types**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/mocks/
git commit -m "feat: add mock data from design JSX for frontend development"
```

---

## Task 6: Smoke Test — Wire Stores + Mock Data + Minimal UI

**Files:**
- Modify: `src/routes/+page.svelte`

Quick verification that stores, mock data, and query layer work together before handing off to Sprint 3 (UI).

**Step 1: Update +page.svelte**

```svelte
<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { mockTraversalResponse } from '$lib/mocks/traversal';

  // Load mock data into store on mount
  $effect(() => {
    analysisState.setResults(
      mockTraversalResponse.nodes,
      mockTraversalResponse.edges,
      mockTraversalResponse.gaps,
    );
    analysisState.setProblemStatement(
      'Er ESPD fra støttende virksomhet tilstrekkelig til å dokumentere rådighet over dennes ressurser, eller må forpliktelseserklæring foreligge ved tilbudsfrist?',
    );
  });

  function handleNodeClick(id: string) {
    uiState.selectNode(id);
  }
</script>

<main>
  <h1>Paragraf</h1>
  <p class="problem">{analysisState.analysis.problemStatement}</p>

  <div class="stats">
    <span>Noder: {analysisState.nodes.length}</span>
    <span>Kanter: {analysisState.edges.length}</span>
    <span>Visning: {uiState.viewMode}</span>
  </div>

  <ul class="node-list">
    {#each analysisState.nodes as node}
      <li class:selected={uiState.selectedNodeId === node.id}>
        <button onclick={() => handleNodeClick(node.id)}>
          <span class="label">{node.label}</span>
          <span class="meta">
            {node.type} · {node.category ?? '—'} · {node.citations} sit.
          </span>
        </button>
      </li>
    {/each}
  </ul>

  {#if uiState.selectedNodeId}
    <aside>
      <h2>Valgt: {uiState.selectedNodeId}</h2>
      <button onclick={() => uiState.selectNode(null)}>Lukk</button>
    </aside>
  {/if}
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--spacing-6);
  }
  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--p-ink);
  }
  .problem {
    color: var(--p-ink2);
    font-style: italic;
    margin-bottom: var(--spacing-4);
  }
  .stats {
    display: flex;
    gap: var(--spacing-4);
    color: var(--p-ink3);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-4);
  }
  .node-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .node-list button {
    all: unset;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
  }
  .node-list button:hover {
    background: var(--p-hover);
  }
  .selected button {
    border-color: var(--p-kofa-accent);
    background: var(--p-kofa-bg);
  }
  .label {
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
  }
  .meta {
    font-size: 0.75rem;
    color: var(--p-ink3);
  }
  aside {
    margin-top: var(--spacing-6);
    padding: var(--spacing-4);
    background: var(--p-panel);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
  }
  aside h2 {
    font-family: var(--font-data);
    font-size: 0.875rem;
  }
  aside button {
    margin-top: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-3);
    background: none;
    border: 1px solid var(--p-border-s);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--p-ink2);
  }
</style>
```

**Step 2: Run dev server and verify**

```bash
npm run dev
```

Open http://localhost:5174. Verify:
- Warm paper background (#F5F3EE)
- Inter font for UI, JetBrains Mono for labels
- 10 nodes listed with type, category, citations
- Clicking a node highlights it and shows "Valgt" panel
- Clicking "Lukk" deselects

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: smoke test page with stores and mock data"
```

---

## Summary

After Sprint 1, the project has:
- Working SvelteKit + Tailwind v4 scaffold with all design tokens
- Complete TypeScript types matching the domain model
- Shared reactive stores (analysis + UI) with localStorage persistence
- API client with mock fallback (ready for real backend in Sprint 2)
- Mock data from the design JSX
- Verified end-to-end: stores → mock data → reactive UI

Sprint 2 (Backend) and Sprint 3 (UI Components) can proceed in parallel.
