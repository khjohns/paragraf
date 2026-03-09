import { apiFetch } from './client';
import type { CaseDetailResponse, ProvisionDetailResponse } from '$lib/types/api';

export async function fetchCaseDetail(sakNr: string): Promise<CaseDetailResponse> {
	return apiFetch<CaseDetailResponse>(`/api/cases/${encodeURIComponent(sakNr)}`);
}

export async function fetchProvisionDetail(
	dokId: string,
	sectionId: string,
): Promise<ProvisionDetailResponse> {
	return apiFetch<ProvisionDetailResponse>(
		`/api/provisions/${encodeURIComponent(dokId)}/${encodeURIComponent(sectionId)}`,
	);
}
