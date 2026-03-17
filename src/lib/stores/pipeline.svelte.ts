import type {
  Proposition,
  PostSearchSuggestion,
  SynthesisResult,
  QAReport,
  LlmMeta,
} from '$lib/types/analysis';
import type { AnalysisDocuments, StreamEvent } from '$lib/api/analyses';
import { fetchDocuments } from '$lib/api/analyses';

/** A single line in the live streaming progress log */
export interface StreamProgressItem {
  type: 'status' | 'tool_call' | 'tool_result';
  label: string;
  done: boolean;
  turn?: number;
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
    // Mark previous non-done items as done if same type
    this.synthesisProgress = [...this.synthesisProgress, item];
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
    this.qaProgress = [...this.qaProgress, item];
  }

  endQaStream() {
    this.qaStreaming = false;
    this.qaLoading = false;
    for (const item of this.qaProgress) item.done = true;
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
    this.synthesisStreaming = false;
    this.synthesisProgress = [];
    this.synthesisLlmMeta = null;
    this.qaReport = null;
    this.qaLoading = false;
    this.qaStreaming = false;
    this.qaProgress = [];
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
