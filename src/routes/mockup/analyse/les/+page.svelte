<script lang="ts">
  import '$lib/mockup/tokens.css';
  import { goto } from '$app/navigation';
  import FullscreenReader from '$lib/mockup/components/FullscreenReader.svelte';
</script>

<!-- Legacy route — redirects back to /mockup/analyse on close -->
<div class="mockup-root">
  <FullscreenReader onClose={() => goto('/mockup/analyse')} />
</div>

<style>
  .mockup-root {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-sans);
  }
</style>
