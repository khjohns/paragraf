<script lang="ts">
  let {
    label,
    initialValue = '',
  }: {
    label: string;
    initialValue?: string | null;
  } = $props();

  let value = $state(initialValue ?? '');
  let editing = $state(false);
  let inputEl: HTMLInputElement | undefined = $state();

  function startEditing() {
    editing = true;
    requestAnimationFrame(() => inputEl?.focus());
  }

  function stopEditing() {
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') stopEditing();
  }
</script>

<div class="chip">
  <div class="chip-label">{label}</div>
  {#if editing}
    <input
      bind:this={inputEl}
      bind:value
      onblur={stopEditing}
      onkeydown={handleKeydown}
      class="chip-input"
    />
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="chip-value" class:empty={!value} onclick={startEditing}>
      {value || 'Ikke spesifisert'}
    </div>
  {/if}
</div>

<style>
  .chip-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-bottom: 4px;
  }

  .chip-input {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-secondary);
    background: transparent;
    border: 1px solid var(--border-stronger);
    border-radius: 2px;
    padding: 4px 8px;
    width: 100%;
    outline: none;
  }

  .chip-value {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-secondary);
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: text;
    transition: border-color 0.15s ease;
  }

  .chip-value:hover {
    border-color: var(--border-strong);
  }

  .chip-value.empty {
    color: var(--ink-muted);
    font-style: italic;
  }
</style>
