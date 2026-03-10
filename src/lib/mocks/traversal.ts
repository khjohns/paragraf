import type { TraversalResponse } from '$lib/types/api';
import { MOCK_NODES, MOCK_EDGES, MOCK_GAPS } from './nodes';

export const mockTraversalResponse: TraversalResponse = {
	nodes: MOCK_NODES,
	edges: MOCK_EDGES,
	gaps: MOCK_GAPS,
	stats: {
		total: MOCK_NODES.filter(n => n.type === 'kofa_case').length,
		categoryA: MOCK_NODES.filter(n => n.category === 'A').length,
		categoryB: MOCK_NODES.filter(n => n.category === 'B').length,
		categoryC: MOCK_NODES.filter(n => n.category === 'C').length,
		delimitations: MOCK_NODES.filter(n => n.isDelimitation).length,
	},
	suggestedProvisions: [],
};
