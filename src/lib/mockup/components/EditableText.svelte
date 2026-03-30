<script lang="ts">
  let {
    initialValue,
    aiGenerated = true,
    serif = true,
    size = 14,
    weight = 400,
    multiline = false,
  }: {
    initialValue: string;
    aiGenerated?: boolean;
    serif?: boolean;
    size?: number;
    weight?: number;
    multiline?: boolean;
  } = $props();

  let value = $state(initialValue);
  let editing = $state(false);
  let edited = $state(false);
  let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined = $state();

  let isAi = $derived(aiGenerated && !edited);
  let fontFamily = $derived(serif ? 'var(--font-serif)' : 'var(--font-sans)');
  let paddingLeft = $derived(aiGenerated ? 16 : 8);

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function startEditing() {
    editing = true;
    requestAnimationFrame(() => {
      if (inputEl) {
        inputEl.focus();
        if (multiline && inputEl instanceof HTMLTextAreaElement) {
          autoResizeTextarea(inputEl);
        }
      }
    });
  }

  function handleBlur() {
    editing = false;
    if (value !== initialValue) edited = true;
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    value = target.value;
    if (multiline && target instanceof HTMLTextAreaElement) {
      autoResizeTextarea(target);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!multiline && e.key === 'Enter') handleBlur();
  }
</script>

{#if editing}
  {#if multiline}
    <textarea
      bind:this={inputEl}
      {value}
      oninput={handleInput}
      onblur={handleBlur}
      class="edit-input"
      style="font-family: {fontFamily}; font-size: {size}px; font-weight: {weight}; padding-left: {paddingLeft}px;"
    ></textarea>
  {:else}
    <input
      bind:this={inputEl}
      type="text"
      {value}
      oninput={handleInput}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      class="edit-input"
      style="font-family: {fontFamily}; font-size: {size}px; font-weight: {weight}; padding-left: {paddingLeft}px;"
    />
  {/if}
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="display-text"
    class:ai={isAi}
    onclick={startEditing}
    style="font-family: {fontFamily}; font-size: {size}px; font-weight: {weight}; padding-left: {paddingLeft}px;"
  >
    {value}
    {#if edited}
      <span class="edited-label">Redigert</span>
    {/if}
  </div>
{/if}

<style>
  .edit-input {
    line-height: 1.55;
    color: var(--ink);
    font-style: normal;
    padding: 4px 8px;
    border-radius: 2px;
    width: 100%;
    border: 1px solid var(--border-stronger);
    border-left: 2px solid var(--border-stronger);
    background: transparent;
    outline: none;
    resize: none;
    overflow: hidden;
  }

  .display-text {
    line-height: 1.55;
    padding: 4px 8px;
    border-radius: 2px;
    cursor: text;
    width: 100%;
    border: 1px solid transparent;
    border-left: 2px solid transparent;
    transition:
      color 0.2s ease,
      border-color 0.15s ease;
    color: var(--ink);
    font-style: normal;
  }

  .display-text:hover {
    border-color: var(--border-strong);
  }

  .display-text.ai {
    color: var(--ai-accent);
    font-style: italic;
    border-left-color: var(--ai-accent);
  }

  .display-text.ai:hover {
    border-color: var(--border-strong);
    border-left-color: var(--ai-accent);
  }

  .edited-label {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-left: 8px;
    vertical-align: middle;
  }
</style>
