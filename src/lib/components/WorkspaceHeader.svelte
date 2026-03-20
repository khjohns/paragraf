<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';

  let title = $derived(analysisState.analysis.title || 'Uten tittel');
  let initials = 'KJ'; // Mock — erstattes med auth senere
  let userName = 'Kasper Johansen'; // Mock
</script>

<header class="workspace-header">
  <nav class="breadcrumb">
    <a href="/" class="crumb brand">Paragraf</a>
    <span class="crumb-sep">/</span>
    <span class="crumb current">{title}</span>
  </nav>
  <span class="spacer"></span>
  <div class="user" title={userName}>
    <span class="avatar">{initials}</span>
  </div>
</header>

<style>
  .workspace-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--p-border-m);
    background: var(--p-panel);
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .crumb {
    font-size: 12px;
    color: var(--p-ink3);
    text-decoration: none;
  }
  .crumb.brand {
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink2);
  }
  .crumb.brand:hover {
    color: var(--p-ink);
  }
  .crumb-sep {
    font-size: 11px;
    color: var(--p-ink4);
  }
  .crumb.current {
    font-weight: 500;
    color: var(--p-ink);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spacer {
    flex: 1;
  }

  .user {
    cursor: default;
  }
  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  @media (max-width: 768px) {
    .workspace-header {
      padding: 8px 12px;
    }
    .crumb.current {
      max-width: 180px;
    }
  }
</style>
