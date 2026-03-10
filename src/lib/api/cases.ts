import { apiFetch } from './client';
import type {
	CaseDetailResponse,
	ProvisionDetailResponse,
	EuCaseDetailResponse,
	ForarbeidDetailResponse,
} from '$lib/types/api';

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

export async function fetchEuCaseDetail(euCaseId: string): Promise<EuCaseDetailResponse> {
	return apiFetch<EuCaseDetailResponse>(
		`/api/eu-cases/${encodeURIComponent(euCaseId)}`,
	);
}

export async function fetchForarbeidDetail(
	docId: string,
	sectionNumber: string,
): Promise<ForarbeidDetailResponse> {
	return apiFetch<ForarbeidDetailResponse>(
		`/api/forarbeider/${encodeURIComponent(docId)}/${encodeURIComponent(sectionNumber)}`,
	);
}
