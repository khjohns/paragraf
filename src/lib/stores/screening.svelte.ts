import type {
  AnalysisCandidate,
  AnalysisStatus,
  BatchStatus,
  BatchType,
  EuScreeningResult,
  QAReport,
  ScreeningAssignment,
  ScreeningMode,
  ScreeningResult,
} from '$lib/types/analysis';
import {
  screenCases,
  submitScreeningBatch,
  submitEuScreeningBatch,
  submitQaBatch,
  pollBatchStatus,
  fetchBatchResults,
} from '$lib/api/analyses';
import { toastState } from './toast.svelte';
import type { PipelineState } from './pipeline.svelte';

// ── Dependencies injected from analysis.svelte.ts after all singletons exist ──

interface ScreeningDeps {
  getAnalysisId: () => string;
  setStatus: (status: AnalysisStatus) => void;
  pipeline: PipelineState;
}

class ScreeningState {
  // ── Screening state ──
  screeningStatus = $state<Record<string, AnalysisCandidate['screening_status']>>({});
  screeningResults = $state<Record<string, ScreeningResult>>({});
  screeningAssignments = $state<Record<string, ScreeningAssignment>>({});
  screeningModes = $state<Record<string, ScreeningMode>>({ A: 'claude', B: 'claude', C: 'pick' });
  streamingSakNr = $state<string | null>(null);
  screeningStarted = $state(false);

  // ── EU Screening state ──
  euScreeningResults = $state<Record<string, EuScreeningResult>>({});
  euScreeningLoading = $state(false);
  streamingEuCaseId = $state<string | null>(null);

  // ── Batch state ──
  batchJobs = $state<Partial<Record<BatchType, { batchId: string; status: BatchStatus | null }>>>(
    {}
  );
  private batchTimers: Partial<Record<BatchType, ReturnType<typeof setTimeout>>> = {};
  private pollingInFlight: Partial<Record<BatchType, boolean>> = {};

  // ── Injected deps ──
  private deps!: ScreeningDeps;

  init(deps: ScreeningDeps) {
    this.deps = deps;
  }

  // ── Screening methods ──

  getAssignment(sakNr: string, category: string | undefined | null): ScreeningAssignment {
    const cat = category ?? 'C';
    const mode = this.screeningModes[cat] ?? 'claude';
    if (mode === 'pick') return this.screeningAssignments[sakNr] ?? 'claude';
    return mode as ScreeningAssignment;
  }

  setAssignment(sakNr: string, category: string | undefined | null, value: ScreeningAssignment) {
    const cat = category ?? 'C';
    if (this.screeningModes[cat] !== 'pick') {
      this.screeningModes[cat] = 'pick';
    }
    this.screeningAssignments[sakNr] = value;
  }

  setCategoryMode(category: string, mode: ScreeningMode) {
    this.screeningModes[category] = mode;
  }

  addScreeningResult(result: ScreeningResult) {
    this.screeningResults[result.sak_nr] = result;
    this.screeningStatus[`kofa:${result.sak_nr}`] = 'ai_screened';
  }

  startScreening() {
    this.screeningStarted = true;
  }

  setStreamingSakNr(sakNr: string | null) {
    this.streamingSakNr = sakNr;
  }

  // ── EU Screening methods ──

  addEuScreeningResult(result: EuScreeningResult) {
    this.euScreeningResults[result.eu_case_id] = result;
  }

  setEuScreeningLoading(loading: boolean) {
    this.euScreeningLoading = loading;
  }

  setStreamingEuCaseId(id: string | null) {
    this.streamingEuCaseId = id;
  }

  // ── SSE Screening ──

  private screeningAbort: AbortController | null = null;

  startScreeningSSE(sakNrs: string[]) {
    this.screeningStarted = true;
    this.deps.setStatus('screening');
    toastState.show(`Screening startet — ${sakNrs.length} saker via SSE`, 'success');

    this.screeningAbort = screenCases(
      this.deps.getAnalysisId(),
      sakNrs,
      (result) => {
        if (result.error) {
          toastState.show(`Screening-feil: ${result.error}`, 'error');
          return;
        }
        this.streamingSakNr = result.sak_nr;
        this.addScreeningResult(result);
      },
      () => {
        this.streamingSakNr = null;
        this.screeningAbort = null;
        toastState.show('Screening fullført', 'success');
      },
      (error) => {
        this.streamingSakNr = null;
        this.screeningAbort = null;
        toastState.show(`Screening feilet: ${error}`, 'error');
      }
    );
  }

  // ── Batch methods ──

  async startScreeningBatch(sakNrs: string[]) {
    this.screeningStarted = true;
    this.deps.setStatus('screening');
    try {
      const { batch_id } = await submitScreeningBatch(this.deps.getAnalysisId(), sakNrs);
      this.batchJobs['screening'] = { batchId: batch_id, status: null };
      this.startPolling('screening', batch_id);
      toastState.show(`Screening-batch sendt — ${sakNrs.length} saker`, 'success');
    } catch (e) {
      toastState.show('Kunne ikke starte batch-screening', 'error');
      console.error('Batch screening failed:', e);
    }
  }

  async startEuScreeningBatch(euCaseIds: string[] | null) {
    this.euScreeningLoading = true;
    try {
      const { batch_id } = await submitEuScreeningBatch(this.deps.getAnalysisId(), euCaseIds);
      this.batchJobs['eu_screening'] = { batchId: batch_id, status: null };
      this.startPolling('eu_screening', batch_id);
      toastState.show('EU-screening-batch sendt', 'success');
    } catch (e) {
      this.euScreeningLoading = false;
      toastState.show('Kunne ikke starte EU batch-screening', 'error');
      console.error('EU batch screening failed:', e);
    }
  }

