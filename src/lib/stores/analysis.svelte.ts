import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type {
  Analysis,
  AnalysisStatus,
  Seeds,
  IterationEntry,
  AnalysisDbResponse,
  ScopingResult,
} from '$lib/types/analysis';
import type { SuggestedProvision } from '$lib/types/api';
import { updateAnalysis, completeAnalysis } from '$lib/api/analyses';
import { toastState } from './toast.svelte';
import { screeningState } from './screening.svelte';
import { pipelineState } from './pipeline.svelte';
import { browser } from '$app/environment';

const STORAGE_KEY = 'paragraf-analysis';

class AnalysisState {
  nodes = $state<GraphNode[]>([]);
  edges = $state<GraphEdge[]>([]);
  gaps = $state<GapPair[]>([]);
  suggestedProvisions = $state<SuggestedProvision[]>([]);
  /** When set, list/graph filters to nodes from this iteration only */
  filterIteration = $state<number | null>(null);
  scopingResult = $state<ScopingResult | null>(null);
  totalCostUsd = $state<number>(0);
  citationSummary = $state<Record<string, number> | null>(null);

  /** Case nodes (nodes with a category) — shared derivation to avoid duplicating across components */
  caseNodes = $derived(this.nodes.filter((n) => n.category));

  /** Category counts — single computation used by ContextStrip, PhasePanel, ScreeningPanel, etc. */
  catCounts = $derived.by(() => {
    const counts = { A: 0, B: 0, C: 0 };
    for (const n of this.caseNodes) {
      if (n.category === 'A') counts.A++;
      else if (n.category === 'B') counts.B++;
      else if (n.category === 'C') counts.C++;
    }
    return counts;
  });

  /** Signal coverage stats — R/F/V counts */
  coverageStats = $derived.by(() => {
    const stats = { ref: 0, fts: 0, vec: 0 };
    for (const n of this.caseNodes) {
      if (n.signals?.ref) stats.ref++;
      if (n.signals?.fts) stats.fts++;
      if (n.signals?.vec) stats.vec++;
    }
    return stats;
  });

  analysis = $state<Analysis>({
    id: crypto.randomUUID(),
    problemStatement: '',
    seeds: { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] },
    iteration: 1,
    readStatus: {},
    notes: {},
    delimitations: {},
    iterationHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  /** Read count — how many cases the user has opened */
  readCount = $derived(Object.values(this.analysis.readStatus).filter(Boolean).length);

  /** Whether the analysis is in a screening-relevant phase */
  isScreeningPhase = $derived(
    this.analysis.status === 'screening' ||
      this.analysis.status === 'screening_complete' ||
      this.analysis.status === 'candidates_ready'
  );

  /** Whether the analysis is in a post-synthesis phase */
  isPostSynthesisPhase = $derived(
    this.analysis.status === 'synthesis' ||
      this.analysis.status === 'qa' ||
      this.analysis.status === 'complete'
  );

  /** Show post-search panel (screening has started or finished) */
  showPostSearch = $derived(this.isScreeningPhase || this.analysis.status === 'post_search');

  /** Show EU screening panel (from screening phase through synthesis) */
  showEuSection = $derived(
    this.showPostSearch || this.analysis.status === 'synthesis' || this.analysis.status === 'qa'
  );

  /** The DB analysis ID — set when loading a workspace */
  private dbId: string | null = null;
  private dbSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Node IDs from before the current iteration */
  private previousNodeIds = new Set<string>();
  /** Seeds snapshot from before the current iteration */
  private previousSeeds: Seeds = { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] };

  // --- Mutations ---

  private applyIterationMarkers(nodes: GraphNode[]): number {
    const prevIterMap = new Map(this.nodes.map((n) => [n.id, n.iteration]));
    let newCount = 0;
    for (const node of nodes) {
      if (this.previousNodeIds.has(node.id)) {
        node.iteration = prevIterMap.get(node.id) ?? 1;
      } else {
        node.iteration = this.analysis.iteration;
        newCount++;
      }
    }
    return newCount;
  }

