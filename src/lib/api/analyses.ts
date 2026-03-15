import { apiFetch } from './client';
import type { AnalysisSummary, AnalysisDbResponse, ScopingResult, ScreeningResult, PostSearchSuggestion, CrossPropositionsResult, EuCaseForScreening, EuScreeningResult, SynthesisResult, QAReport } from '$lib/types/analysis';
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

export function scopeAnalysis(
  analysisId: string,
  problem: string
): Promise<ScopingResult> {
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
 * Start AI screening for multiple cases via SSE.
 * Returns an EventSource-like reader that yields ScreeningResult objects.
 */
export function screenCases(
  analysisId: string,
  sakNrs: string[],
  onResult: (result: ScreeningResult & { done?: boolean; error?: string }) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`/api/analyses/${analysisId}/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sak_nrs: sakNrs }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        onError((data as { error?: string })?.error ?? 'Screening feilet');
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
        // Process remaining buffer
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
  sections: string[] = ['vurdering', 'bakgrunn'],
): Promise<ScreeningResult> {
  return apiFetch<ScreeningResult>(
    `/api/analyses/${analysisId}/screen/${sakNr}/rescreen`,
    {
      method: 'POST',
      body: JSON.stringify({ sections }),
    },
  );
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
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`/api/analyses/${analysisId}/eu-screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eu_case_ids: euCaseIds }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        onError((data as { error?: string })?.error ?? 'EU-screening feilet');
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

// --- Synthesis ---

export function synthesize(analysisId: string): Promise<SynthesisResult> {
  return apiFetch<SynthesisResult>(`/api/analyses/${analysisId}/synthesize`, {
    method: 'POST',
  });
}

export function updateSynthesisNote(
  analysisId: string,
  content: string,
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
