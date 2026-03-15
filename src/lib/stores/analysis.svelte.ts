import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type { Analysis, AnalysisStatus, Seeds, IterationEntry, AnalysisDbResponse, AnalysisCandidate, ScreeningResult, ScreeningAssignment, ScreeningMode, Proposition, PostSearchSuggestion, EuScreeningResult, SynthesisResult, QAReport } from '$lib/types/analysis';
import type { SuggestedProvision } from '$lib/types/api';
import { updateAnalysis } from '$lib/api/analyses';
import { toastState } from './toast.svelte';

const STORAGE_KEY = 'paragraf-analysis';

class AnalysisState {
  nodes = $state<GraphNode[]>([]);
  edges = $state<GraphEdge[]>([]);
  gaps = $state<GapPair[]>([]);
  suggestedProvisions = $state<SuggestedProvision[]>([]);
  /** Screening status per node ID from DB candidates */
  screeningStatus = $state<Record<string, AnalysisCandidate['screening_status']>>({});
  /** AI screening results per sak_nr */
  screeningResults = $state<Record<string, ScreeningResult>>({});
  /** Screening assignment per sak_nr (overrides category mode when in 'pick' mode) */
  screeningAssignments = $state<Record<string, ScreeningAssignment>>({});
  /** Category-level screening mode */
  screeningModes = $state<Record<string, ScreeningMode>>({ A: 'claude', B: 'claude', C: 'pick' });
  /** Currently streaming sak_nr (being screened by Claude) */
  streamingSakNr = $state<string | null>(null);
  /** Whether screening has been started */
  screeningStarted = $state(false);
  /** When set, list/graph filters to nodes from this iteration only */
  filterIteration = $state<number | null>(null);
  /** Cross-propositions from Claude analysis */
  propositions = $state<Proposition[]>([]);
  /** Post-search suggestions from Claude */
  postSearchSuggestions = $state<PostSearchSuggestion | null>(null);
  /** Whether cross-propositions analysis is loading */
  crossPropositionsLoading = $state(false);
  /** Whether post-search is loading */
  postSearchLoading = $state(false);
  /** EU screening results per eu_case_id */
  euScreeningResults = $state<Record<string, EuScreeningResult>>({});
  /** Whether EU screening is loading */
  euScreeningLoading = $state(false);
  /** Currently streaming EU case ID */
  streamingEuCaseId = $state<string | null>(null);
  /** Synthesis result */
  synthesisResult = $state<SynthesisResult | null>(null);
  /** Synthesis markdown (editable) */
  synthesisMarkdown = $state<string>('');
  /** Whether synthesis is loading */
  synthesisLoading = $state(false);
  /** QA report */
  qaReport = $state<QAReport | null>(null);
  /** Whether QA is loading */
  qaLoading = $state(false);
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

  /** Whether the analysis is in a screening-relevant phase */
  isScreeningPhase = $derived(
    this.analysis.status === 'screening' ||
    this.analysis.status === 'screening_complete' ||
    this.analysis.status === 'candidates_ready'
  );

