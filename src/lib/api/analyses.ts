import { apiFetch } from './client';
import type { AnalysisSummary, AnalysisDbResponse, ScopingResult, ScreeningResult } from '$lib/types/analysis';
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                onDone();
              } else {
                onResult(data);
              }
            } catch {
              // Ignore parse errors for partial lines
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.done) {
            onDone();
          } else {
            onResult(data);
          }
        } catch {
          // Ignore
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message ?? 'Nettverksfeil');
      }
    });

  return controller;
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
