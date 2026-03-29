<script lang="ts">
  let {
    x = 0,
    y = 0,
    ref: nodeRef = '',
    text = '',
  }: {
    x: number;
    y: number;
    ref: string;
    text: string;
  } = $props();

  let clampedX = $derived(Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280));
  let clampedY = $derived(Math.max(10, y - 70));
</script>

<div class="tooltip-box" style="left:{clampedX}px;top:{clampedY}px">
  <div class="tooltip-ref">{nodeRef}</div>
  <p class="tooltip-text">{text}</p>
</div>

<style>
  .tooltip-box {
    position: fixed;
    z-index: 90;
    max-width: 260px;
    padding: 10px 12px;
    background: var(--paper);
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    pointer-events: none;
    animation: dropIn 0.12s ease forwards;
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tooltip-ref {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 4px;
  }

  .tooltip-text {
    font-family: var(--font-serif);
    font-size: 13px;
    font-style: italic;
    line-height: 1.45;
    color: var(--ai-accent);
  }
</style>
