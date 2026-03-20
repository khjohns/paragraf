<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { streamChat, fetchChatHistory, type ChatMessage } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';
  import { onMount } from 'svelte';

  type DrawerState = 'closed' | 'half' | 'full';
  type ChatPhase = 'idle' | 'loading_context' | 'streaming';

  let drawerState = $state<DrawerState>('closed');
  let messages = $state<ChatMessage[]>([]);
  let inputText = $state('');
  let streaming = $state(false);
  let streamingText = $state('');
  let chatPhase = $state<ChatPhase>('idle');
  let historyLoaded = $state(false);
  let messagesEl: HTMLDivElement | undefined = $state();
  let messagesEndEl: HTMLDivElement | undefined = $state();
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let abortController: AbortController | null = null;
  let hasInput = $derived(inputText.trim().length > 0);

  // --- Typewriter: buffer chunks, reveal at smooth constant rate ---
  const TYPEWRITER_BASE_RATE = 4; // chars per frame at 60fps ≈ 240 chars/sec
  let chunkQueue = '';
  let typewriterRafId: number | null = null;

  function appendChunk(chunk: string) {
    chunkQueue += chunk;
    if (typewriterRafId === null) {
      typewriterRafId = requestAnimationFrame(typewriterTick);
    }
  }

  function typewriterTick() {
    typewriterRafId = null;
    if (!chunkQueue) return;
    // Adaptive rate: base 4, scales up when buffer grows to stay close to real-time
    const rate = Math.max(TYPEWRITER_BASE_RATE, Math.floor(chunkQueue.length / 8));
    const reveal = chunkQueue.slice(0, rate);
    chunkQueue = chunkQueue.slice(rate);
    streamingText += reveal;
    scrollToBottom();
    if (chunkQueue) {
      typewriterRafId = requestAnimationFrame(typewriterTick);
    }
  }

  function stopTypewriter() {
    if (typewriterRafId !== null) {
      cancelAnimationFrame(typewriterRafId);
      typewriterRafId = null;
    }
    streamingText += chunkQueue;
    chunkQueue = '';
  }

  // Load persisted chat history on mount
  onMount(() => {
    fetchChatHistory(analysisState.analysis.id)
      .then((history) => {
        if (history.length > 0) messages = history;
        historyLoaded = true;
      })
      .catch(() => {
        historyLoaded = true;
      });
  });

  // Abort streaming on component destroy + messages click delegation
  $effect(() => {
    const el = messagesEl;
    if (el) el.addEventListener('click', handleRefClick);
    return () => {
      abortController?.abort();
      stopTypewriter();
      if (el) el.removeEventListener('click', handleRefClick);
    };
  });

  function scrollToBottom() {
    messagesEndEl?.scrollIntoView({ behavior: 'smooth' });
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text || streaming) return;

    messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
    inputText = '';
    if (textareaEl) textareaEl.style.height = 'auto';
    streaming = true;
    streamingText = '';
    chunkQueue = '';
    chatPhase = 'idle';
    scrollToBottom();

    abortController = streamChat(
      analysisState.analysis.id,
      messages,
      (chunk) => {
        appendChunk(chunk);
      },
      () => {
        stopTypewriter();
        messages = [
          ...messages,
          { role: 'assistant', content: streamingText, timestamp: Date.now() },
        ];
        streamingText = '';
        streaming = false;
        chatPhase = 'idle';
        scrollToBottom();
      },
      (error) => {
        stopTypewriter();
        toastState.show(`Chat-feil: ${error}`, 'error');
        streaming = false;
        streamingText = '';
        chatPhase = 'idle';
      },
      (phase) => {
        chatPhase = phase as ChatPhase;
      }
    );
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function openDrawer() {
    drawerState = 'half';
  }

  function toggleSize() {
    drawerState = drawerState === 'half' ? 'full' : 'half';
  }

  function closeDrawer() {
    drawerState = 'closed';
    stopTypewriter();
    if (abortController) {
      abortController.abort();
      abortController = null;
      streaming = false;
      streamingText = '';
      chatPhase = 'idle';
    }
  }

  /** Parse markdown + {ref:...} references into HTML.
   *  Assumes input is a single paragraph (no \n\n) — parseBlocks splits upstream. */
  function parseRefs(text: string): string {
    // Escape HTML first
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Headings (### before ##)
    s = s.replace(/^###\s+(.+)$/gm, '<span class="msg-h3">$1</span>');
    s = s.replace(/^##\s+(.+)$/gm, '<span class="msg-h2">$1</span>');
    // Bold (before italic)
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic (single * not part of **)
    s = s.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    // Line breaks (single newline within block)
    s = s.replace(/\n/g, '<br>');
    // References
    const escAttr = (v: string) => v.replace(/"/g, '&quot;');
    s = s.replace(/\{ref:(\w+):([^:}]+)(?::([^}]+))?\}/g, (_match, type, id, paragraph) => {
      const label = paragraph ? `${id} ${paragraph}` : id;
      const nodeId = escAttr(`${type}:${id}`);
      return `<button class="ref-link ref-${escAttr(type)}" data-node-id="${nodeId}">${label}</button>`;
    });
    return s;
  }

  function handleRefClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('ref-link')) {
      const nodeId = target.dataset.nodeId;
      if (nodeId) {
        uiState.navigateTo(nodeId);
      }
    }
  }

  /** Split assistant content into blocks (text and challenge) */
  function parseBlocks(content: string): { type: 'text' | 'challenge'; content: string }[] {
    const blocks: { type: 'text' | 'challenge'; content: string }[] = [];
    const paragraphs = content.split('\n\n');

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (
        trimmed.startsWith('**Mulig motargument:**') ||
        trimmed.startsWith('**Mulige motargumenter:**')
      ) {
        blocks.push({ type: 'challenge', content: trimmed });
      } else {
        blocks.push({ type: 'text', content: trimmed });
      }
    }
    return blocks;
  }
