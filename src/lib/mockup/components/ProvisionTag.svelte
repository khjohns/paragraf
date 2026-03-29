<script lang="ts">
  let { text, small = false }: { text: string; small?: boolean } = $props();
</script>

<span class="provision-tag" class:small>{text}</span>

<style>
  .provision-tag {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
    background: var(--paper-dark);
    border: 1px solid var(--border);
    padding: 2px 8px;
    white-space: nowrap;
  }

  .provision-tag.small {
    font-size: 11px;
  }
</style>
