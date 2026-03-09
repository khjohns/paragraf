<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toastState } from '$lib/stores/toast.svelte';
</script>

<div class="toast-container">
	{#each toastState.toasts as toast (toast.id)}
		<div class="toast {toast.type}" transition:fly={{ y: 20, duration: 200 }}>
			{toast.message}
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 200;
		pointer-events: none;
	}

	.toast {
		background: var(--p-surface);
		border: 1px solid var(--p-border);
		border-radius: 6px;
		padding: 8px 14px;
		font-size: 12px;
		color: var(--p-ink2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		white-space: nowrap;
	}

	.toast.success {
		color: var(--p-success);
		border-left: 3px solid var(--p-success);
	}

	.toast.error {
		color: var(--p-danger);
		border-left: 3px solid var(--p-danger);
	}
</style>
