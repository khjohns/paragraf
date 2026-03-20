<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { computeAggregatedLayout, LAYER_CONFIG } from '$lib/utils/layout';
  import GraphNode from './GraphNode.svelte';
  import GraphEdge from './GraphEdge.svelte';
  import GraphTooltip from './GraphTooltip.svelte';
  import GraphLegend from './GraphLegend.svelte';
  import AggregateNode from './AggregateNode.svelte';
  import { onMount } from 'svelte';
  import { nodeMatchesSearch } from '$lib/types/graph';
  import type { GraphNode as GNode, AggregateNode as AggType } from '$lib/types/graph';

  // Aggregation state
  let expandedAggregates = $state(new Set<string>());

  // Fade-in tracking for newly expanded nodes
  let newlyExpandedNodes = $state(new Set<string>());

  // Compute aggregated layout reactively
  let layout = $derived.by(() => {
    if (analysisState.nodes.length === 0) return null;
    return computeAggregatedLayout(analysisState.nodes, analysisState.edges, expandedAggregates);
  });

  // Which real node IDs are currently visible (not aggregated away)
  let visibleNodeIds = $derived.by(() => {
    if (!layout) return new Set<string>();
    const hidden = new Set<string>();
    for (const agg of layout.aggregates) {
      for (const id of agg.memberIds) {
        hidden.add(id);
      }
    }
    return new Set(analysisState.nodes.filter((n) => !hidden.has(n.id)).map((n) => n.id));
  });

  // Build lookup for edge valence
  let edgeValenceMap = $derived.by(() => {
    const map = new Map<string, string>();
    for (const e of analysisState.edges) {
      map.set(`${e.from}→${e.to}`, e.valence);
    }
    return map;
  });

  // Node lookup
  let nodeMap = $derived(new Map(analysisState.nodes.map((n) => [n.id, n])));

  // Edges connected to the selected node
  let selectedEdgeKeys = $derived.by(() => {
    const sel = uiState.selectedNodeId;
    if (!sel) return new Set<string>();
    const keys = new Set<string>();
    for (const e of analysisState.edges) {
      if (e.from === sel || e.to === sel) {
        keys.add(`${e.from}→${e.to}`);
      }
    }
    // Also match edges remapped through aggregates
    if (layout) {
      for (const e of layout.edges) {
        if (e.from === sel || e.to === sel) {
          keys.add(`${e.from}→${e.to}`);
        }
      }
    }
    return keys;
  });

  // Search match set
  let searchMatches = $derived.by(() => {
    const q = uiState.graphSearch.toLowerCase().trim();
    if (!q) return null; // null = no search active
    const matches = new Set<string>();
    for (const n of analysisState.nodes) {
      if (nodeMatchesSearch(n, q)) matches.add(n.id);
    }
    return matches;
  });

  // Dimming: regulation filter + search + category filter + type filter
  function isDimmed(node: GNode): boolean {
    if (uiState.regulationFilter && node.regulation === 'old') return true;
    if (searchMatches && !searchMatches.has(node.id)) return true;
    if (uiState.graphTypeFilter.size > 0 && !uiState.graphTypeFilter.has(node.type)) return true;
    if (
      uiState.graphCategoryFilter.size > 0 &&
      node.category &&
      !uiState.graphCategoryFilter.has(node.category)
    )
      return true;
    return false;
  }

  // Dimming for aggregate nodes
  function isAggregateDimmed(agg: AggType): boolean {
    if (uiState.graphTypeFilter.size > 0 && !uiState.graphTypeFilter.has(agg.type)) return true;
    const catFilter = uiState.graphCategoryFilter;
    if (catFilter.size > 0) {
      const hasMatch = agg.memberIds.some((id) => {
        const n = nodeMap.get(id);
        return n?.category && catFilter.has(n.category);
      });
      if (!hasMatch) return true;
    }
    if (searchMatches) {
      const hasMatch = agg.memberIds.some((id) => searchMatches!.has(id));
      if (!hasMatch) return true;
    }
    return false;
  }

  // Zoom/pan state
  let viewBox = $state({ x: 0, y: 0, w: 800, h: 600 });
  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0, vx: 0, vy: 0 });

  // Reset viewBox when layout changes
  $effect(() => {
    if (layout) {
      viewBox = { x: 0, y: 0, w: layout.width, h: layout.height };
    }
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    const newW = Math.max(200, Math.min(viewBox.w * scale, 5000));
    const newH = Math.max(150, Math.min(viewBox.h * scale, 4000));
    // Zoom toward center
    const dx = (newW - viewBox.w) / 2;
    const dy = (newH - viewBox.h) / 2;
    viewBox = { x: viewBox.x - dx, y: viewBox.y - dy, w: newW, h: newH };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPanning) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    viewBox = {
      ...viewBox,
      x: panStart.vx - (e.clientX - panStart.x) * scaleX,
      y: panStart.vy - (e.clientY - panStart.y) * scaleY,
    };
  }

  function handlePointerUp() {
    isPanning = false;
  }

  // Wheel zoom: must register with { passive: false } to allow preventDefault
  let svgEl = $state<SVGSVGElement | undefined>();
  onMount(() => {
    if (!svgEl) return;
    svgEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => svgEl!.removeEventListener('wheel', handleWheel);
  });

  // Tooltip state
  let tooltipNode = $state<GNode | null>(null);
  let tooltipPos = $state({ x: 0, y: 0 });
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  function handleNodeHover(node: GNode, e: MouseEvent) {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltipNode = node;
      tooltipPos = { x: e.clientX, y: e.clientY };
    }, 300);
  }

  function handleNodeLeave() {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    tooltipNode = null;
  }

  // Clean up tooltip timer on destroy
  $effect(() => {
    return () => {
      if (tooltipTimer) clearTimeout(tooltipTimer);
    };
  });

  // Gap lines (dashed purple between provisions with count === 0)
  let gapLines = $derived.by(() => {
    if (!layout) return [];
    return analysisState.gaps
      .filter((g) => g.count === 0)
      .map((g) => {
        const p1 = layout!.nodes.get(g.provision1);
        const p2 = layout!.nodes.get(g.provision2);
        if (!p1 || !p2) return null;
        return { from: p1, to: p2, label: '∅' };
      })
      .filter(Boolean) as Array<{
      from: { x: number; y: number };
      to: { x: number; y: number };
      label: string;
    }>;
  });

  // Layer labels
  import type { NodeType } from '$lib/types/graph';

  function updateLayerMinY(
    layers: Record<string, { label: string; minY: number }>,
    type: NodeType,
    y: number
  ) {
    const key = LAYER_CONFIG[type].label;
    if (!layers[key] || y < layers[key].minY) {
      layers[key] = { label: key, minY: y };
    }
  }

  let layerLabels = $derived.by(() => {
    if (!layout) return [];
    const layers: Record<string, { label: string; minY: number }> = {};

    for (const node of analysisState.nodes) {
      if (!visibleNodeIds.has(node.id)) continue;
      const pos = layout!.nodes.get(node.id);
      if (pos) updateLayerMinY(layers, node.type, pos.y);
    }
    for (const agg of layout!.aggregates) {
      const pos = layout!.nodes.get(agg.id);
      if (pos) updateLayerMinY(layers, agg.type, pos.y);
    }

    const sorted = Object.values(layers).sort((a, b) => a.minY - b.minY);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minY - sorted[i - 1].minY < 40) {
        sorted[i].minY = sorted[i - 1].minY + 40;
      }
    }
    return sorted;
  });

  // Handle aggregate click: expand the group
  function expandAggregate(agg: AggType) {
    // Mark members as newly expanded for fade-in animation
    newlyExpandedNodes = new Set(agg.memberIds);

    // Clear fade-in class after animation
    setTimeout(() => {
      newlyExpandedNodes = new Set();
    }, 500);

    // Add to expanded set (triggers reactive re-layout via dagre)
    expandedAggregates = new Set([...expandedAggregates, agg.id]);
  }

  // Reorganise: collapse all aggregates, full re-layout
  function reorganise() {
    expandedAggregates = new Set();
    newlyExpandedNodes = new Set();
  }

  // Whether we have any aggregates or expanded aggregates (show reorganise button)
  let hasAggregation = $derived(
    (layout?.aggregates.length ?? 0) > 0 || expandedAggregates.size > 0
  );

  // Zoom level as percentage (100% = fit to layout)
  let zoomPercent = $derived.by(() => {
    if (!layout) return 100;
    return Math.round((layout.width / viewBox.w) * 100);
  });

  function zoomTo(percent: number) {
    if (!layout) return;
    const scale = 100 / percent;
    const newW = layout.width * scale;
    const newH = layout.height * scale;
    const dx = (newW - viewBox.w) / 2;
    const dy = (newH - viewBox.h) / 2;
    viewBox = { x: viewBox.x - dx, y: viewBox.y - dy, w: newW, h: newH };
  }

  function zoomIn() {
    zoomTo(Math.min(zoomPercent + 15, 300));
  }

  function zoomOut() {
    zoomTo(Math.max(zoomPercent - 15, 25));
  }

  function zoomReset() {
    if (!layout) return;
    viewBox = { x: 0, y: 0, w: layout.width, h: layout.height };
  }
