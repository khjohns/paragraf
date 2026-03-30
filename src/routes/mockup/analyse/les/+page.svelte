<script lang="ts">
  import '$lib/mockup/tokens.css';
  import { Sun, Moon, ArrowLeft, BookOpen, Plus } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  import ScreeningLayer from '$lib/mockup/components/ScreeningLayer.svelte';
  import SectionNav from '$lib/mockup/components/SectionNav.svelte';
  import ParagraphRow from '$lib/mockup/components/ParagraphRow.svelte';
  import ReadingSidebar from '$lib/mockup/components/ReadingSidebar.svelte';
  import PrecedentPanel from '$lib/mockup/components/PrecedentPanel.svelte';
  import { tick } from 'svelte';
  import { MOCK_SCREENING, MOCK_SECTIONS, MOCK_CASE_METADATA } from '$lib/mockup/data/lesevisning';

  const quotedParas = new Set(MOCK_SCREENING.quotes.map((q) => q.p));

  let darkMode = $state(false);
  let activeSection = $state('vurdering');
  let screeningOpen = $state(true);
  let copiedPara = $state<number | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  let precedentPanelOpen = $state(false);

  let currentSection = $derived(MOCK_SECTIONS.find((s) => s.id === activeSection));

  function copyParaRef(n: number) {
    const text = `${MOCK_CASE_METADATA.ref}, avsnitt ${n}`;
    navigator.clipboard?.writeText(text).then(() => {
      if (copyTimer) clearTimeout(copyTimer);
      copiedPara = n;
      copyTimer = setTimeout(() => (copiedPara = null), 2000);
    });
  }

  let scrollContainer: HTMLDivElement | undefined = $state();

  async function openPrecedentPanel() {
    precedentPanelOpen = true;
    await tick();
    scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
  }

  async function scrollToQuote(p: number) {
    for (const s of MOCK_SECTIONS) {
      if (s.paragraphs.some((para) => para.n === p)) {
        activeSection = s.id;
        break;
      }
    }
    await tick();
    document.getElementById(`para-${p}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
</script>

<div class="mockup-root" class:dark={darkMode}>
  <header class="rv-header">
    <div class="header-left">
      <a href="/mockup" class="logo" title="Tilbake til porteføljen">
        <span class="logo-symbol">&sect;</span>
      </a>
      <div class="header-sep"></div>
      <h1
        class="header-title"
        title="Utforming av miljøkriterier i konkurransegrunnlaget, jf. FOA § 7-9"
      >
        Utforming av miljøkriterier i konkurransegrunnlaget, jf. FOA § 7-9
      </h1>
    </div>
    <div class="header-right">
      <button class="mode-toggle" onclick={() => (darkMode = !darkMode)}>
        {#if darkMode}
          <Sun size={14} />
        {:else}
          <Moon size={14} />
        {/if}
      </button>
      <div class="avatar">MJ</div>
    </div>
  </header>

  <div class="rv-main">
    <div class="rv-scroll" bind:this={scrollContainer}>
      <div class="rv-content">
        <div class="case-header">
          <div class="back-row">
            <a href="/mockup/analyse" class="back-btn">
              <ArrowLeft size={12} /> Tilbake til registeret
            </a>
          </div>
          <h2 class="case-title">{MOCK_CASE_METADATA.ref}</h2>
          <p class="case-subtitle">
            {MOCK_CASE_METADATA.innklaget} — {MOCK_CASE_METADATA.gjelder}
          </p>

          <div class="meta-chips">
            <span class="chip filled">{MOCK_CASE_METADATA.avgjoerelse}</span>
            <span class="chip">{MOCK_CASE_METADATA.sakstype}</span>
            <span class="chip-text">{MOCK_CASE_METADATA.avsluttet}</span>
            <div class="chip-sep"></div>
            {#each MOCK_CASE_METADATA.provisions as p}
              <span class="chip filled">{p}</span>
            {/each}
          </div>
        </div>

        <div class="screening-wrapper slide-in" style="animation-delay: 0.15s">
          <ScreeningLayer
            screening={MOCK_SCREENING}
            bind:open={screeningOpen}
            onScrollToQuote={scrollToQuote}
          />
        </div>
      </div>

      <SectionNav
        sections={MOCK_SECTIONS}
        {activeSection}
        onSelect={(id) => (activeSection = id)}
        originalUrl="https://www.klagenemndssekretariatet.no/sak/2025-0999"
      />

      <div class="rv-content">
        {#if currentSection}
          {#key activeSection}
            <div class="paragraphs" in:fade={{ duration: 150 }}>
              {#each currentSection.paragraphs as p (p.n)}
                <div id="para-{p.n}">
                  <ParagraphRow
                    paragraph={p}
                    isQuoted={quotedParas.has(p.n)}
                    {copiedPara}
                    onCopyRef={copyParaRef}
                  />
                </div>
              {/each}
            </div>
          {/key}
        {/if}

        {#if !precedentPanelOpen}
          <div class="bottom-action">
            <button class="btn-primary-full" onclick={openPrecedentPanel}>
              <BookOpen size={14} /> Marker som Rettssetning
            </button>
            <div class="bottom-meta">
              <span class="bottom-related">
                {MOCK_CASE_METADATA.relatedCases.length} relaterte saker
              </span>
            </div>
          </div>
        {/if}
      </div>

      {#if precedentPanelOpen}
        <div class="rv-content">
          <PrecedentPanel
            screening={MOCK_SCREENING}
            caseRef={MOCK_CASE_METADATA.ref}
            onClose={() => (precedentPanelOpen = false)}
          />
        </div>
      {/if}
    </div>

    <ReadingSidebar metadata={MOCK_CASE_METADATA} />
  </div>
</div>

<style>
  .mockup-root {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-sans);
  }

  .rv-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid var(--border);
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
    z-index: 30;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .logo {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    flex-shrink: 0;
    background: transparent;
    cursor: pointer;
    transition: border-color 0.15s ease;
    text-decoration: none;
    color: var(--ink);
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

  .header-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    flex-shrink: 0;
  }

  .header-title {
    font-family: var(--font-serif);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mode-toggle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-secondary);
  }

  .rv-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .rv-scroll {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  .rv-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .rv-content:last-child {
    padding-bottom: 80px;
  }

  @keyframes rv-fade-up {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .case-header {
    animation: rv-fade-up 0.7s ease both;
    padding-top: 32px;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--ink);
  }

  .back-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-tertiary);
    text-decoration: none;
    padding: 2px 8px;
    transition: color 0.15s ease;
  }

  .back-btn:hover {
    color: var(--ink);
  }

  .case-title {
    font-family: var(--font-serif);
    font-size: 28px;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.25;
    letter-spacing: -0.015em;
    margin-bottom: 8px;
  }

  .case-subtitle {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-tertiary);
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .meta-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .chip {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 2px;
  }

  .chip.filled {
    color: var(--ink);
    background: var(--paper-dark);
  }

  .chip-text {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
  }

  .chip-sep {
    width: 1px;
    height: 12px;
    background: var(--border);
    margin: 0 4px;
  }

  .screening-wrapper {
    margin-top: 24px;
  }

  .slide-in {
    animation: rv-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .paragraphs {
    margin-top: 24px;
  }

  .bottom-action {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .btn-primary-full {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--ink);
    color: var(--paper);
    border: 1.5px solid transparent;
  }

  .btn-primary-full:hover {
    background: #000;
  }

  :global(.dark) .btn-primary-full {
    background: transparent;
    color: var(--ink-secondary);
    border-color: var(--border-strong);
  }

  :global(.dark) .btn-primary-full:hover {
    background: var(--hover-bg-strong);
    color: var(--ink);
  }

  .bottom-meta {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 12px;
  }

  .bottom-related {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
  }
</style>
