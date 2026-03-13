export type AnalysisStatus =
  | 'scoping'
  | 'scoping_complete'
  | 'searching'
  | 'candidates_ready'
  | 'screening'
  | 'screening_complete'
  | 'post_search'
  | 'synthesis'
  | 'qa'
  | 'complete';

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
  title?: string;
  problemStatement: string;
  seeds: Seeds;
  iteration: number;
  readStatus: Record<string, boolean>;
  notes: Record<string, string>;
  delimitations: Record<string, boolean>;
  iterationHistory?: IterationEntry[];
  status?: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
}

/** Summary for portfolio list — lightweight, no candidates */
export interface AnalysisSummary {
  id: string;
  title: string;
  problem: string;
  status: AnalysisStatus;
  iteration: number;
  created_at: string;
  updated_at: string;
}

/** Seed row from DB */
export interface AnalysisSeed {
  id: string;
  analysis_id: string;
  seed_type: 'provision' | 'fts' | 'vector' | 'case';
  value: string;
  iteration: number;
  source: 'user' | 'ai_suggested';
  confirmed: boolean;
}

/** Candidate row from DB */
export interface AnalysisCandidate {
  id: string;
  sak_nr: string;
  category: 'A' | 'B' | 'C' | null;
  signals: { ref: boolean; fts: boolean; vec: boolean };
  iteration: number;
  screening_status: 'pending' | 'ai_screened' | 'user_read' | 'both';
  user_notes: string | null;
  is_delimitation: boolean;
  read_at: string | null;
}

/** DB response shape — mapped to Analysis in loadFromDb */
export interface AnalysisDbResponse {
  id: string;
  title: string;
  problem: string;
  refined_problem: string | null;
  sub_problems: string[];
  context: Record<string, string>;
  status: AnalysisStatus;
  iteration: number;
  seeds: AnalysisSeed[];
  candidates: AnalysisCandidate[];
  created_at: string;
  updated_at: string;
}
