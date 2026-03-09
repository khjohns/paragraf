<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="delim-badge" class:compact>
	<svg width="10" height="10" viewBox="0 0 10 10">
		<circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
		<line x1="3" y1="3" x2="7" y2="7" stroke="currentColor" stroke-width="1.2"/>
	</svg>
	{compact ? 'Avgr.' : 'Avgrensning'}
</span>

<style>
	.delim-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 3px;
		background: var(--p-delim-bg);
		color: var(--p-delim);
		border: 1px solid rgba(196,101,10,0.12);
		flex-shrink: 0;
	}
	.compact {
		padding: 1px 5px;
		border: none;
	}
</style>
