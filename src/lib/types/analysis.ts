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
  ai_screening: ScreeningResult | null;
  user_notes: string | null;
  is_delimitation: boolean;
  read_at: string | null;
}

/** Scoping result from Claude */
export interface ScopingProvision {
  ref: string;
  label: string;
  primary: boolean;
  reason: string;
  verified: boolean;
  excerpt: string | null;
}

export interface ScopingResult {
  refined_problem: string;
  sub_problems: string[];
  context: {
    procedure: string | null;
    service_area: string | null;
    market: string | null;
    threshold: string | null;
  };
  provisions: ScopingProvision[];
  search_strategy: {
    ref_table: string[];
    fts: string[];
    vector: string[];
    prep_work: string[];
  };
  reasoning: string;
}

export interface QuoteVerification {
  sak_nr: string;
  paragraph: number;
  quoted_text: string;
  status: 'verified' | 'truncated' | 'inaccurate' | 'not_found';
  issue: string | null;
}

/** AI screening result for a case */
export interface ScreeningResult {
  sak_nr: string;
  factum: string;
  assessment: string;
  proposition: string;
  quotes: { p: number; text: string }[];
  nuances: string | null;
  relevance: 'A' | 'B' | 'C';
  relevance_reasoning: string;
  star: boolean;
  error?: string;
  quote_verification?: QuoteVerification[];
}

/** Screening assignment — who screens each case */
export type ScreeningAssignment = 'claude' | 'me';

/** Category-level screening mode */
export type ScreeningMode = 'claude' | 'me' | 'pick';

/** Evolution type for a proposition instance */
export type EvolutionType = 'established' | 'confirmed' | 'qualified' | 'consolidating';

/** Evolution display config — shared between PropositionRegistry and Toolbar */
export const EVOLUTION_CONFIG: Record<EvolutionType, { label: string; color: string; bg: string }> =
  {
    established: { label: 'Etablert', color: 'var(--p-ink)', bg: 'rgba(26,24,20,0.06)' },
    confirmed: { label: 'Bekreftet', color: 'var(--p-success)', bg: 'var(--p-success-bg)' },
    qualified: { label: 'Presisert', color: 'var(--p-warn)', bg: 'var(--p-warn-bg)' },
    consolidating: { label: 'Konsoliderende', color: 'var(--p-provision-accent)', bg: '#E8EEF0' },
  };

/** A single instance where a proposition appears in a case */
export interface PropositionInstance {
  caseId: string;
  paragraph: number;
  date: string;
  evolution: EvolutionType;
  quote: string;
  suggested?: boolean;
}

/** A proposition with its instances across cases */
export interface Proposition {
  id: string;
  theme: string;
  proposition: string;
  instances: PropositionInstance[];
  tension?: {
    withId: string;
    note: string;
  };
  confirmed?: boolean;
  source?: 'ai_screening' | 'ai_cross' | 'user';
}

/** Post-search suggestion from Claude */
export interface PostSearchSuggestion {
  fts_terms: string[];
  vector_queries: string[];
  provisions: string[];
  patterns: string[];
  reasoning: string;
}

/** Cross-propositions result from Claude */
export interface CrossPropositionsResult {
  propositions: Proposition[];
  themes: string[];
}

/** EU case identified for screening */
export interface EuCaseForScreening {
  eu_case_id: string;
  celex: string | null;
  case_name: string | null;
  judgment_date: string | null;
  subject: string | null;
  description: string | null;
  ref_count: number;
  referencing_sak_nrs: string[];
  contexts: string[];
}

/** EU case screening result */
export interface EuScreeningResult {
  eu_case_id: string;
  case_name: string | null;
  ref_count: number;
  factum: string;
  holding: string;
  proposition: string;
  directive_articles: string[];
  kofa_relevance: string;
  quotes: { p: number; text: string }[];
  relevance: 'A' | 'B' | 'C';
  relevance_reasoning: string;
  error?: string;
  done?: boolean;
}

/** Synthesis note section */
export interface SynthesisSection {
  heading: string;
  content: string;
  requires_lawyer_input: boolean;
}

/** Synthesis result from Claude */
export interface SynthesisResult {
  title: string;
  sections: SynthesisSection[];
  unresolved_tensions: { description: string; cases: string[] }[];
  coverage_notes: string;
  markdown: string;
}

/** QA verified quote */
export interface QAVerifiedQuote {
  sak_nr: string;
  paragraph: number;
  quoted_text: string;
  status: 'verified' | 'truncated' | 'inaccurate' | 'not_found';
  issue: string | null;
}

/** QA logic flag */
export interface QALogicFlag {
  type:
    | 'argumentative_gap'
    | 'unsupported_conclusion'
    | 'analogy_not_flagged'
    | 'missing_nuance'
    | 'contradiction';
  location: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

/** QA untreated case */
export interface QAUntreatedCase {
  sak_nr: string;
  category: string;
  proposition: string;
  justified_omission: boolean;
  reason: string;
}

/** QA report from backend */
export interface QAReport {
  citation_verification: {
    verified_quotes: QAVerifiedQuote[];
    summary: string;
  };
  logical_consistency: {
    flags: QALogicFlag[];
    summary: string;
  };
  coverage: {
    untreated_cases: QAUntreatedCase[];
    summary: string;
  };
  total_flags: number;
}

/** QA flag severity config — shared between QAPanel and other components */
export const QA_SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'Alvorlig', color: 'var(--p-error, #C13515)', bg: 'rgba(193,53,21,0.06)' },
  medium: { label: 'Middels', color: 'var(--p-warn)', bg: 'var(--p-warn-bg)' },
  low: { label: 'Lav', color: 'var(--p-ink3)', bg: 'var(--p-hover)' },
};

/** Citation status config */
export const CITATION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  verified: { label: 'Verifisert', color: 'var(--p-success)' },
  truncated: { label: 'Trunkert', color: 'var(--p-warn)' },
  inaccurate: { label: 'Unøyaktig', color: 'var(--p-error, #C13515)' },
  not_found: { label: 'Ikke funnet', color: 'var(--p-ink3)' },
};

/** Batch job status from polling */
export interface BatchStatus {
  batch_id: string;
  processing_status: 'in_progress' | 'ended' | 'canceling' | 'canceled' | 'expired';
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
}

/** Batch job type identifier */
export type BatchType = 'screening' | 'eu_screening' | 'qa';

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
