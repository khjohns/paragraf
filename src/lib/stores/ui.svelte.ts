export type ViewMode = 'list' | 'graph';
export type ListFilter = 'all' | 'delimitation' | 'unread';
export type ListSort = 'category' | 'citations' | 'date';

class UiState {
	selectedNodeId = $state<string | null>(null);
	viewMode = $state<ViewMode>('list');
	leftPanelOpen = $state(true);
	listFilter = $state<ListFilter>('all');
	listSort = $state<ListSort>('category');
	regulationFilter = $state(true); // true = only new (2017+)
	scrollToTarget = $state<number | null>(null); // paragraph number for cross-ref navigation

	selectNode(id: string | null) {
		this.selectedNodeId = id;
	}

	clearScrollTarget() {
		this.scrollToTarget = null;
	}

	setViewMode(mode: ViewMode) {
		this.viewMode = mode;
	}

	toggleLeftPanel() {
		this.leftPanelOpen = !this.leftPanelOpen;
	}

	setListFilter(filter: ListFilter) {
		this.listFilter = filter;
	}

	setListSort(sort: ListSort) {
		this.listSort = sort;
	}

	toggleRegulationFilter() {
		this.regulationFilter = !this.regulationFilter;
	}
}

export const uiState = new UiState();
