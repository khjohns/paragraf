<script lang="ts">
  import type { LlmMeta } from '$lib/types/analysis';

  let { meta, label = 'Arbeidslogg' }: { meta: LlmMeta | null; label?: string } = $props();

  let expanded = $state(false);
</script>

{#if meta && meta.tools_called.length > 0}
  <div class="work-log">
    <button class="log-toggle" onclick={() => (expanded = !expanded)}>
      <span class="log-chevron">{expanded ? '▾' : '▸'}</span>
      <span class="log-label">{label}</span>
      <span class="log-meta">
        {meta.total_turns} turns · {(meta.elapsed_ms / 1000).toFixed(0)}s · ${meta.cost_usd.toFixed(
          3
        )}
      </span>
    </button>

    {#if expanded}
      <div class="log-entries">
        {#each meta.tools_called as call}
          <div class="log-entry">
            <span class="log-turn">Turn {call.turn}</span>
            <span class="log-tool">{call.tool}</span>
            <span class="log-input">{JSON.stringify(call.input).slice(0, 80)}</span>
            <span class="log-status" class:error={!call.success}>
              {call.success ? '✓' : '✗'}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .work-log {
    border-top: 1px solid var(--p-border);
    margin-top: 16px;
  }

  .log-toggle {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    width: 100%;
    font-size: 11px;
    color: var(--p-ink3);
  }
  .log-toggle:hover {
    color: var(--p-ink2);
  }
  .log-chevron {
    font-size: 10px;
    color: var(--p-ink4);
  }
  .log-label {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 10px;
  }
  .log-meta {
    margin-left: auto;
    font-family: var(--font-data);
    font-size: 10px;
  }

  .log-entries {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0 8px;
  }
  .log-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    background: var(--p-hover);
    font-size: 10px;
  }
  .log-turn {
    font-family: var(--font-data);
    color: var(--p-ink3);
    font-weight: 600;
    flex-shrink: 0;
  }
  .log-tool {
    font-family: var(--font-data);
    color: var(--p-ink2);
    font-weight: 500;
    flex-shrink: 0;
  }
  .log-input {
    color: var(--p-ink4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .log-status {
    color: var(--p-success);
    flex-shrink: 0;
  }
  .log-status.error {
    color: var(--p-error, #c13515);
  }
</style>
