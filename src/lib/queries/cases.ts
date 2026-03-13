import { createQuery } from '@tanstack/svelte-query';
import { fetchCaseDetail } from '$lib/api/cases';
import type { CaseDetailResponse } from '$lib/types/api';

export function createCaseDetailQuery(getSakNr: () => string | null) {
  return createQuery<CaseDetailResponse>(() => {
    const sakNr = getSakNr();
    return {
      queryKey: ['case-detail', sakNr],
      queryFn: () => fetchCaseDetail(sakNr!),
      enabled: !!sakNr,
    };
  });
}