</script>

{#snippet assistantBlocks(content: string)}
  {#each parseBlocks(content) as block}
    {#if block.type === 'challenge'}
      <div class="challenge-block">
        <div class="challenge-label">Mulige motargumenter</div>
        <p class="challenge-text">
          {@html parseRefs(block.content.replace(/^\*\*Mulige? motargumenter?:\*\*\s*/, ''))}
        </p>
      </div>
    {:else}
      <p class="msg-text">{@html parseRefs(block.content)}</p>
    {/if}
  {/each}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
{#if drawerState === 'closed'}
  <div class="drawer-closed" onclick={openDrawer} role="button" tabindex="0">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <span class="drawer-label">Sparring</span>
    <span class="ai-dot"></span>
  </div>
{:else}
  <div class="drawer-open" class:drawer-full={drawerState === 'full'}>
    <!-- Header -->
    <div class="drawer-header">
      <div class="drawer-drag-handle"></div>
      <div class="header-left">
        <span class="header-title">Sparring</span>
        <span class="ai-badge">AI</span>
      </div>
      <div class="header-right">
        <button
          class="header-btn"
          onclick={toggleSize}
          title={drawerState === 'half' ? 'Utvid' : 'Halv'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {#if drawerState === 'half'}
              <line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" stroke-width="1.2" />
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2" />
              <line x1="2" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" />
            {:else}
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5" />
              <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" stroke-width="1.5" />
            {/if}
          </svg>
        </button>
        <button class="header-btn close" onclick={closeDrawer} aria-label="Lukk chat">×</button>
      </div>
    </div>

    <!-- Messages -->
    <div class="messages" bind:this={messagesEl} role="log">
      {#if messages.length === 0 && !streaming && historyLoaded}
        <div class="empty-chat">
          <div class="empty-chat-title">Still et spørsmål om rettskildebildet</div>
          <div class="empty-chat-desc">
            Diskuter spenninger, test argumenter, eller be om hjelp til å forstå sammenhenger mellom
            sakene.
          </div>
        </div>
      {/if}

      {#each messages as msg}
        {#if msg.role === 'user'}
          <div class="msg-user">
            <span class="msg-label msg-label-user">Du</span>
            <div class="msg-user-bubble">{msg.content}</div>
            {#if msg.timestamp}
              <span class="msg-timestamp msg-timestamp-right">{formatTime(msg.timestamp)}</span>
            {/if}
          </div>
        {:else}
          <div class="msg-assistant">
            <span class="msg-label msg-label-assistant">Claude</span>
            {@render assistantBlocks(msg.content)}
            {#if msg.timestamp}
              <span class="msg-timestamp">{formatTime(msg.timestamp)}</span>
            {/if}
          </div>
        {/if}
      {/each}

      {#if streaming && chatPhase === 'loading_context'}
        <div class="msg-status">
          <span class="status-spinner"></span>
          <span class="status-text">Laster analysekontekst…</span>
        </div>
      {:else if streaming && streamingText}
        <div class="msg-assistant">
          <span class="msg-label msg-label-assistant">Claude</span>
          {@render assistantBlocks(streamingText)}
          <span class="streaming-cursor"></span>
        </div>
      {:else if streaming}
        <div class="msg-assistant">
          <span class="msg-label msg-label-assistant">Claude</span>
          <span class="streaming-spinner"></span>
        </div>
      {/if}

      <div bind:this={messagesEndEl}></div>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <textarea
        bind:this={textareaEl}
        bind:value={inputText}
        oninput={autoResize}
        onkeydown={handleKeyDown}
        placeholder="Still et spørsmål om rettskildebildet…"
        rows="1"
        disabled={streaming}
      ></textarea>
      <button
        class="send-btn"
        class:active={hasInput}
        onclick={sendMessage}
        disabled={!hasInput || streaming}
        aria-label="Send melding"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 13L13 8L3 3V7L9 8L3 9V13Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  /* Closed state */
  .drawer-closed {
    height: 40px;
    border-top: 1px solid var(--p-border);
    background: var(--p-panel);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    color: var(--p-ink3);
    transition: background 0.12s ease;
    flex-shrink: 0;
  }
  @media (hover: hover) {
    .drawer-closed:hover {
      background: var(--p-surface);
    }
  }
  .drawer-label {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
  }
  .ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--p-kofa-accent);
    opacity: 0.6;
  }

  /* Open state */
  .drawer-open {
    height: 45%;
    border-top: 1px solid var(--p-border-m, rgba(26, 24, 20, 0.13));
    background: var(--p-panel);
    display: flex;
    flex-direction: column;
    transition:
      height 0.25s ease,
      flex 0.25s ease;
    flex-shrink: 0;
    min-height: 200px;
  }
  .drawer-full {
    height: 100%;
    flex-shrink: 1;
  }

  /* Header */
  .drawer-header {
    padding: 8px 16px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--p-border);
    flex-shrink: 0;
    position: relative;
  }
  .drawer-drag-handle {
    width: 32px;
    height: 3px;
    border-radius: 2px;
    background: var(--p-border-s, rgba(26, 24, 20, 0.22));
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 3px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink2);
    letter-spacing: 0.06em;
  }
  .ai-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-badge);
    background: var(--p-highlight, #fbf5e8);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-kofa-accent);
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .header-btn {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-md);
    border: 1px solid var(--p-border);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-ink3);
  }
  @media (hover: hover) {
    .header-btn:hover {
      background: var(--p-hover);
    }
  }
  .header-btn.close {
    border: none;
    color: var(--p-ink4);
    font-size: 15px;
  }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    min-height: 0;
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 16px;
    gap: 8px;
  }
  .empty-chat-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .empty-chat-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.55;
    max-width: 360px;
  }

  /* Message labels */
  .msg-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .msg-label-user {
    text-align: right;
    color: var(--p-ink3);
  }
  .msg-label-assistant {
    color: var(--p-kofa-accent);
  }

  /* Timestamps */
  .msg-timestamp {
    display: block;
    font-size: 11px;
    font-family: var(--font-data);
    color: var(--p-ink4);
    margin-top: 4px;
  }
  .msg-timestamp-right {
    text-align: right;
  }

  /* User message */
  .msg-user {
    margin-bottom: 20px;
  }
  .msg-user-bubble {
    max-width: 85%;
    margin-left: auto;
    padding: 12px 16px;
    border-radius: 14px 14px 4px 14px;
    background: var(--p-ink);
    color: var(--p-bg);
    font-size: 14px;
    line-height: 1.6;
    letter-spacing: -0.01em;
  }

  /* Assistant message — AI-generated */
  .msg-assistant {
    margin-bottom: 20px;
    max-width: 90%;
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
    padding: 12px 16px;
    border-radius: var(--radius-md);
  }
  .msg-text {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.65;
    color: var(--p-ink);
    letter-spacing: -0.01em;
  }
  /* Markdown headings in assistant messages */
  :global(.msg-h2) {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--p-ink);
    margin-bottom: 4px;
  }
  :global(.msg-h3) {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--p-ink2);
    margin-bottom: 2px;
  }

  /* Status message (context loading) */
  .msg-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    background: var(--p-highlight, #fbf5e8);
    border: 1px solid var(--p-ai-border-subtle);
  }
  .status-spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--p-ai-border-subtle);
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  .status-text {
    font-size: 12px;
    color: var(--p-ink3);
    font-style: italic;
  }

  /* Challenge block */
  .challenge-block {
    margin: 12px 0 8px;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    border-left: 3px solid var(--p-ai-border-subtle);
    background: var(--p-ai-bg);
  }
  .challenge-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--p-ai-text);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .challenge-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--p-ink2);
  }

  /* Reference links */
  :global(.ref-link) {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-weight: 600;
    font-size: 0.92em;
    padding-bottom: 1px;
    border-bottom: 1px solid transparent;
    transition: border-color 0.15s ease;
  }
  @media (hover: hover) {
    :global(.ref-link:hover) {
      border-bottom-style: solid;
    }
  }
  :global(.ref-kofa) {
    color: var(--p-kofa-accent);
  }
  @media (hover: hover) {
    :global(.ref-kofa:hover) {
      border-bottom-color: var(--p-kofa-accent);
    }
  }
  :global(.ref-eu) {
    color: var(--p-eu-accent);
  }
  @media (hover: hover) {
    :global(.ref-eu:hover) {
      border-bottom-color: var(--p-eu-accent);
    }
  }
  :global(.ref-provision) {
    color: var(--p-provision-accent);
  }
  @media (hover: hover) {
    :global(.ref-provision:hover) {
      border-bottom-color: var(--p-provision-accent);
    }
  }

  /* Streaming */
  .streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: var(--p-kofa-accent);
    animation: blink 1s step-end infinite;
    vertical-align: text-bottom;
    margin-left: 2px;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m, rgba(26, 24, 20, 0.13));
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Input area — flat, single border, aligned */
  .chat-input-area {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .chat-input-area textarea {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    line-height: 1.5;
    color: var(--p-ink);
    resize: none;
    font-family: var(--font-ui);
    padding: 4px 0;
    max-height: 120px;
  }
  .chat-input-area textarea::placeholder {
    color: var(--p-ink4);
  }
  .send-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--p-ink4);
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
    margin-bottom: 2px;
  }
  .send-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
    cursor: pointer;
  }
  @media (hover: hover) {
    .send-btn.active:hover {
      opacity: 0.85;
    }
  }
  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .drawer-open {
      height: 55%;
      min-height: 180px;
    }
    .messages {
      padding: 12px;
    }
    .empty-chat-desc {
      max-width: 100%;
    }
    .chat-input-area {
      padding: 8px 12px;
    }
    .chat-input-area textarea {
      font-size: 16px; /* prevents iOS zoom on focus */
    }
  }
</style>
