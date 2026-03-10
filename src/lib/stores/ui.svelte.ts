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
	navigationHistory = $state<string[]>([]);

	/** Direct selection (list/graph click) — resets navigation history */
	selectNode(id: string | null) {
		this.navigationHistory = [];
		this.selectedNodeId = id;
	}

	/** Cross-reference navigation — pushes current node to history stack */
	navigateTo(id: string) {
		if (this.selectedNodeId && this.selectedNodeId !== id) {
			this.navigationHistory = [...this.navigationHistory, this.selectedNodeId];
		}
		this.selectedNodeId = id;
	}

	/** Go back in navigation history */
	goBack() {
		if (this.navigationHistory.length === 0) return;
		const history = [...this.navigationHistory];
		const previous = history.pop()!;
		this.navigationHistory = history;
		this.selectedNodeId = previous;
	}

	/** Navigate to a specific point in the breadcrumb trail */
	navigateToBreadcrumb(index: number) {
		// Keep history up to (not including) the clicked index, select that node
		const targetId = this.navigationHistory[index];
		this.navigationHistory = this.navigationHistory.slice(0, index);
		this.selectedNodeId = targetId;
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
