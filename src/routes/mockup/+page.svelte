<script lang="ts">
  import { MOCK_ANALYSES, STATUS_META } from '$lib/mockup/data/portfolio';

  // Placeholder — erstatt med ekte komponenter ved konvertering
  let selectedId = $state<string | null>(null);
</script>

<div class="mockup-portfolio">
  <header class="mockup-header">
    <span class="brand">§ Paragraf</span>
    <span class="spacer"></span>
    <span class="meta">Mockup — porteføljeoversikt</span>
  </header>

  <main class="mockup-body">
    <p class="placeholder">
      Porteføljeoversikt. {MOCK_ANALYSES.length} analyser i mockdata. Konverter React-mockup fra
      <code>.mockups/</code> hit.
    </p>
  </main>
</div>

<style>
  .mockup-portfolio {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--p-bg);
    color: var(--p-ink);
  }

  .mockup-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
  }

  .brand {
    font-size: 16px;
    font-weight: 700;
    font-style: italic;
    letter-spacing: -0.02em;
  }

  .spacer {
    flex: 1;
  }

  .meta {
    font-size: 11px;
    color: var(--p-ink3);
    font-family: var(--font-data);
  }

  .mockup-body {
    flex: 1;
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .placeholder {
    font-size: 14px;
    color: var(--p-ink2);
    line-height: 1.6;
  }

  code {
    font-family: var(--font-data);
    font-size: 12px;
    background: var(--p-input);
    padding: 2px 6px;
    border-radius: var(--radius-badge);
  }
</style>
