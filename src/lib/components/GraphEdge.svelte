<script lang="ts">
  import type { Valence } from '$lib/types/graph';

  let {
    points,
    valence,
    dimmed = false,
    highlighted = false,
  }: {
    points: Array<{ x: number; y: number }>;
    valence: Valence;
    dimmed?: boolean;
    highlighted?: boolean;
  } = $props();

  const markerIds: Record<string, string> = {
    confirming: 'arrowhead',
    unknown: 'arrowhead',
    distinguishing: 'arrowhead-warn',
    departing: 'arrowhead-danger',
  };
  let markerId = $derived(markerIds[valence] ?? 'arrowhead');

  let pathD = $derived.by(() => {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    return `M${first.x},${first.y}` + rest.map((p) => ` L${p.x},${p.y}`).join('');
  });

  const valenceStyles: Record<Valence, { dasharray: string; color: string; baseOpacity: number }> =
    {
      confirming: { dasharray: 'none', color: 'var(--p-ink)', baseOpacity: 0.13 },
      unknown: { dasharray: 'none', color: 'var(--p-ink)', baseOpacity: 0.13 },
      distinguishing: { dasharray: '5,3', color: 'var(--p-warn)', baseOpacity: 0.5 },
      departing: { dasharray: '2,3', color: 'var(--p-danger)', baseOpacity: 0.5 },
    };

  let style = $derived(valenceStyles[valence] ?? valenceStyles.unknown);
  let opacity = $derived(
    highlighted
      ? Math.max(style.baseOpacity * 3, 0.6)
      : dimmed
        ? style.baseOpacity * 0.3
        : style.baseOpacity
  );
  let strokeW = $derived(highlighted ? 3 : 1.5);
</script>

<path
  d={pathD}
  stroke={style.color}
  stroke-width={strokeW}
  stroke-dasharray={style.dasharray}
  {opacity}
  fill="none"
  marker-end="url(#{markerId})"
/>

<style>
  path {
    pointer-events: none;
  }
</style>
