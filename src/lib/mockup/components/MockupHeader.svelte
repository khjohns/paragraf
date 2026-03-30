<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte';

  let {
    darkMode = false,
    onToggleDarkMode,
    pageTitle = '',
  }: {
    darkMode?: boolean;
    onToggleDarkMode: () => void;
    pageTitle?: string;
  } = $props();
</script>

<header class="header">
  <div class="header-left">
    <a href="/mockup" class="logo">
      <span class="logo-symbol">&sect;</span>
    </a>
    {#if pageTitle}
      <div class="divider"></div>
      <span class="page-title">{pageTitle}</span>
    {:else}
      <span class="brand">Paragraf</span>
    {/if}
  </div>

  <div class="header-right">
    <button class="mode-toggle" onclick={onToggleDarkMode}>
      {#if darkMode}
        <Sun size={14} />
      {:else}
        <Moon size={14} />
      {/if}
    </button>
    <div class="avatar">MJ</div>
  </div>
</header>

<style>
  .header {
    width: 100%;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    text-decoration: none;
    color: var(--ink);
    transition: border-color 0.15s ease;
  }

  .logo:hover {
    border-color: var(--border-strong);
  }

  .logo:active {
    transform: scale(0.95);
  }

  .logo-symbol {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 600;
    font-size: 13px;
    line-height: 1;
  }

  .brand {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: var(--ink);
  }

  .divider {
    width: 1px;
    height: 16px;
    background: var(--border);
  }

  .page-title {
    font-family: var(--font-serif);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-toggle:hover {
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--paper-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-secondary);
  }
</style>