</script>

<div class="graph-container">
  {#if !layout}
    <div class="empty-state">
      <svg class="empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="16" cy="16" r="6" stroke="var(--p-ink4)" stroke-width="1.5" />
        <circle cx="32" cy="16" r="6" stroke="var(--p-ink4)" stroke-width="1.5" />
        <circle cx="24" cy="36" r="6" stroke="var(--p-ink4)" stroke-width="1.5" />
        <line x1="20" y1="20" x2="22" y2="32" stroke="var(--p-ink4)" stroke-width="1" />
        <line x1="28" y1="20" x2="26" y2="32" stroke="var(--p-ink4)" stroke-width="1" />
      </svg>
      <p class="empty-title">Kjør en analyse for å se grafen</p>
      <p class="empty-desc">Legg til bestemmelser i venstrepanelet og start søket.</p>
    </div>
  {:else}
    <!-- Toolbar overlay -->
    {#if hasAggregation}
      <div class="graph-toolbar">
        <button class="reorganise-btn" onclick={reorganise} title="Fjern alle pins og re-aggreger">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 7a6 6 0 0111.2-3M13 7a6 6 0 01-11.2 3"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M12.2 1v3h-3M1.8 13v-3h3"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Reorganiser
        </button>
      </div>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      class="graph-svg"
      bind:this={svgEl}
      viewBox="{viewBox.x} {viewBox.y} {viewBox.w} {viewBox.h}"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="var(--p-ink)" opacity="0.2" />
        </marker>
        <marker
          id="arrowhead-warn"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill="var(--p-warn)" />
        </marker>
        <marker
          id="arrowhead-danger"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill="var(--p-danger)" />
        </marker>
      </defs>

      <!-- Layer labels -->
      {#each layerLabels as layer}
        <text x={viewBox.x + 12} y={layer.minY - 20} class="layer-label" fill="var(--p-ink4)"
          >{layer.label}</text
        >
      {/each}

      <!-- Gap lines -->
      {#each gapLines as gap}
        <line x1={gap.from.x} y1={gap.from.y} x2={gap.to.x} y2={gap.to.y} class="gap-line" />
        <text x={(gap.from.x + gap.to.x) / 2} y={(gap.from.y + gap.to.y) / 2 - 4} class="gap-label"
          >∅</text
        >
      {/each}

      <!-- Edges -->
      {#each layout.edges as edge}
        {@const valence = (edgeValenceMap.get(`${edge.from}→${edge.to}`) ??
          'unknown') as import('$lib/types/graph').Valence}
        {@const fromNode = nodeMap.get(edge.from)}
        {@const toNode = nodeMap.get(edge.to)}
        {@const dimmed = (fromNode && isDimmed(fromNode)) || (toNode && isDimmed(toNode))}
        {@const highlighted = selectedEdgeKeys.has(`${edge.from}→${edge.to}`)}
        <GraphEdge points={edge.points} {valence} {dimmed} {highlighted} />
      {/each}

      <!-- Aggregate nodes -->
      {#each layout.aggregates as agg (agg.id)}
        {@const pos = layout.nodes.get(agg.id)}
        {#if pos}
          <AggregateNode
            aggregate={agg}
            x={pos.x}
            y={pos.y}
            width={pos.width}
            height={pos.height}
            dimmed={isAggregateDimmed(agg)}
            onclick={() => expandAggregate(agg)}
          />
        {/if}
      {/each}

      <!-- Real nodes (visible ones only) -->
      {#each analysisState.nodes as node (node.id)}
        {#if visibleNodeIds.has(node.id)}
          {@const pos = layout.nodes.get(node.id)}
          {#if pos}
            <g class:fade-in={newlyExpandedNodes.has(node.id)}>
              <GraphNode
                {node}
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                selected={uiState.selectedNodeId === node.id}
                dimmed={isDimmed(node)}
                readStatus={!!analysisState.analysis.readStatus[node.id]}
                onclick={() => uiState.selectNode(node.id)}
                onmouseenter={(e) => handleNodeHover(node, e)}
                onmouseleave={handleNodeLeave}
              />
            </g>
          {/if}
        {/if}
      {/each}
    </svg>

    <GraphTooltip node={tooltipNode} x={tooltipPos.x} y={tooltipPos.y} />
    <GraphLegend />

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button class="zoom-btn" onclick={zoomIn} title="Zoom inn">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line
            x1="7"
            y1="3"
            x2="7"
            y2="11"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <line
            x1="3"
            y1="7"
            x2="11"
            y2="7"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <input
        type="range"
        class="zoom-slider"
        min="25"
        max="300"
        value={zoomPercent}
        oninput={(e) => zoomTo(parseInt(e.currentTarget.value))}
        title="{zoomPercent}%"
      />
      <button class="zoom-btn" onclick={zoomOut} title="Zoom ut">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line
            x1="3"
            y1="7"
            x2="11"
            y2="7"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button class="zoom-btn zoom-reset" onclick={zoomReset} title="Tilpass">
        {zoomPercent}%
      </button>
    </div>
  {/if}
</div>

<style>
  .graph-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--p-bg);
  }
  .graph-svg {
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  .graph-svg:active {
    cursor: grabbing;
  }
  .layer-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .gap-line {
    stroke: var(--p-gap);
    stroke-width: 1.5;
    stroke-dasharray: 4, 3;
    opacity: 0.35;
  }
  .gap-label {
    font-size: 11px;
    fill: var(--p-gap);
    text-anchor: middle;
    font-weight: 600;
  }

  /* Fade-in animation for newly expanded nodes */
  .fade-in {
    animation: nodesFadeIn 0.4s ease-out;
  }
  @keyframes nodesFadeIn {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Graph toolbar */
  .graph-toolbar {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    display: flex;
    gap: 6px;
  }
  .reorganise-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-ui);
    color: var(--p-ink2);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  @media (hover: hover) {
    .reorganise-btn:hover {
      color: var(--p-ink);
      border-color: var(--p-ink3);
      background: var(--p-bg);
    }
  }

  /* Zoom controls */
  .zoom-controls {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--p-panel);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-lg);
    padding: 4px 6px;
  }
  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--p-ink3);
    cursor: pointer;
    font-family: var(--font-data);
    font-size: 10px;
    transition: all 0.12s ease;
  }
  @media (hover: hover) {
    .zoom-btn:hover {
      color: var(--p-ink);
      background: var(--p-surface);
      border-color: var(--p-border);
    }
  }
  .zoom-reset {
    width: auto;
    padding: 0 6px;
    font-weight: 500;
  }
  .zoom-slider {
    width: 80px;
    height: 4px;
    accent-color: var(--p-ink3);
    cursor: pointer;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
  }
  .empty-icon {
    opacity: 0.5;
    margin-bottom: 4px;
  }
  .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .empty-desc {
    font-size: 12px;
    color: var(--p-ink3);
  }

  @media (max-width: 768px) {
    .zoom-slider {
      display: none;
    }
    .zoom-controls {
      bottom: 8px;
      right: 8px;
    }
  }
</style>
