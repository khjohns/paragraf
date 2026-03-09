import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type { Analysis, Seeds } from '$lib/types/analysis';
import { toastState } from './toast.svelte';

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
		this.debouncedSave();
		if (nodes.length > 0) {
			toastState.show(`Analyse fullført — ${nodes.length} treff`, 'success');
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
			if (data.nodes) this.nodes = data.nodes;
			if (data.edges) this.edges = data.edges;
			if (data.gaps) this.gaps = data.gaps;
		} catch {
			// Corrupt data — start fresh
		}
	}

	private touch() {
		this.analysis.updatedAt = new Date().toISOString();
		this.debouncedSave();
	}
}

export const analysisState = new AnalysisState();

// Flush pending save on tab close
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => analysisState.save());
}
