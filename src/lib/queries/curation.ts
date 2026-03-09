import { createQuery } from '@tanstack/svelte-query';
import { fetchCuration } from '$lib/api/curation';
import type { Curation } from '$lib/types/curation';

export function createCurationQuery(
	getParams: () => {
		sakNr: string | null;
		problemStatement: string;
		seedProvisions: string[];
	},
) {
	return createQuery<Curation>(() => {
		const p = getParams();
		return {
			queryKey: ['curation', p.sakNr, p.problemStatement, p.seedProvisions],
			queryFn: () => fetchCuration(p.sakNr!, p.problemStatement, p.seedProvisions),
			enabled: !!p.sakNr && p.problemStatement.length > 0,
			staleTime: Infinity,
		};
	});
}
