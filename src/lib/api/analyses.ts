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

export interface VerifyCitationsResult {
  verified_quotes: Array<{
    sak_nr: string;
    paragraph: number;
    quoted_text: string;
    status: 'verified' | 'truncated' | 'inaccurate' | 'not_found';
    issue: string | null;
  }>;
  summary: string;
}

export function verifyCitations(analysisId: string): Promise<VerifyCitationsResult> {
  return apiFetch<VerifyCitationsResult>(`/api/analyses/${analysisId}/verify-citations`, {
    method: 'POST',
  });
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

/** SSE event types for synthesis/QA streaming (ADR-004 Fase 2) */
export interface StreamEvent {
  type: 'status' | 'chunk' | 'tool_call' | 'tool_result' | 'result' | 'error' | 'done';
  data: Record<string, unknown>;
}

/**
 * Generic typed-SSE stream reader for named events.
 * Backend sends `event: <type>\ndata: <json>\n\n`.
 */
function streamTypedSSE(
  url: string,
  onEvent: (event: StreamEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
  body?: Record<string, unknown>
): AbortController {
  const controller = new AbortController();

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    ...(body && { body: JSON.stringify(body) }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        onError((data as { error?: string })?.error ?? 'Stream feilet');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('Ingen respons-strøm');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE messages are separated by \n\n
          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';

          for (const msg of messages) {
            if (!msg.trim()) continue;
            const lines = msg.split('\n');
            let eventType = '';
            let eventData = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7);
              else if (line.startsWith('data: ')) eventData = line.slice(6);
            }
            if (!eventType) continue;

            if (eventType === 'done') {
              onDone();
              return;
            }

            try {
              const data = JSON.parse(eventData);
              if (eventType === 'error') {
                onError(data.message ?? 'Ukjent feil');
                return;
              }
              onEvent({
                type: eventType as StreamEvent['type'],
                data,
              });
            } catch {
              // Ignore parse errors
            }
          }
        }
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

/** Start streaming synthesis with live tool-call feedback */
export function synthesizeStream(
  analysisId: string,
  onEvent: (event: StreamEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamTypedSSE(`/api/analyses/${analysisId}/synthesize-stream`, onEvent, onDone, onError);
}

/** Start streaming QA with live tool-call feedback */
export function qaStream(
  analysisId: string,
  onEvent: (event: StreamEvent) => void,
  onDone: () => void,
  onError: (error: string) => void
): AbortController {
  return streamTypedSSE(`/api/analyses/${analysisId}/qa-stream`, onEvent, onDone, onError);
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
  timestamp?: number;
}

/** Load persisted chat history from the database. */
export async function fetchChatHistory(analysisId: string): Promise<ChatMessage[]> {
  const rows = await apiFetch<
    { role: 'user' | 'assistant'; content: string; created_at: string }[]
  >(`/api/analyses/${analysisId}/chat/messages`);
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    timestamp: new Date(r.created_at).getTime(),
  }));
}

/**
 * Stream a chat response via typed SSE. Returns AbortController for cancellation.
 * Uses streamTypedSSE — supports status events (loading_context, streaming) and text chunks.
 */
export function streamChat(
  analysisId: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  onStatus?: (phase: string) => void
): AbortController {
  return streamTypedSSE(
    `/api/analyses/${analysisId}/chat`,
    (event) => {
      if (event.type === 'status' && onStatus) {
        onStatus(event.data.phase as string);
      } else if (event.type === 'chunk') {
        onChunk(event.data.text as string);
      }
    },
    onDone,
    onError,
    { messages: messages.map(({ role, content }) => ({ role, content })) }
  );
}
