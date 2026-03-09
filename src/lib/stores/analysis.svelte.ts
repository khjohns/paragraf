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
