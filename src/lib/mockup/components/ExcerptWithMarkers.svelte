<script lang="ts">
  import type { ExcerptPart } from '$lib/mockup/data/analyse';

  let { parts }: { parts: ExcerptPart[] } = $props();
</script>

<p class="excerpt">
  {#each parts as part}
    {#if part.mark}
      <span class="mark mark-{part.mark.toLowerCase()}" title="{part.mark}-treff">{part.text}</span>
    {:else}
      {part.text}
    {/if}
  {/each}
</p>

<style>
  .excerpt {
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-secondary);
  }

  .mark {
    padding: 0 2px;
    cursor: pointer;
  }

  .mark-r {
    background: var(--paper-dark);
    border-bottom: 1.5px solid var(--border-strong);
  }

  .mark-f {
    background: var(--signal-fts-bg);
    border-bottom: 1.5px solid var(--signal-fts-border);
  }

  .mark-v {
    background: var(--ai-bg);
    border-bottom: 1.5px solid var(--ai-border);
  }
</style>
