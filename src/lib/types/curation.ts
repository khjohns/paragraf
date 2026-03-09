export interface CrossReference {
	target_case: string;
	target_paragraph: number;
	relation: 'confirming' | 'contradicting' | 'distinguishing';
	note: string;
}

export interface Highlight {
	paragraph: number;
	start_char: number;
	end_char: number;
	relevance: string;
	cross_references: CrossReference[];
}

export interface Curation {
	highlights: Highlight[];
	summary_note: string;
}
