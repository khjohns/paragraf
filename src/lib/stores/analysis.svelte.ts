import type { GraphNode, GraphEdge, GapPair } from '$lib/types/graph';
import type { Analysis, Seeds, IterationEntry } from '$lib/types/analysis';
import type { SuggestedProvision } from '$lib/types/api';
import { toastState } from './toast.svelte';

const STORAGE_KEY = 'paragraf-analysis';

class AnalysisState {
	nodes = $state<GraphNode[]>([]);
	edges = $state<GraphEdge[]>([]);
	gaps = $state<GapPair[]>([]);
	suggestedProvisions = $state<SuggestedProvision[]>([]);
	/** When set, list/graph filters to nodes from this iteration only */
	filterIteration = $state<number | null>(null);
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

	/** Node IDs from before the current iteration (used to detect new nodes) */
	private previousNodeIds = new Set<string>();
	/** Seeds snapshot from before the current iteration (used for history label) */
	private previousSeeds: Seeds = { provisions: [], ftsTerms: [], vectorQuery: '', cases: [] };

	// --- Mutations ---

	setResults(nodes: GraphNode[], edges: GraphEdge[], gaps: GapPair[], suggested?: SuggestedProvision[]) {
		// If we're in iteration 2+, mark new nodes with the current iteration number
		if (this.analysis.iteration > 1 && this.previousNodeIds.size > 0) {
			const prevIterMap = new Map(this.nodes.map(n => [n.id, n.iteration]));
			let newCount = 0;
			for (const node of nodes) {
				if (this.previousNodeIds.has(node.id)) {
					node.iteration = prevIterMap.get(node.id) ?? 1;
				} else {
					node.iteration = this.analysis.iteration;
					newCount++;
				}
			}
			// Update iteration history with actual new node count
			const history = this.analysis.iterationHistory ?? [];
			const current = history.find(h => h.iteration === this.analysis.iteration);
			if (current) {
				current.newNodeCount = newCount;
			}
		}

		this.nodes = nodes;
		this.edges = edges;
		this.gaps = gaps;
		this.suggestedProvisions = suggested ?? [];
		// Snapshot seeds so startNewIteration can diff against what was used for this run
		this.previousSeeds = { ...this.analysis.seeds };
		this.debouncedSave();
		if (nodes.length > 0) {
			// Defer toast to avoid effect_update_depth_exceeded when called from $effect
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
		this.previousNodeIds = new Set(this.nodes.map(n => n.id));
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
		].filter(s => !prevSeedSet.has(s));

		const entry: IterationEntry = {
			iteration: this.analysis.iteration,
			addedSeeds,
			newNodeCount: 0, // Updated in setResults when data arrives
		};
		if (!this.analysis.iterationHistory) this.analysis.iterationHistory = [];
		this.analysis.iterationHistory.push(entry);

		this.touch();
		queueMicrotask(() =>
			toastState.show(`Iterasjon ${this.analysis.iteration} startet — endre seeds og kjør nytt søk`, 'success')
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
			const labels = added.map(id => `§${id.split(':')[1]}`).join(' og ');
			queueMicrotask(() => toastState.show(`${labels} lagt til som seeds`, 'success'));
		}
	}

	toggleFilterIteration(iteration: number) {
		this.filterIteration = this.filterIteration === iteration ? null : iteration;
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
	}
}

export const analysisState = new AnalysisState();

// Flush pending save on tab close
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => analysisState.save());
}
