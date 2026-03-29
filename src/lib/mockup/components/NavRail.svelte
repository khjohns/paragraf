<script lang="ts">
  import { Search, List, Network, BookOpen, PenTool } from 'lucide-svelte';

  let {
    isScopeOpen = false,
    onToggleScope,
  }: {
    isScopeOpen: boolean;
    onToggleScope: () => void;
  } = $props();
</script>

<nav class="nav-rail">
  <button class="nav-btn" class:active={isScopeOpen} title="Scope" onclick={onToggleScope}>
    <Search size={16} />
  </button>

  <button class="nav-btn active" title="Arbeidsregister" style="position: relative;">
    <List size={16} />
    <div class="activity-dot"></div>
  </button>

  <button class="nav-btn" title="Grafvisning">
    <Network size={16} />
  </button>

  <button class="nav-btn" title="Rettssetninger">
    <BookOpen size={16} />
  </button>

  <div class="rail-spacer"></div>

  <button class="nav-btn" title="Notat">
    <PenTool size={16} />
  </button>
</nav>

<style>
  .nav-rail {
    width: 48px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    flex-shrink: 0;
    gap: 4px;
  }

  .nav-btn {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
    color: var(--ink-muted);
  }

  .nav-btn:hover {
    color: var(--ink);
    background: var(--hover-bg);
  }

  .nav-btn:active {
    transform: scale(0.95);
  }

  .nav-btn.active {
    color: var(--ink);
    background: var(--paper-dark);
    border-color: var(--border);
  }

  .activity-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ai-accent);
  }

  .rail-spacer {
    margin-top: auto;
  }
</style>
