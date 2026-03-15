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

/** Layer config: rank controls vertical order in dagre, label is the UI heading */
export const LAYER_CONFIG: Record<NodeType, { rank: number; label: string }> = {
  prep_work: { rank: 0, label: 'FORARBEIDER' },
  provision: { rank: 1, label: 'BESTEMMELSER' },
  kofa_case: { rank: 2, label: 'PRAKSIS' },
  eu_case: { rank: 3, label: 'EU-DOMMER' },
  court_case: { rank: 3, label: 'EU-DOMMER' },
};

/** Node size scales with citation count */
function nodeSize(node: GraphNode): { width: number; height: number } {
  let base = 36;
  if (node.citations >= 10) base += 14;
  else if (node.citations >= 5) base += 8;
  else if (node.citations >= 3) base += 4;

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

/** Build maps from provision→cases and case→provisions based on edges */
function buildProvisionCaseMaps(
  edges: GraphEdge[],
  nodeMap: Map<string, GraphNode>
): {
  provisionToCases: Map<string, GraphNode[]>;
  caseToProvisions: Map<string, string[]>;
} {
  const provisionToCases = new Map<string, GraphNode[]>();
  const caseToProvisions = new Map<string, string[]>();

  for (const edge of edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

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

  return { provisionToCases, caseToProvisions };
}

/** Build aggregate nodes from provision-case groupings */
function buildAggregates(
  provisionToCases: Map<string, GraphNode[]>,
  caseToProvisions: Map<string, string[]>,
  expandedAggregates: Set<string>
): {
  aggregates: AggregateNode[];
  aggregatedNodeIds: Set<string>;
  memberToAggregate: Map<string, string>;
} {
  const aggregates: AggregateNode[] = [];
  const aggregatedNodeIds = new Set<string>();
  const memberToAggregate = new Map<string, string>();

  for (const [provId, caseNodes] of provisionToCases) {
    const byType = new Map<NodeType, GraphNode[]>();
    for (const cn of caseNodes) {
      if (!byType.has(cn.type)) byType.set(cn.type, []);
      byType.get(cn.type)!.push(cn);
    }

    for (const [type, group] of byType) {
      const aggId = `agg:${provId}:${type}`;
      if (expandedAggregates.has(aggId)) continue;
      if (group.length <= AGGREGATE_THRESHOLD) continue;

      // Only aggregate nodes exclusive to one provision
      const exclusiveMembers = group.filter((n) => {
        const provs = caseToProvisions.get(n.id);
        return provs && provs.length === 1;
      });

      if (exclusiveMembers.length <= AGGREGATE_THRESHOLD) continue;

      const counts = { A: 0, B: 0, C: 0 };
      for (const n of exclusiveMembers) {
        if (n.category) counts[n.category]++;
      }

      aggregates.push({
        id: aggId,
        provisionId: provId,
        type,
        totalCount: exclusiveMembers.length,
        countA: counts.A,
        countB: counts.B,
        countC: counts.C,
        memberIds: exclusiveMembers.map((n) => n.id),
      });

      for (const member of exclusiveMembers) {
        aggregatedNodeIds.add(member.id);
        memberToAggregate.set(member.id, aggId);
      }
    }
  }

  return { aggregates, aggregatedNodeIds, memberToAggregate };
}

/** Remap edges so that aggregated nodes point to their aggregate instead */
function remapEdges(
  edges: GraphEdge[],
  aggregatedNodeIds: Set<string>,
  memberToAggregate: Map<string, string>
): GraphEdge[] {
  const result: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const edge of edges) {
    let from = edge.from;
    let to = edge.to;
    if (aggregatedNodeIds.has(from)) from = memberToAggregate.get(from)!;
    if (aggregatedNodeIds.has(to)) to = memberToAggregate.get(to)!;
    const key = `${from}→${to}`;
    if (!edgeSet.has(key) && from !== to) {
      edgeSet.add(key);
      result.push({ from, to, valence: edge.valence });
    }
  }

  return result;
}

/** Group node/aggregate IDs by their dagre layer rank */
function groupByLayer(
  layoutNodes: GraphNode[],
  aggregates: AggregateNode[]
): Map<number, string[]> {
  const byLayer = new Map<number, string[]>();

  for (const node of layoutNodes) {
    const rank = LAYER_CONFIG[node.type].rank;
    if (!byLayer.has(rank)) byLayer.set(rank, []);
    byLayer.get(rank)!.push(node.id);
  }
  for (const agg of aggregates) {
    const rank = LAYER_CONFIG[agg.type].rank;
    if (!byLayer.has(rank)) byLayer.set(rank, []);
    byLayer.get(rank)!.push(agg.id);
  }

  return byLayer;
}

/** Add constraint edges between two adjacent layers to enforce vertical hierarchy */
function addInterLayerConstraints(
  g: dagre.graphlib.Graph,
  upperIds: string[],
  lowerIds: string[],
  realEdgeKeys: Set<string>
) {
  if (upperIds.length === 0 || lowerIds.length === 0) return;

  const upperAnchor = upperIds[0];
  const lowerAnchor = lowerIds[0];

  for (const id of upperIds) {
    if (!realEdgeKeys.has(`${id}→${lowerAnchor}`)) {
      g.setEdge(id, lowerAnchor, { weight: 2, minlen: 2 });
    }
  }
  for (const id of lowerIds) {
    if (!realEdgeKeys.has(`${upperAnchor}→${id}`)) {
      g.setEdge(upperAnchor, id, { weight: 2, minlen: 2 });
    }
  }
}

/** Add layer constraint edges to enforce vertical hierarchy in dagre */
function addLayerConstraints(
  g: dagre.graphlib.Graph,
  layoutNodes: GraphNode[],
  aggregates: AggregateNode[],
  realEdgeKeys: Set<string>
) {
  const byLayer = groupByLayer(layoutNodes, aggregates);
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);

  for (let i = 0; i < layerKeys.length - 1; i++) {
    addInterLayerConstraints(
      g,
      byLayer.get(layerKeys[i])!,
      byLayer.get(layerKeys[i + 1])!,
      realEdgeKeys
    );
  }
}