  setResults(
    nodes: GraphNode[],
    edges: GraphEdge[],
    gaps: GapPair[],
    suggested?: SuggestedProvision[]
  ) {
    if (this.analysis.iteration > 1 && this.previousNodeIds.size > 0) {
      const newCount = this.applyIterationMarkers(nodes);
      const current = (this.analysis.iterationHistory ?? []).find(
        (h) => h.iteration === this.analysis.iteration
      );
      if (current) current.newNodeCount = newCount;
    }

    this.nodes = nodes;
    this.edges = edges;
    this.gaps = gaps;
    this.suggestedProvisions = suggested ?? [];
    this.previousSeeds = { ...this.analysis.seeds };
    this.debouncedSave();
    if (nodes.length > 0) {
      queueMicrotask(() => toastState.show(`Analyse fullført — ${nodes.length} treff`, 'success'));
    }
  }

  setProblemStatement(text: string) {
    this.analysis.problemStatement = text;
    this.touch();
  }

  setSeeds(seeds: Seeds) {
    this.analysis.seeds = seeds;
    this.touch();
  }

  setStatus(status: AnalysisStatus) {
    this.analysis.status = status;
    this.touch();
  }

  setScopingResult(result: ScopingResult) {
    this.scopingResult = result;
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

  startNewIteration() {
    this.previousNodeIds = new Set(this.nodes.map((n) => n.id));
    this.analysis.iteration++;

    const prevSeedSet = new Set([
      ...this.previousSeeds.provisions,
      ...this.previousSeeds.ftsTerms,
      ...this.previousSeeds.cases,
    ]);
    const addedSeeds = [
      ...this.analysis.seeds.provisions,
      ...this.analysis.seeds.ftsTerms,
      ...this.analysis.seeds.cases,
    ].filter((s) => !prevSeedSet.has(s));

    const entry: IterationEntry = {
      iteration: this.analysis.iteration,
      addedSeeds,
      newNodeCount: 0,
    };
    if (!this.analysis.iterationHistory) this.analysis.iterationHistory = [];
    this.analysis.iterationHistory.push(entry);

    this.touch();
    queueMicrotask(() =>
      toastState.show(
        `Iterasjon ${this.analysis.iteration} startet — endre seeds og kjør nytt søk`,
        'success'
      )
    );
  }

  addSeedsFromGap(id1: string, id2: string) {
    const current = this.analysis.seeds.provisions;
    const added: string[] = [];
    if (!current.includes(id1)) {
      current.push(id1);
      added.push(id1);
    }
    if (!current.includes(id2)) {
      current.push(id2);
      added.push(id2);
    }
    if (added.length > 0) {
      this.analysis.seeds = { ...this.analysis.seeds, provisions: [...current] };
      this.touch();
      const labels = added.map((id) => `§${id.split(':')[1]}`).join(' og ');
      queueMicrotask(() => toastState.show(`${labels} lagt til som seeds`, 'success'));
    }
  }

  toggleFilterIteration(iteration: number) {
    this.filterIteration = this.filterIteration === iteration ? null : iteration;
  }

  clearFilterIteration() {
    this.filterIteration = null;
  }

  /** Mark analysis as complete */
  async markComplete() {
    try {
      await completeAnalysis(this.analysis.id);
      this.setStatus('complete');
      toastState.show('Analysen er ferdigstilt', 'success');
    } catch {
      toastState.show('Kunne ikke ferdigstille', 'error');
    }
  }

  // --- DB Persistence ---

  loadFromDb(data: AnalysisDbResponse) {
    this.dbId = data.id;

    const provisions = data.seeds.filter((s) => s.seed_type === 'provision').map((s) => s.value);
    const ftsTerms = data.seeds.filter((s) => s.seed_type === 'fts').map((s) => s.value);
    const vectorQuery = data.seeds.find((s) => s.seed_type === 'vector')?.value ?? '';
    const cases = data.seeds.filter((s) => s.seed_type === 'case').map((s) => s.value);

    const readStatus: Record<string, boolean> = {};
    const notes: Record<string, string> = {};
    const delimitations: Record<string, boolean> = {};
    for (const c of data.candidates) {
      const nodeId = `kofa:${c.sak_nr}`;
      if (c.read_at) readStatus[nodeId] = true;
      if (c.user_notes) notes[nodeId] = c.user_notes;
      if (c.is_delimitation) delimitations[nodeId] = true;
    }

    this.analysis = {
      id: data.id,
      title: data.title,
      problemStatement: data.problem,
      seeds: { provisions, ftsTerms, vectorQuery, cases },
      iteration: data.iteration,
      status: data.status,
      readStatus,
      notes,
      delimitations,
      iterationHistory: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    this.scopingResult = data.scoping_result ?? null;
    this.totalCostUsd = data.total_cost_usd ?? 0;
    this.citationSummary = data.citation_summary ?? null;

    // Restore nodes/edges from localStorage (not in DB response)
    // Only restore if cached data belongs to THIS analysis
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.analysis?.id === data.id) {
          if (cached.nodes) {
            this.nodes = cached.nodes;
            this.previousNodeIds = new Set(cached.nodes.map((n: GraphNode) => n.id));
          }
          if (cached.edges) this.edges = cached.edges;
          if (cached.gaps) this.gaps = cached.gaps;
        }
      }
    } catch {
      // Corrupt localStorage — nodes will be empty, traversal query will re-fetch
    }

