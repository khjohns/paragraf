export interface Seeds {
  provisions: string[];
  ftsTerms: string[];
  vectorQuery: string;
  cases: string[];
}

export interface IterationEntry {
  iteration: number;
  addedSeeds: string[];
  newNodeCount: number;
}

export interface Analysis {
  id: string;
  problemStatement: string;
  seeds: Seeds;
  iteration: number;
  readStatus: Record<string, boolean>;
  notes: Record<string, string>;
  delimitations: Record<string, boolean>;
  iterationHistory?: IterationEntry[];
  createdAt: string;
  updatedAt: string;
}
