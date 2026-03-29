<script lang="ts">
  import { onMount } from 'svelte';
  import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceRadial } from 'd3-force';
  import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
  import { select } from 'd3-selection';
  import GraphToolbar from './GraphToolbar.svelte';
  import GraphDetailPanel from './GraphDetailPanel.svelte';
  import GraphLegend from './GraphLegend.svelte';
  import NodeTooltip from './NodeTooltip.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import {
    ALL_NODES,
    ALL_EDGES,
    CASE_NODES,
    PROVISION_NODES,
    CASE_CITATIONS,
    PROVISION_REFS,
    MARK_COLORS,
    getDotRadius,
    getCatRadius,
    getConnectedIds,
    type GraphNode,
    type CaseNode,
    type GraphEdge,
  } from '$lib/mockup/data/graf';

  type CatKey = 'all' | 'null' | 'A' | 'B' | 'C';

  let {
    isScopeOpen = false,
    onRequestCloseScope,
  }: {
    isScopeOpen?: boolean;
    onRequestCloseScope?: () => void;
  } = $props();

  // ── State ──
  let hoveredId = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let showProvisions = $state(true);
  let activeCats = $state<CatKey[]>([]);
  let legendOpen = $state(true);
  let nodeMarks = $state<Record<string, string>>({});
  let contextMenu = $state<{ nodeId: string; x: number; y: number } | null>(null);
  let tooltipInfo = $state<{ nodeId: string; x: number; y: number; text: string; ref: string } | null>(null);
  let animating = $state(false);

  // ── Refs ──
  let svgEl: SVGSVGElement;
  let gEl: SVGGElement;
  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLDivElement;
  let zoomBehavior: ReturnType<typeof d3zoom> | null = null;
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  let currentTransform = { k: 1, x: 0, y: 0 };

  // ── Positions ──
  let positions = $state<Record<string, { x: number; y: number }>>({});
  let prevPositions: Record<string, { x: number; y: number }> = {};
  let animFrameId: number | null = null;

  // ── Derived ──
  let visibleNodeIds = $derived.by(() => {
    const ids = new Set<string>();
    ALL_NODES.forEach((n) => {
      if (n.type === 'provision') {
        if (showProvisions) ids.add(n.id);
        return;
      }
      if (activeCats.length === 0) {
        ids.add(n.id);
      } else {
        const ck = n.category === null ? 'null' : n.category;
        if (activeCats.includes(ck as CatKey)) ids.add(n.id);
      }
    });
    return ids;
  });

  let visibleEdges = $derived(
    ALL_EDGES.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
  );

  let isolatedIds = $derived.by(() => {
    const connected = new Set<string>();
    visibleEdges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const iso = new Set<string>();
    visibleNodeIds.forEach((id) => {
      const n = ALL_NODES.find((x) => x.id === id);
      if (n && n.type === 'case' && !connected.has(id)) iso.add(id);
    });
    return iso;
  });

  let selectedNode = $derived(selectedId ? ALL_NODES.find((n) => n.id === selectedId) ?? null : null);
  let caseCount = $derived(CASE_NODES.filter((n) => visibleNodeIds.has(n.id)).length);
  let provCount = $derived(PROVISION_NODES.filter((n) => visibleNodeIds.has(n.id)).length);

  // ── Simulation ──
  function runSimulation(visIds: Set<string>): Record<string, { x: number; y: number }> {
    const cx = 500, cy = 400;
    const nodes = ALL_NODES.filter((n) => visIds.has(n.id)).map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
    }));
    const links = ALL_EDGES
      .filter((e) => visIds.has(e.source) && visIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const nc = nodes.length;
    const charge = nc > 15 ? -280 : nc > 8 ? -350 : -420;
    const linkDist = nc > 15 ? 80 : 95;

    const sim = forceSimulation(nodes as any)
      .force('link', forceLink(links).id((d: any) => d.id).distance(linkDist).strength(0.35))
      .force('charge', forceManyBody().strength(charge).distanceMax(500))
      .force('center', forceCenter(cx, cy).strength(0.04))
      .force('collide', forceCollide().radius((d: any) => d.type === 'provision' ? 50 : 45).strength(0.6))
      .force('radial', forceRadial((d: any) => getCatRadius(d), cx, cy).strength((d: any) => d.type === 'provision' ? 0.02 : 0.05))
      // FUTURE: Kronologisk akse — legg til .force('timeX', forceX(...)) her
      // når "Tid"-toggle er aktiv. Se paragraf-graf-v4.jsx for parametre.
      .alpha(1)
      .alphaDecay(0.025);

    for (let i = 0; i < 350; i++) sim.tick();
    sim.stop();

    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n: any) => { pos[n.id] = { x: n.x, y: n.y }; });
    return pos;
  }

  function updatePositions(newPos: Record<string, { x: number; y: number }>, animate: boolean) {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);

    if (animate && Object.keys(prevPositions).length > 0) {
      animating = true;
      const startPos = { ...prevPositions };
      const endPos = newPos;
      const duration = 500;
      const t0 = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        // cubicInOut easing
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const interp: Record<string, { x: number; y: number }> = {};
        for (const id of Object.keys(endPos)) {
          const s = startPos[id] || endPos[id];
          interp[id] = {
            x: s.x + (endPos[id].x - s.x) * ease,
            y: s.y + (endPos[id].y - s.y) * ease,
          };
        }
        // Keep disappearing nodes at their last position
        for (const id of Object.keys(startPos)) {
          if (!endPos[id]) interp[id] = startPos[id];
        }
        positions = interp;
        if (t < 1) {
          animFrameId = requestAnimationFrame(step);
        } else {
          animating = false;
          prevPositions = endPos;
          animFrameId = null;
          requestAnimationFrame(() => fitView());
        }
      };
      animFrameId = requestAnimationFrame(step);
    } else {
      positions = newPos;
      prevPositions = newPos;
      requestAnimationFrame(() => fitView());
    }
  }

  function getPos(id: string): { x: number; y: number } | null {
    return positions[id] ?? null;
  }

  // ── Filter change triggers re-simulation ──
  let prevVisKey = '';
  $effect(() => {
    const key = [...visibleNodeIds].sort().join(',');
    if (key !== prevVisKey) {
      const animate = prevVisKey !== '';
      prevVisKey = key;
      const newPos = runSimulation(visibleNodeIds);
      updatePositions(newPos, animate);
    }
  });

  // ── Canvas edge rendering ──
  let edgeColors = { color: 'rgba(28,27,26,0.10)', cite: 'rgba(28,27,26,0.18)', highlight: 'rgba(28,27,26,0.40)' };

  function updateEdgeColors() {
    if (!canvasEl) return;
    const style = getComputedStyle(canvasEl);
    edgeColors = {
      color: style.getPropertyValue('--edge-color').trim() || edgeColors.color,
      cite: style.getPropertyValue('--edge-cite').trim() || edgeColors.cite,
      highlight: style.getPropertyValue('--edge-highlight').trim() || edgeColors.highlight,
    };
  }

  function drawEdges() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(currentTransform.x, currentTransform.y);
    ctx.scale(currentTransform.k, currentTransform.k);

    for (const e of visibleEdges) {
      const sp = getPos(e.source);
      const tp = getPos(e.target);
      if (!sp || !tp) continue;

      const isHovered = hoveredId && (e.source === hoveredId || e.target === hoveredId);
      const isDimmed = hoveredId && !isHovered;
      const isCitation = e.edgeType === 'citation';

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tp.x, tp.y);

      if (isDimmed) {
        ctx.globalAlpha = 0.04;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.lineWidth = isHovered ? 1.5 : 1;

      if (isHovered) {
        ctx.strokeStyle = edgeColors.highlight;
      } else if (isCitation) {
        ctx.strokeStyle = edgeColors.cite;
      } else {
        ctx.strokeStyle = edgeColors.color;
      }

      if (!isCitation) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // Animation frame loop for canvas
  let rafId: number;
  let frameCount = 0;
  function renderLoop() {
    // Refresh CSS colors every ~60 frames (1s) to catch dark mode changes
    if (frameCount++ % 60 === 0) updateEdgeColors();
    drawEdges();
    rafId = requestAnimationFrame(renderLoop);
  }

  // ── Zoom ──
  function setupZoom() {
    if (!svgEl || !gEl) return;
    const svg = select(svgEl);
    const behavior = d3zoom()
      .scaleExtent([0.15, 3])
      .filter((e: any) => {
        if (e.type === 'wheel') return true;
        if ((e.type === 'mousedown' || e.type === 'touchstart') && e.target.closest('.graph-node')) return false;
        return true;
      })
      .on('zoom', (e: any) => {
        gEl.setAttribute('transform', e.transform.toString());
        currentTransform = { k: e.transform.k, x: e.transform.x, y: e.transform.y };
      });

    svg.call(behavior as any);
    zoomBehavior = behavior;
  }

  function fitView() {
    if (!svgEl || !gEl || !zoomBehavior) return;
    const bb = gEl.getBBox();
    if (!bb.width) return;
    const W = svgEl.clientWidth;
    const H = svgEl.clientHeight;
    const pad = 80;
    const s = Math.min((W - pad * 2) / bb.width, (H - pad * 2) / bb.height, 1.4);
    const tx = W / 2 - s * (bb.x + bb.width / 2);
    const ty = H / 2 - s * (bb.y + bb.height / 2);
    select(svgEl)
      .transition()
      .duration(400)
      .call(zoomBehavior!.transform as any, zoomIdentity.translate(tx, ty).scale(s));
  }

  function zoomIn() {
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(250).call(zoomBehavior.scaleBy as any, 1.4);
  }

  function zoomOut() {
    if (!svgEl || !zoomBehavior) return;
    select(svgEl).transition().duration(250).call(zoomBehavior.scaleBy as any, 0.7);
  }

  // ── Resize canvas ──
  function resizeCanvas() {
    if (!canvasEl || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    canvasEl.width = rect.width * window.devicePixelRatio;
    canvasEl.height = rect.height * window.devicePixelRatio;
    canvasEl.style.width = rect.width + 'px';
    canvasEl.style.height = rect.height + 'px';
    const ctx = canvasEl.getContext('2d');
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  // ── Interactions ──
  function toggleCat(cat: CatKey) {
    if (cat === 'all') {
      activeCats = [];
      return;
    }
    const has = activeCats.includes(cat);
    const next = has ? activeCats.filter((c) => c !== cat) : [...activeCats, cat];
    activeCats = next.length === 4 ? [] : next;
  }

  function handleNodeClick(nodeId: string, e: MouseEvent) {
    e.stopPropagation();
    selectedId = selectedId === nodeId ? null : nodeId;
    contextMenu = null;
    // Panel model: node selection closes scope
    if (selectedId && isScopeOpen) onRequestCloseScope?.();
  }

  // Panel model: scope opening deselects node
  $effect(() => {
    if (isScopeOpen && selectedId) {
      selectedId = null;
    }
  });

  function handleContextMenu(nodeId: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const n = ALL_NODES.find((x) => x.id === nodeId);
    if (!n || n.type !== 'case') return;
    contextMenu = { nodeId, x: e.clientX, y: e.clientY };
  }

  function handleBackgroundClick() {
    selectedId = null;
    contextMenu = null;
  }

  function showTooltipDelayed(nodeId: string, svgX: number, svgY: number) {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      const n = ALL_NODES.find((x) => x.id === nodeId);
      if (!n || n.type !== 'case' || !n.proposition) return;
      if (!svgEl || !gEl) return;
      const ctm = gEl.getCTM();
      if (!ctm) return;
      const pt = svgEl.createSVGPoint();
      pt.x = svgX;
      pt.y = svgY;
      const screen = pt.matrixTransform(ctm);
      const rect = svgEl.getBoundingClientRect();
      tooltipInfo = {
        nodeId,
        x: rect.left + screen.x,
        y: rect.top + screen.y,
        text: n.proposition,
        ref: n.ref,
      };
    }, 400);
  }

  function hideTooltip() {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipInfo = null;
  }

  function applyMark(colorId: string) {
    if (!contextMenu) return;
    const nid = contextMenu.nodeId;
    if (colorId === 'none') {
      const next = { ...nodeMarks };
      delete next[nid];
      nodeMarks = next;
    } else {
      nodeMarks = { ...nodeMarks, [nid]: colorId };
    }
    contextMenu = null;
  }

  // Close context menu on outside click
  $effect(() => {
    if (!contextMenu) return;
    const handler = () => { contextMenu = null; };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  // ── Lifecycle ──
  onMount(() => {
    setupZoom();
    resizeCanvas();
    renderLoop();

    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerEl) ro.observe(containerEl);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  });

  // Helper for node rendering
  function getNodeOpacity(n: GraphNode, isDim: boolean): number {
    const markHex = nodeMarks[n.id] ? MARK_COLORS.find((c) => c.id === nodeMarks[n.id])?.hex : null;
    if (isDim) return 0.08;
    if (n.type === 'case') {
      if (n.category === 'C' && !markHex) return 0.4;
      if (isolatedIds.has(n.id) && !markHex) return 0.5;
    }
    return 1;
  }
</script>

<div class="graph-container">
  <GraphToolbar
    {activeCats}
    {showProvisions}
    {caseCount}
    {provCount}
    isolatedCount={isolatedIds.size}
    onToggleCat={toggleCat}
    onToggleProvisions={() => (showProvisions = !showProvisions)}
    onZoomIn={zoomIn}
    onZoomOut={zoomOut}
    onFitView={fitView}
  />

  <div class="graph-area" bind:this={containerEl}>
    <!-- Canvas for edges -->
    <canvas class="edge-canvas" bind:this={canvasEl}></canvas>

    <!-- SVG for nodes + zoom -->
    <svg
      bind:this={svgEl}
      class="graph-svg"
      onclick={handleBackgroundClick}
      onmousedown={(e) => { if (!(e.target as Element).closest('.graph-node')) svgEl.style.cursor = 'grabbing'; }}
      onmouseup={() => { svgEl.style.cursor = 'grab'; }}
    >
      <g bind:this={gEl}>
        {#each ALL_NODES as n (n.id)}
          {#if visibleNodeIds.has(n.id)}
            {@const pos = getPos(n.id)}
            {#if pos}
              {@const isHov = hoveredId === n.id}
              {@const isSel = selectedId === n.id}
              {@const connIds = hoveredId ? getConnectedIds(hoveredId) : new Set<string>()}
              {@const isDim = !!hoveredId && hoveredId !== n.id && !connIds.has(n.id)}
              {@const markColorId = nodeMarks[n.id]}
              {@const markHex = markColorId ? (MARK_COLORS.find((c) => c.id === markColorId)?.hex ?? null) : null}

              {#if n.type === 'case'}
                {@const r = getDotRadius(n)}
                {@const catFill = n.category === 'A' ? 'var(--ink)' : 'var(--paper)'}
                {@const catStroke = n.category === 'A' ? 'var(--ink)' : n.category === 'B' ? 'var(--border-strong)' : n.category === 'C' ? 'var(--border)' : 'var(--ink-muted)'}
                {@const catDash = n.category === null ? '2 2' : 'none'}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                  class="graph-node"
                  transform="translate({pos.x},{pos.y})"
                  onclick={(e) => handleNodeClick(n.id, e)}
                  oncontextmenu={(e) => handleContextMenu(n.id, e)}
                  onmouseenter={() => { hoveredId = n.id; showTooltipDelayed(n.id, pos.x, pos.y - 20); }}
                  onmouseleave={() => { hoveredId = null; hideTooltip(); }}
                  style="opacity:{getNodeOpacity(n, isDim)};transition:{animating ? 'none' : 'opacity 0.2s ease'}"
                >
                  <!-- Hit area -->
                  <rect x={-r - 6} y={-r - 6} width={170} height={r * 2 + 36} fill="transparent" />

                  <!-- Selection ring -->
                  {#if isSel}
                    <circle cx={0} cy={0} r={r + 5} fill="none" stroke="var(--ink)" stroke-width={1.5} stroke-dasharray="3 2" />
                  {/if}

                  <!-- User mark ring -->
                  {#if markHex}
                    <circle cx={0} cy={0} r={r + 3} fill="none" stroke={markHex} stroke-width={2.5} />
                  {/if}

                  <!-- Node dot -->
                  <circle
                    cx={0} cy={0} r={r}
                    fill={catFill}
                    stroke={catStroke}
                    stroke-width={n.category === 'A' ? 0 : 1.5}
                    stroke-dasharray={catDash}
                  />

                  <!-- Star -->
                  {#if n.star}
                    <text x={r + 3} y={-r + 2} class="star-text">&starf;</text>
                  {/if}

                  <!-- Signal dots -->
                  {#each n.signals as sig, si}
                    {@const sc = sig === 'R' ? 'var(--ink-muted)' : sig === 'F' ? 'var(--signal-fts)' : 'var(--ai-accent)'}
                    <circle cx={-r + si * 7} cy={r + 10} r={2.5} fill={sc} opacity={0.7} />
                  {/each}

                  <!-- Ref label -->
                  <text x={r + 8} y={-1} class="node-ref" class:highlight={isHov || isSel}>{n.ref}</text>

                  <!-- Source/year -->
                  <text x={r + 8} y={11} class="node-meta">{n.source} &middot; {n.year}</text>

                  <!-- Citation count -->
                  {#if n.citedBy > 0}
                    <text x={0} y={r + 24} text-anchor="middle" class="node-cite">&nearr;{n.citedBy}</text>
                  {/if}

                  <!-- Isolated indicator -->
                  {#if isolatedIds.has(n.id)}
                    <text x={r + 8} y={23} class="node-isolated">isolert</text>
                  {/if}
                </g>
              {:else}
                <!-- Provision node -->
                {@const lw = n.ref.length * 7.2 + 20}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                  class="graph-node"
                  transform="translate({pos.x},{pos.y})"
                  onclick={(e) => handleNodeClick(n.id, e)}
                  onmouseenter={() => { hoveredId = n.id; }}
                  onmouseleave={() => { hoveredId = null; }}
                  style="opacity:{isDim ? 0.08 : 1};transition:{animating ? 'none' : 'opacity 0.2s ease'}"
                >
                  <!-- Selection ring -->
                  {#if isSel}
                    <rect x={-lw / 2 - 4} y={-15} width={lw + 8} height={28} fill="none" stroke="var(--ink)" stroke-width={1.5} stroke-dasharray="3 2" rx={3} />
                  {/if}

                  <!-- Box -->
                  <rect
                    x={-lw / 2} y={-11} width={lw} height={22}
                    fill="var(--paper-dark)"
                    stroke={isHov || isSel ? 'var(--border-strong)' : 'var(--border)'}
                    stroke-width={1} rx={2}
                    style="transition:stroke 0.15s ease"
                  />

                  <!-- Square marker -->
                  <rect x={-lw / 2 + 6} y={-3} width={5} height={5} fill="var(--border-strong)" rx={1} />

                  <!-- Label -->
                  <text x={-lw / 2 + 16} y={3} class="prov-label" class:highlight={isHov || isSel}>{n.ref}</text>
                </g>
              {/if}
            {/if}
          {/if}
        {/each}
      </g>
    </svg>

    <!-- Tooltip -->
    {#if tooltipInfo && !selectedId}
      <NodeTooltip x={tooltipInfo.x} y={tooltipInfo.y} ref={tooltipInfo.ref} text={tooltipInfo.text} />
    {/if}

    <!-- Context menu -->
    {#if contextMenu}
      <ColorPicker
        x={contextMenu.x}
        y={contextMenu.y}
        currentMark={nodeMarks[contextMenu.nodeId] ?? ''}
        onApply={applyMark}
      />
    {/if}

    <!-- Legend -->
    <GraphLegend {nodeMarks} />
  </div>

  <!-- Detail panel -->
  {#if selectedNode}
    {#key selectedNode.id}
      <GraphDetailPanel
        {selectedNode}
        {isolatedIds}
        {nodeMarks}
        onSelectNode={(id) => { selectedId = id; }}
        onClose={() => { selectedId = null; }}
      />
    {/key}
  {/if}
</div>

<style>
  .graph-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .graph-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .edge-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .graph-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .graph-node {
    cursor: pointer;
  }

  .star-text {
    font-size: 8px;
    fill: var(--gold-star);
    font-family: sans-serif;
  }

  .node-ref {
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono);
    fill: var(--ink-secondary);
    transition: fill 0.15s ease;
  }

  .node-ref.highlight {
    fill: var(--ink);
  }

  .node-meta {
    font-size: 10px;
    font-family: var(--font-sans);
    fill: var(--ink-muted);
  }

  .node-cite {
    font-size: 8px;
    font-weight: 600;
    font-family: var(--font-mono);
    fill: var(--ink-muted);
  }

  .node-isolated {
    font-size: 9px;
    font-family: var(--font-sans);
    fill: var(--ink-muted);
    font-style: italic;
  }

  .prov-label {
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-mono);
    fill: var(--ink-tertiary);
    transition: fill 0.15s ease;
  }

  .prov-label.highlight {
    fill: var(--ink);
  }
</style>
