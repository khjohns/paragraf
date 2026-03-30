<script lang="ts">
  import { Plus, X } from 'lucide-svelte';

  let {
    type,
    label,
    color,
    items: initialItems,
  }: {
    type: 'ref' | 'fts' | 'vector' | 'prepWork';
    label: string;
    color: string;
    items: string[];
  } = $props();

  let items = $state([...initialItems]);
  let adding = $state(false);
  let newValue = $state('');
  let addInput: HTMLInputElement | undefined = $state();

  let isMono = $derived(type === 'ref' || type === 'prepWork');

  function startAdding() {
    adding = true;
    requestAnimationFrame(() => addInput?.focus());
  }

  function confirmAdd() {
    if (newValue.trim()) items = [...items, newValue.trim()];
    newValue = '';
    adding = false;
  }

  function cancelAdd() {
    newValue = '';
    adding = false;
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  const placeholders: Record<string, string> = {
    ref: '§ …',
    fts: '«…»',
    vector: 'Beskriv konsept…',
    prepWork: 'Referanse…',
  };

  // ── Inline editable item state ──
  let editingIndex = $state<number | null>(null);
  let editValue = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  function startEditItem(index: number) {
    editingIndex = index;
    editValue = items[index];
    requestAnimationFrame(() => {
      if (editInput) {
        editInput.focus();
        editInput.select();
      }
    });
  }

  function confirmEdit() {
    if (editingIndex !== null) {
      if (!editValue.trim()) {
        removeItem(editingIndex);
      } else {
        items = items.map((it, i) => (i === editingIndex ? editValue.trim() : it));
      }
    }
    editingIndex = null;
    editValue = '';
  }

  function cancelEdit(index: number) {
    editValue = items[index];
    editingIndex = null;
  }
</script>

<div class="signal-group">
  <div class="group-header">
    <span class="dot" style="background: {color}"></span>
    <span class="group-label">{label}</span>
  </div>
  <div class="group-items">
    {#each items as item, i (i)}
      {#if editingIndex === i}
        <input
          bind:this={editInput}
          bind:value={editValue}
          onblur={confirmEdit}
          onkeydown={(e) => {
            if (e.key === 'Enter') confirmEdit();
            if (e.key === 'Escape') cancelEdit(i);
          }}
          class="item-edit-input"
          class:mono={isMono}
          class:serif={!isMono}
        />
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="signal-item"
          class:mono={isMono}
          class:serif={!isMono}
          class:italic={type === 'vector'}
          onclick={() => startEditItem(i)}
        >
          {item}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="remove-x"
            onclick={(e) => {
              e.stopPropagation();
              removeItem(i);
            }}
          >
            <X size={9} />
          </span>
        </span>
      {/if}
    {/each}

    {#if adding}
      <input
        bind:this={addInput}
        bind:value={newValue}
        onblur={confirmAdd}
        onkeydown={(e) => {
          if (e.key === 'Enter') confirmAdd();
          if (e.key === 'Escape') cancelAdd();
        }}
        placeholder={placeholders[type]}
        class="item-edit-input"
        class:mono={isMono}
        class:serif={!isMono}
      />
    {:else}
      <button class="add-btn" onclick={startAdding}>
        <Plus size={9} />
      </button>
    {/if}
  </div>
</div>

<style>
  .signal-group {
    margin-bottom: 12px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .group-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-tertiary);
  }

  .group-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-left: 12px;
    align-items: center;
  }

  .signal-item {
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid transparent;
    cursor: text;
    color: var(--ink-secondary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: border-color 0.15s ease;
  }

  .signal-item:hover {
    border-color: var(--border-strong);
  }

  .signal-item.mono {
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .signal-item.serif {
    font-family: var(--font-serif);
    font-size: 13px;
  }

  .signal-item.italic {
    font-style: italic;
  }

  .remove-x {
    color: var(--ink-muted);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: inline-flex;
  }

  .signal-item:hover .remove-x {
    opacity: 0.5;
  }

  .remove-x:hover {
    opacity: 1 !important;
  }

  .item-edit-input {
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid var(--border-stronger);
    background: transparent;
    color: var(--ink);
    outline: none;
    min-width: 80px;
    max-width: 100%;
  }

  .item-edit-input.mono {
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .item-edit-input.serif {
    font-family: var(--font-serif);
    font-size: 13px;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    transition: color 0.15s ease;
  }

  .add-btn:hover {
    color: var(--ink-tertiary);
  }
</style>
