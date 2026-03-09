import type { GraphNode, GraphEdge, GapPair } from './graph';
import type { Seeds } from './analysis';

export interface TraversalRequest extends Seeds {
	regulationFilter: 'new' | 'all';
}

export interface TraversalResponse {
	nodes: GraphNode[];
	edges: GraphEdge[];
	gaps: GapPair[];
	stats: {
		total: number;
		categoryA: number;
		categoryB: number;
		categoryC: number;
		delimitations: number;
	};
}

export interface DecisionParagraph {
	paragraph_number: number;
	section: string;
	text: string;
}

export interface CaseDetailResponse {
	sak_nr: string;
	paragraphs: DecisionParagraph[];
	law_references: Array<{
		law_name: string;
		law_section: string;
		context: string;
		regulation_version: string;
	}>;
	case_references: Array<{
		to_sak_nr: string;
		context: string;
	}>;
	eu_references: Array<{
		eu_case_id: string;
		eu_case_name: string;
		context: string;
	}>;
}

export interface ProvisionDetailResponse {
	dok_id: string;
	section_id: string;
	title: string;
	content: string;
	structure_path: string[];
	referencing_cases: number;
}
