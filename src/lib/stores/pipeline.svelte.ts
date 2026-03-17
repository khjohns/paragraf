import type {
  Proposition,
  PostSearchSuggestion,
  SynthesisResult,
  QAReport,
  LlmMeta,
} from '$lib/types/analysis';
import type { AnalysisDocuments } from '$lib/api/analyses';
import { fetchDocuments } from '$lib/api/analyses';

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

  // ── QA methods ──

  setQaReport(report: QAReport | null) {
    this.qaReport = report;
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
    this.synthesisLlmMeta = null;
    this.qaReport = null;
    this.qaLoading = false;
    this.qaLlmMeta = null;
  }

  /** Load synthesis note and QA report from the DB */
  async loadDocuments(analysisId: string) {
    try {
      const docs: AnalysisDocuments = await fetchDocuments(analysisId);
      if (docs.note) {
        this.synthesisMarkdown = docs.note.content;
      }
      if (docs.qa_report) {
        try {
          this.qaReport = JSON.parse(docs.qa_report.content);
        } catch {
          console.error('Corrupt QA report in DB — could not parse');
        }
      }
    } catch {
      // Document fetch failed — synthesis/QA will show empty state
    }
  }
}

export type { PipelineState };
export const pipelineState = new PipelineState();
