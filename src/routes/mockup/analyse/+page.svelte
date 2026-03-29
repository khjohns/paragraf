<script lang="ts">
  import { MOCK_SCOPE, MOCK_CANDIDATES } from '$lib/mockup/data/analyse';

  // Placeholder — erstatt med ekte komponenter ved konvertering
  let activeTab = $state<string>('all');
  let selectedDocId = $state<string | null>(null);
  let isScopeOpen = $state(true);
</script>

<div class="mockup-analyse">
  <header class="mockup-header">
    <span class="brand">§</span>
    <span class="separator"></span>
    <span class="question">{MOCK_SCOPE.mainQuestion}</span>
    <span class="spacer"></span>
    <span class="meta">Mockup — analyseside</span>
  </header>

  <div class="mockup-workspace">
    <p class="placeholder">
      Analyseside med {MOCK_CANDIDATES.length} kandidatsaker. Konverter React-mockup fra
      <code>.mockups/</code> hit.
    </p>
  </div>
</div>

<style>
  .mockup-analyse {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--p-bg);
    color: var(--p-ink);
  }

  .mockup-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--p-border-m);
    background: var(--p-panel);
    flex-shrink: 0;
  }

  .brand {
    font-size: 18px;
    font-weight: 700;
    font-style: italic;
  }

  .separator {
    width: 1px;
    height: 16px;
    background: var(--p-border-s);
  }

  .question {
    font-size: 14px;
    font-weight: 500;
    color: var(--p-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .spacer {
    flex-shrink: 0;
  }

  .meta {
    font-size: 11px;
    color: var(--p-ink3);
    font-family: var(--font-data);
    flex-shrink: 0;
  }

  .mockup-workspace {
    flex: 1;
    padding: 24px;
    overflow: auto;
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
