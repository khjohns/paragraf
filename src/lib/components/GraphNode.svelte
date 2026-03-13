<script lang="ts">
  import { NODE_TYPE_ACCENT, type GraphNode } from '$lib/types/graph';

  let {
    node,
    x,
    y,
    width,
    height,
    selected = false,
    dimmed = false,
    readStatus = false,
    onclick,
    onmouseenter,
    onmouseleave,
  }: {
    node: GraphNode;
    x: number;
    y: number;
    width: number;
    height: number;
    selected?: boolean;
    dimmed?: boolean;
    readStatus?: boolean;
    onclick?: (e: MouseEvent) => void;
    onmouseenter?: (e: MouseEvent) => void;
    onmouseleave?: (e: MouseEvent) => void;
  } = $props();

  let accent = $derived(NODE_TYPE_ACCENT[node.type]);

  const bgVars: Record<string, string> = {
    provision: 'var(--p-provision-bg)',
    kofa_case: 'var(--p-kofa-bg)',
    eu_case: 'var(--p-eu-bg)',
    court_case: 'var(--p-court-bg)',
    prep_work: 'var(--p-prep-bg)',
  };
  const borderVars: Record<string, string> = {
    provision: 'var(--p-provision-border)',
    kofa_case: 'var(--p-kofa-border)',
    eu_case: 'var(--p-eu-border)',
    court_case: 'var(--p-court-border)',
    prep_work: 'var(--p-prep-border)',
  };

  let bg = $derived(bgVars[node.type]);
  let border = $derived(borderVars[node.type]);
  let strokeWidth = $derived(selected ? 2 : 1);
  let strokeColor = $derived(selected ? accent : border);

  const catBg: Record<string, string> = {
    A: 'rgba(26,24,20,0.08)',
    B: 'rgba(26,24,20,0.05)',
    C: 'rgba(26,24,20,0.03)',
  };
  const catFill: Record<string, string> = {
    A: 'var(--p-ink)',
    B: 'var(--p-ink2)',
    C: 'var(--p-ink3)',
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
  transform="translate({x},{y})"
  opacity={dimmed ? 0.2 : 1}
  {onclick}
  {onmouseenter}
  {onmouseleave}
  onpointerdown={(e) => e.stopPropagation()}
  style="cursor: pointer"
>
  <!-- Node shape -->
  {#if node.type === 'provision'}
    <rect
      x={-width / 2}
      y={-height / 2}
      {width}
      {height}
      rx={3}
      fill={bg}
      stroke={strokeColor}
      stroke-width={strokeWidth}
    />
  {:else if node.type === 'kofa_case'}
    <circle
      cx={0}
      cy={0}
      r={height / 2}
      fill={bg}
      stroke={strokeColor}
      stroke-width={strokeWidth}
    />
  {:else if node.type === 'eu_case'}
    <rect
      x={(-height / 2) * 0.7}
      y={(-height / 2) * 0.7}
      width={height * 0.7}
      height={height * 0.7}
      rx={2}
      fill={bg}
      stroke={strokeColor}
      stroke-width={strokeWidth}
      transform="rotate(45)"
    />
  {:else if node.type === 'court_case'}
    <circle
      cx={0}
      cy={0}
      r={height / 2}
      fill={bg}
      stroke={strokeColor}
      stroke-width={strokeWidth}
    />
  {:else if node.type === 'prep_work'}
    <rect
      x={-width / 2}
      y={-height / 4}
      {width}
      height={height / 2}
      rx={2}
      fill={bg}
      stroke={strokeColor}
      stroke-width={strokeWidth}
      opacity={0.6}
    />
  {/if}

  <!-- Label -->
  <text x={0} y={0} text-anchor="middle" dominant-baseline="central" class="label" fill={accent}
    >{node.label}</text
  >

  <!-- Category badge (top-right) -->
  {#if node.category}
    {@const bx = width / 2 - 4}
    {@const by = -height / 2 - 4}
    <rect x={bx - 6} y={by - 6} width={14} height={12} rx={2} fill={catBg[node.category]} />
    <text
      x={bx + 1}
      y={by + 1}
      text-anchor="middle"
      dominant-baseline="central"
      class="cat-text"
      fill={catFill[node.category]}>{node.category}</text
    >
  {/if}

  <!-- Read checkmark (top-left) -->
  {#if readStatus}
    {@const cx = -width / 2 + 4}
    {@const cy = -height / 2 - 4}
    <circle {cx} {cy} r={5} fill="var(--p-success)" />
    <path
      d="M{cx - 2.5},{cy} L{cx - 0.5},{cy + 2} L{cx + 2.5},{cy - 1.5}"
      stroke="#fff"
      stroke-width={1.5}
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}

  <!-- Delimitation marker (near category badge) -->
  {#if node.isDelimitation}
    {@const dx = node.category ? width / 2 + 10 : width / 2 - 4}
    {@const dy = -height / 2 - 4}
    <circle cx={dx} cy={dy} r={5} fill="var(--p-delim)" />
    <text
      x={dx}
      y={dy}
      text-anchor="middle"
      dominant-baseline="central"
      fill="#fff"
      font-size="7"
      font-weight="700">∅</text
    >
  {/if}

  <!-- Seed marker (left) -->
  {#if node.isSeed}
    <circle cx={-width / 2 - 8} cy={0} r={3} fill={accent} />
  {/if}

  <!-- Iteration pill (below node, iteration 2+) -->
  {#if node.iteration >= 2}
    {@const iy = height / 2 + 12}
    <rect x={-16} y={iy - 6} width={32} height={12} rx={6} fill="var(--p-success-bg)" />
    <text x={0} y={iy + 1} text-anchor="middle" dominant-baseline="central" class="iter-text"
      >iter. {node.iteration}</text
    >
  {/if}
</g>

<style>
  .label {
    font-family: var(--font-data);
    font-weight: 600;
    font-size: 12px;
  }
  .cat-text {
    font-family: var(--font-data);
    font-weight: 600;
    font-size: 8px;
  }
  .iter-text {
    font-family: var(--font-data);
    font-size: 8px;
    fill: var(--p-success);
    font-weight: 600;
  }
</style>
