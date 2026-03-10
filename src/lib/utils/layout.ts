import dagre from '@dagrejs/dagre';
import type { GraphNode, GraphEdge, NodeType, AggregateNode } from '$lib/types/graph';

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

export interface AggregatedLayout extends GraphLayout {
	aggregates: AggregateNode[];
	/** Map from original node ID to aggregate ID (for nodes that are aggregated) */
	memberToAggregate: Map<string, string>;
}

/** Threshold: only aggregate groups with more than this many nodes */
const AGGREGATE_THRESHOLD = 5;

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

/** Size for an aggregate box */
function aggregateSize(): { width: number; height: number } {
	return { width: 100, height: 40 };
}



/**
 * Compute an aggregated layout where case nodes connected to the same provision
 * are grouped into virtual aggregate nodes when the group exceeds AGGREGATE_THRESHOLD.
 *
 * @param expandedAggregates Set of aggregate IDs that have been expanded by the user
 * @param pinnedPositions Map of node IDs to pinned x/y positions (from previous expansions)
 */
export function computeAggregatedLayout(
	nodes: GraphNode[],
	edges: GraphEdge[],
	expandedAggregates: Set<string>,
	pinnedPositions: Map<string, { x: number; y: number }>,
): AggregatedLayout {
	const nodeMap = new Map(nodes.map(n => [n.id, n]));

	// Group case nodes by their connected provision(s)
	// A case node is grouped under a provision if there's an edge from the provision to the case
	const provisionToCases = new Map<string, GraphNode[]>();
	const caseToProvisions = new Map<string, string[]>();

	for (const edge of edges) {
		const fromNode = nodeMap.get(edge.from);
		const toNode = nodeMap.get(edge.to);

		// Edges may point in either direction: provision→case or case→provision
		let provId: string | null = null;
		let caseNode: GraphNode | null = null;

		if (fromNode?.type === 'provision' && toNode && toNode.type !== 'provision') {
			provId = edge.from;
			caseNode = toNode;
		} else if (toNode?.type === 'provision' && fromNode && fromNode.type !== 'provision') {
			provId = edge.to;
			caseNode = fromNode;
		}

		if (provId && caseNode) {
			if (!provisionToCases.has(provId)) provisionToCases.set(provId, []);
			provisionToCases.get(provId)!.push(caseNode);

			if (!caseToProvisions.has(caseNode.id)) caseToProvisions.set(caseNode.id, []);
			caseToProvisions.get(caseNode.id)!.push(provId);
		}
	}

	// Build aggregates: for each provision, if the group of connected case nodes of the
	// same type exceeds the threshold, create an aggregate
	const aggregates: AggregateNode[] = [];
	const aggregatedNodeIds = new Set<string>();
	const memberToAggregate = new Map<string, string>();

	for (const [provId, caseNodes] of provisionToCases) {
		// Group by node type
		const byType = new Map<NodeType, GraphNode[]>();
		for (const cn of caseNodes) {
			if (!byType.has(cn.type)) byType.set(cn.type, []);
			byType.get(cn.type)!.push(cn);
		}

		for (const [type, group] of byType) {
			const aggId = `agg:${provId}:${type}`;

			// Skip if this aggregate is expanded
			if (expandedAggregates.has(aggId)) continue;

			if (group.length > AGGREGATE_THRESHOLD) {
				// Check that these nodes aren't shared with another provision
				// (if a case is connected to multiple provisions, don't aggregate it)
				const exclusiveMembers = group.filter(n => {
					const provs = caseToProvisions.get(n.id);
					return provs && provs.length === 1;
				});

				if (exclusiveMembers.length > AGGREGATE_THRESHOLD) {
					const countA = exclusiveMembers.filter(n => n.category === 'A').length;
					const countB = exclusiveMembers.filter(n => n.category === 'B').length;
					const countC = exclusiveMembers.filter(n => n.category === 'C').length;

					const agg: AggregateNode = {
						id: aggId,
						provisionId: provId,
						type,
						totalCount: exclusiveMembers.length,
						countA,
						countB,
						countC,
						memberIds: exclusiveMembers.map(n => n.id),
					};
					aggregates.push(agg);

					for (const member of exclusiveMembers) {
						aggregatedNodeIds.add(member.id);
						memberToAggregate.set(member.id, aggId);
					}
				}
			}
		}
	}

	// Build the node list for dagre: real nodes (minus aggregated) + aggregate nodes
	const layoutNodes = nodes.filter(n => !aggregatedNodeIds.has(n.id));
	const layoutEdges: GraphEdge[] = [];

	// Remap edges: if an edge targets an aggregated node, point to its aggregate instead
	const edgeSet = new Set<string>();
	for (const edge of edges) {
		let from = edge.from;
		let to = edge.to;
		if (aggregatedNodeIds.has(from)) from = memberToAggregate.get(from)!;
		if (aggregatedNodeIds.has(to)) to = memberToAggregate.get(to)!;
		const key = `${from}→${to}`;
		if (!edgeSet.has(key) && from !== to) {
			edgeSet.add(key);
			layoutEdges.push({ from, to, valence: edge.valence });
		}
	}

	// Build dagre graph
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'TB',
		ranksep: 80,
		nodesep: 30,
		marginx: 40,
		marginy: 40,
	});
	g.setDefaultEdgeLabel(() => ({}));

	// Add real nodes
	for (const node of layoutNodes) {
		const size = nodeSize(node);
		g.setNode(node.id, { width: size.width, height: size.height });
	}

	// Add aggregate nodes
	for (const agg of aggregates) {
		const size = aggregateSize();
		g.setNode(agg.id, { width: size.width, height: size.height });
	}

	// Add edges
	for (const edge of layoutEdges) {
		if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
			g.setEdge(edge.from, edge.to, { weight: 1, minlen: 1 });
		}
	}

	// Layer constraints
	const byLayer = new Map<number, string[]>();
	for (const node of layoutNodes) {
		const layer = LAYER_RANK[node.type];
		if (!byLayer.has(layer)) byLayer.set(layer, []);
		byLayer.get(layer)!.push(node.id);
	}
	// Aggregate nodes inherit their type's layer
	for (const agg of aggregates) {
		const layer = LAYER_RANK[agg.type];
		if (!byLayer.has(layer)) byLayer.set(layer, []);
		byLayer.get(layer)!.push(agg.id);
	}

	const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
	for (let i = 0; i < layerKeys.length - 1; i++) {
		const upper = byLayer.get(layerKeys[i])!;
		const lower = byLayer.get(layerKeys[i + 1])!;
		if (upper.length > 0 && lower.length > 0) {
			g.setEdge(upper[0], lower[0], { weight: 0, minlen: 2 });
		}
	}

	dagre.layout(g);

	// Extract results, respecting pinned positions
	const resultNodes = new Map<string, NodeLayout>();
	for (const id of g.nodes()) {
		const n = g.node(id);
		if (n) {
			const pinned = pinnedPositions.get(id);
			resultNodes.set(id, {
				x: pinned?.x ?? n.x,
				y: pinned?.y ?? n.y,
				width: n.width,
				height: n.height,
			});
		}
	}

	const resultEdges: EdgeLayout[] = [];
	for (const e of g.edges()) {
		const edgeData = g.edge(e);
		if (edgeData?.points) {
			const points = [...edgeData.points];
			// Snap edge endpoints to pinned node positions
			const fromPos = resultNodes.get(e.v);
			const toPos = resultNodes.get(e.w);
			if (fromPos && pinnedPositions.has(e.v) && points.length > 0) {
				points[0] = { x: fromPos.x, y: fromPos.y };
			}
			if (toPos && pinnedPositions.has(e.w) && points.length > 0) {
				points[points.length - 1] = { x: toPos.x, y: toPos.y };
			}
			resultEdges.push({ points, from: e.v, to: e.w });
		}
	}

	const graphLabel = g.graph();
	return {
		nodes: resultNodes,
		edges: resultEdges,
		width: graphLabel?.width ?? 800,
		height: graphLabel?.height ?? 600,
		aggregates,
		memberToAggregate,
	};
}
