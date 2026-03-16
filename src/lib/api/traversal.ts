import { apiFetch } from './client';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

export async function fetchTraversal(
  analysisId: string,
  req: TraversalRequest
): Promise<TraversalResponse> {
  return apiFetch<TraversalResponse>(`/api/analyses/${analysisId}/traverse`, {
    method: 'POST',
    body: JSON.stringify({ regulationFilter: req.regulationFilter }),
  });
}
