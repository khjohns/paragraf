<script lang="ts">
	import type { Valence } from '$lib/types/graph';

	let { valence, size = 10 }: { valence: Valence; size?: number } = $props();

	const cfg: Record<string, { icon: string; label: string; colorVar: string; bgVar: string }> = {
		confirming: { icon: '✓', label: 'Bekreftende', colorVar: '--p-success', bgVar: '--p-success-bg' },
		distinguishing: { icon: '↔', label: 'Avgrensende', colorVar: '--p-warn', bgVar: '--p-warn-bg' },
		departing: { icon: '✕', label: 'Fravikende', colorVar: '--p-danger', bgVar: '--p-danger-bg' },
	};

	let config = $derived(cfg[valence]);
</script>

{#if config}
	<span
		class="pip"
		title={config.label}
		style:width="{size + 6}px"
		style:height="{size + 4}px"
		style:font-size="{size - 1}px"
		style:color="var({config.colorVar})"
		style:background="var({config.bgVar})"
	>{config.icon}</span>
{/if}

<style>
	.pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		font-weight: 700;
		flex-shrink: 0;
	}
</style>
