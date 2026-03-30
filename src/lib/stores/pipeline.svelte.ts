import type {
  Proposition,
  PropositionInstance,
  PostSearchSuggestion,
  SynthesisResult,
  QAReport,
  LlmMeta,
} from '$lib/types/analysis';
import type { AnalysisDocuments, StreamEvent } from '$lib/api/analyses';
import { fetchDocuments } from '$lib/api/analyses';
import { MOCK_RETTSSETNINGER } from '$lib/mockup/data/rettssetninger';

/** A single line in the live streaming progress log */
export interface StreamProgressItem {
  type: 'status' | 'tool_call' | 'tool_result';
  label: string;
  done: boolean;
  turn?: number;
}

/**
 * Normalize cross-propositions from DB — the CLI pipeline stores a JSON object with
 * `themes` (array of {id, title}) and `propositions` (array of {id, themeId, statement,
 * instances, tensions}). Map to the frontend Proposition[] format which uses `proposition`,
 * `theme` (title string), and `tension` (singular, first element).
 */
function normalizeCrossPropositions(raw: Record<string, unknown>): Proposition[] {
  const themes = (raw.themes ?? []) as Array<{ id: string; title: string }>;
  const themeMap = new Map(themes.map((t) => [t.id, t.title]));
  const rawProps = (raw.propositions ?? []) as Array<Record<string, unknown>>;

  return rawProps.map((p) => {
    const tensions = (p.tensions ?? []) as Array<{ withId: string; note: string }>;
    const prop: Proposition = {
      id: p.id as string,
      theme: themeMap.get(p.themeId as string) ?? (p.themeId as string) ?? '',
      proposition: (p.statement ?? p.proposition ?? '') as string,
      instances: (p.instances ?? []) as Proposition['instances'],
      confirmed: false,
      source: 'ai_cross',
    };
    if (tensions.length > 0) {
      prop.tension = tensions[0];
    }
    return prop;
  });
}

/**
 * Normalize QA report from DB — older Opus reports use a flat structure
 * (reference_issues, logic_flags, untreated_cases) while the current frontend
 * expects nested structure (citation_verification, logical_consistency, coverage, total_flags).
 */
function normalizeQaReport(raw: Record<string, unknown>): QAReport {
  // Already in new format
  if ('total_flags' in raw && typeof raw.total_flags === 'number') {
    return raw as unknown as QAReport;
  }

  // Old flat format → map to expected structure
  const refIssues = (raw.reference_issues ?? []) as Array<Record<string, unknown>>;
  const logicFlags = (raw.logic_flags ?? []) as Array<Record<string, unknown>>;
  const untreated = (raw.untreated_cases ?? []) as Array<Record<string, unknown>>;
  const overall = (raw.overall_assessment ?? '') as string;

  const mapped: QAReport = {
    citation_verification: {
      verified_quotes: refIssues.map((r) => ({
        sak_nr: r.sak_nr as string,
        paragraph: r.paragraph as number,
        quoted_text: '',
        status: 'inaccurate' as const,
        issue: r.description as string,
      })),
      summary: `${refIssues.length} referanseproblemer`,
    },
    logical_consistency: {
      flags: logicFlags.map((f) => ({
        type: (f.issue_type ?? 'missing_nuance') as 'missing_nuance',
        location: (f.sak_nr ?? '') as string,
        description: f.description as string,
        severity: (f.severity ?? 'medium') as 'high' | 'medium' | 'low',
        suggestion: (f.suggestion ?? '') as string,
      })),
      summary: `${logicFlags.length} logikkmerknader`,
    },
    coverage: {
      untreated_cases: untreated.map((u) => ({
        sak_nr: (u.sak_nr ?? '') as string,
        category: (u.category ?? '') as string,
        proposition: (u.proposition ?? '') as string,
        justified_omission: (u.justified_omission ?? false) as boolean,
        reason: (u.reason ?? overall) as string,
      })),
      summary: `${untreated.length} ubehandlede saker`,
    },
    total_flags:
      refIssues.length + logicFlags.length + untreated.filter((u) => !u.justified_omission).length,
  };

  return mapped;
}

/** Convert mockup Rettssetning[] → Proposition[] for dev fallback */
function mockToPropositions(): Proposition[] {
  return MOCK_RETTSSETNINGER.map((rs) => ({
    id: rs.id,
    theme: rs.theme,
    proposition: rs.proposition,
    tension: rs.tension ?? undefined,
    confirmed: !rs.isAiGenerated,
    source: rs.isAiGenerated ? ('ai_cross' as const) : ('user' as const),
    instances: rs.cases.map(
      (c): PropositionInstance => ({
        caseId: c.ref,
        paragraph: parseInt(c.paragraphs.replace(/\D/g, '')) || 0,
        date: `${c.year}-01-01`,
        evolution: c.evolution,
        quote: c.quotes[0]?.text ?? '',
        suggested: c.suggested,
      })
    ),
  }));
}

class PipelineState {
  // ── Propositions ──
  propositions = $state<Proposition[]>([]);
  postSearchSuggestions = $state<PostSearchSuggestion | null>(null);
  crossPropositionsLoading = $state(false);
  postSearchLoading = $state(false);

