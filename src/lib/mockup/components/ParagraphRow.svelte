<script lang="ts">
  import { Sparkles, ExternalLink } from 'lucide-svelte';
  import type { Paragraph } from '$lib/mockup/data/lesevisning';

  let {
    paragraph,
    isQuoted = false,
    copiedPara = null,
    onCopyRef,
  }: {
    paragraph: Paragraph;
    isQuoted?: boolean;
    copiedPara?: number | null;
    onCopyRef: (n: number) => void;
  } = $props();

  let isCopied = $derived(copiedPara === paragraph.n);
</script>

<div class="para-row" class:para-highlighted={isQuoted} class:para-key={paragraph.isKey}>
  <div class="para-anchor">
    <button
      class="para-num-btn"
      onclick={() => onCopyRef(paragraph.n)}
      title={isCopied ? 'Kopiert!' : `Kopier referanse: avsnitt ${paragraph.n}`}
      class:copied={isCopied}
    >
      {isCopied ? '✓' : paragraph.n}
    </button>
  </div>

  <div class="para-content">
    <p class="para-text">{paragraph.text}</p>

    {#if paragraph.refs && paragraph.refs.length > 0}
      <div class="para-refs">
        {#each paragraph.refs as r}
          {#if r.case}
            <button class="ref-link">
              KOFA-{r.case}{r.para ? `, avsnitt ${r.para}` : ''}
              <ExternalLink size={9} />
            </button>
          {:else if r.provision}
            <span class="prov-inline">{r.provision}</span>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  {#if isQuoted}
    <div class="quote-indicator">
      <Sparkles size={11} color="var(--ai-accent)" />
    </div>
  {/if}
</div>

<style>
  .para-row {
    display: flex;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);
    transition: background 0.15s ease;
  }

  .para-row:hover {
    background: var(--hover-bg);
  }

  .para-highlighted {
    border-left: 2px solid var(--ai-accent);
    margin-left: -2px;
  }

  .para-key {
    background: var(--hover-bg);
  }

  .para-anchor {
    width: 48px;
    flex-shrink: 0;
    padding-top: 2px;
    text-align: right;
    padding-right: 16px;
  }

  .para-num-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.4;
    transition:
      opacity 0.15s ease,
      color 0.15s ease;
  }

  .para-row:hover .para-num-btn:not(.copied) {
    opacity: 1;
  }

  .para-num-btn:hover {
    opacity: 1;
    color: var(--ink);
  }

  .para-num-btn.copied {
    color: var(--confirm-color);
    opacity: 1;
  }

  .para-content {
    flex: 1;
    padding-right: 16px;
  }

  .para-text {
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.7;
    color: var(--ink-secondary);
  }

  .para-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .ref-link {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ref-link);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color 0.15s ease;
    background: none;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .ref-link:hover {
    color: var(--ink);
    text-decoration-style: solid;
  }

  .prov-inline {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-tertiary);
    background: var(--paper-dark);
    border: 1px solid var(--border);
    padding: 0 6px;
    border-radius: 2px;
  }

  .quote-indicator {
    width: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    padding-top: 4px;
  }
</style>