    // Delegate screening hydration
    screeningState.reset();
    screeningState.loadFromCandidates(data.candidates);

    // Delegate pipeline reset + rehydration
    // Always try to load documents — status in DB may be stale if synthesis/QA
    // were run outside the normal pipeline flow
    pipelineState.reset();
    pipelineState.loadDocuments(data.id).then(() => {
      // If documents exist but status is behind, advance it
      if (pipelineState.qaReport && data.status !== 'complete') {
        this.setStatus('complete');
      } else if (
        pipelineState.synthesisMarkdown &&
        !['synthesis', 'qa', 'complete'].includes(data.status ?? '')
      ) {
        this.setStatus('synthesis');
      }
      this.save();
    });

    this.save();
  }

  flushDbSave() {
    if (this.dbSaveTimeout) {
      clearTimeout(this.dbSaveTimeout);
      this.dbSaveTimeout = null;
      this.saveToDb();
    }
  }

  // --- localStorage Persistence ---

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 500);
  }

  save() {
    try {
      const data = {
        version: 1,
        analysis: this.analysis,
        nodes: this.nodes,
        edges: this.edges,
        gaps: this.gaps,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.analysis) this.analysis = data.analysis;
      if (data.nodes) {
        this.nodes = data.nodes;
        this.previousNodeIds = new Set(data.nodes.map((n: GraphNode) => n.id));
      }
      if (data.edges) this.edges = data.edges;
      if (data.gaps) this.gaps = data.gaps;
    } catch {
      // Corrupt data — start fresh
    }
  }

  private debouncedDbSave() {
    if (!this.dbId) return;
    if (this.dbSaveTimeout) clearTimeout(this.dbSaveTimeout);
    this.dbSaveTimeout = setTimeout(() => this.saveToDb(), 1000);
  }

  private async saveToDb() {
    if (!this.dbId) return;
    try {
      await updateAnalysis(this.dbId, {
        problem: this.analysis.problemStatement,
        title: this.analysis.title ?? '',
        seeds: this.analysis.seeds,
        iteration: this.analysis.iteration,
        status: this.analysis.status ?? 'scoping',
      });
    } catch {
      // DB save failed — localStorage still has the data
    }
  }

  private touch() {
    this.analysis.updatedAt = new Date().toISOString();
    this.debouncedSave();
    this.debouncedDbSave();
  }
}

export const analysisState = new AnalysisState();

// Wire up cross-store dependencies
screeningState.init({
  getAnalysisId: () => analysisState.analysis.id,
  setStatus: (s) => analysisState.setStatus(s),
  pipeline: pipelineState,
});

// Flush pending saves on tab close
if (browser) {
  window.addEventListener('beforeunload', () => {
    analysisState.save();
    analysisState.flushDbSave();
  });
}
