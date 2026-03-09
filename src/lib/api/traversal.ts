import { apiFetch } from './client';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

export async function fetchTraversal(req: TraversalRequest): Promise<TraversalResponse> {
	return apiFetch<TraversalResponse>('/api/traverse', {
		method: 'POST',
		body: JSON.stringify(req),
	});
}