  // ── Synthesis ──
  synthesisResult = $state<SynthesisResult | null>(null);
  synthesisMarkdown = $state<string>('');
  synthesisLoading = $state(false);

  // ── Streaming progress (ADR-004 Fase 2) ──
  synthesisStreaming = $state(false);
  synthesisProgress = $state<StreamProgressItem[]>([]);
  qaStreaming = $state(false);
  qaProgress = $state<StreamProgressItem[]>([]);

  // ── LLM Meta (for WorkLog) ──
  synthesisLlmMeta = $state<LlmMeta | null>(null);
  qaLlmMeta = $state<LlmMeta | null>(null);

  // ── QA ──
  qaReport = $state<QAReport | null>(null);
  qaLoading = $state(false);

  // ── Proposition methods ──

  setPropositions(propositions: Proposition[]) {
    this.propositions = propositions;
  }

  setPostSearchSuggestions(suggestions: PostSearchSuggestion | null) {
    this.postSearchSuggestions = suggestions;
  }

  togglePropositionConfirmed(id: string) {
    const prop = this.propositions.find((p) => p.id === id);
    if (prop) prop.confirmed = !prop.confirmed;
  }

  setCrossPropositionsLoading(loading: boolean) {
    this.crossPropositionsLoading = loading;
  }

  setPostSearchLoading(loading: boolean) {
    this.postSearchLoading = loading;
  }

  // ── Synthesis methods ──

  setSynthesisResult(result: SynthesisResult | null) {
    this.synthesisResult = result;
    if (result) {
      this.synthesisMarkdown = result.markdown;
      this.synthesisLlmMeta = result._llm_meta ?? null;
    }
  }

  setSynthesisMarkdown(markdown: string) {
    this.synthesisMarkdown = markdown;
  }

  setSynthesisLoading(loading: boolean) {
    this.synthesisLoading = loading;
  }

  // ── Streaming progress (ADR-004 Fase 2) ──

  startSynthesisStream() {
    this.synthesisStreaming = true;
    this.synthesisProgress = [];
    this.synthesisLoading = true;
  }

  addSynthesisProgress(item: StreamProgressItem) {
    this.synthesisProgress.push(item);
  }

  markLastProgressDone(target: 'synthesis' | 'qa') {
    const arr = target === 'synthesis' ? this.synthesisProgress : this.qaProgress;
    const last = arr.findLast((p) => !p.done);
    if (last) last.done = true;
  }

  endSynthesisStream() {
    this.synthesisStreaming = false;
    this.synthesisLoading = false;
    // Mark all remaining as done
    for (const item of this.synthesisProgress) item.done = true;
  }

  startQaStream() {
    this.qaStreaming = true;
    this.qaProgress = [];
    this.qaLoading = true;
  }

  addQaProgress(item: StreamProgressItem) {
    this.qaProgress.push(item);
  }

  endQaStream() {
    this.qaStreaming = false;
    this.qaLoading = false;
    for (const item of this.qaProgress) item.done = true;
  }

  // ── QA methods ──

  setQaReport(report: QAReport | null, llmMeta?: LlmMeta | null) {
    this.qaReport = report;
    if (llmMeta !== undefined) this.qaLlmMeta = llmMeta;
  }

  setQaLoading(loading: boolean) {
    this.qaLoading = loading;
  }

  // ── Lifecycle ──

  /** Reset all pipeline state (called on analysis switch) */
  reset() {
    this.propositions = [];
    this.postSearchSuggestions = null;
    this.crossPropositionsLoading = false;
    this.postSearchLoading = false;
    this.synthesisResult = null;
    this.synthesisMarkdown = '';
    this.synthesisLoading = false;
    this.synthesisStreaming = false;
    this.synthesisProgress = [];
    this.synthesisLlmMeta = null;
    this.qaReport = null;
    this.qaLoading = false;
    this.qaStreaming = false;
    this.qaProgress = [];
    this.qaLlmMeta = null;
  }

  /** Load synthesis note, QA report and cross-propositions from the DB */
  async loadDocuments(analysisId: string) {
    try {
      const docs: AnalysisDocuments = await fetchDocuments(analysisId);
      if (docs.note) {
        this.synthesisMarkdown = docs.note.content;
      }
      if (docs.qa_report) {
        try {
          const raw = JSON.parse(docs.qa_report.content);
          this.qaReport = normalizeQaReport(raw);
        } catch {
          console.error('Corrupt QA report in DB — could not parse');
        }
      }
      if (docs.cross_propositions) {
        try {
          const raw = JSON.parse(docs.cross_propositions.content);
          this.propositions = normalizeCrossPropositions(raw);
        } catch {
          console.error('Corrupt cross-propositions in DB — could not parse');
        }
      }
    } catch {
      // Document fetch failed — synthesis/QA will show empty state
    }
    // Dev fallback: show mock propositions when DB has none
    if (this.propositions.length === 0) {
      this.propositions = mockToPropositions();
    }
  }
}

export type { PipelineState };
export const pipelineState = new PipelineState();
