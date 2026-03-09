export interface Seeds {
	provisions: string[];
	ftsTerms: string[];
	vectorQuery: string;
	cases: string[];
}

export interface Analysis {
	id: string;
	problemStatement: string;
	seeds: Seeds;
	iteration: number;
	readStatus: Record<string, boolean>;
	notes: Record<string, string>;
	delimitations: Record<string, boolean>;
	createdAt: string;
	updatedAt: string;
}
