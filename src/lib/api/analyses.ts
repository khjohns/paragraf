import { apiFetch } from './client';
import type { AnalysisSummary, AnalysisDbResponse, ScopingResult } from '$lib/types/analysis';
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
