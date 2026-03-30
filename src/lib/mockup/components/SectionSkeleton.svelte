<script lang="ts">
  import { Loader2 } from 'lucide-svelte';

  let { label }: { label: string } = $props();
</script>

<div class="skeleton">
  <Loader2 size={10} class="spinner" />
  <span class="skeleton-label">{label}</span>
</div>

<style>
  .skeleton {
    border-bottom: 1px solid var(--border-subtle);
    padding: 14px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .skeleton :global(.spinner) {
    color: var(--ai-accent);
    flex-shrink: 0;
    animation: spin 1.2s linear infinite;
  }

  .skeleton-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
