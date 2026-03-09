<script lang="ts">
	import { analysisState } from '$lib/stores/analysis.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import { computeLayout } from '$lib/utils/layout';
	import GraphNode from './GraphNode.svelte';
	import GraphEdge from './GraphEdge.svelte';
	import GraphTooltip from './GraphTooltip.svelte';
	import GraphLegend from './GraphLegend.svelte';
	import { onMount } from 'svelte';
	import type { GraphNode as GNode } from '$lib/types/graph';

	// Compute layout reactively
	let layout = $derived.by(() => {
		if (analysisState.nodes.length === 0) return null;
		return computeLayout(analysisState.nodes, analysisState.edges);
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
	let nodeMap = $derived(new Map(analysisState.nodes.map(n => [n.id, n])));

	// Dimming: regulation filter
	function isDimmed(node: GNode): boolean {
		if (uiState.regulationFilter && node.regulation === 'old') return true;
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
	let svgEl: SVGSVGElement;
	onMount(() => {
		if (!svgEl) return;
		svgEl.addEventListener('wheel', handleWheel, { passive: false });
		return () => svgEl.removeEventListener('wheel', handleWheel);
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
			.filter(g => g.count === 0)
			.map(g => {
				const p1 = layout!.nodes.get(g.provision1);
				const p2 = layout!.nodes.get(g.provision2);
				if (!p1 || !p2) return null;
				return { from: p1, to: p2, label: '∅' };
			})
			.filter(Boolean) as Array<{ from: { x: number; y: number }; to: { x: number; y: number }; label: string }>;
	});

	// Layer labels
	let layerLabels = $derived.by(() => {
		if (!layout) return [];
		const layers: Record<string, { label: string; minY: number }> = {};
		for (const node of analysisState.nodes) {
			const pos = layout!.nodes.get(node.id);
			if (!pos) continue;
			let layerKey: string;
			if (node.type === 'provision') layerKey = 'BESTEMMELSER';
			else if (node.type === 'kofa_case') layerKey = 'PRAKSIS';
			else layerKey = 'EU / FORARBEIDER';

			if (!layers[layerKey] || pos.y < layers[layerKey].minY) {
				layers[layerKey] = { label: layerKey, minY: pos.y };
			}
		}
		return Object.values(layers).sort((a, b) => a.minY - b.minY);
	});
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
				<marker id="arrowhead-warn" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
					<path d="M0,0 L8,3 L0,6" fill="var(--p-warn)" />
				</marker>
				<marker id="arrowhead-danger" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
					<path d="M0,0 L8,3 L0,6" fill="var(--p-danger)" />
				</marker>
			</defs>

			<!-- Layer labels -->
			{#each layerLabels as layer}
				<text
					x={viewBox.x + 12}
					y={layer.minY - 20}
					class="layer-label"
					fill="var(--p-ink4)"
				>{layer.label}</text>
			{/each}

			<!-- Gap lines -->
			{#each gapLines as gap}
				<line
					x1={gap.from.x} y1={gap.from.y}
					x2={gap.to.x} y2={gap.to.y}
					class="gap-line"
				/>
				<text
					x={(gap.from.x + gap.to.x) / 2}
					y={(gap.from.y + gap.to.y) / 2 - 4}
					class="gap-label"
				>∅</text>
			{/each}

			<!-- Edges -->
			{#each layout.edges as edge}
				{@const valence = edgeValenceMap.get(`${edge.from}→${edge.to}`) ?? 'unknown'}
				{@const fromNode = nodeMap.get(edge.from)}
				{@const toNode = nodeMap.get(edge.to)}
				{@const dimmed = (fromNode && isDimmed(fromNode)) || (toNode && isDimmed(toNode))}
				<GraphEdge points={edge.points} {valence} {dimmed} />
			{/each}

			<!-- Nodes -->
			{#each analysisState.nodes as node (node.id)}
				{@const pos = layout.nodes.get(node.id)}
				{#if pos}
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
				{/if}
			{/each}
		</svg>

		<GraphTooltip node={tooltipNode} x={tooltipPos.x} y={tooltipPos.y} />
		<GraphLegend />
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
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.gap-line {
		stroke: var(--p-gap);
		stroke-width: 1.5;
		stroke-dasharray: 4,3;
		opacity: 0.35;
	}
	.gap-label {
		font-size: 11px;
		fill: var(--p-gap);
		text-anchor: middle;
		font-weight: 600;
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
</style>