/** Register all nodes and aggregates in the dagre graph */
function populateGraphNodes(
  g: dagre.graphlib.Graph,
  layoutNodes: GraphNode[],
  aggregates: AggregateNode[]
) {
  for (const node of layoutNodes) {
    const size = nodeSize(node);
    g.setNode(node.id, { width: size.width, height: size.height });
  }
  for (const agg of aggregates) {
    const size = aggregateSize();
    g.setNode(agg.id, { width: size.width, height: size.height });
  }
}

/** Add real edges to the dagre graph, returns set of edge keys */
function populateGraphEdges(g: dagre.graphlib.Graph, layoutEdges: GraphEdge[]): Set<string> {
  const realEdgeKeys = new Set<string>();
  for (const edge of layoutEdges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to, { weight: 1, minlen: 1 });
      realEdgeKeys.add(`${edge.from}→${edge.to}`);
    }
  }
  return realEdgeKeys;
}

/** Extract node and edge layouts from a computed dagre graph */
function extractLayoutResults(
  g: dagre.graphlib.Graph,
  realEdgeKeys: Set<string>
): { nodes: Map<string, NodeLayout>; edges: EdgeLayout[]; width: number; height: number } {
  const resultNodes = new Map<string, NodeLayout>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    if (n) {
      resultNodes.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
    }
  }

  const resultEdges: EdgeLayout[] = [];
  for (const e of g.edges()) {
    if (!realEdgeKeys.has(`${e.v}→${e.w}`)) continue;
    const edgeData = g.edge(e);
    if (edgeData?.points) {
      resultEdges.push({ points: edgeData.points, from: e.v, to: e.w });
    }
  }

  const graphLabel = g.graph();
  return {
    nodes: resultNodes,
    edges: resultEdges,
    width: graphLabel?.width ?? 800,
    height: graphLabel?.height ?? 600,
  };
}

/**
 * Compute an aggregated layout where case nodes connected to the same provision
 * are grouped into virtual aggregate nodes when the group exceeds AGGREGATE_THRESHOLD.
 *
 * @param expandedAggregates Set of aggregate IDs that have been expanded by the user
 */
export function computeAggregatedLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  expandedAggregates: Set<string>
): AggregatedLayout {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Phase 1: Build provision↔case mappings
  const { provisionToCases, caseToProvisions } = buildProvisionCaseMaps(edges, nodeMap);

  // Phase 2: Build aggregates
  const { aggregates, aggregatedNodeIds, memberToAggregate } = buildAggregates(
    provisionToCases,
    caseToProvisions,
    expandedAggregates
  );

  // Phase 3: Filter and remap through aggregates
  const layoutNodes = nodes.filter((n) => !aggregatedNodeIds.has(n.id));
  const layoutEdges = remapEdges(edges, aggregatedNodeIds, memberToAggregate);

  // Phase 4: Build and compute dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 30, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  populateGraphNodes(g, layoutNodes, aggregates);
  const realEdgeKeys = populateGraphEdges(g, layoutEdges);
  addLayerConstraints(g, layoutNodes, aggregates, realEdgeKeys);
  dagre.layout(g);

  // Phase 5: Extract results
  const {
    nodes: resultNodes,
    edges: resultEdges,
    width,
    height,
  } = extractLayoutResults(g, realEdgeKeys);

  return {
    nodes: resultNodes,
    edges: resultEdges,
    width,
    height,
    aggregates,
    memberToAggregate,
  };
}
