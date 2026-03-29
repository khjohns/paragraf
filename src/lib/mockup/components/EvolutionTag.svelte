<script lang="ts">
  import { EVOLUTION_CONFIG, type EvolutionType } from '$lib/mockup/data/rettssetninger';

  let { evolution }: { evolution: EvolutionType } = $props();

  const config = $derived(EVOLUTION_CONFIG[evolution]);
</script>

<span class="tag-evolution {config.css}">{config.label}</span>

<style>
  .tag-evolution {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 1px 6px;
    border-radius: 2px;
    white-space: nowrap;
  }

  .tag-established {
    border: 1px solid var(--border-strong);
    color: var(--ink-tertiary);
  }

  .tag-confirmed {
    border: 1px solid rgba(55, 94, 55, 0.3);
    color: var(--confirm-color);
  }

  .tag-qualified {
    border: 1px dashed var(--qualified-color);
    color: var(--qualified-color);
  }

  .tag-consolidating {
    border: 1px solid var(--border);
    color: var(--ink-muted);
  }
</style>
