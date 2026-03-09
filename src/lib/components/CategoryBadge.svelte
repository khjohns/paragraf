<script lang="ts">
	import type { Category } from '$lib/types/graph';

	let { category, small = false }: { category: Category; small?: boolean } = $props();
</script>

<span
	class="badge cat-{category.toLowerCase()}"
	class:small
>{category}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
		font-family: var(--font-data);
		flex-shrink: 0;
	}
	.badge.small {
		padding: 1px 4px;
		font-size: 10px;
	}
	.cat-a { background: rgba(26,24,20,0.08); color: var(--p-ink); }
	.cat-b { background: rgba(26,24,20,0.05); color: var(--p-ink2); }
	.cat-c { background: rgba(26,24,20,0.03); color: var(--p-ink3); }
</style>
