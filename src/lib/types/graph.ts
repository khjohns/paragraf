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

export const NODE_TYPE_ACCENT: Record<NodeType, string> = {
	provision: 'var(--p-provision-accent)',
	kofa_case: 'var(--p-kofa-accent)',
	eu_case: 'var(--p-eu-accent)',
	court_case: 'var(--p-court-accent)',
	prep_work: 'var(--p-prep-accent)',
};

export interface GapPair {
	provision1: string;
	provision2: string;
	count: number;
}
