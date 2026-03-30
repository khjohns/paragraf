export type ViewMode = 'list' | 'graph' | 'propositions' | 'synthesis';
export type ListFilter = 'all' | 'delimitation' | 'unread';
export type ListSort = 'category' | 'citations' | 'date';
export type ProcessView = 'context' | 'synthesis-review' | null;

class UiState {
  selectedNodeId = $state<string | null>(null);
  viewMode = $state<ViewMode>('list');
  leftPanelOpen = $state(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
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

  /** Direct selection (list/graph click) — resets navigation history.
   *  Auto-closes left panel when opening right panel (mutual exclusion). */
  selectNode(id: string | null) {
    if (id === this.selectedNodeId) return;
    if (this.navigationHistory.length > 0) this.navigationHistory = [];
    if (id && this.leftPanelOpen) this.leftPanelOpen = false;
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
    const previous = this.navigationHistory[this.navigationHistory.length - 1];
    this.navigationHistory = this.navigationHistory.slice(0, -1);
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

  /** Toggle left panel. Auto-closes right panel when opening (mutual exclusion). */
  toggleLeftPanel() {
    const opening = !this.leftPanelOpen;
    if (opening && this.selectedNodeId) this.selectNode(null);
    this.leftPanelOpen = opening;
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
  }

  /** Navigate to a phase/section. Sets both activePhase and the corresponding processView.
   *  Section 1 = Problemstilling → ContextView
   *  Section 2 = Gjennomgang → workspace (list/graph)
   *  Section 3 = Syntese → Notat-fanen (viewMode), prosessvisning bare under streaming
   */
  setPhase(phase: number) {
    this.activePhase = phase;
    if (phase === 1) {
      this.activeProcessView = 'context';
    } else if (phase === 3) {
      // Navigate to Notat tab instead of process view
      this.activeProcessView = null;
      this.viewMode = 'synthesis';
    } else {
      this.activeProcessView = null; // phase 2 = workspace
    }
  }
}

export const uiState = new UiState();
