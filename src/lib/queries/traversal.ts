import { createQuery } from '@tanstack/svelte-query';
import { fetchTraversal } from '$lib/api/traversal';
import type { TraversalRequest, TraversalResponse } from '$lib/types/api';

export function createTraversalQuery(getRequest: () => TraversalRequest) {
	return createQuery<TraversalResponse>(() => {
		const request = getRequest();
		return {
			queryKey: ['traversal', request],
			queryFn: async () => {
				try {
					return await fetchTraversal(request);
				} catch {
					const { mockTraversalResponse } = await import('$lib/mocks/traversal');
					return mockTraversalResponse;
				}
			},
			enabled: request.provisions.length > 0 || request.ftsTerms.length > 0,
		};
	});
}
