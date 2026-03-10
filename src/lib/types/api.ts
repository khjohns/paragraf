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
	avgjoerelse: string | null;
	saken_gjelder: string | null;
	avsluttet: string | null;
	innklaget: string | null;
	klager: string | null;
	sakstype: string | null;
	regelverk: string | null;
	summary: string | null;
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
	referencing_case_list: Array<{
		sak_nr: string;
		saken_gjelder: string;
		avsluttet: string | null;
		avgjoerelse: string;
	}>;
}

export interface EuCaseDetailResponse {
	eu_case_id: string;
	celex: string | null;
	case_name: string | null;
	judgment_date: string | null;
	subject: string | null;
	description: string | null;
	source_url: string | null;
	referencing_cases_count: number;
	referencing_cases: Array<{ sak_nr: string; context: string }>;
}

export interface ForarbeidDetailResponse {
	doc_id: string;
	doc_type: string | null;
	title: string | null;
	full_title: string | null;
	session: string | null;
	source_url: string | null;
	section: {
		number: string;
		title: string | null;
		level: number | null;
		text: string | null;
		parent_path: string | null;
	} | null;
	law_references: Array<{
		law_name: string;
		law_section: string;
		context: string;
	}>;
}
