import { createQuery } from '@tanstack/svelte-query';
import { fetchAnalyses, fetchAnalysis } from '$lib/api/analyses';
import type { AnalysisSummary, AnalysisDbResponse } from '$lib/types/analysis';

export function createAnalysesListQuery() {
  return createQuery<AnalysisSummary[]>(() => ({
    queryKey: ['analyses'],
    queryFn: fetchAnalyses,
  }));
}

export function createAnalysisQuery(getId: () => string | null) {
  return createQuery<AnalysisDbResponse>(() => {
    const id = getId();
    return {
      queryKey: ['analysis', id],
      queryFn: () => fetchAnalysis(id!),
      enabled: !!id,
    };
  });
}