  async startQaBatch() {
    this.deps.pipeline.setQaLoading(true);
    try {
      const { batch_id } = await submitQaBatch(this.deps.getAnalysisId());
      this.batchJobs['qa'] = { batchId: batch_id, status: null };
      this.startPolling('qa', batch_id);
      toastState.show('QA-batch sendt', 'success');
    } catch (e) {
      this.deps.pipeline.setQaLoading(false);
      toastState.show('Kunne ikke starte batch-QA', 'error');
      console.error('Batch QA failed:', e);
    }
  }

  isBatchActive(batchType: BatchType): boolean {
    return !!this.batchJobs[batchType];
  }

  getBatchProgress(batchType: BatchType): number {
    const job = this.batchJobs[batchType];
    if (!job?.status) return 0;
    const counts = job.status.request_counts;
    const total =
      counts.processing + counts.succeeded + counts.errored + counts.canceled + counts.expired;
    if (total === 0) return 0;
    return Math.round(((counts.succeeded + counts.errored) / total) * 100);
  }

  stopAllPolling() {
    for (const batchType of Object.keys(this.batchTimers) as BatchType[]) {
      this.stopPolling(batchType);
    }
    this.batchJobs = {};
  }

  /** Reset all screening state (called on analysis switch) */
  reset() {
    this.screeningStatus = {};
    this.screeningResults = {};
    this.screeningAssignments = {};
    this.screeningModes = { A: 'claude', B: 'claude', C: 'pick' };
    this.streamingSakNr = null;
    this.screeningStarted = false;
    this.euScreeningResults = {};
    this.euScreeningLoading = false;
    this.streamingEuCaseId = null;
    this.stopAllPolling();
  }

  /** Hydrate screening state from DB candidates */
  loadFromCandidates(candidates: AnalysisCandidate[]) {
    const status: Record<string, AnalysisCandidate['screening_status']> = {};
    const results: Record<string, ScreeningResult> = {};
    for (const c of candidates) {
      const nodeId = `kofa:${c.sak_nr}`;
      if (c.screening_status) status[nodeId] = c.screening_status;
      if (c.ai_screening) results[c.sak_nr] = c.ai_screening;
    }
    this.screeningStatus = status;
    this.screeningResults = results;
  }

  // ── Private polling internals ──

  private startPolling(batchType: BatchType, batchId: string) {
    this.stopPolling(batchType);
    // Capture analysis ID at submission time so it stays correct even if the user switches analyses
    const analysisId = this.deps.getAnalysisId();

    const poll = async () => {
      if (this.pollingInFlight[batchType]) return;
      this.pollingInFlight[batchType] = true;
      try {
        const status = await pollBatchStatus(analysisId, batchId);
        const job = this.batchJobs[batchType];
        if (job) job.status = status;

        if (status.processing_status === 'ended') {
          this.stopPolling(batchType);
          await this.handleBatchComplete(batchType, batchId, analysisId);
          return;
        }
      } catch (e) {
        console.error(`Polling error for ${batchType}:`, e);
      } finally {
        this.pollingInFlight[batchType] = false;
      }
      this.batchTimers[batchType] = setTimeout(poll, 5000);
    };

    this.batchTimers[batchType] = setTimeout(poll, 5000);
  }

  private stopPolling(batchType: BatchType) {
    if (this.batchTimers[batchType]) {
      clearTimeout(this.batchTimers[batchType]);
      delete this.batchTimers[batchType];
    }
    delete this.pollingInFlight[batchType];
  }

  private async handleBatchComplete(batchType: BatchType, batchId: string, analysisId: string) {
    try {
      if (batchType === 'screening') {
        const data = (await fetchBatchResults(analysisId, batchId, 'screening')) as {
          results: ScreeningResult[];
        };
        for (const result of data.results) {
          if (!result.error) this.addScreeningResult(result);
        }
        this.deps.setStatus('screening_complete');
        toastState.show(
          `Screening ferdig — ${data.results.filter((r) => !r.error).length} saker screenet`,
          'success'
        );
      } else if (batchType === 'eu_screening') {
        const data = (await fetchBatchResults(analysisId, batchId, 'eu_screening')) as {
          results: EuScreeningResult[];
        };
        for (const result of data.results) {
          if (!result.error) this.addEuScreeningResult(result);
        }
        this.euScreeningLoading = false;
        toastState.show(
          `EU-screening ferdig — ${data.results.filter((r) => !r.error).length} dommer screenet`,
          'success'
        );
      } else if (batchType === 'qa') {
        const report = (await fetchBatchResults(analysisId, batchId, 'qa')) as QAReport;
        this.deps.pipeline.setQaReport(report);
        this.deps.pipeline.setQaLoading(false);
        this.deps.setStatus('qa');
        toastState.show(
          `QA ferdig — ${report.total_flags} flagg`,
          report.total_flags > 0 ? 'info' : 'success'
        );
      }
    } catch (e) {
      console.error(`Failed to fetch batch results for ${batchType}:`, e);
      toastState.show(`Batch-feil: kunne ikke hente resultater for ${batchType}`, 'error');
      if (batchType === 'eu_screening') this.euScreeningLoading = false;
      if (batchType === 'qa') this.deps.pipeline.setQaLoading(false);
    } finally {
      delete this.batchJobs[batchType];
    }
  }
}

export type { ScreeningState };
export const screeningState = new ScreeningState();
