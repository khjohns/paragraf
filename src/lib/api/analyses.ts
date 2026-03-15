import { apiFetch } from './client';
import type {
  AnalysisSummary,
  AnalysisDbResponse,
  ScopingResult,
  ScreeningResult,
  PostSearchSuggestion,
  CrossPropositionsResult,
  EuCaseForScreening,
  EuScreeningResult,
  SynthesisResult,
  QAReport,
  BatchStatus,
  BatchType,
} from '$lib/types/analysis';
import type { TraversalResponse } from '$lib/types/api';

export function fetchAnalyses(): Promise<AnalysisSummary[]> {
  return apiFetch<AnalysisSummary[]>('/api/analyses');
}

export function fetchAnalysis(id: string): Promise<AnalysisDbResponse> {
  return apiFetch<AnalysisDbResponse>(`/api/analyses/${id}`);
}

export function createAnalysis(title: string, problem = ''): Promise<AnalysisDbResponse> {
  return apiFetch<AnalysisDbResponse>('/api/analyses', {
    method: 'POST',
    body: JSON.stringify({ title, problem }),
  });
}

export function updateAnalysis(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/analyses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function scopeAnalysis(analysisId: string, problem: string): Promise<ScopingResult> {
  return apiFetch<ScopingResult>(`/api/analyses/${analysisId}/scope`, {
    method: 'POST',
    body: JSON.stringify({ problem }),
  });
}

export function traverseAnalysis(
  analysisId: string,
  iteration = 1,
  regulationFilter: 'new' | 'all' = 'new'
): Promise<TraversalResponse & { candidateCount: number }> {
  return apiFetch(`/api/analyses/${analysisId}/traverse`, {
    method: 'POST',
    body: JSON.stringify({ iteration, regulationFilter }),
  });
}

export function updateCandidate(
  analysisId: string,
  sakNr: string,
  updates: Record<string, unknown>
): Promise<unknown> {
  return apiFetch(`/api/analyses/${analysisId}/candidates/${sakNr}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Generic SSE stream reader — shared by KOFA and EU screening.
 */
function streamSSE<T>(
  url: string,
  body: Record<string, unknown>,
  errorLabel: string,
  onResult: (result: T & { done?: boolean; error?: string }) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        onError((data as { error?: string })?.error ?? errorLabel);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('Ingen respons-strøm');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) onDone();
          else onResult(data);
        } catch {
          // Ignore parse errors for partial lines
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            processLine(line);
          }
        }
        processLine(buffer);
      } finally {
        reader.releaseLock();
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message ?? 'Nettverksfeil');
      }
    });

  return controller;
}

/**
 * Start AI screening for multiple cases via SSE.
 */
export function screenCases(
  analysisId: string,
  sakNrs: string[],
  onResult: (result: ScreeningResult & { done?: boolean; error?: string }) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE<ScreeningResult>(
    `/api/analyses/${analysisId}/screen`,
    { sak_nrs: sakNrs },
    'Screening feilet',
    onResult,
    onDone,
    onError
  );
}

export function postSearch(analysisId: string): Promise<PostSearchSuggestion> {
  return apiFetch<PostSearchSuggestion>(`/api/analyses/${analysisId}/post-search`, {
    method: 'POST',
  });
}

export function crossPropositions(analysisId: string): Promise<CrossPropositionsResult> {
  return apiFetch<CrossPropositionsResult>(`/api/analyses/${analysisId}/cross-propositions`, {
    method: 'POST',
  });
}

export function rescreenCase(
  analysisId: string,
  sakNr: string,
  sections: string[] = ['vurdering', 'bakgrunn']
): Promise<ScreeningResult> {
  return apiFetch<ScreeningResult>(`/api/analyses/${analysisId}/screen/${sakNr}/rescreen`, {
    method: 'POST',
    body: JSON.stringify({ sections }),
  });
}

// --- EU Screening ---

export function fetchEuCases(analysisId: string): Promise<EuCaseForScreening[]> {
  return apiFetch<EuCaseForScreening[]>(`/api/analyses/${analysisId}/eu-cases`);
}

export function screenEuCases(
  analysisId: string,
  euCaseIds: string[] | null,
  onResult: (result: EuScreeningResult & { done?: boolean; error?: string }) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE<EuScreeningResult>(
    `/api/analyses/${analysisId}/eu-screen`,
    { eu_case_ids: euCaseIds },
    'EU-screening feilet',
    onResult,
    onDone,
    onError
  );
}

// --- Synthesis ---

export function synthesize(analysisId: string): Promise<SynthesisResult> {
  return apiFetch<SynthesisResult>(`/api/analyses/${analysisId}/synthesize`, {
    method: 'POST',
  });
}

export function updateSynthesisNote(
  analysisId: string,
  content: string
): Promise<{ ok: boolean; version: number }> {
  return apiFetch(`/api/analyses/${analysisId}/synthesis`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

// --- QA ---

export function runQA(analysisId: string): Promise<QAReport> {
  return apiFetch<QAReport>(`/api/analyses/${analysisId}/qa`, {
    method: 'POST',
  });
}

// --- Documents ---

export interface AnalysisDocuments {
  note?: { content: string; version: number };
  qa_report?: { content: string; version: number };
}

export function fetchDocuments(analysisId: string): Promise<AnalysisDocuments> {
  return apiFetch<AnalysisDocuments>(`/api/analyses/${analysisId}/documents`);
}

// --- Complete ---

export function completeAnalysis(analysisId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/analyses/${analysisId}/complete`, {
    method: 'POST',
  });
}

// --- Batch API ---

export function submitScreeningBatch(
  analysisId: string,
  sakNrs: string[]
): Promise<{ batch_id: string }> {
  return apiFetch(`/api/analyses/${analysisId}/screen-batch`, {
    method: 'POST',
    body: JSON.stringify({ sak_nrs: sakNrs }),
  });
}

export function submitEuScreeningBatch(
  analysisId: string,
  euCaseIds: string[] | null
): Promise<{ batch_id: string }> {
  return apiFetch(`/api/analyses/${analysisId}/eu-screen-batch`, {
    method: 'POST',
    body: JSON.stringify({ eu_case_ids: euCaseIds }),
  });
}

export function submitQaBatch(analysisId: string): Promise<{ batch_id: string }> {
  return apiFetch(`/api/analyses/${analysisId}/qa-batch`, {
    method: 'POST',
  });
}

export function pollBatchStatus(analysisId: string, batchId: string): Promise<BatchStatus> {
  return apiFetch<BatchStatus>(`/api/analyses/${analysisId}/batch-status/${batchId}`);
}

export function fetchBatchResults(
  analysisId: string,
  batchId: string,
  batchType: BatchType,
  extra?: Record<string, unknown>
): Promise<unknown> {
  return apiFetch(`/api/analyses/${analysisId}/batch-results/${batchId}`, {
    method: 'POST',
    body: JSON.stringify({ batch_type: batchType, ...extra }),
  });
}

// --- Chat ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Stream a chat response via SSE. Returns AbortController for cancellation.
 * Reuses streamSSE — maps {text} chunks to onChunk calls.
 */
export function streamChat(
  analysisId: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamSSE<{ text?: string }>(
    `/api/analyses/${analysisId}/chat`,
    { messages },
    'Chat feilet',
    (result) => {
      if (result.error) onError(result.error);
      else if (result.text) onChunk(result.text);
    },
    onDone,
    onError
  );
}
