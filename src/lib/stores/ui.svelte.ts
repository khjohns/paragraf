export type ViewMode = 'list' | 'graph' | 'propositions' | 'synthesis';
export type ListFilter = 'all' | 'delimitation' | 'unread';
export type ListSort = 'category' | 'citations' | 'date';
export type ProcessView = 'context' | 'synthesis-review' | null;

class UiState {
  selectedNodeId = $state<string | null>(null);
  viewMode = $state<ViewMode>('list');
  leftPanelOpen = $state(true);
  listFilter = $state<ListFilter>('all');
  listSort = $state<ListSort>('category');
  regulationFilter = $state(true); // true = only new (2017+)
  aiEnabled = $state(true); // KI-toggle: disables curation, keeps vector search
  graphSearch = $state('');
  graphCategoryFilter = $state<Set<string>>(new Set()); // empty = show all
  graphTypeFilter = $state<Set<string>>(new Set()); // empty = show all
  activeProcessView = $state<ProcessView>(null);
  /** Active phase tab (1=Problem, 2=Kandidater, 3=Screening/workspace, 4=Syntese) */
  activePhase = $state(3);

  private toggleSetFilter(field: 'graphCategoryFilter' | 'graphTypeFilter', value: string) {
    const next = new Set(this[field]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    this[field] = next;
  }

  toggleGraphCategory(cat: string) {
    this.toggleSetFilter('graphCategoryFilter', cat);
  }
  toggleGraphType(type: string) {
    this.toggleSetFilter('graphTypeFilter', type);
  }
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

  toggleAi() {
    this.aiEnabled = !this.aiEnabled;
  }

  setProcessView(view: ProcessView) {
    this.activeProcessView = view;
  }

  clearProcessView() {
    this.activeProcessView = null;
    this.activePhase = 3;
  }

  /** Navigate to a phase tab. Sets both activePhase and the corresponding processView. */
  setPhase(phase: number) {
    this.activePhase = phase;
    if (phase === 1 || phase === 2) {
      this.activeProcessView = 'context';
    } else if (phase === 4) {
      this.activeProcessView = 'synthesis-review';
    } else {
      this.activeProcessView = null; // phase 3 = workspace
    }
  }
}

export const uiState = new UiState();
