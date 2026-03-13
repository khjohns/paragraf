<script lang="ts">
  import { NODE_TYPE_ACCENT, type NodeType } from '$lib/types/graph';

  let { type, size = 14 }: { type: NodeType; size?: number } = $props();

  let accent = $derived(NODE_TYPE_ACCENT[type]);
</script>

{#if type === 'provision'}
  <span
    class="icon"
    style:width="{size}px"
    style:height="{size * 0.7}px"
    style:border-radius="2px"
    style:background={accent}
  ></span>
{:else if type === 'kofa_case'}
  <span
    class="icon"
    style:width="{size}px"
    style:height="{size}px"
    style:border-radius="50%"
    style:background={accent}
  ></span>
{:else if type === 'eu_case'}
  <span
    class="icon diamond"
    style:width="{size * 0.85}px"
    style:height="{size * 0.85}px"
    style:border-radius="2px"
    style:background={accent}
  ></span>
{:else if type === 'court_case'}
  <span
    class="icon"
    style:width="{size}px"
    style:height="{size}px"
    style:border-radius="50%"
    style:background={accent}
  ></span>
{:else if type === 'prep_work'}
  <span
    class="icon"
    style:width="{size}px"
    style:height="{size * 0.8}px"
    style:border-radius="2px"
    style:background={accent}
    style:opacity="0.5"
  ></span>
{/if}

<style>
  .icon {
    display: inline-block;
    flex-shrink: 0;
    opacity: 0.8;
  }
  .diamond {
    transform: rotate(45deg);
  }
</style>
