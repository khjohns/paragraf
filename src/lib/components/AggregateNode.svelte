<script lang="ts">
	import type { AggregateNode } from '$lib/types/graph';

	let {
		aggregate,
		x,
		y,
		width,
		height,
		dimmed = false,
		onclick,
		onmouseenter,
		onmouseleave,
	}: {
		aggregate: AggregateNode;
		x: number;
		y: number;
		width: number;
		height: number;
		dimmed?: boolean;
		onclick?: (e: MouseEvent) => void;
		onmouseenter?: (e: MouseEvent) => void;
		onmouseleave?: (e: MouseEvent) => void;
	} = $props();

	const typeLabels: Record<string, string> = {
		kofa_case: 'KOFA-saker',
		eu_case: 'EU-dommer',
		court_case: 'Rettsavgjørelser',
		prep_work: 'Forarbeider',
	};

	let label = $derived(`${aggregate.totalCount} ${typeLabels[aggregate.type] ?? 'noder'}`);

	let categoryBreakdown = $derived.by(() => {
		const parts: string[] = [];
		if (aggregate.countA > 0) parts.push(`A: ${aggregate.countA}`);
		if (aggregate.countB > 0) parts.push(`B: ${aggregate.countB}`);
		if (aggregate.countC > 0) parts.push(`C: ${aggregate.countC}`);
		return parts.join('  ');
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
	transform="translate({x},{y})"
	opacity={dimmed ? 0.2 : 1}
	{onclick}
	{onmouseenter}
	{onmouseleave}
	style="cursor: pointer"
	class="aggregate-group"
>
	<!-- Dashed border box -->
	<rect
		x={-width / 2}
		y={-height / 2}
		{width}
		{height}
		rx={6}
		fill="var(--p-bg)"
		stroke="var(--p-ink3)"
		stroke-width={1.5}
		stroke-dasharray="5,3"
	/>

	<!-- Count label -->
	<text
		x={0}
		y={categoryBreakdown ? -4 : 0}
		text-anchor="middle"
		dominant-baseline="central"
		class="agg-label"
	>{label}</text>

	<!-- Category breakdown -->
	{#if categoryBreakdown}
		<text
			x={0}
			y={10}
			text-anchor="middle"
			dominant-baseline="central"
			class="agg-breakdown"
		>{categoryBreakdown}</text>
	{/if}

	<!-- Expand hint icon (small +) -->
	<circle
		cx={width / 2 - 10}
		cy={-height / 2 + 10}
		r={7}
		fill="var(--p-kofa-accent)"
		opacity={0.15}
	/>
	<text
		x={width / 2 - 10}
		y={-height / 2 + 10}
		text-anchor="middle"
		dominant-baseline="central"
		class="expand-icon"
	>+</text>
</g>

<style>
	.aggregate-group:hover rect {
		stroke: var(--p-kofa-accent);
		fill: var(--p-kofa-bg);
	}
	.agg-label {
		font-family: var(--font-data);
		font-weight: 600;
		font-size: 11px;
		fill: var(--p-ink2);
	}
	.agg-breakdown {
		font-family: var(--font-data);
		font-size: 9px;
		fill: var(--p-ink3);
	}
	.expand-icon {
		font-family: var(--font-data);
		font-weight: 700;
		font-size: 10px;
		fill: var(--p-kofa-accent);
	}
</style>
