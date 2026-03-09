import { createQuery } from '@tanstack/svelte-query';
import { fetchCaseDetail } from '$lib/api/cases';
import type { CaseDetailResponse } from '$lib/types/api';

export function createCaseDetailQuery(getSakNr: () => string | null) {
	return createQuery<CaseDetailResponse>(() => {
		const sakNr = getSakNr();
		return {
			queryKey: ['case-detail', sakNr],
			queryFn: async () => {
				try {
					return await fetchCaseDetail(sakNr!);
				} catch {
					const { mockCaseDetail } = await import('$lib/mocks/cases');
					return mockCaseDetail(sakNr!);
				}
			},
			enabled: !!sakNr,
		};
	});
}
