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
  score?: number;
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

export const NODE_TYPE_ACCENT: Record<NodeType, string> = {
  provision: 'var(--p-provision-accent)',
  kofa_case: 'var(--p-kofa-accent)',
  eu_case: 'var(--p-eu-accent)',
  court_case: 'var(--p-court-accent)',
  prep_work: 'var(--p-prep-accent)',
};

/** Check if a node matches a search query (shared predicate for search/filter) */
export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  return (
    node.label.toLowerCase().includes(query) ||
    node.subtitle.toLowerCase().includes(query) ||
    (node.detail?.toLowerCase().includes(query) ?? false)
  );
}

export interface GapPair {
  provision1: string;
  provision2: string;
  id1?: string;
  id2?: string;
  count: number;
}

/** Virtual aggregate node grouping multiple case nodes under a provision */
export interface AggregateNode {
  id: string;
  provisionId: string;
  type: NodeType;
  totalCount: number;
  countA: number;
  countB: number;
  countC: number;
  /** IDs of the real nodes this aggregate represents */
  memberIds: string[];
}
