import dagre from '@dagrejs/dagre';
import type { GraphNode, GraphEdge, NodeType } from '$lib/types/graph';

export interface NodeLayout {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface EdgeLayout {
	points: Array<{ x: number; y: number }>;
	from: string;
	to: string;
}

export interface GraphLayout {
	nodes: Map<string, NodeLayout>;
	edges: EdgeLayout[];
	width: number;
	height: number;
}

// Layer rank for invisible constraint edges
const LAYER_RANK: Record<NodeType, number> = {
	provision: 0,
	kofa_case: 1,
	eu_case: 2,
	court_case: 2,
	prep_work: 2,
};

/** Node size scales with citation count (spec §8b) */
function nodeSize(node: GraphNode): { width: number; height: number } {
	let base = 22;
	if (node.citations >= 10) base += 10;
	else if (node.citations >= 5) base += 5;

	if (node.type === 'provision') {
		return { width: base * 3.5, height: base * 1.2 };
	}
	if (node.type === 'prep_work') {
		return { width: base * 3, height: base * 0.8 };
	}
	// Circles (kofa_case, court_case) and diamonds (eu_case)
	return { width: base * 2, height: base * 2 };
}

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphLayout {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'TB',
		ranksep: 80,
		nodesep: 30,
		marginx: 40,
		marginy: 40,
	});
	g.setDefaultEdgeLabel(() => ({}));

	// Add nodes
	for (const node of nodes) {
		const size = nodeSize(node);
		g.setNode(node.id, { width: size.width, height: size.height });
	}

	// Add real edges
	for (const edge of edges) {
		if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
			g.setEdge(edge.from, edge.to, { weight: 1, minlen: 1 });
		}
	}

	// Add invisible constraint edges to enforce 3-layer hierarchy
	const byLayer = new Map<number, string[]>();
	for (const node of nodes) {
		const layer = LAYER_RANK[node.type];
		if (!byLayer.has(layer)) byLayer.set(layer, []);
		byLayer.get(layer)!.push(node.id);
	}

	const layers = [...byLayer.keys()].sort((a, b) => a - b);
	for (let i = 0; i < layers.length - 1; i++) {
		const upper = byLayer.get(layers[i])!;
		const lower = byLayer.get(layers[i + 1])!;
		if (upper.length > 0 && lower.length > 0) {
			// Connect first node of each layer with invisible edge
			g.setEdge(upper[0], lower[0], { weight: 0, minlen: 2 });
		}
	}

	// Run layout
	dagre.layout(g);

	// Extract results
	const nodeMap = new Map<string, NodeLayout>();
	for (const id of g.nodes()) {
		const n = g.node(id);
		if (n) {
			nodeMap.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
		}
	}

	const edgeLayouts: EdgeLayout[] = [];
	for (const e of g.edges()) {
		const edgeData = g.edge(e);
		if (edgeData?.points) {
			edgeLayouts.push({ points: edgeData.points, from: e.v, to: e.w });
		}
	}

	const graphLabel = g.graph();
	return {
		nodes: nodeMap,
		edges: edgeLayouts,
		width: graphLabel?.width ?? 800,
		height: graphLabel?.height ?? 600,
	};
}
