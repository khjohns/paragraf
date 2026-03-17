import { createQuery } from '@tanstack/svelte-query';
import { fetchTraversal } from '$lib/api/traversal';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

export function createTraversalQuery(
  getParams: () => { analysisId: string; request: TraversalRequest }
) {
  return createQuery<TraversalResponse>(() => {
    const { analysisId, request } = getParams();
    return {
      queryKey: ['traversal', analysisId, request],
      queryFn: () => fetchTraversal(analysisId, request),
      enabled: !!analysisId && (request.provisions.length > 0 || request.ftsTerms.length > 0),
      staleTime: Infinity, // Don't refetch — traversal is expensive
    };
  });
}
