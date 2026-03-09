import { apiFetch } from './client';
import type { Curation } from '$lib/types/curation';

export async function fetchCuration(
	sakNr: string,
	problemStatement: string,
	seedProvisions: string[],
): Promise<Curation> {
	return apiFetch<Curation>(`/api/curate/${encodeURIComponent(sakNr)}`, {
		method: 'POST',
		body: JSON.stringify({
			problem_statement: problemStatement,
			seed_provisions: seedProvisions,
		}),
	});
}