  /** The DB analysis ID — set when loading a workspace */
  private dbId: string | null = null;
  private dbSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Node IDs from before the current iteration (used to detect new nodes) */
  private previousNodeIds = new Set<string>();
  /** Seeds snapshot from before the current iteration (used for history label) */
  private previousSeeds: Seeds = { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] };

  // --- Mutations ---

  /** Mark new vs existing nodes with iteration numbers, returns count of new nodes */
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

    // Diff current seeds against what was used in the last analysis run
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
      newNodeCount: 0, // Updated in setResults when data arrives
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

  /** Add both provisions from a gap pair as seeds (if not already present) */
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

  // --- Screening ---

  /** Get the effective assignment for a case */
  getAssignment(sakNr: string, category: string | undefined | null): ScreeningAssignment {
    const cat = category ?? 'C';
    const mode = this.screeningModes[cat] ?? 'claude';
    if (mode === 'pick') return this.screeningAssignments[sakNr] ?? 'claude';
    return mode as ScreeningAssignment;
  }

  /** Set per-case assignment (switches category to 'pick' mode if needed) */
  setAssignment(sakNr: string, category: string | undefined | null, value: ScreeningAssignment) {
    const cat = category ?? 'C';
    if (this.screeningModes[cat] !== 'pick') {
      this.screeningModes[cat] = 'pick';
    }
    this.screeningAssignments[sakNr] = value;
  }

  /** Set category-level screening mode */
  setCategoryMode(category: string, mode: ScreeningMode) {
    this.screeningModes[category] = mode;
  }

  /** Add a screening result (from SSE stream) */
  addScreeningResult(result: ScreeningResult) {
    this.screeningResults[result.sak_nr] = result;
    this.screeningStatus[`kofa:${result.sak_nr}`] = 'ai_screened';
  }

  /** Mark screening as started */
  startScreening() {
    this.screeningStarted = true;
  }

  /** Set the currently streaming case */
  setStreamingSakNr(sakNr: string | null) {
    this.streamingSakNr = sakNr;
  }

  // --- Propositions ---

  /** Set cross-propositions from Claude analysis */
  setPropositions(propositions: Proposition[]) {
    this.propositions = propositions;
  }

  /** Set post-search suggestions */
  setPostSearchSuggestions(suggestions: PostSearchSuggestion | null) {
    this.postSearchSuggestions = suggestions;
  }

  /** Toggle confirmed state on a proposition */
  togglePropositionConfirmed(id: string) {
    const prop = this.propositions.find(p => p.id === id);
    if (prop) prop.confirmed = !prop.confirmed;
  }

  /** Set cross-propositions loading state */
  setCrossPropositionsLoading(loading: boolean) {
    this.crossPropositionsLoading = loading;
  }

  /** Set post-search loading state */
  setPostSearchLoading(loading: boolean) {
    this.postSearchLoading = loading;
  }

  // --- EU Screening ---

  /** Add an EU screening result (from SSE stream) */
  addEuScreeningResult(result: EuScreeningResult) {
    this.euScreeningResults[result.eu_case_id] = result;
  }

  /** Set EU screening loading state */
  setEuScreeningLoading(loading: boolean) {
    this.euScreeningLoading = loading;
  }

  /** Set currently streaming EU case */
  setStreamingEuCaseId(id: string | null) {
    this.streamingEuCaseId = id;
  }

  // --- Synthesis ---

  /** Set synthesis result */
  setSynthesisResult(result: SynthesisResult | null) {
    this.synthesisResult = result;
    if (result) this.synthesisMarkdown = result.markdown;
  }

  /** Update synthesis markdown (user edits) */
  setSynthesisMarkdown(markdown: string) {
    this.synthesisMarkdown = markdown;
  }

  /** Set synthesis loading state */
  setSynthesisLoading(loading: boolean) {
    this.synthesisLoading = loading;
  }

  // --- QA ---

  /** Set QA report */
  setQaReport(report: QAReport | null) {
    this.qaReport = report;
  }

  /** Set QA loading state */
  setQaLoading(loading: boolean) {
    this.qaLoading = loading;
  }

  // --- DB Persistence ---

  /** Load from DB response — maps AnalysisDbResponse to internal Analysis shape */
  loadFromDb(data: AnalysisDbResponse) {
    this.dbId = data.id;

    // Convert DB seeds to local Seeds format
    const provisions = data.seeds.filter((s) => s.seed_type === 'provision').map((s) => s.value);
    const ftsTerms = data.seeds.filter((s) => s.seed_type === 'fts').map((s) => s.value);
    const vectorQuery = data.seeds.find((s) => s.seed_type === 'vector')?.value ?? '';
    const cases = data.seeds.filter((s) => s.seed_type === 'case').map((s) => s.value);

    // Convert DB candidates to readStatus/notes/delimitations/screeningStatus
    const readStatus: Record<string, boolean> = {};
    const notes: Record<string, string> = {};
    const delimitations: Record<string, boolean> = {};
    const screening: Record<string, AnalysisCandidate['screening_status']> = {};
    const screeningResults: Record<string, ScreeningResult> = {};
    for (const c of data.candidates) {
      const nodeId = `kofa:${c.sak_nr}`;
      if (c.read_at) readStatus[nodeId] = true;
      if (c.user_notes) notes[nodeId] = c.user_notes;
      if (c.is_delimitation) delimitations[nodeId] = true;
      if (c.screening_status) screening[nodeId] = c.screening_status;
      if (c.ai_screening) {
        screeningResults[c.sak_nr] = c.ai_screening;
      }
    }
    this.screeningStatus = screening;
    this.screeningResults = screeningResults;

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

    // Reset Sprint 15 state to avoid stale data from previous analysis
    this.euScreeningResults = {};
    this.euScreeningLoading = false;
    this.streamingEuCaseId = null;
    this.synthesisResult = null;
    this.synthesisMarkdown = '';
    this.synthesisLoading = false;
    this.qaReport = null;
    this.qaLoading = false;

    // Also save to localStorage as cache
    this.save();
  }

  /** Persist current state to DB (debounced) */
  private debouncedDbSave() {
    if (!this.dbId) return;
    if (this.dbSaveTimeout) clearTimeout(this.dbSaveTimeout);
    this.dbSaveTimeout = setTimeout(() => this.saveToDb(), 1000);
  }

  /** Flush any pending DB save immediately (called on beforeunload) */
  flushDbSave() {
    if (this.dbSaveTimeout) {
      clearTimeout(this.dbSaveTimeout);
      this.dbSaveTimeout = null;
      this.saveToDb();
    }
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
      // localStorage full or unavailable — silently fail
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
        // Restore previousNodeIds so iteration marking works across reloads
        this.previousNodeIds = new Set(data.nodes.map((n: GraphNode) => n.id));
      }
      if (data.edges) this.edges = data.edges;
      if (data.gaps) this.gaps = data.gaps;
    } catch {
      // Corrupt data — start fresh
    }
  }

  private touch() {
    this.analysis.updatedAt = new Date().toISOString();
    this.debouncedSave();
    this.debouncedDbSave();
  }
}

export const analysisState = new AnalysisState();

// Flush pending saves on tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analysisState.save();
    // Also flush pending DB save (best-effort, fire-and-forget)
    analysisState.flushDbSave();
  });
}
