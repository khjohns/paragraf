<script lang="ts">
  let { size = 14 }: { size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="8.5" cy="12" r="5.5" />
  <circle cx="15.5" cy="12" r="5.5" />
</svg>
